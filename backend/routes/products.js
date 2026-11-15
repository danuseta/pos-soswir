const express = require("express");
const bcrypt = require("bcryptjs");
const { pool, query, withTransaction } = require("../models/db");
const { HttpError } = require("../utils/httpError");
const { upload, deleteProductImage } = require("../utils/imageStorage");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

function validateProduct(body, { requireStock }) {
  const price = Number(body.price);
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") return "Nama produk wajib diisi";
  if (!Number.isFinite(price) || price <= 0) return "Harga harus angka lebih dari 0";
  if (!body.category_id) return "Kategori wajib dipilih";
  if (requireStock) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) return "Stok harus bilangan bulat 0 atau lebih";
  }
  return null;
}

function sendError(res, error, logMessage, fallbackMessage) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error(logMessage, error);
  res.status(500).json({ message: fallbackMessage });
}

router.post("/upload-image", authenticateToken, authorizeRole(["superadmin"]), (req, res) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      const status = error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 500);
      return res.status(status).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Ukuran gambar maksimal 5MB" : error.message });
    }
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    res.json({ imageUrl: `/uploads/products/${req.file.filename}`, imageFilename: req.file.filename });
  });
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { active_only } = req.query;

    let sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.image_filename,
        p.category_id,
        p.supplier_id,
        p.tax_percentage,
        p.tax_description,
        p.is_active,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        c.is_reseller as category_is_reseller,
        s.name as supplier_name,
        s.phone as supplier_phone
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
    `;

    if (active_only === "true") {
      sql += " WHERE p.is_active = true";
    }

    sql += " ORDER BY p.created_at DESC";

    const products = await query(sql);

    res.json(products.map(product => ({
      ...product,
      price: parseFloat(product.price),
      tax_percentage: parseFloat(product.tax_percentage || 0),
      category: product.category_name || "Uncategorized"
    })));
  } catch (error) {
    sendError(res, error, "Error fetching products:", "Server error fetching products");
  }
});

router.post("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category_id,
      supplier_id,
      tax_percentage,
      tax_description,
      image_url,
      image_filename
    } = req.body;

    const invalid = validateProduct(req.body, { requireStock: true });
    if (invalid) return res.status(400).json({ message: invalid });

    const categoryRows = await query("SELECT is_reseller FROM categories WHERE id = $1", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    if (categoryRows[0].is_reseller) {
      if (!supplier_id || !tax_percentage || tax_percentage <= 0) {
        return res.status(400).json({ message: "Produk PUBJ harus memiliki supplier dan persentase fee yang valid" });
      }

      const supplierRows = await query("SELECT id FROM suppliers WHERE id = $1 AND is_active = true", [supplier_id]);
      if (supplierRows.length === 0) {
        return res.status(404).json({ message: "Supplier tidak ditemukan atau tidak aktif" });
      }
    }

    const [created] = await query(
      `INSERT INTO products (name, description, price, stock, category_id, supplier_id, tax_percentage, tax_description, image_url, image_filename)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [name, description, price, stock, category_id, supplier_id || null, tax_percentage || 0, tax_description, image_url, image_filename]
    );

    res.status(201).json({
      message: "Produk berhasil ditambahkan",
      id: created.id
    });
  } catch (error) {
    sendError(res, error, "Error creating product:", "Server error creating product");
  }
});

router.put("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      name,
      description,
      price,
      category_id,
      supplier_id,
      tax_percentage,
      tax_description,
      image_url,
      image_filename
    } = req.body;

    const invalid = validateProduct(req.body, { requireStock: false });
    if (invalid) return res.status(400).json({ message: invalid });

    const categoryRows = await query("SELECT is_reseller FROM categories WHERE id = $1", [category_id]);
    if (categoryRows.length === 0) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    if (categoryRows[0].is_reseller) {
      if (!supplier_id || !tax_percentage || tax_percentage <= 0) {
        return res.status(400).json({ message: "Produk PUBJ harus memiliki supplier dan persentase fee yang valid" });
      }
    }

    const existing = await query("SELECT image_filename FROM products WHERE id = $1", [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    const updated = await query(
      `UPDATE products
       SET name = $1, description = $2, price = $3, category_id = $4, supplier_id = $5,
           tax_percentage = $6, tax_description = $7,
           image_url = $8, image_filename = $9, updated_at = now()
       WHERE id = $10
       RETURNING id`,
      [name, description, price, category_id, supplier_id || null, tax_percentage || 0, tax_description, image_url, image_filename, productId]
    );
    if (updated.length === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    if (existing[0].image_filename && existing[0].image_filename !== image_filename) {
      await deleteProductImage(existing[0].image_filename);
    }

    res.json({ message: "Produk berhasil diperbarui" });
  } catch (error) {
    sendError(res, error, "Error updating product:", "Server error updating product");
  }
});

