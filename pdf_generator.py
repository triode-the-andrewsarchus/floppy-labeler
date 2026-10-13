#!/usr/bin/env python3
"""
pdf_generator.py
Generates print-ready PDFs for Label Outfitters 3.5" Diskette Labels
(Avery 5096 / 5196 / CompuLabel 311400 template compatible).

Exact label section dimensions:
- Total Width: 2.75" (198.0 pt)
- Total Height: 2.75" (198.0 pt)
- Front Cover: 2.125" (153.0 pt) - 77.27%
- Spine Edge: 0.125" (9.0 pt) - 4.55%
- Rear Strip: 0.500" (36.0 pt) - 18.18%
"""

import math
import os
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageFilter

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Dimension constants in points (72 pt = 1 inch)
PAGE_WIDTH = 8.5 * 72.0      # 612.0 pt
PAGE_HEIGHT = 11.0 * 72.0    # 792.0 pt

MARGIN_LEFT = 0.125 * 72.0   # 9.0 pt
MARGIN_RIGHT = 0.125 * 72.0  # 9.0 pt
MARGIN_TOP = 0.525 * 72.0    # 37.8 pt
MARGIN_BOTTOM = 0.525 * 72.0 # 37.8 pt

LABEL_WIDTH = 2.75 * 72.0    # 198.0 pt
LABEL_HEIGHT = 2.75 * 72.0   # 198.0 pt

ROW_GAP = 0.25 * 72.0        # 18.0 pt
STRIP_GAP_TOP = 0.100 * 72.0 # 7.2 pt
STRIP_GAP_ROW = 0.100 * 72.0 # 7.2 pt

STRIP_WIDTH = 1.375 * 72.0   # 99.0 pt
STRIP_HEIGHT = 0.500 * 72.0  # 36.0 pt

LABELS_PER_PAGE = 9
COLS = 3
ROWS = 3

# EXACT Label section breakdown matching specifications:
# 2.125" Front + 0.125" Spine + 0.500" Rear = 2.750"
DEFAULT_FRONT_HEIGHT = 2.125 * 72.0  # 153.0 pt (Front cover image)
DEFAULT_SPINE_HEIGHT = 0.125 * 72.0  # 9.0 pt (Spine edge)
DEFAULT_BACK_HEIGHT = 0.500 * 72.0   # 36.0 pt (Rear strip text)


def hex_to_color(hex_str: str, default: colors.Color = colors.white) -> colors.Color:
    """Converts a hex color string to a ReportLab Color object."""
    if not hex_str:
        return default
    hex_clean = hex_str.strip().lstrip('#')
    if len(hex_clean) == 3:
        hex_clean = ''.join(c * 2 for c in hex_clean)
    if len(hex_clean) != 6:
        return default
    try:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        return colors.Color(r, g, b)
    except ValueError:
        return default


def extract_image_colors(img_path: str) -> Tuple[str, str]:
    """
    Extracts two harmonious / dominant colors from an album cover image.
    Returns (hex_primary, hex_secondary).
    """
    try:
        with Image.open(img_path) as img:
            small = img.resize((60, 60)).convert('RGB')
            raw_colors = small.getcolors(maxcolors=3600)
            if not raw_colors:
                return ('#00F0FF', '#FF007F')

            raw_colors.sort(key=lambda c: c[0], reverse=True)

            def rgb_to_hex(r, g, b):
                return f'#{r:02X}{g:02X}{b:02X}'

            # Filter out near-pure black or near-pure white for primary color
            filtered = [c[1] for c in raw_colors if 55 < sum(c[1]) < 710]
            if not filtered:
                filtered = [c[1] for c in raw_colors]

            c1 = filtered[0] if filtered else (217, 4, 41)

            # Find a contrasting secondary color
            def dist_sq(a, b):
                return (a[0] - b[0])**2 + (a[1] - b[1])**2 + (a[2] - b[2])**2

            contrasts = sorted(filtered, key=lambda c: dist_sq(c, c1), reverse=True)
            if contrasts and dist_sq(contrasts[0], c1) > 1400:
                c2 = contrasts[0]
            else:
                # If image is monochromatic, pair with clean white or accent
                c2 = (255, 255, 255) if sum(c1) < 400 else (20, 20, 25)

            return (rgb_to_hex(*c1), rgb_to_hex(*c2))
    except Exception as e:
        print(f"Error extracting colors from {img_path}: {e}")
        return ('#00F0FF', '#FF007F')


