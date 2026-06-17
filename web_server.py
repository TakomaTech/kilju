from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import io
import sys
from pathlib import Path

from parser import parse_source
from interpreter import Interpreter


class KiljuCompilerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.serve_file('static/index.html', 'text/html')
        elif self.path == '/style.css':
            self.serve_file('static/style.css', 'text/css')
        elif self.path == '/script.js':
            self.serve_file('static/script.js', 'application/javascript')
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/run':
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                code = data.get('code', '')
                
                output = self.execute_kilju(code)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': True, 'output': output})
                self.wfile.write(response.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': False, 'error': str(e)})
                self.wfile.write(response.encode('utf-8'))
        else:
            self.send_error(404)

    def serve_file(self, filepath, content_type):
        path = Path(filepath)
        if path.exists():
            with open(path, 'r') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
        else:
            self.send_error(404)

    def execute_kilju(self, code):
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        try:
            program = parse_source(code)
            interpreter = Interpreter()
            interpreter.execute(program)
            output = sys.stdout.getvalue()
            return output if output else "(no output)"
        finally:
            sys.stdout = old_stdout

    def log_message(self, format, *args):
        pass


def main():
    server_address = ('localhost', 8000)
    httpd = HTTPServer(server_address, KiljuCompilerHandler)
    print('Kilju Online Compiler running at http://localhost:8000')
    httpd.serve_forever()


if __name__ == '__main__':
    main()