router.patch("/:id/add-stock", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "Jumlah stok tambahan harus berupa bilangan bulat lebih dari 0" });
  }

  try {
    const products = await query(
      `SELECT p.name, p.stock, c.is_reseller
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    if (products[0].is_reseller) {
      return res.status(400).json({ message: "Stok produk PUBJ hanya dapat ditambahkan melalui Stok Harian PUBJ" });
    }

    const [updatedProduct] = await query(
      "UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2 RETURNING stock",
      [quantity, req.params.id]
    );

    res.json({
      message: `Stok produk "${products[0].name}" berhasil ditambah ${quantity}`,
      added_stock: quantity,
      stock: Number(updatedProduct.stock)
    });
  } catch (error) {
    sendError(res, error, "Error adding product stock:", "Server error saat menambah stok produk");
  }
});

router.options("/:id/toggle-active", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.patch("/:id/toggle-active", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const [product] = await query(
      "UPDATE products SET is_active = NOT is_active, updated_at = now() WHERE id = $1 RETURNING name, is_active",
      [req.params.id]
    );

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    res.json({
      message: `Produk "${product.name}" berhasil ${product.is_active ? "diaktifkan" : "dinonaktifkan"}`,
      is_active: product.is_active
    });
  } catch (error) {
    sendError(res, error, "Error toggling product status:", "Server error saat mengubah status produk");
  }
});

router.delete("/:id/hard-delete", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ message: "Password wajib diisi untuk konfirmasi penghapusan" });
    }

    const userId = req.user.id;
    const userRows = await query("SELECT password, username FROM users WHERE id = $1 AND role = 'superadmin'", [userId]);

    if (userRows.length === 0) {
      return res.status(403).json({ message: "Akses ditolak. Hanya superadmin yang dapat menghapus produk secara permanen" });
    }

    const isPasswordValid = await bcrypt.compare(password, userRows[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password tidak valid. Penghapusan dibatalkan untuk keamanan" });
    }

    console.log(`[AUDIT] Hard delete attempt by user ${userRows[0].username} (ID: ${userId}) for product ID: ${id}`);

    const product = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [id]);
      if (!row) throw new HttpError(404, "Produk tidak ditemukan");
      await client.query("DELETE FROM products WHERE id = $1", [id]);
      return row;
    });
    await deleteProductImage(product.image_filename);

    console.log(`[AUDIT] Successfully hard deleted product "${product.name}" (ID: ${id}) by ${userRows[0].username}`);

    res.json({
      message: `Produk "${product.name}" berhasil dihapus secara permanen`,
      deleted: true,
      audit: {
        deleted_by: userRows[0].username,
        deleted_at: new Date().toISOString(),
        product_name: product.name,
        product_id: id
      }
    });
  } catch (error) {
    sendError(res, error, "Error hard deleting product:", "Server error saat menghapus produk secara permanen");
  }
});

router.delete("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const [product] = await query("SELECT image_filename, name FROM products WHERE id = $1", [id]);

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    const [refs] = await query(
      `SELECT
        (SELECT COUNT(*) FROM sale_items WHERE product_id = $1) AS sales,
        (SELECT COUNT(*) FROM daily_stock_entries WHERE product_id = $1) AS daily_stock,
        (SELECT COUNT(*) FROM transaction_logs WHERE product_id = $1) AS transactions`,
      [id]
    );

    const totalReferences = refs.sales + refs.daily_stock + refs.transactions;

    if (totalReferences > 0) {
      return res.status(400).json({
        message: `Tidak dapat menghapus produk "${product.name}" karena masih memiliki riwayat transaksi atau stok harian. Total referensi: ${totalReferences}`,
        details: {
          sales: refs.sales,
          dailyStock: refs.daily_stock,
          transactions: refs.transactions
        },
        suggestion: "Gunakan fitur 'Nonaktifkan' atau 'Hapus Permanen' dengan konfirmasi password untuk menghapus produk yang memiliki riwayat."
      });
    }

    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    await deleteProductImage(product.image_filename);

    res.json({
      message: `Produk "${product.name}" berhasil dihapus`,
      deleted: true
    });
  } catch (error) {
    sendError(res, error, "Error deleting product:", "Server error saat menghapus produk");
  }
});

module.exports = router;
