require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// كلمة السر مخزنة كنص هنا فقط لتبسيط أول تشغيل، بنعمل لها تشفير عند المقارنة
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD || 'admin123',
  10
);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- رفع الصور ----------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('نوع الملف غير مدعوم'), ok);
  },
});

// ---------- المصادقة (Auth) ----------
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
  if (
    username === ADMIN_USERNAME &&
    bcrypt.compareSync(password || '', ADMIN_PASSWORD_HASH)
  ) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ username: req.admin.username });
});

// ---------- المنتجات (Public) ----------
app.get('/api/products', (req, res) => {
  let products = db.getAllProducts();
  const { category, q } = req.query;
  if (category) products = products.filter((p) => p.category === category);
  if (q) {
    const term = q.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
    );
  }
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

// ---------- المنتجات (Admin only) ----------
app.post('/api/products', authMiddleware, upload.single('image'), (req, res) => {
  const { name, category, price, description, inStock } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'الاسم والسعر مطلوبان' });
  }
  const image = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.svg';
  let sizes = [];
  try { sizes = JSON.parse(req.body.sizes || '[]'); } catch(e) {}
  const product = db.createProduct({
    name,
    category: category || 'عام',
    price: Number(price),
    description: description || '',
    image,
    sizes,
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
  if (req.file) updates.image = `/uploads/${req.file.filename}`;

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
app.get('/api/gallery', (req, res) => {
  res.json(db.getGallery());
});

// ---------- الجاليري (Admin only) ----------
app.post('/api/gallery', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'الصورة مطلوبة' });
  const item = db.addGalleryImage(`/uploads/${req.file.filename}`);
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
