// 小魏工作台 - 云同步服务器 (Node.js)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'sync_data.json');

// MIME 类型
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch (_) { return {}; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8');
}

function json(res, data, status) {
  status = status || 200;
  var body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function serveFile(res, filePath) {
  var ext = path.extname(filePath).toLowerCase();
  var ct = MIME[ext] || 'application/octet-stream';

  try {
    var content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (e) {
    if (e.code === 'ENOENT') {
      // 404 → 返回 index.html (SPA fallback)
      try {
        var idx = fs.readFileSync(path.join(__dirname, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': idx.length });
        res.end(idx);
      } catch (_) {
        res.writeHead(404);
        res.end('Not Found');
      }
    } else {
      res.writeHead(500);
      res.end('Server Error');
    }
  }
}

var server = http.createServer(function(req, res) {
  var url = req.url.split('?')[0];

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API: 健康检查
  if (url === '/api/ping' && req.method === 'GET') {
    json(res, { ok: true, version: '2.0' });
    return;
  }

  // API: 获取全部同步数据
  if (url === '/api/sync' && req.method === 'GET') {
    json(res, readData());
    return;
  }

  // API: 推送并合并同步数据
  if (url === '/api/sync' && req.method === 'POST') {
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() {
      try {
        var body = Buffer.concat(chunks).toString('utf-8');
        var incoming = JSON.parse(body);
        var data = readData();
        var synced = [];
        var updated = {};

        for (var key in incoming) {
          if (!incoming.hasOwnProperty(key)) continue;
          var item = incoming[key];
          if (!item || typeof item.v === 'undefined') continue;

          var clientTs = item.ts || 0;
          var serverItem = data[key];
          var serverTs = (serverItem && serverItem.ts) ? serverItem.ts : 0;

          if (clientTs >= serverTs) {
            data[key] = { v: item.v, ts: clientTs };
            synced.push(key);
          } else {
            updated[key] = data[key];
          }
        }

        // 服务器有新数据也返回
        for (var k in data) {
          if (data.hasOwnProperty(k) && !incoming.hasOwnProperty(k)) {
            var ts = (data[k] && data[k].ts) ? data[k].ts : 0;
            if (ts > 0) updated[k] = data[k];
          }
        }

        writeData(data);
        json(res, { ok: true, synced: synced, updated: updated });
      } catch (e) {
        json(res, { ok: false, error: e.message }, 400);
      }
    });
    return;
  }

  // 静态文件
  var filePath = path.join(__dirname, url === '/' ? 'index.html' : url.replace(/^\//, ''));
  serveFile(res, filePath);
});

server.listen(PORT, function() {
  console.log('小魏工作台云服务器已启动');
  console.log('端口: ' + PORT);
});
