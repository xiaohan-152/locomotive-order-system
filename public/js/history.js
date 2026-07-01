/**
 * history.js - 订单历史模块
 * 查看已提交的订单记录，下载订单总表
 */

// ===================== 加载订单历史 =====================
async function loadOrderHistory() {
  const container = document.getElementById('historyContent');

  try {
    container.innerHTML = '<div class="loading">加载订单记录中...</div>';

    const response = await fetch('/api/orders/history');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || '加载失败');
    }

    const orders = data.orders;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="empty-icon">📂</div>
          <p>暂无历史订单记录</p>
          <button class="btn btn-primary" onclick="switchPage('browse')">去下单</button>
        </div>
      `;
      return;
    }

    // 下载总表按钮
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <span style="color:#666;font-size:14px;">共 <strong style="color:var(--primary);">${orders.length}</strong> 份订单</span>
        <button class="btn btn-primary" onclick="downloadMasterExcel()">📥 下载订单总表</button>
      </div>
      <div style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
      <table class="cart-table" style="box-shadow:none;">
        <thead>
          <tr>
            <th style="width:60px;">序号</th>
            <th>订单号</th>
            <th style="width:70px;">类型</th>
            <th>客户名称</th>
            <th>联系人</th>
            <th>产品项数</th>
            <th>总数量</th>
            <th>提交时间</th>
          </tr>
        </thead>
        <tbody>
    `;

    orders.forEach((order, index) => {
      const time = new Date(order.createdAt);
      const timeStr = `${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')} ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;

      html += `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td><code style="background:#f5f5f5;padding:2px 8px;border-radius:3px;font-size:12px;">${order.orderId}</code></td>
          <td style="text-align:center;"><span style="display:inline-block;padding:1px 10px;border-radius:10px;font-size:12px;background:${order.orderType === '返修' ? '#fff3e0' : '#e8f5e9'};color:${order.orderType === '返修' ? '#e65100' : '#2e7d32'};">${order.orderType === '返修' ? '🔧 返修' : '🔄 更换货'}</span></td>
          <td><strong>${order.customerName}</strong></td>
          <td>${order.customerContact || '-'}</td>
          <td style="text-align:center;">${order.totalItems}</td>
          <td style="text-align:center;">${order.totalQuantity}</td>
          <td style="font-size:12px;color:#888;">${timeStr}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';

    // 统计
    const totalQtyAll = orders.reduce((s, o) => s + (o.totalQuantity || 0), 0);
    html += `
      <div style="text-align:right;margin-top:12px;padding:12px 16px;background:#f8faff;border-radius:8px;font-size:13px;color:#666;">
        累计 <strong style="color:var(--primary);">${totalQtyAll}</strong> 台/套
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    console.error('加载订单历史失败:', err);
    container.innerHTML = `
      <div class="cart-empty">
        <p style="color:#ff4d4f;">加载失败: ${err.message}</p>
        <button class="btn btn-primary" onclick="loadOrderHistory()">重新加载</button>
      </div>
    `;
  }
}

// ===================== 下载总表 =====================
function downloadMasterExcel() {
  window.open('/api/orders/download', '_blank');
}
