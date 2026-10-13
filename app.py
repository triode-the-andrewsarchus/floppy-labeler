#!/usr/bin/env python3
"""
app.py
Main web server and backend for Floppy Diskette NFC Music Labeler.
Provides REST APIs for project persistence, image upload (including clipboard paste),
and print-ready PDF generation using ReportLab.
"""

import base64
import http.server
import json
import mimetypes
import os
import sys
import time
import urllib.parse
import uuid
import webbrowser
from http import HTTPStatus
from socketserver import ThreadingMixIn

from pdf_generator import generate_floppy_pdf, extract_image_colors

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
USER_DATA_DIR = os.path.join(BASE_DIR, 'user_data')
IMAGES_DIR = os.path.join(USER_DATA_DIR, 'images')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
PROJECT_FILE = os.path.join(USER_DATA_DIR, 'project.json')

# Ensure directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

DEFAULT_PROJECT = {
    "version": 1,
    "title": "My Floppy Music Collection",
    "settings": {
        "layout_mode": "back_spine_front",
        "invert_back_text": True,
        "draw_guides": True,
        "bottom_strips_mode": "spine_match",
        "number_prefix": "",
        "number_pad": 2,
        "number_size": 20.0,
        "front_height": 153.0,  # 2.125"
        "spine_height": 9.0,    # 0.125"
        "back_height": 36.0     # 0.500"
    },
    "floppies": [
        {
            "id": "demo-1",
            "number": 1,
            "display_number": "01",
            "album": "Discovery",
            "artist": "Daft Punk",
            "year": "2001",
            "template": "single_album",
            "spine_style": "solid",
            "spine_color1": "#00F0FF",
            "spine_color2": "#FF007F",
            "spine_stripe_width": 4.5,
            "spine_stripe_angle": 45.0,
            "spine_text": "",
            "spine_text_color": "#FFFFFF",
            "back_bg_color": "#F8F9FA",
            "back_text_color": "#111827",
            "two_columns": False,
            "back_text": "Daft Punk - Discovery (2001)\nBonus: Daft Club Remixes\nFeat. Romanthony & Todd Edwards",
            "image": "demo_discovery.png",
            "fit_mode": "cover",
            "zoom": 1.0,
            "pan_x": 0.0,
            "pan_y": 0.0
        },
        {
            "id": "demo-2",
            "number": 2,
            "display_number": "02",
            "album": "Abbey Road",
            "artist": "The Beatles",
            "year": "1969",
            "template": "single_album",
            "spine_style": "solid",
            "spine_color1": "#1C2530",
            "spine_color2": "#ECEDED",
            "spine_stripe_width": 4.5,
            "spine_stripe_angle": 45.0,
            "spine_text": "",
            "spine_text_color": "#FFFFFF",
            "back_bg_color": "#F8F9FA",
            "back_text_color": "#111827",
            "two_columns": False,
            "back_text": "The Beatles - Abbey Road (1969)\nSide A & B • Apple Records\nRemastered Edition",
            "image": "demo_abbey_road.png",
            "fit_mode": "cover",
            "zoom": 1.0,
            "pan_x": 0.0,
            "pan_y": 0.0
        },
        {
            "id": "demo-3",
            "number": 3,
            "display_number": "03",
            "album": "Synthwave Chillout",
            "artist": "Tycho / Boards of Canada",
            "year": "1998",
            "template": "split_album",
            "cover_layout": "split_2_diagonal",
            "spine_style": "solid",
            "spine_color1": "#F77F00",
            "spine_color2": "#003049",
            "spine_stripe_width": 4.5,
            "spine_stripe_angle": 45.0,
            "spine_text": "",
            "spine_text_color": "#FFFFFF",
            "back_bg_color": "#F8F9FA",
            "back_text_color": "#111827",
            "two_columns": False,
            "back_text": "Split 2-in-1 Double EP:\n1. Tycho - Past is Prologue\n2. Boards of Canada - Music has the Right",
            "image": "demo_discovery.png",
            "image2": "demo_abbey_road.png",
            "fit_mode": "cover",
            "zoom": 1.0,
            "pan_x": 0.0,
            "pan_y": 0.0
        }
    ]
}


