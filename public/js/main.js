document.getElementById('year').textContent = new Date().getFullYear();

const WHATSAPP_NUMBER = '201000000000';

let allProducts = [];
let activeCategory = '';
let activeSize = '';
let searchTerm = '';
let priceMin = null;
let priceMax = null;

const grid = document.getElementById('productGrid');
const filtersBar = document.getElementById('filters');
const searchInput = document.getElementById('searchInput');
const sizesGrid = document.getElementById('sizesGrid');
const productsTitle = document.getElementById('productsTitle');
const productsSubtitle = document.getElementById('productsSubtitle');
const clearSizeBtn = document.getElementById('clearSizeBtn');

// -------- تحميل المنتجات --------
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    buildSizesGrid();
    buildCategoryFilters();
    initPriceFilter();
    buildGallery();
    render();
  } catch (e) {
    grid.innerHTML = '<p class="empty">تعذر تحميل المنتجات حالياً</p>';
  }
}

// -------- بناء الجاليري (مستقل عن المنتجات) --------
async function buildGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  try {
    const res = await fetch('/api/gallery');
    const items = await res.json();
    if (!items.length) {
      galleryGrid.innerHTML = '<p class="empty">لا توجد صور في الجاليري بعد</p>';
      return;
    }
    galleryGrid.innerHTML = items.map(item => `
      <div class="gallery-item">
        <img src="${item.image}" alt="صورة جاليري" loading="lazy">
        <div class="gallery-overlay"></div>
      </div>
    `).join('');
  } catch(e) {
    galleryGrid.innerHTML = '<p class="empty">تعذر تحميل الجاليري</p>';
  }
}

// -------- فلتر السعر --------
function initPriceFilter() {
  const priceFilter = document.getElementById('priceFilter');
  const applyBtn = document.getElementById('applyPrice');
  const resetBtn = document.getElementById('resetPrice');
  const minInput = document.getElementById('priceMin');
  const maxInput = document.getElementById('priceMax');

  // تحديد أقل وأعلى سعر تلقائياً من المنتجات
  if (allProducts.length) {
    const prices = allProducts.map(p => p.price);
    minInput.placeholder = `من (${Math.min(...prices).toLocaleString('ar-EG')})`;
    maxInput.placeholder = `إلى (${Math.max(...prices).toLocaleString('ar-EG')})`;
  }

  priceFilter.style.display = 'block';

  applyBtn.addEventListener('click', () => {
    priceMin = minInput.value ? Number(minInput.value) : null;
    priceMax = maxInput.value ? Number(maxInput.value) : null;
    render();
  });

  resetBtn.addEventListener('click', () => {
    priceMin = null;
    priceMax = null;
    minInput.value = '';
    maxInput.value = '';
    render();
  });
}

// -------- بناء سكشن المقاسات --------
function buildSizesGrid() {
  // جمع كل المقاسات الفريدة من جميع المنتجات
  const allSizes = new Set();
  allProducts.forEach(p => {
    if (p.sizes && p.sizes.length) {
      p.sizes.forEach(s => allSizes.add(s));
    }
  });

  if (!allSizes.size) {
    sizesGrid.innerHTML = '<p class="empty">لا توجد مقاسات محددة بعد</p>';
    return;
  }

  sizesGrid.innerHTML = [...allSizes].map(size => {
    const count = allProducts.filter(p => p.sizes && p.sizes.includes(size)).length;
    return `
      <div class="size-card" data-size="${escapeHtml(size)}">
        <div class="size-label">${escapeHtml(size)}</div>
        <div class="size-count">${count} تشكيلة</div>
      </div>`;
  }).join('');

  sizesGrid.querySelectorAll('.size-card').forEach(card => {
    card.addEventListener('click', () => {
      selectSize(card.dataset.size);
    });
  });
}

function selectSize(size) {
  activeSize = size;
  activeCategory = '';
  searchTerm = '';
  searchInput.value = '';

  // تفعيل الكارت المختار
  sizesGrid.querySelectorAll('.size-card').forEach(c => {
    c.classList.toggle('active', c.dataset.size === size);
  });

  // تحديث عنوان سكشن المنتجات
  productsTitle.textContent = `تشكيلة مقاس ${size}`;
  productsSubtitle.textContent = `جميع السجاد المتاح بمقاس ${size}`;
  clearSizeBtn.style.display = 'inline-flex';

  // اسكرول لسكشن المنتجات
  document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });

  updateActiveChip();
  render();
}

