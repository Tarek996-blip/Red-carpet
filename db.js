const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getAllProducts() {
  return readDB().products;
}

function getProductById(id) {
  return readDB().products.find((p) => p.id === id);
}

function createProduct(product) {
  const db = readDB();
  const newProduct = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...product,
  };
  db.products.unshift(newProduct);
  writeDB(db);
  return newProduct;
}

function updateProduct(id, updates) {
  const db = readDB();
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  db.products[idx] = { ...db.products[idx], ...updates };
  writeDB(db);
  return db.products[idx];
}

function deleteProduct(id) {
  const db = readDB();
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  db.products.splice(idx, 1);
  writeDB(db);
  return true;
}

// -------- Gallery --------
function getGallery() {
  return readDB().gallery || [];
}

function addGalleryImage(image) {
  const db = readDB();
  if (!db.gallery) db.gallery = [];
  const item = { id: Date.now().toString(), image, createdAt: new Date().toISOString() };
  db.gallery.unshift(item);
  writeDB(db);
  return item;
}

function deleteGalleryImage(id) {
  const db = readDB();
  if (!db.gallery) return false;
  const idx = db.gallery.findIndex(g => g.id === id);
  if (idx === -1) return false;
  db.gallery.splice(idx, 1);
  writeDB(db);
  return true;
}

module.exports = {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
  getGallery, addGalleryImage, deleteGalleryImage,
};
