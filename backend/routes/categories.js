const express = require("express");
const { pool } = require("../models/db");
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query(`
      SELECT 
        c.id, 
        c.name, 
        c.description,
        COALESCE(c.is_reseller, FALSE) as is_reseller,
        c.created_at,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      GROUP BY c.id, c.name, c.description, c.is_reseller, c.created_at
      ORDER BY c.name ASC
    `);
    connection.release();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server error fetching categories" });
  }
});

router.post("/", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { name, description, is_reseller } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: "Nama kategori tidak boleh kosong" });
    }

    const connection = await pool.getConnection();
    
    const [existing] = await connection.query(
      "SELECT id FROM categories WHERE name = ?", 
      [name]
    );
    
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: "Nama kategori sudah ada" });
    }
    
    const [result] = await connection.query(
      `INSERT INTO categories (name, description, is_reseller) 
       VALUES (?, ?, ?)`,
      [name, description || null, is_reseller || false]
    );
    
    connection.release();
    res.status(201).json({ 
      message: "Kategori berhasil ditambahkan", 
      id: result.insertId 
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Server error creating category" });
  }
});

router.put("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, is_reseller } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: "Nama kategori tidak boleh kosong" });
    }

    const connection = await pool.getConnection();
    
    const [existing] = await connection.query(
      "SELECT id FROM categories WHERE id = ?", 
      [categoryId]
    );
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    
    const [nameConflict] = await connection.query(
      "SELECT id FROM categories WHERE name = ? AND id != ?", 
      [name, categoryId]
    );
    
    if (nameConflict.length > 0) {
      connection.release();
      return res.status(400).json({ message: "Nama kategori sudah ada" });
    }
    
    await connection.query(
      `UPDATE categories 
       SET name = ?, description = ?, is_reseller = ?
       WHERE id = ?`,
      [name, description || null, is_reseller || false, categoryId]
    );
    
    connection.release();
    res.json({ message: "Kategori berhasil diperbarui" });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Server error updating category" });
  }
});

router.delete("/:id", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const connection = await pool.getConnection();
    
    const [existing] = await connection.query(
      "SELECT id FROM categories WHERE id = ?", 
      [categoryId]
    );
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    
    const [products] = await connection.query(
      "SELECT id FROM products WHERE category_id = ?", 
      [categoryId]
    );
    
    if (products.length > 0) {
      connection.release();
      return res.status(400).json({ 
        message: "Kategori tidak dapat dihapus karena masih digunakan oleh produk" 
      });
    }
    
    await connection.query("DELETE FROM categories WHERE id = ?", [categoryId]);
    connection.release();
    
    res.json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Server error deleting category" });
  }
});

module.exports = router;
