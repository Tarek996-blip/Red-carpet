require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'red-carpet',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});

const upload = multer({
  storage: cloudStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ---------- Auth ----------
function authMiddleware(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'غير مصرح، سجل دخول أولاً' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول مرة أخرى' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' });
});

app.post('/api/logout', (req, res) => { res.clearCookie('admin_token'); res.json({ ok: true }); });
app.get('/api/me', authMiddleware, (req, res) => { res.json({ username: req.admin.username }); });

// ---------- المنتجات (Public) ----------
app.get('/api/products', (req, res) => {
  let products = db.getAllProducts();
  const { category, q } = req.query;
  if (category) products = products.filter(p => p.category === category);
  if (q) {
    const term = q.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
    );
  }
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

// ---------- المنتجات (Admin) ----------
app.post('/api/products', authMiddleware, upload.single('image'), (req, res) => {
  const { name, category, price, description, inStock } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'الاسم والسعر مطلوبان' });
  const image = req.file ? req.file.path : '/uploads/placeholder.svg';
  let sizes = [];
  try { sizes = JSON.parse(req.body.sizes || '[]'); } catch(e) {}
  const product = db.createProduct({
    name, category: category || 'عام', price: Number(price),
    description: description || '', image, sizes,
    inStock: inStock === 'true' || inStock === true,
  });
  res.status(201).json(product);
});

app.put('/api/products/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { name, category, price, description, inStock } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (category) updates.category = category;
  if (price) updates.price = Number(price);
  if (description !== undefined) updates.description = description;
  if (inStock !== undefined) updates.inStock = inStock === 'true' || inStock === true;
  if (req.body.sizes) { try { updates.sizes = JSON.parse(req.body.sizes); } catch(e) {} }
  if (req.file) updates.image = req.file.path;
  const updated = db.updateProduct(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(updated);
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  const ok = db.deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json({ ok: true });
});

// ---------- الجاليري (Public) ----------
app.get('/api/gallery', (req, res) => { res.json(db.getGallery()); });

// ---------- الجاليري (Admin) ----------
app.post('/api/gallery', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'الصورة مطلوبة' });
  const item = db.addGalleryImage(req.file.path);
  res.status(201).json(item);
});

app.delete('/api/gallery/:id', authMiddleware, (req, res) => {
  const ok = db.deleteGalleryImage(req.params.id);
  if (!ok) return res.status(404).json({ error: 'الصورة غير موجودة' });
  res.json({ ok: true });
});

// ---------- صفحات الواجهة ----------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'غير موجود' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
