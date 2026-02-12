"""
Image Renderer for Instagram Story Generator.

Composites the final 1080x1920 story image:
  1. Places the preview image (with optional rounded corners & shadow)
  2. Applies background gradient/overlay
  3. Renders text with hand-drawn pencil/marker/brush underline effects
"""

from __future__ import annotations

import io
import math
import random
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .config import StoryConfig, FONTS_DIR


def _parse_color(color_str: str) -> tuple:
    """Parse hex color string (#RRGGBB or #RRGGBBAA) to RGBA tuple."""
    c = color_str.lstrip("#")
    if len(c) == 6:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    elif len(c) == 8:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), int(c[6:8], 16))
    else:
        return (255, 255, 255, 255)


def _apply_opacity(color: tuple, opacity: float) -> tuple:
    """Apply opacity multiplier to an RGBA color."""
    return (color[0], color[1], color[2], int(color[3] * opacity))


class StoryRenderer:
    """
    Renders Instagram Story images based on a StoryConfig template.

    The renderer handles:
      - Background image scaling and placement
      - Gradient/overlay application
      - Text layout with word wrapping
      - Hand-drawn underline effects (pencil, marker, brush)
    """

    def __init__(self, config: StoryConfig):
        self.config = config
        self._font: Optional[ImageFont.FreeTypeFont] = None
        self._font_bold: Optional[ImageFont.FreeTypeFont] = None

    def _get_font(self, bold: bool = False) -> ImageFont.FreeTypeFont:
        """Load and cache the font."""
        if bold and self._font_bold:
            return self._font_bold
        if not bold and self._font:
            return self._font

        size = self.config.font.bold_size if bold else self.config.font.size
        font_family = self.config.font.family

        # Try to load from fonts directory first
        for ext in (".ttf", ".otf"):
            font_path = FONTS_DIR / f"{font_family}{ext}"
            if font_path.exists():
                font = ImageFont.truetype(str(font_path), size)
                if bold:
                    self._font_bold = font
                else:
                    self._font = font
                return font

        # Try system font
        try:
            font = ImageFont.truetype(font_family, size)
        except (OSError, IOError):
            # Try common system font paths
            common_paths = [
                f"/usr/share/fonts/truetype/{font_family.lower()}/{font_family}.ttf",
                f"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                f"/System/Library/Fonts/{font_family}.ttf",
                f"C:/Windows/Fonts/{font_family.lower()}.ttf",
            ]
            font = None
            for path in common_paths:
                if Path(path).exists():
                    font = ImageFont.truetype(path, size)
                    break
            if font is None:
                font = ImageFont.load_default()

        if bold:
            self._font_bold = font
        else:
            self._font = font
        return font

    def render(
        self,
        preview_image: Image.Image,
        text_lines: list[dict],
    ) -> Image.Image:
        """
        Render the complete story image.

        Parameters
        ----------
        preview_image : PIL.Image.Image
            The preview/article image to embed in the story.
        text_lines : list[dict]
            Pre-processed text lines. Each dict has:
              - "text": str — the full line text
              - "highlights": list[str] — words/phrases in this line to underline

        Returns
        -------
        PIL.Image.Image
            The final 1080x1920 RGBA story image.
        """
        cfg = self.config
        canvas = Image.new("RGBA", (cfg.width, cfg.height), (0, 0, 0, 255))

        # Step 1: Place background image (stretched to fill)
        bg = self._prepare_background(preview_image)
        canvas.paste(bg, (0, 0))

        # Step 2: Apply overlay / gradient
        canvas = self._apply_overlay(canvas)

        # Step 3: Place the preview image (with rounded corners, shadow)
        canvas = self._place_preview(canvas, preview_image)

        # Step 4: Render text with underline effects
        canvas = self._render_text(canvas, text_lines)

        return canvas

    def _prepare_background(self, image: Image.Image) -> Image.Image:
        """Scale and blur the image to use as full background."""
        cfg = self.config
        img = image.copy().convert("RGBA")

        # Scale to cover the canvas
        scale = max(cfg.width / img.width, cfg.height / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        # Center crop
        left = (new_w - cfg.width) // 2
        top = (new_h - cfg.height) // 2
        img = img.crop((left, top, left + cfg.width, top + cfg.height))

        # Apply blur for background effect
        img = img.filter(ImageFilter.GaussianBlur(radius=25))

        return img

    def _apply_overlay(self, canvas: Image.Image) -> Image.Image:
        """Apply color overlay and/or gradient on top of background."""
        cfg = self.config
        bg_cfg = cfg.background
        overlay = Image.new("RGBA", (cfg.width, cfg.height), (0, 0, 0, 0))

        if bg_cfg.gradient:
            draw = ImageDraw.Draw(overlay)
            base_color = _parse_color(bg_cfg.overlay_color)

            for y in range(cfg.height):
                if bg_cfg.gradient_direction == "bottom":
                    t = y / cfg.height
                else:  # top
                    t = 1.0 - y / cfg.height

                opacity = (
                    bg_cfg.gradient_start_opacity
                    + (bg_cfg.gradient_end_opacity - bg_cfg.gradient_start_opacity) * t
                )
                color = (base_color[0], base_color[1], base_color[2], int(255 * opacity))
                draw.line([(0, y), (cfg.width, y)], fill=color)
        else:
            base_color = _parse_color(bg_cfg.overlay_color)
            color = _apply_opacity(base_color, bg_cfg.overlay_opacity)
            overlay = Image.new("RGBA", (cfg.width, cfg.height), color)

        return Image.alpha_composite(canvas, overlay)

    def _place_preview(
        self, canvas: Image.Image, preview: Image.Image
    ) -> Image.Image:
        """Place the preview image on the canvas with optional effects."""
        cfg = self.config
        img_cfg = cfg.image

        img = preview.copy().convert("RGBA")

        # Calculate maximum dimensions
        max_w = int(cfg.width * img_cfg.max_width_ratio)
        max_h = int(cfg.height * img_cfg.max_height_ratio)

        # Scale to fit within bounds
        scale = min(max_w / img.width, max_h / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        # Apply rounded corners
        if img_cfg.border_radius > 0:
            img = self._round_corners(img, img_cfg.border_radius)

        # Calculate position
        x = (cfg.width - new_w) // 2

        if img_cfg.position == "top":
            y = img_cfg.y_offset
        elif img_cfg.position == "center":
            y = (cfg.height - new_h) // 2
        elif img_cfg.position == "bottom":
            y = cfg.height - new_h - img_cfg.y_offset
        else:  # fill — already handled by background
            return canvas

        # Draw shadow
        if img_cfg.shadow:
            shadow_color = _parse_color(img_cfg.shadow_color)
            shadow = Image.new("RGBA", (new_w + 40, new_h + 40), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            shadow_draw.rounded_rectangle(
                [20, 20, new_w + 20, new_h + 20],
                radius=img_cfg.border_radius,
                fill=shadow_color,
            )
            shadow = shadow.filter(
                ImageFilter.GaussianBlur(radius=img_cfg.shadow_blur)
            )
            canvas.paste(shadow, (x - 20, y - 20), shadow)

        canvas.paste(img, (x, y), img)
        return canvas

    def _round_corners(self, img: Image.Image, radius: int) -> Image.Image:
        """Apply rounded corners to an image using an alpha mask."""
        mask = Image.new("L", img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle(
            [0, 0, img.width, img.height], radius=radius, fill=255
        )
        img.putalpha(mask)
        return img

    def _render_text(
        self, canvas: Image.Image, text_lines: list[dict]
    ) -> Image.Image:
        """Render text lines onto the canvas with underline effects."""
        cfg = self.config
        font = self._get_font(bold=False)
        draw = ImageDraw.Draw(canvas)

        text_color = _parse_color(cfg.font.color)
        shadow_color = (
            _parse_color(cfg.font.shadow_color) if cfg.font.shadow_color else None
        )

        # Calculate text area bounds
        pad_l = cfg.layout.padding_left
        pad_r = cfg.layout.padding_right
        max_text_width = cfg.layout.text_max_width or (cfg.width - pad_l - pad_r)

        # Determine Y start based on layout.text_area
        if cfg.layout.text_y_start is not None:
            y_cursor = cfg.layout.text_y_start
        elif cfg.layout.text_area == "bottom":
            # Estimate total text height
            line_height = int(cfg.font.size * cfg.font.line_spacing)
            total_h = line_height * len(text_lines)
            y_cursor = cfg.height - cfg.layout.padding_bottom - total_h
        elif cfg.layout.text_area == "center":
            line_height = int(cfg.font.size * cfg.font.line_spacing)
            total_h = line_height * len(text_lines)
            y_cursor = (cfg.height - total_h) // 2
        else:  # top
            y_cursor = cfg.layout.padding_top

        line_height = int(cfg.font.size * cfg.font.line_spacing)

        for line_info in text_lines:
            line_text = line_info["text"]
            highlights = line_info.get("highlights", [])

            if not line_text.strip():
                y_cursor += line_height // 2
                continue

            x = pad_l

            # Render word by word to track positions for underlines
            words = line_text.split()
            word_positions: list[dict] = []

            for word in words:
                bbox = font.getbbox(word)
                w_width = bbox[2] - bbox[0]

                word_positions.append({
                    "word": word,
                    "x": x,
                    "y": y_cursor,
                    "width": w_width,
                    "height": cfg.font.size,
                })

                # Draw shadow
                if shadow_color:
                    sx, sy = cfg.font.shadow_offset
                    draw.text(
                        (x + sx, y_cursor + sy),
                        word,
                        font=font,
                        fill=shadow_color,
                    )

                # Draw text
                draw.text((x, y_cursor), word, font=font, fill=text_color)

                # Advance x with space
                space_w = font.getbbox(" ")[2]
                x += w_width + space_w

            # Draw underlines for highlighted words/phrases
            for highlight in highlights:
                self._draw_underline_for_phrase(
                    canvas, word_positions, highlight
                )

            y_cursor += line_height

        return canvas

    def _draw_underline_for_phrase(
        self,
        canvas: Image.Image,
        word_positions: list[dict],
        phrase: str,
    ) -> None:
        """Find the phrase in word positions and draw underline effect."""
        phrase_words = phrase.lower().split()
        positions = word_positions

        # Find consecutive matching words
        for i in range(len(positions)):
            match = True
            for j, pw in enumerate(phrase_words):
                if i + j >= len(positions):
                    match = False
                    break
                # Strip punctuation for comparison
                pos_word = positions[i + j]["word"].lower().strip(".,!?;:\"'()-–—")
                if pos_word != pw.strip(".,!?;:\"'()-–—"):
                    match = False
                    break

            if match:
                # Calculate underline span
                first = positions[i]
                last = positions[i + len(phrase_words) - 1]
                x_start = first["x"]
                x_end = last["x"] + last["width"]
                y = first["y"] + first["height"]

                self._draw_underline(canvas, x_start, x_end, y)
                break

    def _draw_underline(
        self,
        canvas: Image.Image,
        x_start: int,
        x_end: int,
        y_baseline: int,
    ) -> None:
        """Draw the underline effect based on configured style."""
        cfg = self.config.underline
        style = cfg.style

        if style == "marker":
            self._draw_marker_underline(canvas, x_start, x_end, y_baseline)
        elif style == "brush":
            self._draw_brush_underline(canvas, x_start, x_end, y_baseline)
        else:  # pencil (default)
            self._draw_pencil_underline(canvas, x_start, x_end, y_baseline)

    def _draw_pencil_underline(
        self,
        canvas: Image.Image,
        x_start: int,
        x_end: int,
        y_baseline: int,
    ) -> None:
        """
        Draw a hand-drawn pencil underline.

        Creates a slightly wavy line with variable thickness
        to simulate a real pencil stroke.
        """
        cfg = self.config.underline
        color = _parse_color(cfg.color)
        color = _apply_opacity(color, cfg.opacity)

        # Create an overlay for the underline
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        y_base = y_baseline + 6  # slightly below text baseline

        for p in range(cfg.passes):
            # Slight vertical offset per pass for thickness effect
            y_off = p * 2 - (cfg.passes - 1)
            points = []

            # Seed randomness per underline for consistency
            rng = random.Random(hash((x_start, y_baseline, p)))

            x = x_start - 4  # extend slightly before the word
            end_x = x_end + 4  # extend slightly after
            step = 3

            while x <= end_x:
                # Wavy displacement
                wave = math.sin(x * cfg.wave_frequency) * cfg.wave_amplitude
                # Random hand jitter
                jitter = rng.uniform(-1.2, 1.2)
                y = y_base + wave + jitter + y_off
                points.append((x, y))
                x += step

            # Draw the line segments
            if len(points) >= 2:
                for i in range(len(points) - 1):
                    draw.line(
                        [points[i], points[i + 1]],
                        fill=color,
                        width=cfg.thickness,
                    )

        canvas_result = Image.alpha_composite(canvas, overlay)
        canvas.paste(canvas_result)

    def _draw_marker_underline(
        self,
        canvas: Image.Image,
        x_start: int,
        x_end: int,
        y_baseline: int,
    ) -> None:
        """
        Draw a translucent marker-style highlight.

        Creates a semi-transparent colored rectangle behind/below text,
        like a real highlighter pen.
        """
        cfg = self.config.underline
        color = _parse_color(cfg.color)
        color = _apply_opacity(color, cfg.opacity)

        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        y_top = y_baseline - self.config.font.size + cfg.marker_y_offset
        y_bottom = y_top + self.config.font.size + cfg.marker_height

        # Slightly irregular edges for natural look
        rng = random.Random(hash((x_start, y_baseline)))
        x1 = x_start - rng.randint(2, 6)
        x2 = x_end + rng.randint(2, 6)
        y1_jitter = rng.randint(-2, 2)
        y2_jitter = rng.randint(-2, 2)

        draw.rounded_rectangle(
            [x1, y_top + y1_jitter, x2, y_bottom + y2_jitter],
            radius=4,
            fill=color,
        )

        canvas_result = Image.alpha_composite(canvas, overlay)
        canvas.paste(canvas_result)

    def _draw_brush_underline(
        self,
        canvas: Image.Image,
        x_start: int,
        x_end: int,
        y_baseline: int,
    ) -> None:
        """
        Draw a thick brush-stroke underline.

        Creates a bold, slightly irregular stroke that looks like
        a paint brush was dragged under the text.
        """
        cfg = self.config.underline
        color = _parse_color(cfg.color)
        color = _apply_opacity(color, cfg.opacity)

        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        y_base = y_baseline + 4
        rng = random.Random(hash((x_start, y_baseline)))

        for p in range(cfg.passes):
            y_off = (p - cfg.passes // 2) * 3
            points = []
            x = x_start - 8
            end_x = x_end + 8
            step = 4

            while x <= end_x:
                wave = math.sin(x * cfg.wave_frequency * 0.7) * (cfg.wave_amplitude * 1.5)
                jitter = rng.uniform(-2.0, 2.0)
                y = y_base + wave + jitter + y_off
                points.append((x, y))
                x += step

            if len(points) >= 2:
                # Draw with varying thickness
                for i in range(len(points) - 1):
                    # Thicker in the middle, thinner at edges
                    t = i / max(len(points) - 1, 1)
                    thickness_factor = 1.0 - 0.4 * abs(t - 0.5) * 2
                    width = max(2, int(cfg.thickness * thickness_factor))

                    draw.line(
                        [points[i], points[i + 1]],
                        fill=color,
                        width=width,
                    )

        canvas_result = Image.alpha_composite(canvas, overlay)
        canvas.paste(canvas_result)

    def wrap_text(
        self,
        text: str,
        highlights: list[str],
    ) -> list[dict]:
        """
        Word-wrap text to fit within the configured text area width.

        Returns a list of line dicts: {"text": "...", "highlights": ["..."]}
        Each line includes which highlight phrases (if any) appear on it.
        """
        cfg = self.config
        font = self._get_font()
        max_width = cfg.layout.text_max_width or (
            cfg.width - cfg.layout.padding_left - cfg.layout.padding_right
        )

        words = text.split()
        lines: list[dict] = []
        current_line_words: list[str] = []
        current_width = 0
        space_w = font.getbbox(" ")[2]

        for word in words:
            word_w = font.getbbox(word)[2] - font.getbbox(word)[0]
            test_width = current_width + word_w + (space_w if current_line_words else 0)

            if test_width > max_width and current_line_words:
                line_text = " ".join(current_line_words)
                line_highlights = self._find_highlights_in_line(
                    line_text, highlights
                )
                lines.append({"text": line_text, "highlights": line_highlights})
                current_line_words = [word]
                current_width = word_w
            else:
                current_line_words.append(word)
                current_width = test_width

        # Last line
        if current_line_words:
            line_text = " ".join(current_line_words)
            line_highlights = self._find_highlights_in_line(
                line_text, highlights
            )
            lines.append({"text": line_text, "highlights": line_highlights})

        return lines

    def _find_highlights_in_line(
        self, line_text: str, highlights: list[str]
    ) -> list[str]:
        """Determine which highlight phrases appear in this line."""
        result = []
        line_lower = line_text.lower()
        for h in highlights:
            # Check if all words of the phrase are in this line (in order)
            h_words = h.lower().split()
            # Simple substring check for single words
            if len(h_words) == 1:
                # Check each word in the line
                for lw in line_lower.split():
                    clean_lw = lw.strip(".,!?;:\"'()-–—")
                    if clean_lw == h_words[0].strip(".,!?;:\"'()-–—"):
                        result.append(h)
                        break
            else:
                # Multi-word phrase: check if it appears as substring
                h_clean = " ".join(
                    w.strip(".,!?;:\"'()-–—") for w in h_words
                )
                line_clean_words = [
                    w.strip(".,!?;:\"'()-–—") for w in line_lower.split()
                ]
                line_clean = " ".join(line_clean_words)
                if h_clean in line_clean:
                    result.append(h)
        return result
