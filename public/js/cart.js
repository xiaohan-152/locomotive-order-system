/**
 * cart.js - 订单清单模块
 * 负责订单清单渲染、参数编辑、数量调整
 */

// ===================== 渲染订单清单 =====================
function renderCart() {
  const contentEl = document.getElementById('cartContent');
  const actionsEl = document.getElementById('cartActions');
  const cart = App.state.cart;

  if (!cart || cart.length === 0) {
    contentEl.innerHTML = `
      <div class="cart-empty">
        <div class="empty-icon">🛒</div>
        <p>订单清单是空的</p>
        <button class="btn btn-primary" onclick="switchPage('browse')">去选择产品</button>
      </div>
    `;
    actionsEl.style.display = 'none';
    return;
  }

  actionsEl.style.display = 'flex';

  let tableHtml = `
    <table class="cart-table">
      <thead>
        <tr>
          <th style="width:40px;">序号</th>
          <th>标准产品</th>
          <th>型号</th>
          <th>规格</th>
          <th>级次</th>
          <th>负荷要求</th>
          <th>海拔要求(m)</th>
          <th style="width:80px;">订货数量</th>
          <th>备注</th>
          <th style="width:60px;">操作</th>
        </tr>
      </thead>
      <tbody>
  `;

  cart.forEach((item, index) => {
    tableHtml += `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td><span class="cell-name">${item.productName}</span></td>
        <td>${item.model}</td>
        <td style="font-size:12px;color:#666;max-width:200px;">${item.specs || ''}</td>
        <td class="cell-param">
          <input type="text" value="${item.grade || ''}"
                 onchange="updateCartItem(${index}, 'grade', this.value)"
                 placeholder="级次" style="width:60px;">
        </td>
        <td class="cell-param">
          <input type="text" value="${item.load || ''}"
                 onchange="updateCartItem(${index}, 'load', this.value)"
                 placeholder="负荷" style="width:70px;">
        </td>
        <td class="cell-param">
          <input type="text" value="${item.altitude || ''}"
                 onchange="updateCartItem(${index}, 'altitude', this.value)"
                 placeholder="海拔(m)" style="width:70px;">
        </td>
        <td class="cell-param" style="text-align:center;">
          <div class="qty-control" style="justify-content:center;">
            <button class="qty-btn" onclick="updateCartQty(${index}, -1)">−</button>
            <input class="qty-input" type="number" value="${item.quantity}" min="1" max="9999"
                   onchange="updateCartQtyDirect(${index}, this.value)">
            <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
          </div>
        </td>
        <td class="cell-param cell-remarks">
          <input type="text" value="${item.remarks || ''}"
                 onchange="updateCartItem(${index}, 'remarks', this.value)"
                 placeholder="产品备注">
        </td>
        <td style="text-align:center;">
          <button class="btn btn-danger btn-sm" onclick="removeCartItem(${index})" title="删除">
            ✕
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += '</tbody></table>';

  // 通用备注
  tableHtml += `
    <div style="margin-top:16px;display:flex;align-items:flex-start;gap:12px;padding:14px 20px;background:#f8faff;border-radius:var(--radius);border:1px solid #d0dff5;">
      <label style="font-size:14px;font-weight:600;color:var(--primary);white-space:nowrap;margin-top:6px;">📝 通用备注</label>
      <textarea id="cartGeneralRemarks" rows="2" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;outline:none;resize:vertical;" placeholder="输入订单通用备注（可选）">${App.state.generalRemarks || ''}</textarea>
    </div>
  `;

  contentEl.innerHTML = tableHtml;

  // 监听通用备注变化
  const grTextarea = document.getElementById('cartGeneralRemarks');
  if (grTextarea) {
    grTextarea.addEventListener('input', function() {
      App.state.generalRemarks = this.value;
      App.saveState();
    });
  }

  // 更新汇总
  updateCartSummary();
}

// ===================== 订单清单操作 =====================

// 更新订单清单项字段
function updateCartItem(index, field, value) {
  if (!App.state.cart[index]) return;
  App.state.cart[index][field] = value;
  App.saveState();
}

// 调整数量（相对）
function updateCartQty(index, delta) {
  if (!App.state.cart[index]) return;
  let qty = (App.state.cart[index].quantity || 1) + delta;
  qty = Math.max(1, Math.min(9999, qty));
  App.state.cart[index].quantity = qty;
  App.saveState();
  renderCart(); // 重新渲染以更新显示
}

// 直接设置数量
function updateCartQtyDirect(index, value) {
  if (!App.state.cart[index]) return;
  let qty = parseInt(value) || 1;
  qty = Math.max(1, Math.min(9999, qty));
  App.state.cart[index].quantity = qty;
  App.saveState();
  renderCart();
}

// 删除订单清单项
function removeCartItem(index) {
  if (!App.state.cart[index]) return;
  const name = App.state.cart[index].productName;
  App.state.cart.splice(index, 1);
  App.saveState();
  updateCartBadge();
  renderCart();
  showToast(`已移除「${name}」`, 'info');
}

// 清空订单清单
function clearCart() {
  if (App.state.cart.length === 0) return;
  if (!confirm('确定要清空订单清单吗？')) return;
  App.state.cart = [];
  App.saveState();
  updateCartBadge();
  renderCart();
  showToast('订单清单已清空', 'info');
}

// ===================== 更新汇总 =====================
function updateCartSummary() {
  const cart = App.state.cart;
  const totalItems = cart.length;
  const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  document.getElementById('cartTotalItems').textContent = totalItems;
  document.getElementById('cartTotalQty').textContent = totalQty;
}
