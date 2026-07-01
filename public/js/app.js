/**
 * app.js - 核心应用模块
 * 负责页面路由、全局状态管理、通知系统
 */

// ===================== 全局状态 =====================
const App = {
  state: {
    products: [],
    categories: [],
    customers: [],
    cart: [],        // { productId, productName, model, specs, grade, quantity, altitude, load, remarks }
    currentPage: 'browse',
    customer: {
      name: '',
      contact: '',
      phone: '',
      address: ''
    },
    generalRemarks: ''
  },

  // 恢复本地存储
  init() {
    this.restoreState();

    // 恢复客户选择框和表单
    document.querySelectorAll('.customer-select').forEach(sel => sel.value = this.state.customer.name || '');
    document.getElementById('customerContact').value = this.state.customer.contact || '';
    document.getElementById('customerPhone').value = this.state.customer.phone || '';
    const addrEl = document.getElementById('customerAddress');
    if (addrEl) addrEl.value = this.state.customer.address || '';

    // 加载客户列表
    loadCustomers();
  },

  // 持久化到 localStorage
  saveState() {
    try {
      const persistable = {
        cart: this.state.cart,
        customer: this.state.customer,
        generalRemarks: this.state.generalRemarks
      };
      localStorage.setItem('order-system-state', JSON.stringify(persistable));
    } catch (e) {
      console.warn('保存状态失败:', e);
    }
  },

  // 从 localStorage 恢复
  restoreState() {
    try {
      const saved = localStorage.getItem('order-system-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cart) this.state.cart = parsed.cart;
        if (parsed.customer) this.state.customer = parsed.customer;
        if (parsed.generalRemarks !== undefined) this.state.generalRemarks = parsed.generalRemarks;
      }
    } catch (e) {
      console.warn('恢复状态失败:', e);
    }
  }
};

// ===================== 页面切换 =====================
function switchPage(page) {
  App.state.currentPage = page;

  // 隐藏所有页面
  document.querySelectorAll('.page-section').forEach(el => {
    el.style.display = 'none';
  });

  // 显示目标页面
  const target = document.getElementById('page-' + page);
  if (target) target.style.display = 'block';

  // 更新导航高亮
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // 页面特定刷新
  if (page === 'cart') renderCart();
  if (page === 'order') renderOrderPreview();

  // 更新订单清单角标
  updateCartBadge();

  window.scrollTo(0, 0);
}

// ===================== Toast 通知 =====================
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===================== 加载遮罩 =====================
function showLoading(text = '处理中...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// ===================== 客户列表 =====================
let customersLoaded = false;

async function loadCustomers() {
  if (customersLoaded) return;
  try {
    const resp = await fetch('/api/customers');
    const data = await resp.json();
    if (data.success && data.customers) {
      App.state.customers = data.customers;
      customersLoaded = true;
      // 填充所有客户选择下拉框
      document.querySelectorAll('.customer-select').forEach(sel => renderCustomerOptions(sel));
    }
  } catch (e) { /* ignore */ }
}

function renderCustomerOptions(selectEl) {
  if (!selectEl) return;
  const currentVal = selectEl.value;
  selectEl.innerHTML = '<option value="">-- 请选择客户 --</option>';
  App.state.customers.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
  if (currentVal) selectEl.value = currentVal;
}

// 客户选择变更（同步所有下拉框 + 状态）
function onCustomerSelectChange(value) {
  App.state.customer.name = value;
  App.saveState();
  // 同步所有客户选择下拉框
  document.querySelectorAll('.customer-select').forEach(sel => sel.value = value);
  // 同步文本输入框（兼容旧表单）
  const nameInput = document.getElementById('customerName');
  if (nameInput) nameInput.value = value;
}

// ===================== 工具函数 =====================
// 订单清单角标更新
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = App.state.cart.length;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// ===================== 初始化 =====================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  loadProducts();
  loadCategories();
  updateCartBadge();

  // 监听客户信息变化
  document.getElementById('customerName').addEventListener('input', (e) => {
    App.state.customer.name = e.target.value;
    App.saveState();
  });
  document.getElementById('customerContact').addEventListener('input', (e) => {
    App.state.customer.contact = e.target.value;
    App.saveState();
  });
  document.getElementById('customerPhone').addEventListener('input', (e) => {
    App.state.customer.phone = e.target.value;
    App.saveState();
  });
  const addrEl = document.getElementById('customerAddress');
  if (addrEl) {
    addrEl.addEventListener('input', (e) => {
      App.state.customer.address = e.target.value;
      App.saveState();
    });
  }
});
