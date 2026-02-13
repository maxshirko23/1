"""
Image Renderer for Instagram Story/Post/Carousel Generator.

Supports two rendering modes:
  1. Grid-based layout (new) — elements placed on a 12x12 grid with adaptive rules
  2. Legacy flat layout — backward-compatible simple text + image placement

Composites the final image:
  - Background (blurred preview, solid color, or gradient)
  - Image slots (preview image with rounded corners & shadow)
  - Graphic element slots (logos, icons, decorations)
  - Text slots (title, body) with hand-drawn underline effects
"""

from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .config import StoryConfig, FONTS_DIR
from .grid_layout import GridConfig, LayoutSlot


def _parse_color(color_str: str) -> tuple:
    """Parse hex color string (#RRGGBB or #RRGGBBAA) to RGBA tuple."""
    c = color_str.lstrip("#")
    if len(c) == 6:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    elif len(c) == 8:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), int(c[6:8], 16))
    return (255, 255, 255, 255)


def _apply_opacity(color: tuple, opacity: float) -> tuple:
    return (color[0], color[1], color[2], int(color[3] * opacity))


class StoryRenderer:
    """
    Renders Instagram content images using either grid or legacy layout.

    If the config has a GridConfig, the grid-based renderer is used.
    Otherwise, falls back to the legacy flat layout.
    """

    def __init__(self, config: StoryConfig):
        self.config = config
        self._font_cache: dict[str, ImageFont.FreeTypeFont] = {}

    # ── Font loading ─────────────────────────────────────────────────

    def _get_font(
        self,
        size: Optional[int] = None,
        family: Optional[str] = None,
        weight: Optional[int] = None,
    ) -> ImageFont.FreeTypeFont:
        """Load and cache a font by family/size/weight."""
        size = size or self.config.font.size
        family = family or self.config.font.google_font or self.config.font.family
        weight = weight or self.config.font.weight

        cache_key = f"{family}_{size}_{weight}"
        if cache_key in self._font_cache:
            return self._font_cache[cache_key]

        font = self._load_font(family, size)
        self._font_cache[cache_key] = font
        return font

    def _load_font(self, family: str, size: int) -> ImageFont.FreeTypeFont:
        """Try to load a font from various sources."""
        # Try fonts directory first (includes Google Fonts cache)
        for ext in (".ttf", ".otf"):
            font_path = FONTS_DIR / f"{family}{ext}"
            if font_path.exists():
                return ImageFont.truetype(str(font_path), size)
            for pattern in FONTS_DIR.glob(f"{family}*{ext}"):
                return ImageFont.truetype(str(pattern), size)

        # Try system font by name
        try:
            return ImageFont.truetype(family, size)
        except (OSError, IOError):
            pass

        # Fallback chain
        fallbacks = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/System/Library/Fonts/Helvetica.ttf",
        ]
        for path in fallbacks:
            if Path(path).exists():
                return ImageFont.truetype(path, size)

        return ImageFont.load_default()

    # ── Main render entry point ──────────────────────────────────────

    def render(
        self,
        preview_image: Image.Image,
        text_lines: list[dict],
        title_lines: Optional[list[dict]] = None,
        graphic_image: Optional[Image.Image] = None,
    ) -> Image.Image:
        """
        Render the complete content image.

        Parameters
        ----------
        preview_image : PIL.Image.Image
            The preview/article image.
        text_lines : list[dict]
            Body text lines: [{"text": "...", "highlights": [...]}]
        title_lines : list[dict] | None
            Title text lines (for grid mode). If None, not rendered.
        graphic_image : PIL.Image.Image | None
            Optional graphic element (logo, icon).
        """
        if self.config.grid:
            return self._render_grid(
                preview_image, text_lines, title_lines, graphic_image
            )
        return self._render_legacy(preview_image, text_lines)

    # ── Grid-based renderer ──────────────────────────────────────────

    def _render_grid(
        self,
        preview_image: Image.Image,
        body_lines: list[dict],
        title_lines: Optional[list[dict]],
        graphic_image: Optional[Image.Image],
    ) -> Image.Image:
        """Render using grid-based layout with adaptive rules."""
        cfg = self.config
        grid = cfg.grid
        canvas = Image.new("RGBA", (cfg.width, cfg.height), (0, 0, 0, 255))

        # Background
        bg = self._prepare_background(preview_image)
        canvas.paste(bg, (0, 0))
        canvas = self._apply_overlay(canvas)

        # Apply adaptive rules
        line_counts = {
            "body": len(body_lines),
            "title": len(title_lines) if title_lines else 0,
        }
        adjusted_slots = grid.apply_adaptive_rules(line_counts)

        # Sort by z_index for correct render order
        adjusted_slots.sort(key=lambda s: s.z_index)

        # Render each slot
        for slot in adjusted_slots:
            rect = grid.slot_pixel_rect(slot)

            if slot.slot_type == "image":
                canvas = self._render_image_slot(canvas, slot, rect, preview_image)
            elif slot.slot_type == "title" and title_lines:
                canvas = self._render_text_slot(canvas, slot, rect, title_lines)
            elif slot.slot_type == "body" and body_lines:
                canvas = self._render_text_slot(canvas, slot, rect, body_lines)
            elif slot.slot_type == "graphic" and graphic_image:
                canvas = self._render_graphic_slot(canvas, slot, rect, graphic_image)

        return canvas

    def _render_image_slot(self, canvas, slot, rect, image):
        """Render an image within a grid slot."""
        x, y, w, h = rect
        img = image.copy().convert("RGBA")

        scale = min(w / img.width, h / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        if slot.border_radius > 0:
            img = self._round_corners(img, slot.border_radius)

        ix = x + (w - new_w) // 2
        iy = y + (h - new_h) // 2

        if self.config.image.shadow:
            shadow_color = _parse_color(self.config.image.shadow_color)
            shadow = Image.new("RGBA", (new_w + 40, new_h + 40), (0, 0, 0, 0))
            sd = ImageDraw.Draw(shadow)
            sd.rounded_rectangle(
                [20, 20, new_w + 20, new_h + 20],
                radius=slot.border_radius, fill=shadow_color,
            )
            shadow = shadow.filter(ImageFilter.GaussianBlur(radius=self.config.image.shadow_blur))
            canvas.paste(shadow, (ix - 20, iy - 20), shadow)

        canvas.paste(img, (ix, iy), img)
        return canvas

    def _render_text_slot(self, canvas, slot, rect, lines):
        """Render text within a grid slot with underline effects."""
        x, y, w, h = rect
        draw = ImageDraw.Draw(canvas)

        font_size = slot.font_size or self.config.font.size
        font_family = slot.font_family or self.config.font.google_font or self.config.font.family
        font = self._get_font(size=font_size, family=font_family)

        text_color = _parse_color(slot.font_color or self.config.font.color)
        shadow_color = (
            _parse_color(self.config.font.shadow_color)
            if self.config.font.shadow_color else None
        )
        line_spacing = slot.line_spacing or self.config.font.line_spacing
        line_height = int(font_size * line_spacing)

        total_text_h = line_height * len(lines)
        if slot.v_align == "bottom":
            y_cursor = y + h - total_text_h
        elif slot.v_align == "center":
            y_cursor = y + (h - total_text_h) // 2
        else:
            y_cursor = y

        for line_info in lines:
            if y_cursor + line_height > y + h:
                break

            line_text = line_info["text"]
            highlights = line_info.get("highlights", [])

            if not line_text.strip():
                y_cursor += line_height // 2
                continue

            text_w = font.getbbox(line_text)[2] - font.getbbox(line_text)[0]
            if slot.h_align == "center":
                x_start = x + (w - text_w) // 2
            elif slot.h_align == "right":
                x_start = x + w - text_w
            else:
                x_start = x

            words = line_text.split()
            word_positions = []
            wx = x_start
            for word in words:
                bbox = font.getbbox(word)
                ww = bbox[2] - bbox[0]
                word_positions.append({
                    "word": word, "x": wx, "y": y_cursor,
                    "width": ww, "height": font_size,
                })
                if shadow_color:
                    sx, sy = self.config.font.shadow_offset
                    draw.text((wx + sx, y_cursor + sy), word, font=font, fill=shadow_color)
                draw.text((wx, y_cursor), word, font=font, fill=text_color)
                space_w = font.getbbox(" ")[2]
                wx += ww + space_w

            for hl in highlights:
                self._draw_underline_for_phrase(canvas, word_positions, hl)
            y_cursor += line_height

        return canvas

    def _render_graphic_slot(self, canvas, slot, rect, graphic):
        """Render a graphic element in a slot."""
        x, y, w, h = rect
        img = graphic.copy().convert("RGBA")

        max_w = int(w * slot.scale)
        max_h = int(h * slot.scale)
        scale = min(max_w / img.width, max_h / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        if slot.opacity < 1.0:
            alpha = img.getchannel("A")
            alpha = alpha.point(lambda p: int(p * slot.opacity))
            img.putalpha(alpha)

        if slot.border_radius > 0:
            img = self._round_corners(img, slot.border_radius)

        ix = x + (w - new_w) // 2
        iy = y + (h - new_h) // 2
        canvas.paste(img, (ix, iy), img)
        return canvas

    # ── Legacy renderer (backward compatible) ────────────────────────

    def _render_legacy(self, preview_image, text_lines):
        cfg = self.config
        canvas = Image.new("RGBA", (cfg.width, cfg.height), (0, 0, 0, 255))
        bg = self._prepare_background(preview_image)
        canvas.paste(bg, (0, 0))
        canvas = self._apply_overlay(canvas)
        canvas = self._place_preview_legacy(canvas, preview_image)
        canvas = self._render_text_legacy(canvas, text_lines)
        return canvas

    def _place_preview_legacy(self, canvas, preview):
        cfg = self.config
        img_cfg = cfg.image
        img = preview.copy().convert("RGBA")
        max_w = int(cfg.width * img_cfg.max_width_ratio)
        max_h = int(cfg.height * img_cfg.max_height_ratio)
        scale = min(max_w / img.width, max_h / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        if img_cfg.border_radius > 0:
            img = self._round_corners(img, img_cfg.border_radius)
        x = (cfg.width - new_w) // 2
        if img_cfg.position == "top":
            y = img_cfg.y_offset
        elif img_cfg.position == "center":
            y = (cfg.height - new_h) // 2
        elif img_cfg.position == "bottom":
            y = cfg.height - new_h - img_cfg.y_offset
        else:
            return canvas
        if img_cfg.shadow:
            sc = _parse_color(img_cfg.shadow_color)
            shadow = Image.new("RGBA", (new_w + 40, new_h + 40), (0, 0, 0, 0))
            sd = ImageDraw.Draw(shadow)
            sd.rounded_rectangle([20, 20, new_w + 20, new_h + 20], radius=img_cfg.border_radius, fill=sc)
            shadow = shadow.filter(ImageFilter.GaussianBlur(radius=img_cfg.shadow_blur))
            canvas.paste(shadow, (x - 20, y - 20), shadow)
        canvas.paste(img, (x, y), img)
        return canvas

    def _render_text_legacy(self, canvas, text_lines):
        cfg = self.config
        font = self._get_font()
        draw = ImageDraw.Draw(canvas)
        text_color = _parse_color(cfg.font.color)
        shadow_color = _parse_color(cfg.font.shadow_color) if cfg.font.shadow_color else None
        pad_l = cfg.layout.padding_left
        line_height = int(cfg.font.size * cfg.font.line_spacing)
        if cfg.layout.text_y_start is not None:
            y_cursor = cfg.layout.text_y_start
        elif cfg.layout.text_area == "bottom":
            y_cursor = cfg.height - cfg.layout.padding_bottom - line_height * len(text_lines)
        elif cfg.layout.text_area == "center":
            y_cursor = (cfg.height - line_height * len(text_lines)) // 2
        else:
            y_cursor = cfg.layout.padding_top
        for line_info in text_lines:
            line_text = line_info["text"]
            highlights = line_info.get("highlights", [])
            if not line_text.strip():
                y_cursor += line_height // 2
                continue
            x = pad_l
            words = line_text.split()
            word_positions = []
            for word in words:
                bbox = font.getbbox(word)
                ww = bbox[2] - bbox[0]
                word_positions.append({"word": word, "x": x, "y": y_cursor, "width": ww, "height": cfg.font.size})
                if shadow_color:
                    sx, sy = cfg.font.shadow_offset
                    draw.text((x + sx, y_cursor + sy), word, font=font, fill=shadow_color)
                draw.text((x, y_cursor), word, font=font, fill=text_color)
                x += ww + font.getbbox(" ")[2]
            for hl in highlights:
                self._draw_underline_for_phrase(canvas, word_positions, hl)
            y_cursor += line_height
        return canvas

    # ── Shared helpers ───────────────────────────────────────────────

    def _prepare_background(self, image):
        cfg = self.config
        img = image.copy().convert("RGBA")
        scale = max(cfg.width / img.width, cfg.height / img.height)
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        left = (img.width - cfg.width) // 2
        top = (img.height - cfg.height) // 2
        img = img.crop((left, top, left + cfg.width, top + cfg.height))
        return img.filter(ImageFilter.GaussianBlur(radius=25))

    def _apply_overlay(self, canvas):
        cfg = self.config
        bg_cfg = cfg.background
        overlay = Image.new("RGBA", (cfg.width, cfg.height), (0, 0, 0, 0))
        if bg_cfg.gradient:
            draw = ImageDraw.Draw(overlay)
            base = _parse_color(bg_cfg.overlay_color)
            for y in range(cfg.height):
                t = y / cfg.height if bg_cfg.gradient_direction == "bottom" else 1.0 - y / cfg.height
                op = bg_cfg.gradient_start_opacity + (bg_cfg.gradient_end_opacity - bg_cfg.gradient_start_opacity) * t
                draw.line([(0, y), (cfg.width, y)], fill=(base[0], base[1], base[2], int(255 * op)))
        else:
            base = _parse_color(bg_cfg.overlay_color)
            overlay = Image.new("RGBA", (cfg.width, cfg.height), _apply_opacity(base, bg_cfg.overlay_opacity))
        return Image.alpha_composite(canvas, overlay)

    def _round_corners(self, img, radius):
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width, img.height], radius=radius, fill=255)
        img.putalpha(mask)
        return img

    # ── Underline effects ────────────────────────────────────────────

    def _draw_underline_for_phrase(self, canvas, word_positions, phrase):
        phrase_words = phrase.lower().split()
        for i in range(len(word_positions)):
            match = True
            for j, pw in enumerate(phrase_words):
                if i + j >= len(word_positions):
                    match = False
                    break
                if word_positions[i + j]["word"].lower().strip(".,!?;:\"'()-–—") != pw.strip(".,!?;:\"'()-–—"):
                    match = False
                    break
            if match:
                first = word_positions[i]
                last = word_positions[i + len(phrase_words) - 1]
                self._draw_underline(canvas, first["x"], last["x"] + last["width"], first["y"] + first["height"])
                break

    def _draw_underline(self, canvas, x_start, x_end, y_baseline):
        style = self.config.underline.style
        if style == "marker":
            self._draw_marker(canvas, x_start, x_end, y_baseline)
        elif style == "brush":
            self._draw_brush(canvas, x_start, x_end, y_baseline)
        else:
            self._draw_pencil(canvas, x_start, x_end, y_baseline)

    def _draw_pencil(self, canvas, x_start, x_end, y_baseline):
        cfg = self.config.underline
        color = _apply_opacity(_parse_color(cfg.color), cfg.opacity)
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        y_base = y_baseline + 6
        for p in range(cfg.passes):
            y_off = p * 2 - (cfg.passes - 1)
            rng = random.Random(hash((x_start, y_baseline, p)))
            pts = []
            x = x_start - 4
            while x <= x_end + 4:
                pts.append((x, y_base + math.sin(x * cfg.wave_frequency) * cfg.wave_amplitude + rng.uniform(-1.2, 1.2) + y_off))
                x += 3
            for i in range(len(pts) - 1):
                draw.line([pts[i], pts[i + 1]], fill=color, width=cfg.thickness)
        canvas.paste(Image.alpha_composite(canvas, overlay))

    def _draw_marker(self, canvas, x_start, x_end, y_baseline):
        cfg = self.config.underline
        color = _apply_opacity(_parse_color(cfg.color), cfg.opacity)
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        y_top = y_baseline - self.config.font.size + cfg.marker_y_offset
        y_bottom = y_top + self.config.font.size + cfg.marker_height
        rng = random.Random(hash((x_start, y_baseline)))
        draw.rounded_rectangle(
            [x_start - rng.randint(2, 6), y_top + rng.randint(-2, 2),
             x_end + rng.randint(2, 6), y_bottom + rng.randint(-2, 2)],
            radius=4, fill=color,
        )
        canvas.paste(Image.alpha_composite(canvas, overlay))

    def _draw_brush(self, canvas, x_start, x_end, y_baseline):
        cfg = self.config.underline
        color = _apply_opacity(_parse_color(cfg.color), cfg.opacity)
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        y_base = y_baseline + 4
        rng = random.Random(hash((x_start, y_baseline)))
        for p in range(cfg.passes):
            y_off = (p - cfg.passes // 2) * 3
            pts = []
            x = x_start - 8
            while x <= x_end + 8:
                pts.append((x, y_base + math.sin(x * cfg.wave_frequency * 0.7) * cfg.wave_amplitude * 1.5 + rng.uniform(-2.0, 2.0) + y_off))
                x += 4
            for i in range(len(pts) - 1):
                t = i / max(len(pts) - 1, 1)
                w = max(2, int(cfg.thickness * (1.0 - 0.4 * abs(t - 0.5) * 2)))
                draw.line([pts[i], pts[i + 1]], fill=color, width=w)
        canvas.paste(Image.alpha_composite(canvas, overlay))

    # ── Text wrapping ────────────────────────────────────────────────

    def wrap_text(self, text, highlights, max_width=None, font_size=None, font_family=None):
        """Word-wrap text to fit within a pixel width."""
        font = self._get_font(size=font_size, family=font_family)
        cfg = self.config
        if max_width is None:
            if cfg.grid:
                body = cfg.grid.get_slot("body")
                if body:
                    _, _, w, _ = cfg.grid.slot_pixel_rect(body)
                    max_width = w
            if max_width is None:
                max_width = cfg.layout.text_max_width or (cfg.width - cfg.layout.padding_left - cfg.layout.padding_right)

        words = text.split()
        lines, cur_words, cur_w = [], [], 0
        space_w = font.getbbox(" ")[2]
        for word in words:
            ww = font.getbbox(word)[2] - font.getbbox(word)[0]
            test_w = cur_w + ww + (space_w if cur_words else 0)
            if test_w > max_width and cur_words:
                lt = " ".join(cur_words)
                lines.append({"text": lt, "highlights": self._find_highlights(lt, highlights)})
                cur_words, cur_w = [word], ww
            else:
                cur_words.append(word)
                cur_w = test_w
        if cur_words:
            lt = " ".join(cur_words)
            lines.append({"text": lt, "highlights": self._find_highlights(lt, highlights)})
        return lines

    def _find_highlights(self, line_text, highlights):
        result = []
        line_lower = line_text.lower()
        for h in highlights:
            hw = h.lower().split()
            if len(hw) == 1:
                for lw in line_lower.split():
                    if lw.strip(".,!?;:\"'()-–—") == hw[0].strip(".,!?;:\"'()-–—"):
                        result.append(h)
                        break
            else:
                hc = " ".join(w.strip(".,!?;:\"'()-–—") for w in hw)
                lc = " ".join(w.strip(".,!?;:\"'()-–—") for w in line_lower.split())
                if hc in lc:
                    result.append(h)
        return result
