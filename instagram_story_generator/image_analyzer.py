"""
Smart Image Analyzer for extracting design properties from reference images.

Analyzes a reference image (e.g., a screenshot of a beautiful Instagram story)
and extracts:
  - Color palette, brightness, contrast, warmth
  - Grid-based layout: detects content zones and maps them to 12×12 grid slots
  - Proportional text positioning (title/body with relative offsets)
  - Image/graphic element placement detection
  - Adaptive rules for content-dependent positioning

Supports receiving additional graphic elements alongside the reference image.
"""

from __future__ import annotations

import colorsys
import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image, ImageStat, ImageFilter, ImageDraw

from .grid_layout import (
    GridConfig, LayoutSlot, AdaptiveRule, ContentFormat,
    GRID_COLS, GRID_ROWS,
)


@dataclass
class ColorInfo:
    """A color with metadata."""
    hex: str
    rgb: tuple[int, int, int]
    hsl: tuple[float, float, float]
    frequency: float


@dataclass
class ZoneInfo:
    """Analyzed zone within the 12×12 grid."""
    row: int
    col: int
    brightness: float
    contrast: float
    dominant_color: str
    is_text_area: bool  # likely contains text (high contrast, uniform bg)
    is_image_area: bool  # likely contains an image (varied colors)
    edge_density: float  # edge detection score (0-1)


@dataclass
class AnalysisResult:
    """Complete analysis result from a reference image."""
    # Color palette
    dominant_color: ColorInfo
    palette: list[ColorInfo]
    accent_color: ColorInfo

    # Overall properties
    avg_brightness: float
    contrast: float
    is_dark_theme: bool
    warmth: float

    # Grid analysis
    zones: list[ZoneInfo]
    detected_grid: GridConfig  # pre-built grid with detected slots

    # Suggested parameters
    suggested_underline_style: str
    suggested_font_color: str
    suggested_overlay_opacity: float
    suggested_gradient_direction: str

    # Detected format (based on aspect ratio)
    detected_format: str  # "story", "post"

    # Tags and mood
    tags: list[str] = field(default_factory=list)
    mood: str = "neutral"