def get_blurred_lightened_image(img_input: Any, cache_dir: str) -> Optional[str]:
    """
    Generates and caches a heavily blurred and lightened version of the album cover(s)
    for the back strip texture. Lightened enough so dark text reads clearly without border.
    Supports single image path or a list of image paths for multi-artist covers.
    """
    if not img_input:
        return None
    paths = [p for p in (img_input if isinstance(img_input, (list, tuple)) else [img_input]) if p and os.path.exists(p)]
    if not paths:
        return None

    try:
        os.makedirs(cache_dir, exist_ok=True)
        key_parts = [f"{os.path.splitext(os.path.basename(p))[0]}_{int(os.path.getmtime(p))}" for p in paths]
        cache_name = "_".join(key_parts)
        if len(cache_name) > 60:
            import hashlib
            cache_name = hashlib.md5(cache_name.encode('utf-8')).hexdigest()
        cache_path = os.path.join(cache_dir, f"{cache_name}_blur_light.png")

        # Reuse cache if newer than originals
        if os.path.exists(cache_path):
            return cache_path

        target_size = (400, 400)
        if len(paths) == 1:
            with Image.open(paths[0]) as img:
                composite = img.convert('RGB').resize(target_size)
        elif len(paths) == 2:
            composite = Image.new('RGB', target_size)
            with Image.open(paths[0]) as img1, Image.open(paths[1]) as img2:
                i1 = img1.convert('RGB').resize((200, 400))
                i2 = img2.convert('RGB').resize((200, 400))
                composite.paste(i1, (0, 0))
                composite.paste(i2, (200, 0))
        elif len(paths) == 3:
            composite = Image.new('RGB', target_size)
            w_third = 133
            with Image.open(paths[0]) as img1, Image.open(paths[1]) as img2, Image.open(paths[2]) as img3:
                composite.paste(img1.convert('RGB').resize((w_third, 400)), (0, 0))
                composite.paste(img2.convert('RGB').resize((w_third, 400)), (w_third, 0))
                composite.paste(img3.convert('RGB').resize((400 - 2 * w_third, 400)), (2 * w_third, 0))
        else:
            composite = Image.new('RGB', target_size)
            half = 200
            for idx, p in enumerate(paths[:4]):
                with Image.open(p) as img:
                    im = img.convert('RGB').resize((half, half))
                    gx = (idx % 2) * half
                    gy = (idx // 2) * half
                    composite.paste(im, (gx, gy))

        # Heavy Gaussian blur
        blurred = composite.filter(ImageFilter.GaussianBlur(radius=16))
        # Heavily lighten by blending 84% pure white
        white = Image.new('RGB', blurred.size, (255, 255, 255))
        lightened = Image.blend(blurred, white, 0.84)
        lightened.save(cache_path, format='PNG')
        return cache_path
    except Exception as e:
        print(f"Error creating blurred lightened image for {img_input}: {e}")
        return None


def draw_polygon_image(c: canvas.Canvas, img_path: str,
                       poly_pts: List[Tuple[float, float]],
                       bbox: Tuple[float, float, float, float],
                       fit_mode: str = 'cover',
                       zoom: float = 1.0, pan_x: float = 0.0, pan_y: float = 0.0):
    """
    Clips canvas to poly_pts and draws an image centered inside bbox.
    """
    c.saveState()
    clip = c.beginPath()
    clip.moveTo(poly_pts[0][0], poly_pts[0][1])
    for pt in poly_pts[1:]:
        clip.lineTo(pt[0], pt[1])
    clip.close()
    c.clipPath(clip, stroke=0)

    box_x, box_y, box_w, box_h = bbox
    if img_path and os.path.exists(img_path):
        try:
            with Image.open(img_path) as pil_img:
                img_w, img_h = pil_img.size

            aspect_box = box_w / box_h if box_h > 0 else 1.0
            aspect_img = img_w / img_h if img_h > 0 else 1.0

            if fit_mode == 'cover':
                scale = (box_h / img_h if aspect_img > aspect_box else box_w / img_w) * zoom
            else:
                scale = (box_w / img_w if aspect_img > aspect_box else box_h / img_h) * zoom

            draw_w = img_w * scale
            draw_h = img_h * scale

            offset_x = (box_w - draw_w) / 2.0 + (pan_x / 100.0) * (box_w / 2.0)
            offset_y = (box_h - draw_h) / 2.0 - (pan_y / 100.0) * (box_h / 2.0)

            c.drawImage(img_path, box_x + offset_x, box_y + offset_y,
                        width=draw_w, height=draw_h, preserveAspectRatio=True)
        except Exception as e:
            print(f"Error drawing polygon image {img_path}: {e}")
            c.setFillColor(colors.HexColor('#1f2330'))
            c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=0)
    else:
        c.setFillColor(colors.HexColor('#1f2330'))
        c.rect(box_x, box_y, box_w, box_h, fill=1, stroke=0)

    c.restoreState()


