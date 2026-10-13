import os
import tempfile
import unittest
from PIL import Image
from pdf_generator import (
    PAGE_WIDTH, PAGE_HEIGHT, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_TOP, MARGIN_BOTTOM,
    LABEL_WIDTH, LABEL_HEIGHT, STRIP_WIDTH, STRIP_HEIGHT,
    DEFAULT_FRONT_HEIGHT, DEFAULT_SPINE_HEIGHT, DEFAULT_BACK_HEIGHT,
    extract_image_colors, get_blurred_lightened_image,
    generate_floppy_pdf
)

class TestPdfGenerator(unittest.TestCase):
    def test_dimensions(self):
        """Verify dimensions match Label Outfitters 3.5\" sheet specifications."""
        self.assertAlmostEqual(PAGE_WIDTH, 8.5 * 72.0)
        self.assertAlmostEqual(PAGE_HEIGHT, 11.0 * 72.0)
        self.assertAlmostEqual(MARGIN_LEFT, 0.125 * 72.0)
        self.assertAlmostEqual(MARGIN_RIGHT, 0.125 * 72.0)
        self.assertAlmostEqual(MARGIN_TOP, 0.525 * 72.0)
        self.assertAlmostEqual(MARGIN_BOTTOM, 0.525 * 72.0)
        self.assertAlmostEqual(LABEL_WIDTH, 2.75 * 72.0)
        self.assertAlmostEqual(LABEL_HEIGHT, 2.75 * 72.0)
        self.assertAlmostEqual(STRIP_WIDTH, 1.375 * 72.0)
        self.assertAlmostEqual(STRIP_HEIGHT, 0.500 * 72.0)

        # Exact user diagram section proportions:
        # Rear: 0.500" (36.0 pt)
        # Spine: 0.125" (9.0 pt)
        # Front: 2.125" (153.0 pt)
        # Total: 2.750" (198.0 pt)
        self.assertAlmostEqual(DEFAULT_FRONT_HEIGHT, 2.125 * 72.0)
        self.assertAlmostEqual(DEFAULT_SPINE_HEIGHT, 0.125 * 72.0)
        self.assertAlmostEqual(DEFAULT_BACK_HEIGHT, 0.500 * 72.0)
        self.assertAlmostEqual(DEFAULT_FRONT_HEIGHT + DEFAULT_SPINE_HEIGHT + DEFAULT_BACK_HEIGHT, LABEL_HEIGHT)

        # Check total horizontal width: 0.125 + 3 * 2.75 + 0.125 = 8.5
        total_w = MARGIN_LEFT + 3 * LABEL_WIDTH + MARGIN_RIGHT
        self.assertAlmostEqual(total_w, PAGE_WIDTH)

        # Check total vertical height:
        # 0.525 top + 3*2.75 labels + 2*0.25 gaps + 0.10 gap + 2*0.50 strips + 0.10 gap + 0.525 bottom
        # = 0.525 + 8.25 + 0.50 + 0.10 + 1.00 + 0.10 + 0.525 = 11.0
        row_gaps = 2 * (0.25 * 72.0)
        strip_gaps = (0.100 * 72.0) + (0.100 * 72.0)
        total_h = MARGIN_TOP + 3 * LABEL_HEIGHT + row_gaps + strip_gaps + 2 * STRIP_HEIGHT + MARGIN_BOTTOM
        self.assertAlmostEqual(total_h, PAGE_HEIGHT)

    def test_extract_image_colors(self):
        """Verify color extraction returns two valid hex codes."""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
            img = Image.new('RGB', (100, 100), color=(0, 240, 255))
            # Put contrasting accent in bottom half
            for y in range(50, 100):
                for x in range(100):
                    img.putpixel((x, y), (255, 0, 127))
            img.save(tf.name)
            img_path = tf.name

        try:
            c1, c2 = extract_image_colors(img_path)
            self.assertTrue(c1.startswith('#'))
            self.assertTrue(c2.startswith('#'))
            self.assertEqual(len(c1), 7)
            self.assertEqual(len(c2), 7)
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)

    def test_blurred_lightened_image(self):
        """Verify blurred lightened background texture generation."""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
            img = Image.new('RGB', (80, 80), color=(20, 50, 120))
            img.save(tf.name)
            img_path = tf.name

        cache_dir = tempfile.mkdtemp()
        try:
            blurred_path = get_blurred_lightened_image(img_path, cache_dir)
            self.assertIsNotNone(blurred_path)
            self.assertTrue(os.path.exists(blurred_path))
            with Image.open(blurred_path) as res_img:
                # Should be heavily lightened (subtle texture)
                pixel = res_img.getpixel((40, 40))
                self.assertGreater(sum(pixel), 500)
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)

    def test_generate_multipage_pdf(self):
        """Verify generating a multi-page PDF with 15 floppies."""
        disks = []
        for i in range(1, 16):
            disks.append({
                'number': i,
                'display_number': f"{i:02d}",
                'album': f"Album {i}",
                'artist': f"Artist {i}",
                'spine_style': 'candy_cane' if i % 2 == 1 else 'solid',
                'spine_color1': '#00F0FF' if i % 2 == 1 else '#FF007F',
                'spine_color2': '#FF007F' if i % 2 == 1 else '#FFFFFF',
                'spine_text': '',  # test auto-derived spine text
                'back_text': f"Additional Artists for Disk {i}\nFeat. Guest Star\nRemix Edition",
            })

        output_path = '/tmp/test_multipage.pdf'
        result = generate_floppy_pdf(disks, output_path, settings={'draw_guides': True, 'bottom_strips_mode': 'spine_match'})
        self.assertTrue(os.path.exists(output_path))
        self.assertGreater(os.path.getsize(output_path), 1000)

    def test_multi_artist_splits(self):
        """Verify generating floppies with 2-diagonal, 3-skewed, and 4-quadrant splits."""
        # Create 2 temp images
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf1, \
             tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf2:
            Image.new('RGB', (60, 60), color=(255, 0, 0)).save(tf1.name)
            Image.new('RGB', (60, 60), color=(0, 0, 255)).save(tf2.name)
            p1, p2 = tf1.name, tf2.name

        try:
            img_dir = tempfile.mkdtemp()
            # Copy to img_dir
            import shutil
            shutil.copy(p1, os.path.join(img_dir, 'img1.png'))
            shutil.copy(p2, os.path.join(img_dir, 'img2.png'))

            disks = [
                {
                    'number': 1,
                    'album': 'Split 2',
                    'artist': 'Artist 1 / Artist 2',
                    'cover_layout': 'split_2_diagonal',
                    'image': 'img1.png',
                    'image2': 'img2.png',
                    'spine_style': 'candy_cane'
                },
                {
                    'number': 2,
                    'album': 'Split 3',
                    'artist': 'Trio',
                    'cover_layout': 'split_3_skewed',
                    'image': 'img1.png',
                    'image2': 'img2.png',
                    'image3': 'img1.png',
                    'spine_style': 'candy_cane'
                },
                {
                    'number': 3,
                    'album': 'Quadrant 4',
                    'artist': 'Quartet',
                    'cover_layout': 'split_4_quadrant',
                    'image': 'img1.png',
                    'image2': 'img2.png',
                    'image3': 'img1.png',
                    'image4': 'img2.png',
                    'spine_style': 'solid'
                }
            ]
            out = '/tmp/test_splits.pdf'
            generate_floppy_pdf(disks, out, image_base_dir=img_dir, settings={'draw_guides': True})
            self.assertTrue(os.path.exists(out))
            self.assertGreater(os.path.getsize(out), 1000)
        finally:
            if os.path.exists(p1): os.remove(p1)
            if os.path.exists(p2): os.remove(p2)

    def test_independent_slot_transforms_and_default_solid_spine(self):
        """Verify independent zoom, pan_x, pan_y, and fit_mode per slot and default solid spine."""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
            Image.new('RGB', (100, 100), color=(100, 200, 50)).save(tf.name)
            p = tf.name

        try:
            img_dir = tempfile.mkdtemp()
            import shutil
            shutil.copy(p, os.path.join(img_dir, 'slot1.png'))
            shutil.copy(p, os.path.join(img_dir, 'slot2.png'))

            disk = {
                'number': 1,
                'album': 'Dual Artist Test',
                'artist': 'Alpha & Beta',
                'cover_layout': 'split_2_diagonal',
                'image': 'slot1.png',
                'zoom1': 1.5,
                'pan_x1': 25.0,
                'pan_y1': -10.0,
                'fit_mode1': 'contain',
                'image2': 'slot2.png',
                'zoom2': 0.8,
                'pan_x2': -15.0,
                'pan_y2': 30.0,
                'fit_mode2': 'cover',
                # spine_style omitted to verify default 'solid'
            }
            out = '/tmp/test_slot_transforms.pdf'
            generate_floppy_pdf([disk], out, image_base_dir=img_dir)
            self.assertTrue(os.path.exists(out))
            self.assertGreater(os.path.getsize(out), 1000)
        finally:
            if os.path.exists(p): os.remove(p)

if __name__ == '__main__':
    unittest.main()