clearSizeBtn.addEventListener('click', () => {
  activeSize = '';
  productsTitle.textContent = 'منتجاتنا';
  productsSubtitle.textContent = 'اختر من بين تشكيلتنا الواسعة';
  clearSizeBtn.style.display = 'none';
  sizesGrid.querySelectorAll('.size-card').forEach(c => c.classList.remove('active'));
  render();
});

// -------- فلتر الفئات --------
function buildCategoryFilters() {
  const categories = [...new Set(allProducts.map(p => p.category))];
  const searchBox = filtersBar.querySelector('.search-box');
  filtersBar.querySelectorAll('.filter-chip').forEach(b => b.remove());

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-chip active';
  allBtn.dataset.cat = '';
  allBtn.textContent = 'الكل';
  allBtn.addEventListener('click', () => { activeCategory = ''; updateActiveChip(); render(); });
  filtersBar.insertBefore(allBtn, searchBox);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => { activeCategory = cat; updateActiveChip(); render(); });
    filtersBar.insertBefore(btn, searchBox);
  });
}

function updateActiveChip() {
  filtersBar.querySelectorAll('.filter-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === activeCategory);
  });
}

searchInput.addEventListener('input', e => {
  searchTerm = e.target.value.trim().toLowerCase();
  render();
});

// -------- رسم المنتجات --------
function render() {
  let products = allProducts;
  if (activeSize) products = products.filter(p => p.sizes && p.sizes.includes(activeSize));
  if (activeCategory) products = products.filter(p => p.category === activeCategory);
  if (priceMin !== null) products = products.filter(p => p.price >= priceMin);
  if (priceMax !== null) products = products.filter(p => p.price <= priceMax);
  if (searchTerm) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm)
    );
  }

  if (!products.length) {
    grid.innerHTML = `<p class="empty">${activeSize ? `لا يوجد سجاد بمقاس ${activeSize} حالياً` : 'لا توجد منتجات مطابقة'}</p>`;
    return;
  }

  grid.innerHTML = products.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="card-img"><img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-cat">${escapeHtml(p.category)}</div>
        <h3 class="card-name">${escapeHtml(p.name)}</h3>
        ${p.sizes && p.sizes.length ? `<div class="card-sizes">${p.sizes.map(s => `<span class="size-chip">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
        <div class="card-foot">
          <span class="card-price">${p.price.toLocaleString('ar-EG')} جنيه</span>
          <span class="badge ${p.inStock ? 'badge-in' : 'badge-out'}">${p.inStock ? 'متوفر' : 'غير متوفر'}</span>
        </div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// -------- Modal --------
const modalBackdrop = document.getElementById('modalBackdrop');
const modalImg = document.getElementById('modalImg');
const modalCat = document.getElementById('modalCat');
const modalName = document.getElementById('modalName');
const modalPrice = document.getElementById('modalPrice');
const modalDesc = document.getElementById('modalDesc');
const modalWhatsapp = document.getElementById('modalWhatsapp');
const modalSizesWrap = document.getElementById('modalSizesWrap');
const modalSizes = document.getElementById('modalSizes');

function openModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  modalImg.src = p.image;
  modalImg.alt = p.name;
  modalCat.textContent = p.category;
  modalName.textContent = p.name;
  modalPrice.textContent = `${p.price.toLocaleString('ar-EG')} جنيه`;
  modalDesc.textContent = p.description;

  // مقاسات المنتج جوه الـ modal
  if (p.sizes && p.sizes.length) {
    modalSizes.innerHTML = p.sizes.map(s =>
      `<span class="size-chip ${activeSize === s ? 'active' : ''}">${escapeHtml(s)}</span>`
    ).join('');
    modalSizesWrap.style.display = 'block';
  } else {
    modalSizesWrap.style.display = 'none';
  }

  const sizePart = activeSize ? ` - مقاس ${activeSize}` : '';
  const msg = encodeURIComponent(`أرغب بالاستفسار عن: ${p.name}${sizePart}`);
  modalWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;

  modalBackdrop.classList.add('open');
}

document.getElementById('modalClose').addEventListener('click', () => modalBackdrop.classList.remove('open'));
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) modalBackdrop.classList.remove('open'); });

loadProducts();
