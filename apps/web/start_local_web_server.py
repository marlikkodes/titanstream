#!/usr/bin/env python3
"""
TitanStream Web Application Local Preview Server (Python Fallback Runner)
Serves Web App SPA on port 3000 and proxies /api/v1 to local API dev server on port 3001.
"""

import os
import json
import urllib.request
import urllib.error
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3000
API_TARGET = "http://127.0.0.1:3001"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')
WEB_DIR = DIST_DIR if os.path.exists(DIST_DIR) else BASE_DIR

# Add MIME types for JS/TS module loading
mimetypes.init()
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('text/javascript', '.ts')
mimetypes.add_type('text/javascript', '.tsx')
mimetypes.add_type('text/javascript', '.jsx')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/json', '.json')

class TitanWebHandler(SimpleHTTPRequestHandler):
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.ts': 'text/javascript',
        '.tsx': 'text/javascript',
        '.jsx': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _proxy_request(self):
        target_url = f"{API_TARGET}{self.path}"
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ['host', 'accept-encoding']:
                headers[k] = v

        req = urllib.request.Request(
            target_url,
            data=body,
            headers=headers,
            method=self.command
        )

        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ['transfer-encoding', 'content-length']:
                        self.send_header(k, v)
                resp_body = resp.read()
                self.send_header('Content-Length', str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in ['transfer-encoding', 'content-length']:
                    self.send_header(k, v)
            resp_body = e.read()
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in ['.js', '.mjs', '.ts', '.tsx', '.jsx']:
            return 'text/javascript'
        if ext == '.css':
            return 'text/css'
        if ext == '.json':
            return 'application/json'
        if ext == '.svg':
            return 'image/svg+xml'
        return super().guess_type(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.startswith('/api/') or self.path.startswith('/auth/'):
            return self._proxy_request()
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/') or self.path.startswith('/auth/'):
            return self._proxy_request()
        self.send_error(405)

    def do_PUT(self):
        if self.path.startswith('/api/') or self.path.startswith('/auth/'):
            return self._proxy_request()
        self.send_error(405)

    def do_DELETE(self):
        if self.path.startswith('/api/') or self.path.startswith('/auth/'):
            return self._proxy_request()
        self.send_error(405)

    def do_GET(self):
        if self.path.startswith('/api/') or self.path.startswith('/auth/'):
            return self._proxy_request()

        # Serve static assets or fallback to index.html for SPA routing
        req_path = os.path.join(WEB_DIR, self.path.lstrip('/'))
        if not os.path.exists(req_path) or os.path.isdir(req_path):
            if not any(self.path.endswith(e) for e in ['.js', '.ts', '.tsx', '.jsx', '.css', '.svg', '.json', '.png', '.jpg', '.ico']):
                self.path = '/index.html'
        return super().do_GET()

def run():
    server = HTTPServer(('0.0.0.0', PORT), TitanWebHandler)
    print(f'TitanStream Web Application Server listening on http://0.0.0.0:{PORT}...')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()

if __name__ == '__main__':
    run()
