const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 确保订单存储目录存在
const ORDERS_DIR = path.join(__dirname, 'orders');
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
  console.log(`  创建订单目录: ${ORDERS_DIR}`);
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===================== 产品 API =====================

// 读取产品数据
function loadProducts() {
  const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf-8');
  return JSON.parse(data);
}

// 获取所有产品（支持按分类筛选）
app.get('/api/products', (req, res) => {
  try {
    const products = loadProducts();
    const { category, search } = req.query;

    let filtered = products;
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    if (search) {
      const keyword = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.model.toLowerCase().includes(keyword) ||
        p.category.toLowerCase().includes(keyword)
      );
    }

    res.json({ success: true, products: filtered });
  } catch (err) {
    console.error('加载产品失败:', err);
    res.status(500).json({ success: false, message: '加载产品失败', error: err.message });
  }
});

// 获取单个产品详情
app.get('/api/products/:id', (req, res) => {
  try {
    const products = loadProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '产品未找到' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error('获取产品失败:', err);
    res.status(500).json({ success: false, message: '获取产品失败', error: err.message });
  }
});

// 获取产品分类列表
app.get('/api/categories', (req, res) => {
  try {
    const products = loadProducts();
    const categories = [...new Set(products.map(p => p.category))];
    res.json({ success: true, categories });
  } catch (err) {
    console.error('获取分类失败:', err);
    res.status(500).json({ success: false, message: '获取分类失败', error: err.message });
  }
});

// 获取客户列表
app.get('/api/customers', (req, res) => {
  try {
    const customersPath = path.join(__dirname, 'customers.json');
    if (fs.existsSync(customersPath)) {
      const data = fs.readFileSync(customersPath, 'utf-8');
      const customers = JSON.parse(data);
      res.json({ success: true, customers });
    } else {
      res.json({ success: true, customers: [] });
    }
  } catch (err) {
    console.error('获取客户列表失败:', err);
    res.status(500).json({ success: false, message: '获取客户列表失败', error: err.message });
  }
});

// 获取系统配置（前端需要的信息）
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      recipientEmail: process.env.RECIPIENT_EMAIL || '',
      senderName: process.env.SENDER_NAME || '机车产品下单系统',
    }
  });
});

// ===================== 订单 API =====================

// 生成订单 Excel
async function generateOrderExcel(orderData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Product Order System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('订单明细');
  const orderType = orderData.orderType || '更换货';

  // 定义列（10列: A-J）
  ws.columns = [
    { header: '序号', key: 'index', width: 8 },
    { header: '产品名称', key: 'name', width: 18 },
    { header: '型号', key: 'model', width: 22 },
    { header: '规格', key: 'specs', width: 36 },
    { header: '级次', key: 'grade', width: 10 },
    { header: '负荷要求', key: 'load', width: 14 },
    { header: '海拔要求(m)', key: 'altitude', width: 14 },
    { header: '订货数量', key: 'quantity', width: 10 },
    { header: '备注', key: 'remarks', width: 22 },
    { header: '通用备注', key: 'generalRemarks', width: 22 },
  ];

  // === 标题行 ===
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `产 品 订 单（${orderType}）`;
  titleCell.font = { name: '微软雅黑', size: 18, bold: true, color: { argb: 'FF1F4E79' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;

  // === 客户信息行 ===
  ws.mergeCells('A2:J2');
  const infoCell = ws.getCell('A2');
  const dateStr = new Date().toLocaleDateString('zh-CN');
  infoCell.value =
    `客户: ${orderData.customer.name}  |  联系人: ${orderData.customer.contact}  |  电话: ${orderData.customer.phone}  |  日期: ${dateStr}`;
  infoCell.font = { name: '微软雅黑', size: 10, color: { argb: 'FF333333' } };
  infoCell.alignment = { horizontal: 'left', vertical: 'middle' };
  infoCell.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
  ws.getRow(2).height = 28;

  // === 空行 ===
  ws.getRow(3).height = 6;

  // === 表头行（第4行）===
  const headerRow = ws.getRow(4);
  const headerValues = ['序号', '产品名称', '型号', '规格', '级次', '负荷要求', '海拔要求(m)', '订货数量', '备注', '通用备注'];
  headerRow.values = headerValues;
  headerRow.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 32;

  // 设置表头边框
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // === 数据行 ===
  orderData.items.forEach((item, i) => {
    const rowNum = 5 + i;
    const row = ws.getRow(rowNum);
    row.values = [
      i + 1,
      item.productName,
      item.model,
      item.specs || '',
      item.grade || '',
      item.load || '',
      item.altitude || '',
      item.quantity,
      item.remarks || '',
      orderData.generalRemarks || '',
    ];
    row.font = { name: '微软雅黑', size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = Math.max(24, ...row.values.filter(v => v && String(v).length > 30).map(() => 40));

    // 交替行背景色
    const fillColor = i % 2 === 0 ? 'FFF2F7FB' : 'FFFFFFFF';
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });

    // 数字列居中
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // 序号
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }; // 订货数量
  });

  // === 空行 + 页脚汇总 ===
  const lastDataRow = 4 + orderData.items.length;
  const footerRowNum = lastDataRow + 1;
  ws.mergeCells(`A${footerRowNum}:J${footerRowNum}`);
  const footerCell = ws.getCell(`A${footerRowNum}`);
  const totalQty = orderData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  footerCell.value = `共 ${orderData.items.length} 项产品，总数量: ${totalQty} 台/套  |  订单生成时间: ${new Date().toLocaleString('zh-CN')}`;
  footerCell.font = { name: '微软雅黑', size: 9, color: { argb: 'FF666666' } };
  footerCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(footerRowNum).height = 24;

  return workbook.xlsx.writeBuffer();
}

