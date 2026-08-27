require('dotenv').config();

const mysql = require('mysql2/promise');

const categories = [
  { name: 'Makanan', description: 'Menu makanan siap saji', isReseller: 0 },
  { name: 'Minuman', description: 'Minuman dingin dan hangat', isReseller: 0 },
  { name: 'PUBJ', description: 'Produk usaha binaan dan jajanan titipan', isReseller: 1 }
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

async function findOrCreateCategory(connection, category) {
  const [rows] = await connection.query(
    'SELECT id FROM categories WHERE name = ? LIMIT 1',
    [category.name]
  );

  if (rows.length > 0) {
    await connection.query(
      'UPDATE categories SET description = ?, is_reseller = ? WHERE id = ?',
      [category.description, category.isReseller, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    'INSERT INTO categories (name, description, is_reseller) VALUES (?, ?, ?)',
    [category.name, category.description, category.isReseller]
  );
  return result.insertId;
}

async function findOrCreateSupplier(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM suppliers WHERE name = ? LIMIT 1',
    [name]
  );

  if (rows.length > 0) {
    await connection.query('UPDATE suppliers SET is_active = 1 WHERE id = ?', [rows[0].id]);
    return rows[0].id;
  }

  const [result] = await connection.query(
    'INSERT INTO suppliers (name, is_active) VALUES (?, 1)',
    [name]
  );
  return result.insertId;
}

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    const categoryIds = {};
    for (const category of categories) {
      categoryIds[category.name] = await findOrCreateCategory(connection, category);
    }

    const supplierId = await findOrCreateSupplier(connection, 'Mitra UMKM Soswir');
    let inserted = 0;
    let updated = 0;
    let dailyStockInserted = 0;
    let dailyStockExisting = 0;

    for (const product of products) {
      const [rows] = await connection.query(
        'SELECT id FROM products WHERE name = ? LIMIT 1',
        [product.name]
      );
      const values = [
        product.description,
        product.price,
        product.stock,
        categoryIds[product.category],
        product.supplier ? supplierId : null,
        product.fee || 0,
        product.fee ? 'Fee penjualan produk titipan' : null,
        product.supplier || null
      ];

      let productId;

      if (rows.length > 0) {
        await connection.query(
          `UPDATE products
           SET description = ?, price = ?, stock = ?, category_id = ?, supplier_id = ?,
               tax_percentage = ?, tax_description = ?, supplier_name = ?, is_active = 1
           WHERE id = ?`,
          [...values, rows[0].id]
        );
        productId = rows[0].id;
        updated += 1;
      } else {
        const [result] = await connection.query(
          `INSERT INTO products
             (name, description, price, stock, category_id, supplier_id,
              tax_percentage, tax_description, supplier_name, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [product.name, ...values]
        );
        productId = result.insertId;
        inserted += 1;
      }

      if (product.supplier) {
        const [dailyRows] = await connection.query(
          `SELECT id
           FROM daily_stock_entries
           WHERE product_id = ? AND supplier_id = ? AND entry_date = CURDATE()
           LIMIT 1`,
          [productId, supplierId]
        );

        if (dailyRows.length === 0) {
          await connection.query(
            `INSERT INTO daily_stock_entries
               (product_id, supplier_id, entry_date, quantity_in,
                tax_percentage, price_per_unit, notes, status)
             VALUES (?, ?, CURDATE(), ?, ?, ?, ?, 'active')`,
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

        const [stockRows] = await connection.query(
          `SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) AS available_stock
           FROM daily_stock_entries
           WHERE product_id = ? AND status = 'active'`,
          [productId]
        );
        await connection.query(
          'UPDATE products SET stock = ? WHERE id = ?',
          [Number(stockRows[0].available_stock), productId]
        );
      }
    }

    await connection.commit();

    const [summary] = await connection.query(
      `SELECT c.name AS category, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE c.name IN (?, ?, ?)
       GROUP BY c.id, c.name
       ORDER BY c.id`,
      categories.map((category) => category.name)
    );

    const [pubjStock] = await connection.query(
      `SELECT p.name, dse.quantity_in, dse.quantity_sold,
              dse.quantity_in - dse.quantity_sold AS available_stock,
              dse.status
       FROM daily_stock_entries dse
       JOIN products p ON p.id = dse.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE c.name = 'PUBJ' AND dse.entry_date = CURDATE()
       ORDER BY p.name`
    );

    console.log(JSON.stringify({
      inserted,
      updated,
      dailyStockInserted,
      dailyStockExisting,
      summary,
      pubjStock
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch((error) => {
  console.error('Seeding produk gagal:', error.message);
  process.exitCode = 1;
});
