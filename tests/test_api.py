import json
import os
import threading
import time
import unittest
import urllib.request
from app import ThreadedHTTPServer, FloppyLabelerHandler

class TestAppAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start test server on random port
        cls.server = ThreadedHTTPServer(('127.0.0.1', 8899), FloppyLabelerHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever)
        cls.thread.daemon = True
        cls.thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_get_project(self):
        req = urllib.request.Request('http://127.0.0.1:8899/api/project')
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertIn('floppies', data)
            self.assertIn('settings', data)

    def test_post_project(self):
        payload = {
            "version": 1,
            "title": "Test Title",
            "settings": {},
            "floppies": [
                {
                    "id": "t1",
                    "number": 1,
                    "display_number": "01",
                    "album": "Test Album",
                    "artist": "Test Artist"
                }
            ]
        }
        req = urllib.request.Request(
            'http://127.0.0.1:8899/api/project',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data.get('success'))

    def test_upload_base64_image(self):
        # 1x1 red PNG
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        payload = {
            "image_data": f"data:image/png;base64,{png_b64}",
            "filename": "test_red.png"
        }
        req = urllib.request.Request(
            'http://127.0.0.1:8899/api/upload',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data.get('success'))
            self.assertTrue(data.get('filename').startswith('img_'))

    def test_render_pdf(self):
        payload = {
            "floppies": [
                {
                    "number": 1,
                    "display_number": "01",
                    "album": "Render Test",
                    "artist": "Artist",
                    "spine_style": "candy_cane",
                    "spine_color1": "#00F0FF",
                    "spine_color2": "#FF007F"
                }
            ],
            "settings": {"draw_guides": True}
        }
        req = urllib.request.Request(
            'http://127.0.0.1:8899/api/render-pdf',
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data.get('success'))
            self.assertIn('url', data)

if __name__ == '__main__':
    unittest.main()