// 发送订单邮件
async function sendOrderEmail(orderData, excelBuffer) {
  const dateStr = new Date().toLocaleDateString('zh-CN');
  const timeStr = new Date().toLocaleString('zh-CN');
  const totalQty = orderData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const htmlBody = `
    <div style="font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="background: #1F4E79; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 22px;">📋 新订单通知</h2>
      </div>
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <h3 style="color: #1F4E79; border-bottom: 2px solid #4472C4; padding-bottom: 8px;">客户信息</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 12px; background: #fff;"><b>客户名称:</b> ${orderData.customer.name}</td></tr>
          <tr><td style="padding: 6px 12px; background: #f8f9fa;"><b>联系人:</b> ${orderData.customer.contact}</td></tr>
          <tr><td style="padding: 6px 12px; background: #fff;"><b>联系电话:</b> ${orderData.customer.phone}</td></tr>
        </table>
        <h3 style="color: #1F4E79; border-bottom: 2px solid #4472C4; padding-bottom: 8px;">订单明细</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          <tr style="background: #4472C4; color: white;">
            <th style="padding: 8px; border: 1px solid #4472C4;">序号</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">产品名称</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">型号</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">规格</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">级次</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">数量</th>
            <th style="padding: 8px; border: 1px solid #4472C4;">备注</th>
          </tr>
          ${orderData.items.map((item, i) => `
            <tr style="background: ${i % 2 === 0 ? '#fff' : '#f2f7fb'};">
              <td style="padding: 6px 8px; border: 1px solid #dee2e6; text-align: center;">${i + 1}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6;">${item.productName}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6;">${item.model}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6;">${item.specs || ''}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6; text-align: center;">${item.grade || ''}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6; text-align: center;">${item.quantity}</td>
              <td style="padding: 6px 8px; border: 1px solid #dee2e6; font-size:13px; color:#c62828;${item.remarks ? 'font-weight:bold' : ''}">${item.remarks || '-'}</td>
            </tr>
          `).join('')}
        </table>
        <p style="margin: 8px 0;"><b>总数量:</b> ${totalQty} 台/套</p>
        ${orderData.generalRemarks ? `
          <div style="background: linear-gradient(135deg, #fff8e1, #fff3cd); border: 2px solid #ffa000; padding: 16px 20px; border-radius: 8px; margin: 16px 0; box-shadow: 0 2px 8px rgba(255,160,0,0.15);">
            <div style="font-size:16px; font-weight:bold; color:#e65100; margin-bottom:6px;">📌 通用备注</div>
            <div style="font-size:15px; color:#333; line-height:1.6;">${orderData.generalRemarks}</div>
          </div>
        ` : ''}<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #dee2e6; color: #999; font-size: 12px;">
          <p>此邮件由系统自动发送，Excel订单明细详见附件。</p>
          <p>生成时间: ${timeStr}</p>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.SENDER_NAME || '机车产品下单系统'}" <${process.env.QQ_EMAIL}>`,
    to: process.env.RECIPIENT_EMAIL,
    subject: `[${orderData.orderType || '更换货'}] ${orderData.customer.name} - ${dateStr}`,
    html: htmlBody,
    attachments: [{
      filename: `订单_${orderData.customer.name}_${dateStr.replace(/\//g, '-')}.xlsx`,
      content: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  };
  if (process.env.CC_EMAIL && process.env.CC_EMAIL.trim()) {
    mailOptions.cc = process.env.CC_EMAIL.trim();
  }

  // 尝试多种SMTP配置（云平台可能屏蔽某些端口）
  const configs = [
    { host: 'smtp.163.com', port: 587, secure: false, requireTLS: true },
    { host: 'smtp.163.com', port: 465, secure: true },
    { host: 'smtp.qq.com', port: 587, secure: false, requireTLS: true },
    { host: 'smtp.qq.com', port: 465, secure: true },
  ];

  const errors = [];
  for (const cfg of configs) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        requireTLS: cfg.requireTLS || false,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
        auth: { user: process.env.QQ_EMAIL, pass: process.env.QQ_AUTH_CODE },
      });
      await transporter.sendMail(mailOptions);
      console.log(`  邮件发送成功 (${cfg.host}:${cfg.port})`);
      return; // 发送成功就返回
    } catch (err) {
      errors.push(`${cfg.host}:${cfg.port} - ${err.message}`);
      continue; // 尝试下一个配置
    }
  }
  // 所有方式都失败
  throw new Error('所有SMTP方式均失败: ' + errors.join('; '));
}

