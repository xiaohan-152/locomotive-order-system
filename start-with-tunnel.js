/**
 * start-with-tunnel.js - 启动服务器并创建公网隧道
 * 运行后手机和其他电脑可通过公网地址访问
 */
const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(55));
console.log('  机车产品下单系统 - 启动中...');
console.log('='.repeat(55));

// 1. 启动主服务器
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

server.stdout.on('data', d => process.stdout.write(d));
server.stderr.on('data', d => process.stderr.write(d));

// 等待服务器启动后，再启动隧道
setTimeout(() => {
  console.log('\n🌐 正在创建公网隧道...');
  console.log('   首次使用可能需要按提示访问网址完成认证\n');

  const tunnel = spawn('npx.cmd', ['localtunnel', '--port', '8080'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  tunnel.stdout.on('data', d => {
    const text = d.toString();
    process.stdout.write(d);
    // 捕获 URL
    const match = text.match(/https:\/\/[a-z-]+\.loca\.lt/);
    if (match) {
      console.log('\n' + '='.repeat(55));
      console.log('  ✅ 公网地址已生成！');
      console.log('');
      console.log('  🌍 ' + match[0]);
      console.log('');
      console.log('  📱 手机/其他电脑打开上面网址即可使用');
      console.log('  ⚠️  首次访问需点击 "Click to Continue" 按钮');
      console.log('  ⚠️  关闭此窗口服务即停止');
      console.log('='.repeat(55) + '\n');
    }
  });

  tunnel.stderr.on('data', d => process.stderr.write(d));

  tunnel.on('error', err => {
    console.error('❌ 隧道创建失败:', err.message);
    console.log('   服务器仍可通过 http://localhost:8080 访问');
  });

  // 窗口关闭时清理
  process.on('SIGINT', () => {
    tunnel.kill();
    server.kill();
    process.exit();
  });

}, 3000);

// 窗口关闭时清理
process.on('SIGINT', () => {
  server.kill();
  process.exit();
});