def load_project() -> dict:
    if os.path.exists(PROJECT_FILE):
        try:
            with open(PROJECT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading project file: {e}. Using default.")
    return DEFAULT_PROJECT


def save_project(data: dict):
    with open(PROJECT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


class FloppyLabelerHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP request handler with REST API and static file serving."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/' or path == '/index.html':
            self.serve_file(os.path.join(STATIC_DIR, 'index.html'), 'text/html')
            return

        if path == '/api/project':
            project = load_project()
            self.send_json(project)
            return

        if path.startswith('/user_data/images/'):
            filename = os.path.basename(path)
            file_path = os.path.join(IMAGES_DIR, filename)
            if os.path.exists(file_path):
                mime, _ = mimetypes.guess_type(file_path)
                self.serve_file(file_path, mime or 'image/png')
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Image not found")
            return

        if path.startswith('/output/'):
            filename = os.path.basename(path)
            file_path = os.path.join(OUTPUT_DIR, filename)
            if os.path.exists(file_path):
                self.serve_file(file_path, 'application/pdf')
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "PDF not found")
            return

        # Serve static assets (both /static/... and /...)
        clean_path = path
        if clean_path.startswith('/static/'):
            clean_path = clean_path[len('/static/'):]
        static_file = os.path.join(STATIC_DIR, clean_path.lstrip('/'))
        if os.path.exists(static_file) and not os.path.isdir(static_file):
            mime, _ = mimetypes.guess_type(static_file)
            self.serve_file(static_file, mime or 'application/octet-stream')
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b''

        if path == '/api/project':
            try:
                data = json.loads(body.decode('utf-8'))
                save_project(data)
                self.send_json({"success": True, "message": "Saved successfully", "time": time.time()})
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=400)
            return

        if path == '/api/upload':
            try:
                # Can receive JSON with base64 data (clipboard paste or drag-drop) or multipart
                content_type = self.headers.get('Content-Type', '')
                if 'application/json' in content_type:
                    req_data = json.loads(body.decode('utf-8'))
                    image_data = req_data.get('image_data', '')
                    orig_name = req_data.get('filename', 'paste.png')

                    if ',' in image_data:
                        # Strip header: data:image/png;base64,...
                        header, b64_str = image_data.split(',', 1)
                        ext = '.png'
                        if 'jpeg' in header or 'jpg' in header:
                            ext = '.jpg'
                        elif 'webp' in header:
                            ext = '.webp'
                    else:
                        b64_str = image_data
                        ext = os.path.splitext(orig_name)[1] or '.png'

                    img_bytes = base64.b64decode(b64_str)
                    unique_id = uuid.uuid4().hex[:12]
                    filename = f"img_{unique_id}{ext}"
                    dest_path = os.path.join(IMAGES_DIR, filename)

                    with open(dest_path, 'wb') as f:
                        f.write(img_bytes)

                    # Extract dominant and accent colors from image
                    c1, c2 = extract_image_colors(dest_path)

                    self.send_json({
                        "success": True,
                        "filename": filename,
                        "url": f"/user_data/images/{filename}",
                        "colors": {
                            "color1": c1,
                            "color2": c2
                        }
                    })
                    return
                else:
                    self.send_json({"success": False, "error": "Expected application/json with base64"}, status=400)
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        if path == '/api/extract-colors':
            try:
                req_data = json.loads(body.decode('utf-8')) if body else {}
                filename = os.path.basename(req_data.get('filename', ''))
                img_path = os.path.join(IMAGES_DIR, filename)
                if os.path.exists(img_path):
                    c1, c2 = extract_image_colors(img_path)
                    self.send_json({"success": True, "colors": {"color1": c1, "color2": c2}})
                else:
                    self.send_json({"success": False, "error": "Image not found"}, status=404)
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        if path == '/api/render-pdf':
            try:
                req_data = json.loads(body.decode('utf-8')) if body else {}
                project = load_project()

                floppies = req_data.get('floppies', project.get('floppies', []))
                settings = req_data.get('settings', project.get('settings', {}))

                timestamp = time.strftime('%Y%m%d_%H%M%S')
                pdf_filename = f"floppy_labels_{timestamp}.pdf"
                pdf_path = os.path.join(OUTPUT_DIR, pdf_filename)
                cache_dir = os.path.join(USER_DATA_DIR, 'cache')

                generate_floppy_pdf(floppies, pdf_path, settings=settings,
                                    image_base_dir=IMAGES_DIR, cache_dir=cache_dir)

                self.send_json({
                    "success": True,
                    "filename": pdf_filename,
                    "url": f"/output/{pdf_filename}",
                    "pages": max(1, (len(floppies) + 8) // 9),
                    "total_labels": len(floppies)
                })
            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        if path == '/api/reset-project':
            save_project(DEFAULT_PROJECT)
            self.send_json({"success": True, "project": DEFAULT_PROJECT})
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def serve_file(self, file_path: str, content_type: str):
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f"Error reading file: {e}")

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(body)


class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def run(port: int = 8080, open_browser: bool = True):
    server_address = ('', port)
    httpd = ThreadedHTTPServer(server_address, FloppyLabelerHandler)
    url = f"http://localhost:{port}"
    print(f"\n=======================================================")
    print(f"  Floppy Diskette NFC Music Labeler Studio")
    print(f"  Avery 5096/5196 & Label Outfitters 3.5\" Diskette")
    print(f"  Web Studio running at: {url}")
    print(f"=======================================================\n")

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"Could not open browser automatically: {e}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Floppy Diskette NFC Music Labeler")
    parser.add_argument('--port', type=int, default=8080, help="Port to run server on (default: 8080)")
    parser.add_argument('--no-browser', action='store_true', help="Do not open browser automatically")
    args = parser.parse_args()

    run(port=args.port, open_browser=not args.no_browser)
