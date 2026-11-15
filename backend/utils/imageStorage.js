const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${EXTENSIONS[file.mimetype]}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) return cb(null, true);
    const error = new Error("Format gambar harus JPG, PNG, atau WEBP");
    error.status = 400;
    cb(error);
  }
});

async function deleteProductImage(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(filename)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Gagal hapus gambar produk:", error);
  }
}

module.exports = { UPLOAD_DIR, upload, deleteProductImage };
