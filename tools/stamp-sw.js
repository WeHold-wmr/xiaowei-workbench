// 每次部署时给 sw.js 写入一个新的缓存版本号。
// 关键：只有 sw.js 的【字节内容】发生变化，浏览器/手机/平板主屏 PWA 才会
// 重新安装 Service Worker 并自动刷新。所以这个脚本是"改完即自动更新"的核心。
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'sw.js');
let sw = fs.readFileSync(swPath, 'utf-8');

// 用时间戳作为版本令牌，保证每次部署都唯一
const token = 'xw-' + Date.now();

const newSw = sw.replace(/const CACHE\s*=\s*['"][^'"]*['];/, "const CACHE = '" + token + "';");

if (newSw === sw) {
  console.error('[stamp-sw] 未在 sw.js 中找到 CACHE 赋值行，请检查格式');
  process.exit(1);
}

fs.writeFileSync(swPath, newSw);
console.log('[stamp-sw] CACHE 已更新为', token);
