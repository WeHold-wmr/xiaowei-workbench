#!/usr/bin/env python3
"""小魏工作台 - 多设备同步服务器"""
import http.server
import json
import os
import urllib.parse
from pathlib import Path

DATA_FILE = Path(__file__).parent / 'sync_data.json'
PORT = 8000


def load_data():
    if DATA_FILE.exists():
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # 迁移旧格式：{key: value} → {key: {v: value, ts: ts}}
        migrated = False
        for key, val in list(data.items()):
            if not isinstance(val, dict) or 'v' not in val:
                data[key] = {'v': val, 'ts': 0}
                migrated = True
        if migrated:
            save_data(data)
        return data
    return {}


def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class SyncHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/sync':
            data = load_data()
            self._json_response(data)
            return
        elif self.path == '/api/ping':
            self._json_response({'ok': True, 'version': '1.0'})
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                incoming = json.loads(body)
                data = load_data()

                synced = []       # 客户端更新成功的 key
                updated = {}      # 返回服务器更新的数据（客户端可能有脏数据没推完）

                for key, item in incoming.items():
                    if not isinstance(item, dict) or 'v' not in item:
                        continue
                    client_ts = item.get('ts', 0)
                    server_ts = data.get(key, {}).get('ts', 0) if isinstance(data.get(key), dict) else 0

                    # 时间戳比较：客户端更新才接受
                    if client_ts >= server_ts:
                        data[key] = {'v': item['v'], 'ts': client_ts}
                        synced.append(key)
                    else:
                        # 服务器数据更新，返回给客户端
                        updated[key] = data[key]

                # 顺便找出服务器有但客户端没传的更新数据
                for key in data:
                    if key not in incoming and isinstance(data.get(key), dict) and data[key].get('ts', 0) > 0:
                        updated[key] = data[key]

                save_data(data)
                self._json_response({
                    'ok': True,
                    'synced': synced,
                    'updated': updated
                })
            except Exception as e:
                self._json_response({'ok': False, 'error': str(e)}, status=400)
            return
        self.send_error(405)

    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        if '/api/' not in args[0]:
            super().log_message(format, *args)


if __name__ == '__main__':
    os.chdir(Path(__file__).parent)
    print(f'✨ 小魏工作台同步服务器启动')
    print(f'   局域网访问: http://YOUR_IP:{PORT}')
    print(f'   数据文件: {DATA_FILE}')
    http.server.HTTPServer(('0.0.0.0', PORT), SyncHandler).serve_forever()
