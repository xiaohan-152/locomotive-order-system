/**
 * order.js - 订单提交模块
 * 负责订单预览渲染、表单提交、与后端 API 交互
 */

// ===================== 渲染订单预览 =====================
function renderOrderPreview() {
  const container = document.getElementById('orderPreview');
  const cart = App.state.cart;

  if (!cart || cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <p>订单清单为空，请先选择产品</p>
        <button class="btn btn-primary" onclick="switchPage('browse')">去选择产品</button>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="cart-table">
      <thead>
        <tr>
          <th style="width:40px;">序号</th>
          <th>标准产品</th>
          <th>型号</th>
          <th>规格</th>
          <th>级次</th>
          <th>负荷</th>
          <th>海拔(m)</th>
          <th style="width:70px;">订货数量</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
  `;

  cart.forEach((item, index) => {
    tableHtml += `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.model}</td>
        <td style="font-size:12px;color:#666;">${item.specs || ''}</td>
        <td style="text-align:center;">${item.grade || '-'}</td>
        <td style="text-align:center;">${item.load || '-'}</td>
        <td style="text-align:center;">${item.altitude || '-'}</td>
        <td style="text-align:center;font-weight:600;">${item.quantity}</td>
        <td style="font-size:12px;color:#888;">${item.remarks || ''}</td>
      </tr>
    `;
  });

  tableHtml += '</tbody></table>';

  const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  tableHtml += `
    <div style="text-align:right;padding:12px;font-size:15px;background:#f8faff;border-top:2px solid var(--primary-light);">
      共计 <strong style="color:var(--primary);font-size:18px;">${cart.length}</strong> 项产品，
      总数量 <strong style="color:var(--primary);font-size:18px;">${totalQty}</strong> 台/套
    </div>
  `;

  container.innerHTML = tableHtml;
}

// ===================== 提交订单 =====================
let serverConfig = { recipientEmail: '', senderName: '' };

// 初始化时加载服务端配置
async function loadServerConfig() {
  try {
    const resp = await fetch('/api/config');
    const data = await resp.json();
    if (data.success) serverConfig = data.config;
  } catch (e) { /* ignore */ }
}
loadServerConfig();

async function submitOrder() {
  const cart = App.state.cart;

  // 验证订单清单
  if (!cart || cart.length === 0) {
    showToast('请先选择产品', 'warning');
    return;
  }

  // 获取订单类型
  const orderTypeEl = document.querySelector('input[name="orderType"]:checked');
  const orderType = orderTypeEl ? orderTypeEl.value : '更换货';

  let customerName = '', customerContact = '', customerPhone = '', customerAddress = '';

  if (orderType !== '正常排产') {
    // 获取客户信息（非正常排产时需要）
    const customerSelect = document.querySelector('#page-order .customer-select');
    customerName = customerSelect ? customerSelect.value.trim() : '';
    if (!customerName) {
      showToast('请选择客户名称', 'warning');
      if (customerSelect) customerSelect.focus();
      return;
    }
    customerContact = document.getElementById('customerContact').value.trim();
    customerPhone = document.getElementById('customerPhone').value.trim();
    customerAddress = document.getElementById('customerAddress').value.trim();
  }

  const generalRemarks = App.state.generalRemarks || '';

  // 更新状态
  App.state.customer.name = customerName;
  App.state.customer.contact = customerContact;
  App.state.customer.phone = customerPhone;
  App.state.customer.address = customerAddress;
  App.state.generalRemarks = generalRemarks;
  App.saveState();

  // 构建订单数据
  const orderData = {
    orderType: orderType,
    customer: {
      name: customerName,
      contact: customerContact,
      phone: customerPhone,
      address: customerAddress
    },
    generalRemarks: generalRemarks,
    items: cart.map(item => ({
      productId: item.productId,
      productName: item.productName,
      model: item.model,
      specs: item.specs || '',
      grade: item.grade || '',
      quantity: item.quantity || 1,
      altitude: item.altitude || '',
      load: item.load || '',
      remarks: item.remarks || ''
    }))
  };

  // 提交
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;

  try {
    showLoading('正在生成 Excel 并发送邮件...');

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    hideLoading();

    const result = await response.json();

    if (result.success) {
      // 显示成功页
      document.getElementById('successOrderId').textContent = result.orderId || '—';
      document.getElementById('successFileName').textContent = orderType + ' - 订单总表.xlsx';

      const emailLine = document.getElementById('successEmailLine');
      if (result.emailSent) {
        emailLine.style.display = 'block';
        document.getElementById('successRecipient').textContent = serverConfig.recipientEmail || '收件人';
      } else {
        emailLine.style.display = 'none';
      }

      // 清空订单清单
      App.state.cart = [];
      App.saveState();
      updateCartBadge();

      switchPage('success');
      showToast(result.message || '订单提交成功！', 'success');
    } else {
      showToast(result.message || '订单提交失败', 'error');
    }
  } catch (err) {
    hideLoading();
    console.error('订单提交失败:', err);
    showToast('网络错误，请检查服务器是否正常运行', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ===================== 重置并继续下单 =====================
function resetAndGoBrowse() {
  switchPage('browse');
}

// ===================== 订单类型切换 =====================
function selectOrderType(type) {
  // 更新按钮文字
  const typeMap = { '更换货': '📤 提交更换货订单', '返修': '📤 提交返修订单', '正常排产': '📤 提交正常排产订单' };
  document.getElementById('submitBtn').textContent = typeMap[type] || '📤 提交订单';

  // 正常排产时隐藏整个客户信息区
  const infoSection = document.getElementById('customerInfoSection');
  if (type === '正常排产') {
    if (infoSection) infoSection.style.display = 'none';
  } else {
    if (infoSection) infoSection.style.display = '';
  }
}

// ===================== 下载订单总表 =====================
function downloadMasterExcel() {
  window.open('/api/orders/download', '_blank');
}

// ===================== 智能解析客户信息 =====================
function parseCustomerInfo() {
  const input = document.getElementById('parseInput').value.trim();
  if (!input) {
    showToast('请先粘贴客户地址信息', 'warning');
    return;
  }

  // 清理：去除多余空白行
  const text = input.replace(/\n{3,}/g, '\n').trim();

  let phone = '';
  let name = '';
  let address = '';

  // === 提取手机号（1开头的11位数字）===
  const phoneMatch = text.match(/(1[3-9]\d{9})/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  } else {
    // 尝试匹配座机号
    const telMatch = text.match(/(0\d{2,3}[- ]?\d{7,8})/);
    if (telMatch) phone = telMatch[1];
  }

  // === 提取姓名 ===
  // 策略1: 找"收货人/收件人/联系人/姓名"后面的词
  const nameLabelMatch = text.match(/(?:收[货件]人|联系人|[收姓]名)[：:]\s*([^\s,，\d]{2,6})/);
  if (nameLabelMatch) {
    name = nameLabelMatch[1];
  }

  // 策略2: 从手机号前面的词找（通常是姓名在最前面）
  if (!name && phone) {
    const phoneIdx = text.indexOf(phone);
    const beforePhone = text.substring(0, phoneIdx).trim();
    // 取手机号前面的最后一个词（2-6个汉字）
    const nameFromPhone = beforePhone.match(/([^\s,，\n]{2,6})$/);
    if (nameFromPhone) {
      const possibleName = nameFromPhone[1].replace(/[：:]/g, '').trim();
      if (/^[一-龥]{2,6}$/.test(possibleName)) {
        name = possibleName;
      }
    }
  }

  // 策略3: 找开头第一行，去掉地址关键词后可能是姓名
  if (!name) {
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const clean = line.replace(/[：:].*$/, '').trim();
      if (/^[一-龥]{2,6}$/.test(clean) && !clean.includes('地址') && !clean.includes('电话') && !clean.includes('邮编')) {
        name = clean;
        break;
      }
    }
  }

  // === 提取地址 ===
  // 策略1: 找"地址/收货地址"后面的内容
  const addrLabelMatch = text.match(/(?:地址|收货地址|详细地址)[：:]\s*([^\n]+)/);
  if (addrLabelMatch) {
    address = addrLabelMatch[1].trim();
  }

  // 策略2: 去掉姓名和手机号后剩下的长文本
  if (!address) {
    let remaining = text;
    if (name) remaining = remaining.replace(name, '');
    if (phone) remaining = remaining.replace(phone, '');
    remaining = remaining.replace(/[：:]/g, ' ')
      .replace(/收[货件]人|联系人|地址|电话|姓名/g, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 找到看起来像地址的部分（包含省/市/区/县/路/街等关键字）
    const addrKeywords = /[省市区县镇乡路街道村组号栋楼单元室层]|[\d]+号/;
    if (addrKeywords.test(remaining) && remaining.length >= 6) {
      address = remaining;
    }
  }

  // 策略3: 整段文本中提取最长的不含手机号的连续文本
  if (!address) {
    const lines = text.split('\n').filter(l => l.trim());
    let longest = '';
    for (const line of lines) {
      const clean = line.replace(phone, '').replace(name, '').trim();
      if (clean.length > longest.length && clean.length >= 6) {
        longest = clean;
      }
    }
    if (longest) address = longest;
  }

  // === 填入表单 ===
  let filled = false;

  if (name) {
    document.getElementById('customerContact').value = name;
    App.state.customer.contact = name;
    filled = true;
  }
  if (phone) {
    document.getElementById('customerPhone').value = phone;
    App.state.customer.phone = phone;
    filled = true;
  }
  if (address) {
    document.getElementById('customerAddress').value = address;
    App.state.customer.address = address;
    filled = true;
  }

  if (filled) {
    App.saveState();
    showToast('✅ 已识别并填入：' + [name, phone, address].filter(Boolean).join(' | '), 'success', 4000);
  } else {
    showToast('未识别到有效信息，请手动填写', 'warning');
  }
}
