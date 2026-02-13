"""
Image Analyzer for extracting design properties from reference images.

Analyzes a reference image (e.g., a screenshot of a beautiful Instagram story)
and extracts: dominant colors, color palette, brightness, contrast,
layout zones, and suggests template parameters.

Uses only Pillow — no heavy ML dependencies.
"""

from __future__ import annotations

import colorsys
import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image, ImageStat, ImageFilter


@dataclass
class ColorInfo:
    """A color with metadata."""
    hex: str
    rgb: tuple[int, int, int]
    hsl: tuple[float, float, float]
    frequency: float  # 0.0–1.0, share of total pixels


@dataclass
class LayoutZone:
    """Detected content zone in the image."""
    name: str  # "top", "center", "bottom"
    y_start: float  # 0.0–1.0 relative
    y_end: float
    brightness: float  # average brightness 0–255
    is_dark: bool
    dominant_color: str  # hex


@dataclass
class AnalysisResult:
    """Complete analysis result from a reference image."""
    # Color palette
    dominant_color: ColorInfo
    palette: list[ColorInfo]  # up to 8 colors, sorted by frequency
    accent_color: ColorInfo  # most saturated non-dominant color

    # Overall properties
    avg_brightness: float  # 0–255
    contrast: float  # standard deviation of brightness
    is_dark_theme: bool
    warmth: float  # -1.0 (cool) to 1.0 (warm)

    # Layout zones
    zones: list[LayoutZone]
    text_zone: str  # suggested text placement: "top", "bottom", "center"
    image_zone: str  # suggested image placement

    # Suggested style
    suggested_underline_style: str  # "pencil", "marker", "brush"
    suggested_font_color: str
    suggested_overlay_opacity: float
    suggested_gradient_direction: str

    # Tags for library search
    tags: list[str] = field(default_factory=list)
    mood: str = "neutral"  # "energetic", "calm", "professional", "playful", "dark", "light"


