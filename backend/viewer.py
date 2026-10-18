#!/usr/bin/env python3
"""Private local viewer. The Cloudflare key never reaches browser JavaScript."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qs, urlencode
import json
import os

ROOT = Path(__file__).resolve().parent
KEY = Path(os.environ.get('DRAWBOX_INBOX_KEY_FILE', str(Path.home() / '.config/drawbox/inbox-key')))
ORIGIN = 'http://127.0.0.1:4319'
REMOTE = os.environ.get('DRAWBOX_INBOX_URL', 'https://drawbox.example.invalid/api/inbox')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, body, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get('Host') != '127.0.0.1:4319' or self.headers.get('Origin', ORIGIN) != ORIGIN:
            self.reply(403, b'{"error":"Local access only."}')
            return
        url = urlsplit(self.path)
        if url.path == '/':
            self.reply(200, (ROOT / 'inbox.html').read_bytes(), 'text/html;charset=utf-8')
            return
        if url.path != '/api/inbox':
            self.reply(404, b'{"error":"Not found."}')
            return
        params = parse_qs(url.query)
        query = urlencode({k: v[0] for k, v in params.items() if k in ('before', 'id')})
        try:
            token = KEY.read_text().strip()
            request = Request(REMOTE + ('?' + query if query else ''), headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'CanvasDrawingInbox/1.0'})
            with urlopen(request, timeout=15) as response:
                body = response.read(5_000_001)
                if len(body) > 5_000_000:
                    raise ValueError('Inbox page is too large.')
                self.reply(200, body)
        except HTTPError as error:
            self.reply(error.code, json.dumps({'error': 'Cloudflare rejected the inbox request (' + str(error.code) + ').'}).encode())
        except (OSError, URLError, ValueError):
            self.reply(503, b'{"error":"Could not connect to the private inbox."}')

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 4319), Handler).serve_forever()