// 生成订单 ID
function generateOrderId(orderType) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const prefix = orderType === '返修' ? 'REP' : orderType === '正常排产' ? 'NOR' : 'CHG';
  return `${prefix}-${y}${m}${d}-${h}${min}${s}`;
}

const MASTER_FILE = '订单总表.xlsx';

// 追加订单到总表
async function appendToMasterExcel(orderData, orderId) {
  const masterPath = path.join(ORDERS_DIR, MASTER_FILE);
  let workbook;

  if (fs.existsSync(masterPath)) {
    workbook = await new ExcelJS.Workbook().xlsx.readFile(masterPath);
  } else {
    workbook = new ExcelJS.Workbook();
  }

  const orderType = orderData.orderType || '更换货';
  let ws = workbook.getWorksheet(orderType);
  if (!ws) {
    ws = workbook.addWorksheet(orderType);
    ws.columns = [
      { header: '订单号', key: 'orderId', width: 24 },
      { header: '产品名称', key: 'productName', width: 16 },
      { header: '型号', key: 'model', width: 22 },
      { header: '规格', key: 'specs', width: 36 },
      { header: '级次', key: 'grade', width: 10 },
      { header: '负荷要求', key: 'load', width: 14 },
      { header: '海拔要求(m)', key: 'altitude', width: 14 },
      { header: '订货数量', key: 'quantity', width: 10 },
      { header: '备注', key: 'remarks', width: 22 },
      { header: '通用备注', key: 'generalRemarks', width: 22 },
      { header: '提交日期', key: 'date', width: 14 },
      { header: '客户名称', key: 'customerName', width: 18 },
      { header: '联系人', key: 'contact', width: 12 },
      { header: '联系电话', key: 'phone', width: 16 },
      { header: '地址', key: 'address', width: 30 },
    ];

    // 样式化表头
    const headerRow = ws.getRow(1);
    headerRow.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });
  }

  const dateStr = new Date().toLocaleDateString('zh-CN');
  const startRow = ws.rowCount + 1;

  orderData.items.forEach((item, i) => {
    const rowNum = startRow + i;
    const row = ws.getRow(rowNum);
    row.values = [
      orderId,
      item.productName,
      item.model,
      item.specs || '',
      item.grade || '',
      item.load || '',
      item.altitude || '',
      item.quantity,
      item.remarks || '',
      orderData.generalRemarks || '',
      dateStr,
      orderData.customer.name,
      orderData.customer.contact || '',
      orderData.customer.phone || '',
      orderData.customer.address || '',
    ];
    row.font = { name: '微软雅黑', size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });
  });

  await workbook.xlsx.writeFile(masterPath);
  console.log(`[${orderId}] 已追加到「${orderType}」工作表 (共 ${ws.rowCount - 1} 行)`);
}

