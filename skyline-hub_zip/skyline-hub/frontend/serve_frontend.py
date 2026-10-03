import http.server
import socketserver
import os
import sys

PORT = 5173
DIRECTORY = os.path.join(os.path.dirname(__file__), 'dist')

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path_without_query = self.path.split('?')[0]
        local_path = os.path.join(DIRECTORY, path_without_query.lstrip('/'))

        if not os.path.exists(local_path) and not path_without_query.startswith('/assets/'):
            self.path = '/index.html'

        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SPARequestHandler) as httpd:
        print(f"==================================================")
        print(f" Skyline Hub Frontend is running!")
        print(f" URL: http://localhost:{PORT}")
        print(f"==================================================")
        httpd.serve_forever()