def draw_divider_line(c: canvas.Canvas, pt1: Tuple[float, float], pt2: Tuple[float, float],
                      width: float = 1.6):
    """Draws a crisp divider line with dark border and bright core."""
    c.saveState()
    c.setStrokeColor(colors.HexColor('#0b0e14'))
    c.setLineWidth(width + 1.2)
    c.setLineCap(1)
    c.line(pt1[0], pt1[1], pt2[0], pt2[1])

    c.setStrokeColor(colors.HexColor('#ffffff'))
    c.setLineWidth(width * 0.7)
    c.line(pt1[0], pt1[1], pt2[0], pt2[1])
    c.restoreState()


def draw_candy_cane(c: canvas.Canvas, x: float, y: float, w: float, h: float,
                    color1: colors.Color, color2: colors.Color,
                    stripe_width: float = 4.5, angle_deg: float = 45.0):
    """Draws candy-cane diagonal stripes clipped to a bounding rectangle."""
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0)

    # Base color
    c.setFillColor(color1)
    c.rect(x, y, w, h, fill=1, stroke=0)

    # Diagonal stripes
    c.setFillColor(color2)
    rad = math.radians(angle_deg)
    tan_val = math.tan(rad) if math.cos(rad) != 0 else 1.0
    dx = h / tan_val if tan_val != 0 else h

    step = stripe_width * 2.0
    min_x = x - abs(dx) - step * 2
    max_x = x + w + abs(dx) + step * 2

    curr_x = min_x
    while curr_x < max_x:
        poly = c.beginPath()
        poly.moveTo(curr_x, y)
        poly.lineTo(curr_x + stripe_width, y)
        poly.lineTo(curr_x + stripe_width + dx, y + h)
        poly.lineTo(curr_x + dx, y + h)
        poly.close()
        c.drawPath(poly, fill=1, stroke=0)
        curr_x += step

    c.restoreState()


def draw_stroked_text(c: canvas.Canvas, text: str, x: float, y: float,
                      font_name: str = 'Helvetica-Bold', font_size: float = 20.0,
                      fill_color: colors.Color = colors.white,
                      stroke_color: colors.Color = colors.black,
                      stroke_width: float = 1.8):
    """Draws crisp outlined text with black border and white interior."""
    c.saveState()
    c.setFont(font_name, font_size)

    offsets = [
        (-stroke_width, -stroke_width), (-stroke_width, 0), (-stroke_width, stroke_width),
        (0, -stroke_width),                                 (0, stroke_width),
        (stroke_width, -stroke_width),  (stroke_width, 0),  (stroke_width, stroke_width),
        (-stroke_width * 0.7, -stroke_width * 0.7),
        (stroke_width * 0.7, stroke_width * 0.7),
    ]
    c.setFillColor(stroke_color)
    for ox, oy in offsets:
        c.drawString(x + ox, y + oy, text)

    c.setFillColor(fill_color)
    c.drawString(x, y, text)
    c.restoreState()


