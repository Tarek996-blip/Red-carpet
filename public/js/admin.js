const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginError = document.getElementById('loginError');
const successMsg = document.getElementById('successMsg');

let products = [];

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = 'block';
  dashboardView.style.display = 'none';
}

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  loadProducts();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  loginError.classList.remove('show');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      showDashboard();
    } else {
      loginError.textContent = data.error || 'خطأ في الدخول';
      loginError.classList.add('show');
    }
  } catch (e) {
    loginError.textContent = 'تعذر الاتصال بالسيرفر';
    loginError.classList.add('show');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
});

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('productsTableBody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px">لا توجد منتجات بعد</td></tr>';
    return;
  }
  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td><img src="${p.image}" alt=""></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${p.price.toLocaleString('ar-EG')} جنيه</td>
      <td>${p.inStock ? 'متوفر' : 'غير متوفر'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn edit" data-edit="${p.id}">تعديل</button>
          <button class="icon-btn danger" data-delete="${p.id}">حذف</button>
        </div>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openForm(btn.dataset.edit))
  );
  tbody.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteProduct(btn.dataset.delete))
  );
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Form modal ----------
const formBackdrop = document.getElementById('formBackdrop');
const productForm = document.getElementById('productForm');
const formTitle = document.getElementById('formTitle');

document.getElementById('addProductBtn').addEventListener('click', () => openForm());
document.getElementById('cancelFormBtn').addEventListener('click', closeForm);

function openForm(id) {
  productForm.reset();
  document.getElementById('productId').value = '';
  formTitle.textContent = 'إضافة منتج';
  if (id) {
    const p = products.find((x) => x.id === id);
    if (p) {
      formTitle.textContent = 'تعديل منتج';
      document.getElementById('productId').value = p.id;
      document.getElementById('fName').value = p.name;
      document.getElementById('fCategory').value = p.category;
      document.getElementById('fPrice').value = p.price;
      document.getElementById('fDescription').value = p.description;
      document.getElementById('fSizes').value = p.sizes ? p.sizes.join(', ') : '';
      document.getElementById('fInStock').checked = p.inStock;
    }
  }
  formBackdrop.classList.add('open');
}

function closeForm() {
  formBackdrop.classList.remove('open');
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('fName').value);
  formData.append('category', document.getElementById('fCategory').value);
  formData.append('price', document.getElementById('fPrice').value);
  formData.append('description', document.getElementById('fDescription').value);
  formData.append('inStock', document.getElementById('fInStock').checked);
  const sizesRaw = document.getElementById('fSizes').value;
  const sizesArr = sizesRaw.split(',').map(s => s.trim()).filter(Boolean);
  formData.append('sizes', JSON.stringify(sizesArr));
  const imageFile = document.getElementById('fImage').files[0];
  if (imageFile) formData.append('image', imageFile);

  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, { method, body: formData });
  if (res.ok) {
    closeForm();
    showSuccess(id ? 'تم تعديل المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
    loadProducts();
  } else {
    const data = await res.json();
    alert(data.error || 'حدث خطأ');
  }
});

async function deleteProduct(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showSuccess('تم حذف المنتج');
    loadProducts();
  }
}

function showSuccess(msg) {
  successMsg.textContent = msg;
  successMsg.classList.add('show');
  setTimeout(() => successMsg.classList.remove('show'), 3000);
}

checkAuth();

// -------- التبويبات --------
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    document.getElementById('tab-products').style.display = name === 'products' ? 'block' : 'none';
    document.getElementById('tab-gallery').style.display = name === 'gallery' ? 'block' : 'none';
    if (name === 'gallery') loadGalleryAdmin();
  });
});

// -------- جاليري الأدمن --------
async function loadGalleryAdmin() {
  const grid = document.getElementById('galleryAdminGrid');
  grid.innerHTML = '<p style="color:#888">جارٍ التحميل...</p>';
  const res = await fetch('/api/gallery');
  const items = await res.json();
  if (!items.length) {
    grid.innerHTML = '<p class="empty">لا توجد صور بعد — ارفع صورة جديدة</p>';
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="gallery-admin-card">
      <img src="${item.image}" alt="">
      <button class="del-btn" data-id="${item.id}">حذف</button>
    </div>
  `).join('');
  grid.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف الصورة؟')) return;
      await fetch(`/api/gallery/${btn.dataset.id}`, { method: 'DELETE' });
      loadGalleryAdmin();
    });
  });
}

// رفع صور الجاليري
document.getElementById('galleryUploadInput').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  for (const file of files) {
    const formData = new FormData();
    formData.append('image', file);
    await fetch('/api/gallery', { method: 'POST', body: formData });
  }
  showSuccess(`تم رفع ${files.length} صورة بنجاح`);
  loadGalleryAdmin();
  e.target.value = '';
});
