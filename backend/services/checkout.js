const { HttpError } = require("../utils/httpError");
const { refreshPubjStock } = require("./dailyStock");

const round2 = (value) => Math.round(value * 100) / 100;

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "Keranjang kosong";
  for (const item of items) {
    if (!item || !Number.isInteger(item.product_id) || item.product_id <= 0) return "Produk tidak valid";
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return "Jumlah barang harus bilangan bulat lebih dari 0";
  }
  return null;
}

function mergeItems(items) {
  const totals = new Map();
  for (const item of items) {
    totals.set(item.product_id, (totals.get(item.product_id) || 0) + item.quantity);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([product_id, quantity]) => ({ product_id, quantity }));
}

async function lockProduct(client, productId) {
  const { rows } = await client.query(
    `SELECT p.id, p.name, p.price, p.stock, p.is_active, p.category_id,
            c.name AS category_name, COALESCE(c.is_reseller, false) AS is_reseller
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1
     FOR UPDATE OF p`,
    [productId]
  );
  if (rows.length === 0) throw new HttpError(404, `Produk ${productId} tidak ditemukan`);
  return rows[0];
}

async function takeShopStock(client, product, quantity) {
  if (product.stock < quantity) {
    throw new HttpError(400, `Stok ${product.name} tidak mencukupi. Tersedia: ${product.stock}`);
  }
  await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [quantity, product.id]);
  return { entryId: null, fee: null };
}

async function takePubjStock(client, product, quantity, gross) {
  const { rows } = await client.query(
    `SELECT id, quantity_in, quantity_sold, tax_percentage
     FROM daily_stock_entries
     WHERE product_id = $1 AND entry_date = current_date AND status = 'active'
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE`,
    [product.id]
  );
  const entry = rows[0];
  if (!entry) throw new HttpError(400, `Produk PUBJ ${product.name} belum ada stok hari ini`);

  const available = entry.quantity_in - entry.quantity_sold;
  if (available < quantity) {
    throw new HttpError(400, `Stok ${product.name} tidak mencukupi. Tersedia: ${available}`);
  }

  const percentage = Number(entry.tax_percentage);
  const storeFee = round2(gross * (percentage / 100));
  const supplierEarning = round2(gross - storeFee);

  await client.query(
    `UPDATE daily_stock_entries
     SET quantity_sold = quantity_sold + $1,
         quantity_returned = quantity_in - (quantity_sold + $1),
         total_revenue = total_revenue + $2,
         store_fee = store_fee + $3,
         supplier_earning = supplier_earning + $4,
         status = CASE WHEN quantity_sold + $1 = quantity_in THEN 'completed' ELSE 'active' END
     WHERE id = $5`,
    [quantity, gross, storeFee, supplierEarning, entry.id]
  );
  await refreshPubjStock(client, product.id);

  return { entryId: entry.id, fee: { percentage, storeFee, supplierEarning } };
}

async function createSale(client, { items, customerName, paymentMethod, user }) {
  const lines = [];
  for (const item of mergeItems(items)) {
    const product = await lockProduct(client, item.product_id);
    if (!product.is_active) throw new HttpError(400, `Produk ${product.name} sedang nonaktif`);

    const price = Number(product.price);
    const gross = round2(price * item.quantity);
    const taken = product.is_reseller
      ? await takePubjStock(client, product, item.quantity, gross)
      : await takeShopStock(client, product, item.quantity);

    lines.push({ product, quantity: item.quantity, price, gross, ...taken });
  }

  const total = round2(lines.reduce((sum, line) => sum + line.gross, 0));
  const { rows: [sale] } = await client.query(
    "INSERT INTO sales (user_id, customer_name, total_amount, payment_method) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.id, customerName, total, paymentMethod]
  );

  for (const line of lines) {
    const { rows: [saleItem] } = await client.query(
      "INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, daily_stock_entry_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [sale.id, line.product.id, line.quantity, line.price, line.entryId]
    );

    if (line.fee) {
      await client.query(
        `INSERT INTO sale_taxes (
           sale_id, category_id, category_name, gross_amount, tax_percentage, tax_amount, net_amount,
           store_profit, supplier_amount, quantity, price_per_item, product_id, product_name, daily_stock_entry_id, sale_item_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          sale.id, line.product.category_id, line.product.category_name, line.gross, line.fee.percentage,
          line.fee.storeFee, line.fee.supplierEarning, line.quantity, line.price, line.product.id,
          line.product.name, line.entryId, saleItem.id
        ]
      );
    }

    await client.query(
      `INSERT INTO transaction_logs (sale_id, user_id, username, product_id, product_name, quantity, price, total, daily_stock_entry_id, sale_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [sale.id, user.id, user.username, line.product.id, line.product.name, line.quantity, line.price, line.gross, line.entryId, saleItem.id]
    );
  }

  return { id: sale.id, total };
}

module.exports = { validateItems, mergeItems, createSale };