def draw_floppy_label(c: canvas.Canvas, origin_x: float, origin_y: float,
                      disk: Dict[str, Any], settings: Dict[str, Any],
                      image_base_dir: str = "", cache_dir: str = ""):
    """
    Renders one 2.75" x 2.75" floppy diskette label.
    origin_x, origin_y: bottom-left coordinates of the label on the PDF canvas.
    Exact proportions:
      Front: 2.125" (153.0 pt)
      Spine: 0.125" (9.0 pt)
      Rear:  0.500" (36.0 pt)
    """
    front_h = settings.get('front_height', DEFAULT_FRONT_HEIGHT)
    spine_h = settings.get('spine_height', DEFAULT_SPINE_HEIGHT)
    back_h = settings.get('back_height', DEFAULT_BACK_HEIGHT)
    layout_mode = settings.get('layout_mode', 'back_spine_front')
    invert_back = settings.get('invert_back_text', True)
    draw_guides = settings.get('draw_guides', False)

    # Section Y positions (origin_y is bottom of label)
    if layout_mode == 'back_spine_front':
        # Default wrap-around: Front at bottom, Spine in middle, Rear strip at top
        front_y = origin_y
        spine_y = origin_y + front_h
        back_y = origin_y + front_h + spine_h
    else:
        # Alternative: Front at top, Spine in middle, Rear strip at bottom
        back_y = origin_y
        spine_y = origin_y + back_h
        front_y = origin_y + back_h + spine_h

    # =========================================================================
    # 1. FRONT SECTION (Main Cover Image + Sequential Number)
    # Height: 2.125" (153.0 pt)
    # =========================================================================
    c.saveState()
    front_clip = c.beginPath()
    front_clip.rect(origin_x, front_y, LABEL_WIDTH, front_h)
    c.clipPath(front_clip, stroke=0)

    # Dark background base
    c.setFillColor(colors.HexColor('#111319'))
    c.rect(origin_x, front_y, LABEL_WIDTH, front_h, fill=1, stroke=0)

    img1_file = disk.get('image', '')
    img2_file = disk.get('image2', '')
    img3_file = disk.get('image3', '')
    img4_file = disk.get('image4', '')

    img_path1 = os.path.join(image_base_dir, img1_file) if img1_file else ""
    img_path2 = os.path.join(image_base_dir, img2_file) if img2_file else ""
    img_path3 = os.path.join(image_base_dir, img3_file) if img3_file else ""
    img_path4 = os.path.join(image_base_dir, img4_file) if img4_file else ""

    cover_layout = disk.get('cover_layout', 'single')

    if cover_layout == 'split_2_diagonal':
        # 45-degree diagonal split passing through center (Arcade VS style)
        x_top = origin_x + 22.5
        x_bot = origin_x + 175.5
        y_top = front_y + front_h
        y_bot = front_y

        poly1 = [
            (origin_x, y_bot),
            (origin_x, y_top),
            (x_top, y_top),
            (x_bot, y_bot)
        ]
        poly2 = [
            (x_top, y_top),
            (origin_x + LABEL_WIDTH, y_top),
            (origin_x + LABEL_WIDTH, y_bot),
            (x_bot, y_bot)
        ]

        draw_polygon_image(c, img_path1, poly1, (origin_x, front_y, LABEL_WIDTH, front_h),
                           fit_mode=disk.get('fit_mode1', disk.get('fit_mode', 'cover')),
                           zoom=float(disk.get('zoom1', disk.get('zoom', 1.0))),
                           pan_x=float(disk.get('pan_x1', disk.get('pan_x', 0.0))),
                           pan_y=float(disk.get('pan_y1', disk.get('pan_y', 0.0))))
        draw_polygon_image(c, img_path2 or img_path1, poly2, (origin_x, front_y, LABEL_WIDTH, front_h),
                           fit_mode=disk.get('fit_mode2', 'cover'),
                           zoom=float(disk.get('zoom2', 1.0)),
                           pan_x=float(disk.get('pan_x2', 0.0)),
                           pan_y=float(disk.get('pan_y2', 0.0)))

        draw_divider_line(c, (x_top, y_top), (x_bot, y_bot), width=1.6)

    elif cover_layout == 'split_3_skewed':
        # 3 parallel skewed diagonal bars across the cover
        d1_top = (origin_x + 48.0, front_y + front_h)
        d1_bot = (origin_x + 84.0, front_y)
        d2_top = (origin_x + 114.0, front_y + front_h)
        d2_bot = (origin_x + 150.0, front_y)

        poly1 = [
            (origin_x, front_y),
            (origin_x, front_y + front_h),
            d1_top,
            d1_bot
        ]
        poly2 = [
            d1_bot,
            d1_top,
            d2_top,
            d2_bot
        ]
        poly3 = [
            d2_bot,
            d2_top,
            (origin_x + LABEL_WIDTH, front_y + front_h),
            (origin_x + LABEL_WIDTH, front_y)
        ]

        draw_polygon_image(c, img_path1, poly1, (origin_x, front_y, LABEL_WIDTH, front_h),
                           fit_mode=disk.get('fit_mode1', disk.get('fit_mode', 'cover')),
                           zoom=float(disk.get('zoom1', disk.get('zoom', 1.0))),
                           pan_x=float(disk.get('pan_x1', disk.get('pan_x', 0.0))),
                           pan_y=float(disk.get('pan_y1', disk.get('pan_y', 0.0))))
        draw_polygon_image(c, img_path2 or img_path1, poly2, (origin_x, front_y, LABEL_WIDTH, front_h),
                           fit_mode=disk.get('fit_mode2', 'cover'),
                           zoom=float(disk.get('zoom2', 1.0)),
                           pan_x=float(disk.get('pan_x2', 0.0)),
                           pan_y=float(disk.get('pan_y2', 0.0)))
        draw_polygon_image(c, img_path3 or img_path2 or img_path1, poly3, (origin_x, front_y, LABEL_WIDTH, front_h),
                           fit_mode=disk.get('fit_mode3', 'cover'),
                           zoom=float(disk.get('zoom3', 1.0)),
                           pan_x=float(disk.get('pan_x3', 0.0)),
                           pan_y=float(disk.get('pan_y3', 0.0)))

        draw_divider_line(c, d1_top, d1_bot, width=1.4)
        draw_divider_line(c, d2_top, d2_bot, width=1.4)

    elif cover_layout == 'split_4_quadrant':
        # 4 equal quadrants (2x2 grid)
        mid_x = origin_x + LABEL_WIDTH / 2.0
        mid_y = front_y + front_h / 2.0
        half_w = LABEL_WIDTH / 2.0
        half_h = front_h / 2.0

        q1 = [(origin_x, mid_y), (origin_x, front_y + front_h), (mid_x, front_y + front_h), (mid_x, mid_y)]
        q2 = [(mid_x, mid_y), (mid_x, front_y + front_h), (origin_x + LABEL_WIDTH, front_y + front_h), (origin_x + LABEL_WIDTH, mid_y)]
        q3 = [(origin_x, front_y), (origin_x, mid_y), (mid_x, mid_y), (mid_x, front_y)]
        q4 = [(mid_x, front_y), (mid_x, mid_y), (origin_x + LABEL_WIDTH, mid_y), (origin_x + LABEL_WIDTH, front_y)]

        draw_polygon_image(c, img_path1, q1, (origin_x, mid_y, half_w, half_h),
                           fit_mode=disk.get('fit_mode1', disk.get('fit_mode', 'cover')),
                           zoom=float(disk.get('zoom1', disk.get('zoom', 1.0))),
                           pan_x=float(disk.get('pan_x1', disk.get('pan_x', 0.0))),
                           pan_y=float(disk.get('pan_y1', disk.get('pan_y', 0.0))))
        draw_polygon_image(c, img_path2 or img_path1, q2, (mid_x, mid_y, half_w, half_h),
                           fit_mode=disk.get('fit_mode2', 'cover'),
                           zoom=float(disk.get('zoom2', 1.0)),
                           pan_x=float(disk.get('pan_x2', 0.0)),
                           pan_y=float(disk.get('pan_y2', 0.0)))
        draw_polygon_image(c, img_path3 or img_path1, q3, (origin_x, front_y, half_w, half_h),
                           fit_mode=disk.get('fit_mode3', 'cover'),
                           zoom=float(disk.get('zoom3', 1.0)),
                           pan_x=float(disk.get('pan_x3', 0.0)),
                           pan_y=float(disk.get('pan_y3', 0.0)))
        draw_polygon_image(c, img_path4 or img_path2 or img_path1, q4, (mid_x, front_y, half_w, half_h),
                           fit_mode=disk.get('fit_mode4', 'cover'),
                           zoom=float(disk.get('zoom4', 1.0)),
                           pan_x=float(disk.get('pan_x4', 0.0)),
                           pan_y=float(disk.get('pan_y4', 0.0)))

        draw_divider_line(c, (mid_x, front_y), (mid_x, front_y + front_h), width=1.4)
        draw_divider_line(c, (origin_x, mid_y), (origin_x + LABEL_WIDTH, mid_y), width=1.4)

    else:
        # Standard Single Image
        if img_path1 and os.path.exists(img_path1):
            try:
                with Image.open(img_path1) as pil_img:
                    img_w, img_h = pil_img.size

                fit_mode = disk.get('fit_mode1', disk.get('fit_mode', 'cover'))
                zoom = float(disk.get('zoom1', disk.get('zoom', 1.0)))
                pan_x = float(disk.get('pan_x1', disk.get('pan_x', 0.0)))
                pan_y = float(disk.get('pan_y1', disk.get('pan_y', 0.0)))

                aspect_box = LABEL_WIDTH / front_h
                aspect_img = img_w / img_h if img_h > 0 else 1.0

                if fit_mode == 'cover':
                    scale = (front_h / img_h if aspect_img > aspect_box else LABEL_WIDTH / img_w) * zoom
                else:
                    scale = (LABEL_WIDTH / img_w if aspect_img > aspect_box else front_h / img_h) * zoom

                draw_w = img_w * scale
                draw_h = img_h * scale

                offset_x = (LABEL_WIDTH - draw_w) / 2.0 + (pan_x / 100.0) * (LABEL_WIDTH / 2.0)
                offset_y = (front_h - draw_h) / 2.0 - (pan_y / 100.0) * (front_h / 2.0)

                c.drawImage(img_path1, origin_x + offset_x, front_y + offset_y,
                            width=draw_w, height=draw_h, preserveAspectRatio=True)
            except Exception as err:
                print(f"Error drawing image {img_path1}: {err}")
        else:
            # Default placeholder graphics if no image uploaded
            c.setFillColor(colors.HexColor('#1f2330'))
            c.rect(origin_x, front_y, LABEL_WIDTH, front_h, fill=1, stroke=0)
            c.setFillColor(colors.HexColor('#5c677d'))
            c.setFont('Helvetica-Bold', 12)
            c.drawCentredString(origin_x + LABEL_WIDTH / 2.0, front_y + front_h / 2.0 + 10, "FLOPPY MUSIC")
            c.setFont('Helvetica', 9)
            c.drawCentredString(origin_x + LABEL_WIDTH / 2.0, front_y + front_h / 2.0 - 6, disk.get('album', 'No Image'))

    # Draw Sequential Number in Lower-Left of Front Section (White text with solid black outline)
    number_text = str(disk.get('display_number', disk.get('number', '1')))
    if number_text:
        num_font_size = float(settings.get('number_size', 20.0))
        num_x = origin_x + 8.0
        num_y = front_y + 8.0
        draw_stroked_text(c, number_text, num_x, num_y,
                          font_name='Helvetica-Bold', font_size=num_font_size,
                          fill_color=colors.white, stroke_color=colors.black,
                          stroke_width=1.8)

    c.restoreState()

    # =========================================================================
    # 2. SPINE SECTION (Solid Color or Candy-Cane Stripes)
    # Height: 0.125" (9.0 pt)
    # =========================================================================
    c.saveState()
    spine_style = disk.get('spine_style', 'solid')

    # Spine colors: use specified colors, or extract automatically from image(s) if available
    c1_hex = disk.get('spine_color1', '')
    c2_hex = disk.get('spine_color2', '')
    if (not c1_hex or not c2_hex):
        if cover_layout == 'split_2_diagonal' and img_path1 and img_path2 and os.path.exists(img_path1) and os.path.exists(img_path2):
            c1_cand, _ = extract_image_colors(img_path1)
            c2_cand, _ = extract_image_colors(img_path2)
            c1_hex = c1_hex or c1_cand
            c2_hex = c2_hex or c2_cand
        elif img_path1 and os.path.exists(img_path1):
            extracted_c1, extracted_c2 = extract_image_colors(img_path1)
            c1_hex = c1_hex or extracted_c1
            c2_hex = c2_hex or extracted_c2

    color1 = hex_to_color(c1_hex or '#D90429')
    color2 = hex_to_color(c2_hex or '#FFFFFF')
    stripe_w = float(disk.get('spine_stripe_width', 4.5))
    stripe_angle = float(disk.get('spine_stripe_angle', 45.0))

    if spine_style == 'candy_cane':
        draw_candy_cane(c, origin_x, spine_y, LABEL_WIDTH, spine_h,
                        color1, color2, stripe_width=stripe_w, angle_deg=stripe_angle)
    else:
        c.setFillColor(color1)
        c.rect(origin_x, spine_y, LABEL_WIDTH, spine_h, fill=1, stroke=0)

    # Spine Text: Defaults to "Artist - Album", overrideable by disk['spine_text']
    spine_text = disk.get('spine_text', '').strip()
    if not spine_text:
        artist_str = disk.get('artist', '').strip()
        album_str = disk.get('album', '').strip()
        if artist_str and album_str:
            spine_text = f"{artist_str} - {album_str}"
        elif album_str or artist_str:
            spine_text = album_str or artist_str

    if spine_text:
        c.saveState()
        spine_clip = c.beginPath()
        spine_clip.rect(origin_x + 3, spine_y, LABEL_WIDTH - 6, spine_h)
        c.clipPath(spine_clip, stroke=0)

        # Precise font sizing for 9.0 pt (0.125") spine
        spine_font_size = min(6.5, max(4.0, spine_h * 0.68))
        text_color = hex_to_color(disk.get('spine_text_color', '#FFFFFF'))
        draw_stroked_text(c, spine_text.upper(), origin_x + 5, spine_y + (spine_h - spine_font_size) / 2.0 + 0.5,
                          font_name='Helvetica-Bold', font_size=spine_font_size,
                          fill_color=text_color, stroke_color=colors.black, stroke_width=0.7)
        c.restoreState()

    c.restoreState()

    # =========================================================================
    # 3. REAR STRIP SECTION (Additional Artists / Albums, Heavily Blurred Cover)
    # Height: 0.500" (36.0 pt)
    # =========================================================================
    c.saveState()
    back_clip = c.beginPath()
    back_clip.rect(origin_x, back_y, LABEL_WIDTH, back_h)
    c.clipPath(back_clip, stroke=0)

    # Heavily blurred and lightened version of the album cover(s) for subtle texture
    active_img_paths = [p for p in [img_path1, img_path2, img_path3, img_path4] if p and os.path.exists(p)]
    lightened_bg_path = get_blurred_lightened_image(active_img_paths, cache_dir) if active_img_paths else None
    if lightened_bg_path and os.path.exists(lightened_bg_path):
        try:
            c.drawImage(lightened_bg_path, origin_x, back_y, width=LABEL_WIDTH, height=back_h, preserveAspectRatio=False)
        except Exception as err:
            print(f"Error drawing lightened background: {err}")
            c.setFillColor(colors.HexColor('#F8F9FA'))
            c.rect(origin_x, back_y, LABEL_WIDTH, back_h, fill=1, stroke=0)
    else:
        # Clean subtle off-white background
        back_bg = hex_to_color(disk.get('back_bg_color', '#F8F9FA'))
        c.setFillColor(back_bg)
        c.rect(origin_x, back_y, LABEL_WIDTH, back_h, fill=1, stroke=0)

    # Content rendering: Additional Artists / Albums
    back_text = disk.get('back_text', '').strip()
    album_name = disk.get('album', '').strip()
    artist_name = disk.get('artist', '').strip()

    lines_to_print: List[str] = []
    if back_text:
        lines_to_print = [line.strip() for line in back_text.split('\n') if line.strip()]
    elif album_name or artist_name:
        if artist_name and album_name:
            lines_to_print = [f"{artist_name} - {album_name}"]
        else:
            lines_to_print = [album_name or artist_name]

    if lines_to_print:
        c.saveState()
        # Invert text 180 degrees so it reads upright when folded over diskette
        center_x = origin_x + LABEL_WIDTH / 2.0
        center_y = back_y + back_h / 2.0
        if invert_back:
            c.translate(center_x, center_y)
            c.rotate(180)
            c.translate(-center_x, -center_y)

        # Solid dark text reads cleanly without needing border on the heavily lightened cover
        text_color = hex_to_color(disk.get('back_text_color', '#111827'))
        c.setFillColor(text_color)

        padding_x = 6.0
        padding_y = 2.5
        avail_w = LABEL_WIDTH - (padding_x * 2.0)
        avail_h = back_h - (padding_y * 2.0)

        num_lines = len(lines_to_print)
        use_two_columns = disk.get('two_columns', False) or (num_lines > 4)

        if use_two_columns and num_lines > 1:
            col1 = lines_to_print[:(num_lines + 1) // 2]
            col2 = lines_to_print[(num_lines + 1) // 2:]
            col_w = (avail_w - 6.0) / 2.0

            font_size = min(7.5, max(4.5, (avail_h / max(len(col1), len(col2))) * 0.85))
            leading = font_size * 1.15

            cur_y = back_y + back_h - padding_y - font_size
            for line in col1:
                c.setFont('Helvetica-Bold', font_size)
                while c.stringWidth(line, 'Helvetica-Bold', font_size) > col_w and len(line) > 3:
                    line = line[:-4] + "..."
                c.drawString(origin_x + padding_x, cur_y, line)
                cur_y -= leading

            cur_y = back_y + back_h - padding_y - font_size
            for line in col2:
                c.setFont('Helvetica-Bold', font_size)
                while c.stringWidth(line, 'Helvetica-Bold', font_size) > col_w and len(line) > 3:
                    line = line[:-4] + "..."
                c.drawString(origin_x + padding_x + col_w + 6.0, cur_y, line)
                cur_y -= leading
        else:
            font_size = min(8.5, max(5.0, (avail_h / num_lines) * 0.80))
            leading = font_size * 1.18

            cur_y = back_y + back_h - padding_y - font_size
            for idx, line in enumerate(lines_to_print):
                font_name = 'Helvetica-Bold' if idx == 0 else 'Helvetica'
                c.setFont(font_name, font_size)
                while c.stringWidth(line, font_name, font_size) > avail_w and len(line) > 3:
                    line = line[:-4] + "..."
                c.drawString(origin_x + padding_x, cur_y, line)
                cur_y -= leading

        c.restoreState()

    c.restoreState()

    # =========================================================================
    # OPTIONAL ALIGNMENT / FOLD GUIDES
    # =========================================================================
    if draw_guides:
        c.saveState()
        c.setStrokeColor(colors.Color(0.7, 0.7, 0.7, alpha=0.6))
        c.setLineWidth(0.4)
        c.setDash(2, 2)
        # Outer boundary
        c.rect(origin_x, origin_y, LABEL_WIDTH, LABEL_HEIGHT, stroke=1, fill=0)
        # Fold lines between sections
        c.line(origin_x, spine_y, origin_x + LABEL_WIDTH, spine_y)
        c.line(origin_x, spine_y + spine_h, origin_x + LABEL_WIDTH, spine_y + spine_h)
        c.restoreState()


def draw_bottom_strips(c: canvas.Canvas, page_disks: List[Dict[str, Any]], settings: Dict[str, Any]):
    """Renders the 12 bottom filing strips (1.375" x 0.500" in 2 rows of 6)."""
    fill_mode = settings.get('bottom_strips_mode', 'spine_match')
    draw_guides = settings.get('draw_guides', False)

    strip_rows_y = [81.0, 37.8]
    strip_idx = 0
    for r in range(2):
        y_pos = strip_rows_y[r]
        for c_idx in range(6):
            x_pos = MARGIN_LEFT + c_idx * STRIP_WIDTH

            if fill_mode != 'blank' and strip_idx < len(page_disks):
                disk = page_disks[strip_idx]
                c.saveState()
                strip_clip = c.beginPath()
                strip_clip.rect(x_pos, y_pos, STRIP_WIDTH, STRIP_HEIGHT)
                c.clipPath(strip_clip, stroke=0)

                if fill_mode == 'spine_match':
                    color1 = hex_to_color(disk.get('spine_color1', '#D90429'))
                    color2 = hex_to_color(disk.get('spine_color2', '#FFFFFF'))
                    draw_candy_cane(c, x_pos, y_pos, STRIP_WIDTH, STRIP_HEIGHT, color1, color2, stripe_width=4.5)

                    title = disk.get('spine_text') or f"{disk.get('artist', '')} - {disk.get('album', '')}".strip(" -")
                    if title:
                        draw_stroked_text(c, title[:30].upper(), x_pos + 6, y_pos + (STRIP_HEIGHT - 7) / 2,
                                          font_name='Helvetica-Bold', font_size=6.5, stroke_width=0.6)
                elif fill_mode == 'title_match':
                    c.setFillColor(colors.HexColor('#F8F9FA'))
                    c.rect(x_pos, y_pos, STRIP_WIDTH, STRIP_HEIGHT, fill=1, stroke=0)
                    c.setFillColor(colors.HexColor('#1F2937'))
                    c.setFont('Helvetica-Bold', 7)
                    num_str = f"#{disk.get('display_number', disk.get('number', ''))} "
                    title = disk.get('album', disk.get('artist', 'Floppy'))
                    c.drawString(x_pos + 4, y_pos + STRIP_HEIGHT - 12, num_str + title[:20])
                    c.setFont('Helvetica', 6)
                    c.drawString(x_pos + 4, y_pos + 6, disk.get('artist', '')[:25])

                c.restoreState()

            if draw_guides:
                c.saveState()
                c.setStrokeColor(colors.Color(0.7, 0.7, 0.7, alpha=0.5))
                c.setLineWidth(0.3)
                c.setDash(2, 2)
                c.rect(x_pos, y_pos, STRIP_WIDTH, STRIP_HEIGHT, stroke=1, fill=0)
                c.restoreState()

            strip_idx += 1


def generate_floppy_pdf(disks: List[Dict[str, Any]], output_path: str,
                        settings: Optional[Dict[str, Any]] = None,
                        image_base_dir: str = "",
                        cache_dir: str = "") -> str:
    """
    Generates a print-ready multi-page PDF formatted exactly for
    Label Outfitters 3.5" Diskette Sheets (Avery 5096/5196).
    """
    if settings is None:
        settings = {}

    if not cache_dir and image_base_dir:
        cache_dir = os.path.join(os.path.dirname(image_base_dir), 'cache')

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)

    total_disks = len(disks)
    num_pages = max(1, math.ceil(total_disks / LABELS_PER_PAGE))

    row_y_positions = [
        792.0 - MARGIN_TOP - LABEL_HEIGHT,                  # Row 0: 556.2 pt
        792.0 - MARGIN_TOP - (2 * LABEL_HEIGHT) - ROW_GAP,  # Row 1: 340.2 pt
        792.0 - MARGIN_TOP - (3 * LABEL_HEIGHT) - (2 * ROW_GAP), # Row 2: 124.2 pt
    ]

    for page_num in range(num_pages):
        page_disks = disks[page_num * LABELS_PER_PAGE : (page_num + 1) * LABELS_PER_PAGE]

        for idx, disk in enumerate(page_disks):
            col_idx = idx % COLS
            row_idx = idx // COLS
            x_pos = MARGIN_LEFT + col_idx * LABEL_WIDTH
            y_pos = row_y_positions[row_idx]
            draw_floppy_label(c, x_pos, y_pos, disk, settings, image_base_dir, cache_dir)

        draw_bottom_strips(c, page_disks, settings)

        c.saveState()
        c.setFont('Helvetica', 6)
        c.setFillColor(colors.Color(0.5, 0.5, 0.5, alpha=0.8))
        meta_text = f"Label Outfitters 3.5\" Diskette (Avery 5096/5196) • Sheet {page_num + 1} of {num_pages} • Scale: 100%"
        c.drawCentredString(PAGE_WIDTH / 2.0, 12.0, meta_text)
        c.restoreState()

        c.showPage()

    c.save()
    return output_path
