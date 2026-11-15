require('dotenv').config();

const { pool, withTransaction } = require('../models/db');

const categories = [
  { name: 'Makanan', description: 'Menu makanan siap saji', isReseller: false },
  { name: 'Minuman', description: 'Minuman dingin dan hangat', isReseller: false },
  { name: 'PUBJ', description: 'Produk usaha binaan dan jajanan titipan', isReseller: true }
];

const products = [
  { name: 'Nasi Goreng Spesial', description: 'Nasi goreng dengan telur dan ayam', price: 18000, stock: 30, category: 'Makanan' },
  { name: 'Mie Goreng Telur', description: 'Mie goreng dengan telur', price: 15000, stock: 25, category: 'Makanan' },
  { name: 'Roti Bakar Cokelat', description: 'Roti bakar isi cokelat', price: 12000, stock: 20, category: 'Makanan' },
  { name: 'Es Teh Manis', description: 'Teh manis dingin', price: 5000, stock: 50, category: 'Minuman' },
  { name: 'Kopi Susu', description: 'Kopi susu hangat', price: 10000, stock: 35, category: 'Minuman' },
  { name: 'Air Mineral 600 ml', description: 'Air mineral kemasan', price: 4000, stock: 60, category: 'Minuman' },
  { name: 'Keripik Singkong UMKM', description: 'Keripik singkong titipan mitra', price: 8000, stock: 24, category: 'PUBJ', supplier: 'Mitra UMKM Soswir', fee: 10 },
  { name: 'Brownies Mini UMKM', description: 'Brownies mini titipan mitra', price: 10000, stock: 18, category: 'PUBJ', supplier: 'Mitra UMKM Soswir', fee: 10 },
  { name: 'Risoles Mayo UMKM', description: 'Risoles mayo titipan mitra', price: 6000, stock: 20, category: 'PUBJ', supplier: 'Mitra UMKM Soswir', fee: 10 }
];

async function findOrCreateCategory(client, category) {
  const { rows } = await client.query(
    'SELECT id FROM categories WHERE name = $1 LIMIT 1',
    [category.name]
  );

  if (rows.length > 0) {
    await client.query(
      'UPDATE categories SET description = $1, is_reseller = $2 WHERE id = $3',
      [category.description, category.isReseller, rows[0].id]
    );
    return rows[0].id;
  }

  const result = await client.query(
    'INSERT INTO categories (name, description, is_reseller) VALUES ($1, $2, $3) RETURNING id',
    [category.name, category.description, category.isReseller]
  );
  return result.rows[0].id;
}

async function findOrCreateSupplier(client, name) {
  const { rows } = await client.query(
    'SELECT id FROM suppliers WHERE name = $1 LIMIT 1',
    [name]
  );

  if (rows.length > 0) {
    await client.query('UPDATE suppliers SET is_active = true WHERE id = $1', [rows[0].id]);
    return rows[0].id;
  }

  const result = await client.query(
    'INSERT INTO suppliers (name, is_active) VALUES ($1, true) RETURNING id',
    [name]
  );
  return result.rows[0].id;
}

async function seed() {
  const report = await withTransaction(async (client) => {
    const categoryIds = {};
    for (const category of categories) {
      categoryIds[category.name] = await findOrCreateCategory(client, category);
    }

    const supplierId = await findOrCreateSupplier(client, 'Mitra UMKM Soswir');
    let inserted = 0;
    let updated = 0;
    let dailyStockInserted = 0;
    let dailyStockExisting = 0;

    for (const product of products) {
      const { rows } = await client.query(
        'SELECT id FROM products WHERE name = $1 LIMIT 1',
        [product.name]
      );
      const values = [
        product.description,
        product.price,
        product.stock,
        categoryIds[product.category],
        product.supplier ? supplierId : null,
        product.fee || 0,
        product.fee ? 'Fee penjualan produk titipan' : null
      ];

      let productId;

      if (rows.length > 0) {
        await client.query(
          `UPDATE products
           SET description = $1, price = $2, stock = $3, category_id = $4, supplier_id = $5,
               tax_percentage = $6, tax_description = $7, is_active = true
           WHERE id = $8`,
          [...values, rows[0].id]
        );
        productId = rows[0].id;
        updated += 1;
      } else {
        const result = await client.query(
          `INSERT INTO products
             (description, price, stock, category_id, supplier_id,
              tax_percentage, tax_description, name, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
           RETURNING id`,
          [...values, product.name]
        );
        productId = result.rows[0].id;
        inserted += 1;
      }

      if (product.supplier) {
        const { rows: dailyRows } = await client.query(
          `SELECT id
           FROM daily_stock_entries
           WHERE product_id = $1 AND supplier_id = $2 AND entry_date = current_date
           LIMIT 1`,
          [productId, supplierId]
        );

        if (dailyRows.length === 0) {
          await client.query(
            `INSERT INTO daily_stock_entries
               (product_id, supplier_id, entry_date, quantity_in,
                tax_percentage, price_per_unit, notes, status)
             VALUES ($1, $2, current_date, $3, $4, $5, $6, 'active')`,
            [
              productId,
              supplierId,
              product.stock,
              product.fee,
              product.price,
              'Stok awal dari seeder produk'
            ]
          );
          dailyStockInserted += 1;
        } else {
          dailyStockExisting += 1;
        }

        const { rows: stockRows } = await client.query(
          `SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) AS available_stock
           FROM daily_stock_entries
           WHERE product_id = $1 AND status = 'active'`,
          [productId]
        );
        await client.query(
          'UPDATE products SET stock = $1 WHERE id = $2',
          [Number(stockRows[0].available_stock), productId]
        );
      }
    }

    return { inserted, updated, dailyStockInserted, dailyStockExisting };
  });

  const { rows: summary } = await pool.query(
    `SELECT c.name AS category, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
     WHERE c.name = ANY($1)
     GROUP BY c.id, c.name
     ORDER BY c.id`,
    [categories.map((category) => category.name)]
  );

  const { rows: pubjStock } = await pool.query(
    `SELECT p.name, dse.quantity_in, dse.quantity_sold,
            dse.quantity_in - dse.quantity_sold AS available_stock,
            dse.status
     FROM daily_stock_entries dse
     JOIN products p ON p.id = dse.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE c.name = 'PUBJ' AND dse.entry_date = current_date
     ORDER BY p.name`
  );

  console.log(JSON.stringify({ ...report, summary, pubjStock }, null, 2));
}

seed()
  .catch((error) => {
    console.error('Seeding produk gagal:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
