"""Read-only localhost evidence server with bounded paths and video byte ranges."""
import argparse
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


def handler_for(root):
    root = Path(root).resolve()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_file(True)

        def do_HEAD(self):
            self.send_file(False)

        def log_message(self, *args):
            pass

        def send_file(self, body):
            target = (root / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
            if target.is_dir():
                target = (target / 'study.html').resolve()
            if not target.is_relative_to(root):
                self.send_error(403)
                return
            if not target.is_file():
                self.send_error(404)
                return
            size = target.stat().st_size
            start, end, code = 0, size - 1, 200
            requested = self.headers.get('Range')
            if requested:
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
                if not match or not any(match.groups()) or not size:
                    self.send_error(416)
                    return
                if not match[1]:
                    start = max(0, size - int(match[2]))
                else:
                    start = int(match[1])
                    end = min(end, int(match[2])) if match[2] else end
                if start > end or start >= size:
                    self.send_error(416)
                    return
                code = 206
            self.send_response(code)
            self.send_header('Content-Type', mimetypes.guess_type(target)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(max(0, end - start + 1)))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            if code == 206:
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.end_headers()
            if body:
                try:
                    with target.open('rb') as stream:
                        stream.seek(start)
                        remaining = end - start + 1
                        while remaining > 0:
                            data = stream.read(min(262144, remaining))
                            if not data:
                                break
                            self.wfile.write(data)
                            remaining -= len(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    if not args.directory.is_dir():
        parser.error('Study directory does not exist')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(args.directory))
    print(f'http://127.0.0.1:{server.server_port}/study.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