class ImageAnalyzer:
    """
    Analyzes reference images to extract design properties.

    Usage:
        analyzer = ImageAnalyzer()
        result = analyzer.analyze("reference_story.png")
        print(result.palette)
        print(result.suggested_underline_style)
    """

    def __init__(self, palette_size: int = 8, sample_size: int = 500):
        """
        Parameters
        ----------
        palette_size : int
            Number of colors to extract for the palette.
        sample_size : int
            Resize dimension for faster processing (pixels on long side).
        """
        self.palette_size = palette_size
        self.sample_size = sample_size

    def analyze(self, image_or_path) -> AnalysisResult:
        """
        Analyze a reference image and return design properties.

        Parameters
        ----------
        image_or_path : str | Path | PIL.Image.Image
            Reference image to analyze.
        """
        if isinstance(image_or_path, Image.Image):
            img = image_or_path.copy()
        else:
            img = Image.open(image_or_path)

        img = img.convert("RGB")

        # Downsample for speed
        thumb = self._make_thumbnail(img)

        # Extract color palette
        palette = self._extract_palette(thumb)
        dominant = palette[0]
        accent = self._find_accent_color(palette)

        # Brightness & contrast
        avg_brightness = self._avg_brightness(thumb)
        contrast = self._contrast(thumb)
        is_dark = avg_brightness < 128

        # Color temperature
        warmth = self._calc_warmth(palette)

        # Layout zone analysis
        zones = self._analyze_zones(img)
        text_zone, image_zone = self._suggest_layout(zones)

        # Style suggestions
        underline = self._suggest_underline_style(contrast, is_dark, warmth)
        font_color = self._suggest_font_color(is_dark, dominant)
        overlay_opacity = self._suggest_overlay_opacity(contrast, is_dark)
        gradient_dir = self._suggest_gradient_direction(zones)

        # Auto-tag
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
            text_zone=text_zone,
            image_zone=image_zone,
            suggested_underline_style=underline,
            suggested_font_color=font_color,
            suggested_overlay_opacity=overlay_opacity,
            suggested_gradient_direction=gradient_dir,
            tags=tags,
            mood=mood,
        )

    # ── Color extraction ─────────────────────────────────────────────

    def _make_thumbnail(self, img: Image.Image) -> Image.Image:
        """Resize for faster processing."""
        img = img.copy()
        img.thumbnail((self.sample_size, self.sample_size), Image.LANCZOS)
        return img

    def _extract_palette(self, img: Image.Image) -> list[ColorInfo]:
        """
        Extract color palette using Pillow's quantize.

        Returns colors sorted by frequency (most frequent first).
        """
        # Quantize to N colors
        quantized = img.quantize(colors=self.palette_size, method=Image.Quantize.MEDIANCUT)
        palette_data = quantized.getpalette()
        pixels = list(quantized.getdata())
        total_pixels = len(pixels)

        # Count frequency of each color index
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
                frequency=round(count / total_pixels, 4),
            ))

        return colors or [ColorInfo(hex="#000000", rgb=(0, 0, 0), hsl=(0, 0, 0), frequency=1.0)]

    def _find_accent_color(self, palette: list[ColorInfo]) -> ColorInfo:
        """Find the most saturated non-dominant color as accent."""
        if len(palette) <= 1:
            return palette[0]

        # Skip the dominant color, find most saturated among the rest
        candidates = palette[1:]
        best = max(candidates, key=lambda c: c.hsl[1])  # max saturation
        return best

    # ── Brightness & contrast ────────────────────────────────────────

    def _avg_brightness(self, img: Image.Image) -> float:
        """Average perceived brightness (0–255)."""
        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        return stat.mean[0]

    def _contrast(self, img: Image.Image) -> float:
        """Contrast as standard deviation of brightness."""
        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        return stat.stddev[0]

    # ── Color temperature ────────────────────────────────────────────

    def _calc_warmth(self, palette: list[ColorInfo]) -> float:
        """
        Estimate color warmth from -1.0 (cool/blue) to 1.0 (warm/orange).

        Based on weighted average of hue positions.
        """
        if not palette:
            return 0.0

        warmth_sum = 0.0
        weight_sum = 0.0

        for color in palette:
            hue = color.hsl[0]  # 0–360
            sat = color.hsl[1]
            freq = color.frequency

            weight = freq * sat  # more saturated & frequent → more influence
            if weight < 0.001:
                continue

            # Warm hues: 0–60 (red-yellow) and 300–360 (magenta-red)
            # Cool hues: 150–270 (cyan-blue)
            if hue <= 60:
                w = 1.0 - hue / 60  # 1.0 at red, 0.0 at yellow
            elif hue <= 150:
                w = -(hue - 60) / 90  # transition to cool
            elif hue <= 270:
                w = -1.0  # cool zone
            elif hue <= 330:
                w = -1.0 + (hue - 270) / 60  # transition back to warm
            else:
                w = (hue - 330) / 30  # warm again near red

            warmth_sum += w * weight
            weight_sum += weight

        if weight_sum < 0.001:
            return 0.0
        return max(-1.0, min(1.0, warmth_sum / weight_sum))

    # ── Layout zone analysis ─────────────────────────────────────────

    def _analyze_zones(self, img: Image.Image) -> list[LayoutZone]:
        """Split image into 3 horizontal zones and analyze each."""
        w, h = img.size
        zone_height = h // 3
        zones = []

        for i, name in enumerate(["top", "center", "bottom"]):
            y1 = i * zone_height
            y2 = (i + 1) * zone_height if i < 2 else h
            crop = img.crop((0, y1, w, y2))

            gray = crop.convert("L")
            stat = ImageStat.Stat(gray)
            brightness = stat.mean[0]

            # Get dominant color of zone
            thumb = crop.copy()
            thumb.thumbnail((100, 100), Image.LANCZOS)
            q = thumb.quantize(colors=1, method=Image.Quantize.MEDIANCUT)
            p = q.getpalette()
            if p:
                zone_color = f"#{p[0]:02X}{p[1]:02X}{p[2]:02X}"
            else:
                zone_color = "#000000"

            zones.append(LayoutZone(
                name=name,
                y_start=round(y1 / h, 3),
                y_end=round(y2 / h, 3),
                brightness=round(brightness, 1),
                is_dark=brightness < 128,
                dominant_color=zone_color,
            ))

        return zones

    def _suggest_layout(self, zones: list[LayoutZone]) -> tuple[str, str]:
        """
        Suggest text and image placement based on zone brightness.

        Text goes where it's darker (better contrast for white text),
        image goes where it's brighter (more visual interest).
        """
        if not zones:
            return "bottom", "top"

        # Find darkest zone for text
        darkest = min(zones, key=lambda z: z.brightness)
        brightest = max(zones, key=lambda z: z.brightness)

        text_zone = darkest.name
        image_zone = brightest.name

        # Avoid same zone for both
        if text_zone == image_zone:
            text_zone = "bottom"
            image_zone = "top"

        return text_zone, image_zone

    # ── Style suggestions ────────────────────────────────────────────

    def _suggest_underline_style(
        self, contrast: float, is_dark: bool, warmth: float
    ) -> str:
        """Suggest underline style based on image characteristics."""
        if contrast > 70:
            # High contrast → bold brush looks good
            return "brush"
        elif is_dark and warmth > 0.2:
            # Dark warm theme → pencil feels hand-crafted
            return "pencil"
        elif not is_dark:
            # Light theme → marker highlight looks clean
            return "marker"
        else:
            return "pencil"

    def _suggest_font_color(self, is_dark: bool, dominant: ColorInfo) -> str:
        """Suggest font color that contrasts with the dominant background."""
        if is_dark:
            return "#FFFFFF"
        else:
            return "#1A1A2E"

    def _suggest_overlay_opacity(self, contrast: float, is_dark: bool) -> float:
        """Suggest overlay opacity: busier images need more overlay."""
        if contrast > 80:
            return 0.6
        elif contrast > 50:
            return 0.45
        else:
            return 0.3

    def _suggest_gradient_direction(self, zones: list[LayoutZone]) -> str:
        """Suggest gradient direction based on content distribution."""
        if not zones:
            return "bottom"

        top_brightness = zones[0].brightness if zones else 128
        bottom_brightness = zones[-1].brightness if zones else 128

        # Gradient towards the darker zone (where text likely goes)
        if top_brightness > bottom_brightness:
            return "bottom"
        else:
            return "top"

    # ── Auto-tagging ─────────────────────────────────────────────────

    def _generate_tags(
        self,
        is_dark: bool,
        warmth: float,
        contrast: float,
        brightness: float,
        palette: list[ColorInfo],
    ) -> list[str]:
        """Generate descriptive tags for template library search."""
        tags = []

        # Theme
        tags.append("dark" if is_dark else "light")

        # Warmth
        if warmth > 0.3:
            tags.append("warm")
        elif warmth < -0.3:
            tags.append("cool")
        else:
            tags.append("neutral-tone")

        # Contrast
        if contrast > 70:
            tags.append("high-contrast")
        elif contrast < 30:
            tags.append("low-contrast")

        # Dominant hue family
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

        # Saturation
        avg_sat = sum(c.hsl[1] for c in palette) / len(palette) if palette else 0
        if avg_sat > 0.5:
            tags.append("vibrant")
        elif avg_sat < 0.15:
            tags.append("muted")

        return tags

    def _detect_mood(
        self,
        is_dark: bool,
        warmth: float,
        contrast: float,
        brightness: float,
    ) -> str:
        """Detect overall mood/vibe of the design."""
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
        else:
            return "neutral"