class ImageAnalyzer:
    """
    Smart analyzer that extracts design properties and layout from reference images.

    Features:
      - Color palette extraction (Pillow quantize)
      - 12×12 grid zone analysis with edge detection
      - Automatic slot detection (title, body, image zones)
      - Proportional positioning: detects margins, spacing ratios
      - Graphic element detection via secondary image input
      - Adaptive rule generation based on layout analysis
      - Google Fonts suggestion via font_hint parameter

    Usage:
        analyzer = ImageAnalyzer()

        # Basic analysis
        result = analyzer.analyze("reference.png")

        # With format hint
        result = analyzer.analyze("reference.png", format_hint="post")

        # With graphic element
        result = analyzer.analyze(
            "reference.png",
            graphic_element=Image.open("logo.png"),
        )

        # With Google Font hint
        result = analyzer.analyze("reference.png", font_hint="Montserrat")
    """

    def __init__(self, palette_size: int = 8, sample_size: int = 500):
        self.palette_size = palette_size
        self.sample_size = sample_size

    def analyze(
        self,
        image_or_path,
        format_hint: Optional[str] = None,
        graphic_element: Optional[Image.Image] = None,
        font_hint: Optional[str] = None,
        font_weight: Optional[int] = None,
    ) -> AnalysisResult:
        """
        Analyze a reference image and build a complete layout.

        Parameters
        ----------
        image_or_path : str | Path | PIL.Image.Image
            Reference image.
        format_hint : str | None
            Force format: "story", "post", "carousel". Auto-detected if None.
        graphic_element : PIL.Image.Image | None
            Optional graphic element (logo, icon) to include in the template.
        font_hint : str | None
            Google Font family name to use in the template.
        font_weight : int | None
            Font weight (100-900) for the font_hint.
        """
        if isinstance(image_or_path, Image.Image):
            img = image_or_path.copy()
        else:
            img = Image.open(image_or_path)
        img = img.convert("RGB")

        # Detect format from aspect ratio
        detected_format = self._detect_format(img, format_hint)

        # Downsample for analysis
        thumb = self._make_thumbnail(img)

        # Color analysis
        palette = self._extract_palette(thumb)
        dominant = palette[0]
        accent = self._find_accent_color(palette)
        avg_brightness = self._avg_brightness(thumb)
        contrast = self._contrast(thumb)
        is_dark = avg_brightness < 128
        warmth = self._calc_warmth(palette)

        # Grid zone analysis (12×12)
        zones = self._analyze_grid_zones(img)

        # Detect layout slots from zones
        grid = self._detect_layout(
            zones, detected_format, is_dark, graphic_element,
            font_hint, font_weight,
        )

        # Style suggestions
        underline = self._suggest_underline_style(contrast, is_dark, warmth)
        font_color = "#FFFFFF" if is_dark else "#1A1A2E"
        overlay_opacity = self._suggest_overlay_opacity(contrast)
        gradient_dir = self._suggest_gradient_direction(zones)

        tags = self._generate_tags(is_dark, warmth, contrast, avg_brightness, palette)
        mood = self._detect_mood(is_dark, warmth, contrast, avg_brightness)

        return AnalysisResult(
            dominant_color=dominant,
            palette=palette,
            accent_color=accent,
            avg_brightness=avg_brightness,
            contrast=contrast,
            is_dark_theme=is_dark,
            warmth=warmth,
            zones=zones,
            detected_grid=grid,
            suggested_underline_style=underline,
            suggested_font_color=font_color,
            suggested_overlay_opacity=overlay_opacity,
            suggested_gradient_direction=gradient_dir,
            detected_format=detected_format,
            tags=tags,
            mood=mood,
        )

    # ── Format detection ─────────────────────────────────────────────

    def _detect_format(self, img: Image.Image, hint: Optional[str]) -> str:
        """Detect content format from aspect ratio."""
        if hint:
            return hint
        ratio = img.height / img.width
        if ratio > 1.5:
            return "story"  # 1920/1080 = 1.78
        else:
            return "post"   # 1350/1080 = 1.25

    # ── Color extraction ─────────────────────────────────────────────

    def _make_thumbnail(self, img: Image.Image) -> Image.Image:
        img = img.copy()
        img.thumbnail((self.sample_size, self.sample_size), Image.LANCZOS)
        return img

    def _extract_palette(self, img: Image.Image) -> list[ColorInfo]:
        quantized = img.quantize(colors=self.palette_size, method=Image.Quantize.MEDIANCUT)
        palette_data = quantized.getpalette()
        pixels = list(quantized.getdata())
        total = len(pixels)
        freq = Counter(pixels)

        colors: list[ColorInfo] = []
        for idx, count in freq.most_common(self.palette_size):
            if palette_data is None:
                continue
            i = idx * 3
            if i + 2 >= len(palette_data):
                continue
            r, g, b = palette_data[i], palette_data[i + 1], palette_data[i + 2]
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            colors.append(ColorInfo(
                hex=f"#{r:02X}{g:02X}{b:02X}",
                rgb=(r, g, b),
                hsl=(round(h * 360, 1), round(s, 3), round(l, 3)),
                frequency=round(count / total, 4),
            ))
        return colors or [ColorInfo("#000000", (0, 0, 0), (0, 0, 0), 1.0)]

    def _find_accent_color(self, palette: list[ColorInfo]) -> ColorInfo:
        if len(palette) <= 1:
            return palette[0]
        return max(palette[1:], key=lambda c: c.hsl[1])

    def _avg_brightness(self, img: Image.Image) -> float:
        return ImageStat.Stat(img.convert("L")).mean[0]

    def _contrast(self, img: Image.Image) -> float:
        return ImageStat.Stat(img.convert("L")).stddev[0]

    def _calc_warmth(self, palette: list[ColorInfo]) -> float:
        warmth_sum = weight_sum = 0.0
        for c in palette:
            hue, sat = c.hsl[0], c.hsl[1]
            w = c.frequency * sat
            if w < 0.001:
                continue
            if hue <= 60:
                t = 1.0 - hue / 60
            elif hue <= 150:
                t = -(hue - 60) / 90
            elif hue <= 270:
                t = -1.0
            elif hue <= 330:
                t = -1.0 + (hue - 270) / 60
            else:
                t = (hue - 330) / 30
            warmth_sum += t * w
            weight_sum += w
        return max(-1.0, min(1.0, warmth_sum / weight_sum)) if weight_sum > 0.001 else 0.0

    # ── Grid zone analysis (12×12) ───────────────────────────────────

    def _analyze_grid_zones(self, img: Image.Image) -> list[ZoneInfo]:
        """
        Split image into a 12×12 grid and analyze each cell.

        For each cell, measures:
          - brightness, contrast, dominant color
          - edge density (indicates image content vs flat background)
          - text area likelihood, image area likelihood
        """
        w, h = img.size
        cell_w = w / GRID_COLS
        cell_h = h / GRID_ROWS

        # Prepare edge-detected version for edge density
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)

        zones = []
        for row in range(GRID_ROWS):
            for col in range(GRID_COLS):
                x1 = int(col * cell_w)
                y1 = int(row * cell_h)
                x2 = int((col + 1) * cell_w)
                y2 = int((row + 1) * cell_h)

                cell = img.crop((x1, y1, x2, y2))
                cell_edges = edges.crop((x1, y1, x2, y2))

                cell_gray = cell.convert("L")
                stat = ImageStat.Stat(cell_gray)
                brightness = stat.mean[0]
                cell_contrast = stat.stddev[0]

                edge_stat = ImageStat.Stat(cell_edges)
                edge_density = edge_stat.mean[0] / 255.0

                # Dominant color of cell
                cell_thumb = cell.copy()
                cell_thumb.thumbnail((10, 10), Image.LANCZOS)
                q = cell_thumb.quantize(colors=1, method=Image.Quantize.MEDIANCUT)
                p = q.getpalette()
                dom_color = f"#{p[0]:02X}{p[1]:02X}{p[2]:02X}" if p else "#000000"

                # Heuristics for zone type
                # Text areas: relatively uniform (low contrast), visible edges
                is_text = cell_contrast < 40 and edge_density > 0.03
                # Image areas: high color variation
                is_image = cell_contrast > 35 and edge_density > 0.08

                zones.append(ZoneInfo(
                    row=row, col=col,
                    brightness=round(brightness, 1),
                    contrast=round(cell_contrast, 1),
                    dominant_color=dom_color,
                    is_text_area=is_text,
                    is_image_area=is_image,
                    edge_density=round(edge_density, 4),
                ))

        return zones

    # ── Layout detection from grid zones ─────────────────────────────

    def _detect_layout(
        self,
        zones: list[ZoneInfo],
        format_name: str,
        is_dark: bool,
        graphic_element: Optional[Image.Image],
        font_hint: Optional[str],
        font_weight: Optional[int],
    ) -> GridConfig:
        """
        Detect layout structure from grid zone analysis.

        Groups zones into content regions (image area, text area,
        empty/background area) and maps them to LayoutSlots.
        """
        # Aggregate by row: find which rows are image-heavy vs text-heavy
        row_scores = self._score_rows(zones)

        # Detect image region (contiguous rows with high image score)
        img_start, img_end = self._find_region(row_scores, "image")
        txt_start, txt_end = self._find_region(row_scores, "text")

        # Detect left margin from zones
        left_margin_cols = self._detect_left_margin(zones, txt_start, txt_end)
        right_margin_cols = self._detect_right_margin(zones, txt_start, txt_end)

        # Detect title vs body split within text region
        title_rows, body_rows = self._split_title_body(
            zones, txt_start, txt_end
        )

        # Build slots
        slots = []

        # Image slot
        if img_end > img_start:
            slots.append(LayoutSlot(
                name="image", slot_type="image",
                col_start=left_margin_cols,
                row_start=img_start,
                col_span=GRID_COLS - left_margin_cols - right_margin_cols,
                row_span=img_end - img_start,
                h_align="center", v_align="center",
                padding_left=20, padding_right=20,
                padding_top=20, padding_bottom=20,
                image_mode="slot", border_radius=20,
            ))

        # Title slot
        if title_rows[1] > title_rows[0]:
            slots.append(LayoutSlot(
                name="title", slot_type="title",
                col_start=left_margin_cols,
                row_start=title_rows[0],
                col_span=GRID_COLS - left_margin_cols - right_margin_cols,
                row_span=title_rows[1] - title_rows[0],
                h_align="left", v_align="bottom",
                padding_left=24, padding_right=24,
                font_size=66 if format_name == "story" else 56,
                font_weight=font_weight or 700,
                font_family=font_hint,
                line_spacing=1.3,
            ))

        # Body slot
        if body_rows[1] > body_rows[0]:
            slots.append(LayoutSlot(
                name="body", slot_type="body",
                col_start=left_margin_cols,
                row_start=body_rows[0],
                col_span=GRID_COLS - left_margin_cols - right_margin_cols,
                row_span=body_rows[1] - body_rows[0],
                h_align="left", v_align="top",
                padding_left=24, padding_right=24,
                padding_top=10,
                font_size=44 if format_name == "story" else 38,
                font_family=font_hint,
                line_spacing=1.5,
            ))

        # Graphic element slot
        if graphic_element:
            gfx_slot = self._place_graphic_element(
                graphic_element, slots, format_name
            )
            slots.append(gfx_slot)

        # Adaptive rules
        rules = self._generate_adaptive_rules(title_rows, body_rows)

        return GridConfig(
            format=format_name,
            slots=slots,
            adaptive_rules=rules,
            max_lines_per_slide=6 if format_name == "carousel" else 8,
        )

    def _score_rows(self, zones: list[ZoneInfo]) -> list[dict]:
        """Score each grid row for image/text/empty content."""
        row_scores = []
        for row in range(GRID_ROWS):
            row_zones = [z for z in zones if z.row == row]
            img_score = sum(1 for z in row_zones if z.is_image_area) / GRID_COLS
            txt_score = sum(1 for z in row_zones if z.is_text_area) / GRID_COLS
            avg_edge = sum(z.edge_density for z in row_zones) / GRID_COLS
            avg_contrast = sum(z.contrast for z in row_zones) / GRID_COLS
            row_scores.append({
                "row": row,
                "image": img_score,
                "text": txt_score,
                "edge": avg_edge,
                "contrast": avg_contrast,
            })
        return row_scores

    def _find_region(
        self, row_scores: list[dict], region_type: str
    ) -> tuple[int, int]:
        """Find contiguous row range for a region type."""
        threshold = 0.15
        in_region = False
        start = 0
        best_start, best_end = 0, 0
        best_length = 0

        for i, rs in enumerate(row_scores):
            score = rs[region_type]
            if score >= threshold and not in_region:
                in_region = True
                start = i
            elif score < threshold and in_region:
                in_region = False
                length = i - start
                if length > best_length:
                    best_start, best_end = start, i
                    best_length = length

        if in_region:
            length = GRID_ROWS - start
            if length > best_length:
                best_start, best_end = start, GRID_ROWS

        # Fallback: if no clear region found, use defaults
        if best_length == 0:
            if region_type == "image":
                return (1, 5)  # top portion
            else:
                return (7, 12)  # bottom portion

        return (best_start, best_end)

    def _detect_left_margin(
        self, zones: list[ZoneInfo], txt_start: int, txt_end: int
    ) -> int:
        """Detect left margin in grid columns by checking empty columns."""
        for col in range(GRID_COLS):
            col_zones = [
                z for z in zones
                if z.col == col and txt_start <= z.row < txt_end
            ]
            if any(z.edge_density > 0.02 for z in col_zones):
                return max(0, col)
        return 1  # default 1-column margin

    def _detect_right_margin(
        self, zones: list[ZoneInfo], txt_start: int, txt_end: int
    ) -> int:
        """Detect right margin in grid columns."""
        for col in range(GRID_COLS - 1, -1, -1):
            col_zones = [
                z for z in zones
                if z.col == col and txt_start <= z.row < txt_end
            ]
            if any(z.edge_density > 0.02 for z in col_zones):
                return max(0, GRID_COLS - 1 - col)
        return 1

    def _split_title_body(
        self, zones: list[ZoneInfo], txt_start: int, txt_end: int
    ) -> tuple[tuple[int, int], tuple[int, int]]:
        """
        Within the text region, detect title vs body split.

        Title: first 1-2 rows of text (often bolder/larger).
        Body: remaining text rows.
        """
        text_rows = txt_end - txt_start
        if text_rows <= 2:
            return ((txt_start, txt_end), (txt_end, txt_end))

        # Title gets roughly 40% of text area, body gets 60%
        title_end = txt_start + max(2, int(text_rows * 0.4))
        return ((txt_start, title_end), (title_end, txt_end))

    def _place_graphic_element(
        self,
        graphic: Image.Image,
        existing_slots: list[LayoutSlot],
        format_name: str,
    ) -> LayoutSlot:
        """
        Find a good position for a graphic element that doesn't overlap
        existing slots.

        Tries corners first, then edges.
        """
        # Find occupied grid cells
        occupied = set()
        for slot in existing_slots:
            for r in range(slot.row_start, slot.row_start + slot.row_span):
                for c in range(slot.col_start, slot.col_start + slot.col_span):
                    occupied.add((r, c))

        # Graphic size: 2×2 grid cells by default
        gfx_rows = 2
        gfx_cols = 2

        # Try positions in priority order: top-right, bottom-right, top-left
        candidates = [
            (0, GRID_COLS - gfx_cols),  # top-right corner
            (GRID_ROWS - gfx_rows, GRID_COLS - gfx_cols),  # bottom-right
            (0, 0),  # top-left
            (GRID_ROWS - gfx_rows, 0),  # bottom-left
        ]

        for row, col in candidates:
            cells = {
                (r, c)
                for r in range(row, row + gfx_rows)
                for c in range(col, col + gfx_cols)
            }
            if not cells & occupied:
                return LayoutSlot(
                    name="graphic", slot_type="graphic",
                    col_start=col, row_start=row,
                    col_span=gfx_cols, row_span=gfx_rows,
                    h_align="center", v_align="center",
                    image_mode="slot", border_radius=0,
                    opacity=1.0, scale=0.8,
                    z_index=10,
                )

        # Fallback: overlay in top-right
        return LayoutSlot(
            name="graphic", slot_type="graphic",
            col_start=GRID_COLS - 2, row_start=0,
            col_span=2, row_span=2,
            h_align="center", v_align="center",
            image_mode="overlay", border_radius=0,
            opacity=0.9, scale=0.7,
            z_index=10,
        )

    def _generate_adaptive_rules(
        self,
        title_rows: tuple[int, int],
        body_rows: tuple[int, int],
    ) -> list[AdaptiveRule]:
        """Generate adaptive rules based on detected layout."""
        rules = []

        # If body text is long, shift title up
        if title_rows[1] > title_rows[0]:
            rules.append(AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="title", action="shift_row", value=-1,
            ))
            rules.append(AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="shift_row", value=-1,
            ))
            rules.append(AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="resize_row", value=1,
            ))

        # If body text is very long, shrink font
        rules.append(AdaptiveRule(
            slot_name="body", condition="lines_gt", threshold=6,
            target_slot="body", action="change_font_size", value=-6,
        ))

        # If no title, expand body into title area
        if title_rows[1] > title_rows[0]:
            rules.append(AdaptiveRule(
                slot_name="title", condition="no_content",
                target_slot="body", action="shift_row",
                value=-(body_rows[0] - title_rows[0]),
            ))
            rules.append(AdaptiveRule(
                slot_name="title", condition="no_content",
                target_slot="body", action="resize_row",
                value=body_rows[0] - title_rows[0],
            ))

        return rules

    # ── Style suggestions ────────────────────────────────────────────

    def _suggest_underline_style(self, contrast, is_dark, warmth):
        if contrast > 70:
            return "brush"
        elif is_dark and warmth > 0.2:
            return "pencil"
        elif not is_dark:
            return "marker"
        return "pencil"

    def _suggest_overlay_opacity(self, contrast):
        if contrast > 80:
            return 0.6
        elif contrast > 50:
            return 0.45
        return 0.3

    def _suggest_gradient_direction(self, zones):
        top_rows = [z for z in zones if z.row < 4]
        bottom_rows = [z for z in zones if z.row >= 8]
        top_bright = sum(z.brightness for z in top_rows) / max(len(top_rows), 1)
        bottom_bright = sum(z.brightness for z in bottom_rows) / max(len(bottom_rows), 1)
        return "bottom" if top_bright > bottom_bright else "top"

    # ── Auto-tagging ─────────────────────────────────────────────────

    def _generate_tags(self, is_dark, warmth, contrast, brightness, palette):
        tags = []
        tags.append("dark" if is_dark else "light")
        if warmth > 0.3:
            tags.append("warm")
        elif warmth < -0.3:
            tags.append("cool")
        else:
            tags.append("neutral-tone")
        if contrast > 70:
            tags.append("high-contrast")
        elif contrast < 30:
            tags.append("low-contrast")
        if palette:
            hue = palette[0].hsl[0]
            sat = palette[0].hsl[1]
            if sat > 0.15:
                if 0 <= hue < 30 or hue >= 330:
                    tags.append("red")
                elif 30 <= hue < 75:
                    tags.append("orange-yellow")
                elif 75 <= hue < 150:
                    tags.append("green")
                elif 150 <= hue < 210:
                    tags.append("cyan")
                elif 210 <= hue < 270:
                    tags.append("blue")
                elif 270 <= hue < 330:
                    tags.append("purple")
            else:
                tags.append("monochrome")
        avg_sat = sum(c.hsl[1] for c in palette) / len(palette) if palette else 0
        if avg_sat > 0.5:
            tags.append("vibrant")
        elif avg_sat < 0.15:
            tags.append("muted")
        return tags

    def _detect_mood(self, is_dark, warmth, contrast, brightness):
        if is_dark and contrast > 60:
            return "bold"
        elif is_dark and warmth > 0.2:
            return "energetic"
        elif is_dark and warmth < -0.2:
            return "professional"
        elif not is_dark and contrast < 40:
            return "calm"
        elif not is_dark and warmth > 0.3:
            return "playful"
        elif brightness > 200:
            return "minimal"
        return "neutral"
