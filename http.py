from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Callable, Any, Dict, Optional
import json
from threading import Thread


class Request:
    def __init__(self, method: str, path: str, headers: Dict[str, str], body: str = ""):
        self.method = method
        self.path = path
        self.headers = headers
        self.body = body


class Response:
    def __init__(self):
        self.status = 200
        self.headers: Dict[str, str] = {}
        self.body = ""

    def set_status(self, status: int) -> None:
        self.status = status

    def set_header(self, name: str, value: str) -> None:
        self.headers[name] = value

    def set_body(self, body: str) -> None:
        self.body = body


_request_handler: Optional[Callable[[Request], None]] = None


class KiljuHTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._handle_request("GET")

    def do_POST(self) -> None:
        self._handle_request("POST")

    def do_PUT(self) -> None:
        self._handle_request("PUT")

    def do_DELETE(self) -> None:
        self._handle_request("DELETE")

    def _handle_request(self, method: str) -> None:
        content_length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""
        
        req = Request(method, self.path, dict(self.headers), body)
        
        if _request_handler:
            _request_handler(req)
        
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"OK")

    def log_message(self, format: str, *args: Any) -> None:
        pass


def serve(port: int, handler: Callable[[Request], None]) -> None:
    global _request_handler
    _request_handler = handler
    
    server = HTTPServer(("localhost", port), KiljuHTTPHandler)
    thread = Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()


def send(status: int, content: str) -> str:
    return f"HTTP {status}: {content}"


def json_response(data: Dict[str, Any], status: int = 200) -> str:
    return json.dumps({"status": status, "data": data})


def redirect(url: str, status: int = 302) -> str:
    return f"Redirect {status}: {url}"


def text_response(content: str, status: int = 200) -> str:
    return f"HTTP {status}: {content}"


def html_response(content: str, status: int = 200) -> str:
    return f'HTTP {status}: <html><body>{content}</body></html>'


def file_response(filepath: str, status: int = 200) -> str:
    try:
        with open(filepath, "r") as f:
            content = f.read()
        return f"HTTP {status}: {content}"
    except FileNotFoundError:
        return "HTTP 404: File not found"
