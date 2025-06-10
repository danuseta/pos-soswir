const express = require("express");
const multer = require("multer");
const bcrypt = require("bcrypt");
const cloudinary = require("../config/cloudinary");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post("/upload-image", authenticateToken, authorizeRole(["superadmin"]), upload.single('image'), async (req, res) => {
  try {
    console.log("Upload image request received");
    
    if (!req.file) {
      console.log("No file found in request");
      return res.status(400).json({ message: "No image file provided" });
    }
    
    console.log(`File received: ${req.file.originalname}, size: ${req.file.size} bytes`);

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "pos_products",
          transformation: [
            { width: 400, height: 400, crop: "fill" },
            { quality: "auto" }
          ]
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            console.log("Cloudinary upload success:", result.public_id);
            resolve(result);
          }
        }
      ).end(req.file.buffer);
    });

    res.json({ 
      imageUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Error uploading image", error: error.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { active_only } = req.query;
    
    const connection = await pool.getConnection();
    
    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.cloudinary_public_id,
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
    
    if (active_only === 'true') {
      query += " WHERE p.is_active = 1";
    }
    
    query += " ORDER BY p.created_at DESC";
    
    const [products] = await connection.query(query);
    
    const formattedProducts = products.map(product => ({
      ...product,
      price: parseFloat(product.price),
      tax_percentage: parseFloat(product.tax_percentage || 0),
      category: product.category_name || 'Uncategorized'
    }));
    
    connection.release();
    res.json(formattedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server error fetching products" });
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
      public_id
    } = req.body;

    if (!name || !price || stock === undefined || !category_id) {
      return res.status(400).json({ message: "Data produk tidak lengkap" });
    }

    const connection = await pool.getConnection();
    
    const [categoryRows] = await connection.query("SELECT is_reseller FROM categories WHERE id = ?", [category_id]);
    
    if (categoryRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    
    if (categoryRows[0].is_reseller) {
      if (!supplier_id || !tax_percentage || tax_percentage <= 0) {
        connection.release();
        return res.status(400).json({ message: "Produk PUBJ harus memiliki supplier dan persentase fee yang valid" });
      }
      
      const [supplierRows] = await connection.query("SELECT id FROM suppliers WHERE id = ? AND is_active = 1", [supplier_id]);
      if (supplierRows.length === 0) {
        connection.release();
        return res.status(404).json({ message: "Supplier tidak ditemukan atau tidak aktif" });
      }
    }
    
    const [result] = await connection.query(
      `INSERT INTO products (name, description, price, stock, category_id, supplier_id, tax_percentage, tax_description, image_url, cloudinary_public_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, price, stock, category_id, supplier_id, tax_percentage || 0, tax_description, image_url, public_id]
    );
    
    connection.release();
    res.status(201).json({ 
      message: "Produk berhasil ditambahkan", 
      id: result.insertId 
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Server error creating product" });
  }
});

router.put("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const productId = req.params.id;
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
      public_id
    } = req.body;

    if (!name || !price || stock === undefined || !category_id) {
      return res.status(400).json({ message: "Data produk tidak lengkap" });
    }

    const connection = await pool.getConnection();

    const [categoryRows] = await connection.query("SELECT is_reseller FROM categories WHERE id = ?", [category_id]);
    
    if (categoryRows.length > 0 && categoryRows[0].is_reseller) {
      if (!supplier_id || !tax_percentage || tax_percentage <= 0) {
        connection.release();
        return res.status(400).json({ message: "Produk PUBJ harus memiliki supplier dan persentase fee yang valid" });
      }
    }

    const [result] = await connection.query(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, supplier_id = ?,
           tax_percentage = ?, tax_description = ?, 
           image_url = ?, cloudinary_public_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, description, price, stock, category_id, supplier_id, tax_percentage || 0, tax_description, image_url, public_id, productId]
    );
    
    connection.release();
    res.json({ message: "Produk berhasil diperbarui" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error updating product" });
  }
});

router.patch("/:id/toggle-active", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    const [product] = await connection.query("SELECT name, is_active FROM products WHERE id = ?", [id]);
    
    if (product.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }
    
    const currentStatus = product[0].is_active;
    const newStatus = currentStatus ? 0 : 1;
    const statusText = newStatus ? 'diaktifkan' : 'dinonaktifkan';
    
    const [result] = await connection.query(
      "UPDATE products SET is_active = ?, updated_at = NOW() WHERE id = ?",
      [newStatus, id]
    );
    
    connection.release();
    
    res.json({ 
      message: `Produk "${product[0].name}" berhasil ${statusText}`,
      is_active: newStatus === 1
    });
  } catch (error) {
    console.error("Error toggling product status:", error);
    res.status(500).json({ message: "Server error saat mengubah status produk" });
  }
});

router.delete("/:id/hard-delete", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { password, confirmation } = req.body;
  
  try {
    if (!password) {
      return res.status(400).json({ message: "Password wajib diisi untuk konfirmasi penghapusan" });
    }

    const connection = await pool.getConnection();
    
    const userId = req.user.id;
    const [userRows] = await connection.query("SELECT password, username FROM users WHERE id = ? AND role = 'superadmin'", [userId]);
    
    if (userRows.length === 0) {
      connection.release();
      return res.status(403).json({ message: "Akses ditolak. Hanya superadmin yang dapat menghapus produk secara permanen" });
    }
    
    const isPasswordValid = await bcrypt.compare(password, userRows[0].password);
    if (!isPasswordValid) {
      connection.release();
      return res.status(401).json({ message: "Password tidak valid. Penghapusan dibatalkan untuk keamanan" });
    }
    
    const [product] = await connection.query("SELECT * FROM products WHERE id = ?", [id]);
    
    if (product.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    const productData = product[0];
    
    console.log(`[AUDIT] Hard delete attempt by user ${userRows[0].username} (ID: ${userId}) for product "${productData.name}" (ID: ${id})`);
    
    try {
      await connection.beginTransaction();
      
      await connection.query(
        "UPDATE sale_items SET product_id = NULL WHERE product_id = ?", 
        [id]
      );
      
      await connection.query(
        "UPDATE transaction_logs SET product_id = NULL WHERE product_id = ?", 
        [id]
      );
      
      await connection.query(
        "UPDATE sale_taxes SET product_id = NULL WHERE product_id = ?", 
        [id]
      );
      
      await connection.query(
        "UPDATE daily_stock_entries SET product_id = NULL WHERE product_id = ?", 
        [id]
      );
      
      const [deleteResult] = await connection.query("DELETE FROM products WHERE id = ?", [id]);
      
      await connection.commit();
      
      if (productData.cloudinary_public_id) {
        try {
          await cloudinary.uploader.destroy(productData.cloudinary_public_id);
          console.log(`[AUDIT] Deleted image: ${productData.cloudinary_public_id}`);
        } catch (cloudinaryError) {
          console.error("Error deleting image from Cloudinary:", cloudinaryError);
        }
      }
      
      console.log(`[AUDIT] Successfully hard deleted product "${productData.name}" (ID: ${id}) by ${userRows[0].username}`);
      
      connection.release();
      
      res.json({ 
        message: `Produk "${productData.name}" berhasil dihapus secara permanen`,
        deleted: true,
        audit: {
          deleted_by: userRows[0].username,
          deleted_at: new Date().toISOString(),
          product_name: productData.name,
          product_id: id
        }
      });
      
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
    
  } catch (error) {
    console.error("Error hard deleting product:", error);
    res.status(500).json({ 
      message: "Server error saat menghapus produk secara permanen", 
      error: error.message 
    });
  }
});

router.delete("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    
    const [product] = await connection.query("SELECT cloudinary_public_id, name FROM products WHERE id = ?", [id]);
    
    if (product.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }
    
    const [saleReferences] = await connection.query(
      "SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?", 
      [id]
    );
    
    const [dailyStockReferences] = await connection.query(
      "SELECT COUNT(*) as count FROM daily_stock_entries WHERE product_id = ?",
      [id]
    );
    
    const [transactionReferences] = await connection.query(
      "SELECT COUNT(*) as count FROM transaction_logs WHERE product_id = ?",
      [id]
    );
    
    const totalReferences = saleReferences[0].count + dailyStockReferences[0].count + transactionReferences[0].count;
    
    if (totalReferences > 0) {
      connection.release();
      return res.status(400).json({ 
        message: `Tidak dapat menghapus produk "${product[0].name}" karena masih memiliki riwayat transaksi atau stok harian. Total referensi: ${totalReferences}`,
        details: {
          sales: saleReferences[0].count,
          dailyStock: dailyStockReferences[0].count, 
          transactions: transactionReferences[0].count
        },
        suggestion: "Gunakan fitur 'Nonaktifkan' atau 'Hapus Permanen' dengan konfirmasi password untuk menghapus produk yang memiliki riwayat."
      });
    }
    
    const [result] = await connection.query("DELETE FROM products WHERE id = ?", [id]);
    
    if (product[0].cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(product[0].cloudinary_public_id);
        console.log(`Deleted image: ${product[0].cloudinary_public_id}`);
      } catch (cloudinaryError) {
        console.error("Error deleting image from Cloudinary:", cloudinaryError);
      }
    }
    
    connection.release();
    res.json({ 
      message: `Produk "${product[0].name}" berhasil dihapus`,
      deleted: true
    });
    
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ 
      message: "Server error saat menghapus produk", 
      error: error.message 
    });
  }
});

module.exports = router;