// 保存订单元数据（用于历史记录展示）
function saveOrderMeta(orderData, orderId) {
  const meta = {
    orderId,
    orderType: orderData.orderType || '更换货',
    createdAt: new Date().toISOString(),
    customer: orderData.customer,
    generalRemarks: orderData.generalRemarks || '',
    items: orderData.items.map(item => ({
      productName: item.productName,
      model: item.model,
      quantity: item.quantity,
      specs: item.specs,
      grade: item.grade,
      altitude: item.altitude,
      load: item.load,
      remarks: item.remarks,
    })),
    totalItems: orderData.items.length,
    totalQuantity: orderData.items.reduce((s, i) => s + (i.quantity || 0), 0),
  };
  const metaPath = path.join(ORDERS_DIR, `${orderId}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`[${orderId}] 元数据已保存`);
}

// 提交订单：生成 Excel + 保存本地 + 发送邮件
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;

    // 基本验证
    const orderType = orderData.orderType || '更换货';

    // 正常排产不需要客户信息，自动填充默认值
    if (orderType === '正常排产') {
      orderData.customer = orderData.customer || {};
      orderData.customer.name = orderData.customer.name || '正常排产订单';
    } else {
      if (!orderData.customer || !orderData.customer.name) {
        return res.status(400).json({ success: false, message: '请填写客户名称' });
      }
    }
    if (!orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ success: false, message: '请至少选择一项产品' });
    }

    const orderId = generateOrderId(orderType);

    // 生成 Excel（内存中，用于邮件附件）
    console.log(`[${orderId}] 正在生成 Excel...`);
    const excelBuffer = await generateOrderExcel(orderData);
    console.log(`[${orderId}] Excel 生成成功 (${(excelBuffer.length / 1024).toFixed(1)} KB)`);

    // ========== 1. 追加到总表 ==========
    await appendToMasterExcel(orderData, orderId);

    // ========== 2. 保存元数据 ==========
    saveOrderMeta(orderData, orderId);

    // ========== 3. 发送邮件（后台发送，不阻塞订单提交） ==========
    let emailSent = false;
    if (process.env.RECIPIENT_EMAIL && process.env.RECIPIENT_EMAIL.trim()) {
      emailSent = true; // 乐观标记，后台尝试发送
      // 后台发邮件，即使失败也不影响订单提交
      sendOrderEmail(orderData, excelBuffer)
        .then(() => console.log(`[${orderId}] 邮件发送成功`))
        .catch(err => console.error(`[${orderId}] 邮件发送失败:`, err.message));
    }

    res.json({
      success: true,
      orderId,
      emailSent,
      message: emailSent
        ? '订单提交成功！已追加到订单总表并通过邮件发送。'
        : '订单提交成功！已追加到订单总表。',
    });
  } catch (err) {
    console.error('订单处理失败:', err);
    res.status(500).json({ success: false, message: '订单处理失败: ' + err.message, error: err.message });
  }
});

// 获取订单历史列表
app.get('/api/orders/history', (req, res) => {
  try {
    const files = fs.readdirSync(ORDERS_DIR)
      .filter(f => f.endsWith('.json') && f !== 'index.json')
      .map(f => {
        const filePath = path.join(ORDERS_DIR, f);
        const stat = fs.statSync(filePath);
        const meta = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          orderId: meta.orderId,
          orderType: meta.orderType || '更换货',
          customerName: meta.customer?.name || '',
          customerContact: meta.customer?.contact || '',
          totalItems: meta.totalItems || 0,
          totalQuantity: meta.totalQuantity || 0,
          createdAt: meta.createdAt || stat.birthtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, orders: files });
  } catch (err) {
    console.error('获取订单历史失败:', err);
    res.status(500).json({ success: false, message: '获取订单历史失败', error: err.message });
  }
});

// 下载订单总表
app.get('/api/orders/download', (req, res) => {
  const masterPath = path.join(ORDERS_DIR, MASTER_FILE);
  if (!fs.existsSync(masterPath)) {
    return res.status(404).json({ success: false, message: '订单总表不存在，请先提交订单' });
  }
  res.download(masterPath, MASTER_FILE);
});

// 前端路由（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== 启动服务器 =====================

const os = require('os');

// 获取本机局域网 IP
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && net.address.startsWith('192.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('='.repeat(50));
  console.log(`  产品订单系统已启动`);
  console.log(`  本机: http://localhost:${PORT}`);
  console.log(`  局域网: http://${localIP}:${PORT}`);
  console.log(`  邮箱: ${process.env.QQ_EMAIL || '未配置'}`);
  console.log(`  收件: ${process.env.RECIPIENT_EMAIL || '未配置'}`);
  console.log('='.repeat(50));
  if (localIP === 'localhost') {
    console.log('提示: 其他电脑请使用本机局域网 IP 地址访问');
  } else {
    console.log(`提示: 同一局域网内其他电脑访问 http://${localIP}:${PORT}`);
  }
});
