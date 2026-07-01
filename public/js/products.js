/**
 * products.js - 产品浏览模块
 * 负责加载产品、筛选、搜索、渲染产品列表
 */

// ===================== 加载产品 =====================
async function loadProducts() {
  const listEl = document.getElementById('productList');
  try {
    listEl.innerHTML = '<div class="loading">加载产品中...</div>';

    const response = await fetch('/api/products');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '加载失败');
    }

    App.state.products = data.products;

    if (data.products.length === 0) {
      listEl.innerHTML = '<div class="loading">暂无产品数据</div>';
      return;
    }

    renderProducts(data.products);
  } catch (err) {
    console.error('加载产品失败:', err);
    listEl.innerHTML = `<div class="loading" style="color:#ff4d4f;">
      加载产品失败: ${err.message}
      <br><br>
      <button class="btn btn-primary" onclick="loadProducts()">重新加载</button>
    </div>`;
  }
}

// ===================== 加载分类 =====================
async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();

    if (data.success && data.categories) {
      App.state.categories = data.categories;
      const select = document.getElementById('categoryFilter');

      // 保留"全部分类"选项
      data.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.warn('加载分类失败:', err);
  }
}

// ===================== 搜索 =====================
function searchProducts() {
  filterProducts();
}

// ===================== 筛选 =====================
function filterProducts() {
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;

  let filtered = App.state.products;

  if (keyword) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(keyword) ||
      p.model.toLowerCase().includes(keyword) ||
      (p.specs && p.specs.toLowerCase().includes(keyword))
    );
  }

  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }

  renderProducts(filtered);
}

// ===================== 渲染产品列表 =====================
function renderProducts(products) {
  const listEl = document.getElementById('productList');

  if (products.length === 0) {
    listEl.innerHTML = '<div class="loading">没有匹配的产品</div>';
    return;
  }

  listEl.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-category">${product.category}</div>
      <div class="product-header">
        <span class="product-name">${product.name}</span>
        <span class="product-model">${product.model}</span>
      </div>
      <div class="product-specs">${product.specs || '暂无规格'}</div>
      <div class="product-params">
        <span class="product-param"><strong>级次：</strong>${product.grade || '-'}</span>
        <span class="product-param"><strong>负荷：</strong>${product.defaultLoad || '-'}</span>
        <span class="product-param"><strong>海拔：</strong>${product.defaultAltitude || '-'}m</span>
      </div>
      <div class="product-footer">
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${product.id}', -1)">−</button>
          <input class="qty-input" id="qty-${product.id}" type="number" value="1" min="1" max="9999" onchange="updateProductQty('${product.id}')">
          <button class="qty-btn" onclick="changeQty('${product.id}', 1)">+</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addToCart('${product.id}')">
          加入订单清单
        </button>
      </div>
    </div>
  `).join('');
}

// ===================== 数量控制 =====================
function changeQty(productId, delta) {
  const input = document.getElementById('qty-' + productId);
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(9999, val + delta));
  input.value = val;
}

function updateProductQty(productId) {
  const input = document.getElementById('qty-' + productId);
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(9999, val));
  input.value = val;
}

// ===================== 加入订单清单 =====================
function addToCart(productId) {
  const product = App.state.products.find(p => p.id === productId);
  if (!product) return;

  const input = document.getElementById('qty-' + productId);
  const quantity = parseInt(input?.value) || 1;

  // 检查是否已在订单清单中
  const existingIndex = App.state.cart.findIndex(item => item.productId === productId);
  if (existingIndex >= 0) {
    // 累加数量
    App.state.cart[existingIndex].quantity += quantity;
    showToast(`「${product.name}」已增加 ${quantity} 台，共 ${App.state.cart[existingIndex].quantity} 台`, 'info');
  } else {
    // 新增
    App.state.cart.push({
      productId: product.id,
      productName: product.name,
      model: product.model,
      category: product.category,
      specs: product.specs,
      grade: product.grade || '',
      unit: product.unit || '台',
      quantity: quantity,
      altitude: product.defaultAltitude || '',
      load: product.defaultLoad || '',
      remarks: ''
    });
    showToast(`「${product.name}」已加入订单清单`, 'success');
  }

  App.saveState();
  updateCartBadge();

  // 重置数量为1
  if (input) input.value = 1;
}
