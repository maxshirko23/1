"""
Template Builder — converts image analysis results into StoryConfig YAML templates.

Takes an AnalysisResult from ImageAnalyzer and produces a complete,
ready-to-use YAML template with all design parameters filled in.
"""

from __future__ import annotations

import colorsys
from pathlib import Path
from typing import Optional

import yaml

from .config import (
    StoryConfig,
    FontConfig,
    UnderlineConfig,
    ImageConfig,
    LayoutConfig,
    BackgroundConfig,
    TEMPLATES_DIR,
)
from .image_analyzer import AnalysisResult, ColorInfo


class TemplateBuilder:
    """
    Builds StoryConfig templates from image analysis results.

    Usage:
        from instagram_story_generator import ImageAnalyzer, TemplateBuilder

        analyzer = ImageAnalyzer()
        result = analyzer.analyze("reference.png")

        builder = TemplateBuilder()
        config = builder.build(result, name="my_brand")
        builder.save_yaml(config, "templates/my_brand.yaml")
    """

    def build(
        self,
        analysis: AnalysisResult,
        name: Optional[str] = None,
    ) -> StoryConfig:
        """
        Build a complete StoryConfig from analysis results.

        Parameters
        ----------
        analysis : AnalysisResult
            Output from ImageAnalyzer.analyze().
        name : str | None
            Template name. Auto-generated from mood + tags if None.
        """
        if name is None:
            tag_part = "_".join(analysis.tags[:2]) if analysis.tags else "custom"
            name = f"{analysis.mood}_{tag_part}"

        font = self._build_font_config(analysis)
        underline = self._build_underline_config(analysis)
        image = self._build_image_config(analysis)
        layout = self._build_layout_config(analysis)
        background = self._build_background_config(analysis)

        return StoryConfig(
            name=name,
            font=font,
            underline=underline,
            image=image,
            layout=layout,
            background=background,
        )

    def save_yaml(self, config: StoryConfig, path: str | Path) -> Path:
        """
        Save a StoryConfig as a YAML template file.

        Returns the path to the saved file.
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = self._config_to_yaml_dict(config)

        with open(path, "w", encoding="utf-8") as f:
            f.write(f"# Auto-generated template: {config.name}\n")
            f.write(f"# ={'=' * len(config.name)}==================\n\n")
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        return path

    # ── Font config ──────────────────────────────────────────────────

    def _build_font_config(self, a: AnalysisResult) -> FontConfig:
        """Determine font parameters from analysis."""
        font_color = a.suggested_font_color

        # Shadow: dark themes get lighter shadows for depth, light themes get dark
        if a.is_dark_theme:
            shadow_color = "#00000099"
            shadow_offset = (3, 3)
        else:
            shadow_color = "#00000040"
            shadow_offset = (2, 2)

        # Font size: high contrast images can support larger text
        if a.contrast > 60:
            size = 64
            bold_size = 74
        else:
            size = 56
            bold_size = 64

        # Line spacing: calmer designs get more breathing room
        if a.mood in ("calm", "minimal"):
            line_spacing = 1.6
        elif a.mood in ("bold", "energetic"):
            line_spacing = 1.35
        else:
            line_spacing = 1.5

        return FontConfig(
            family="Arial",
            size=size,
            bold_size=bold_size,
            line_spacing=line_spacing,
            color=font_color,
            shadow_color=shadow_color,
            shadow_offset=shadow_offset,
        )

    # ── Underline config ─────────────────────────────────────────────

    def _build_underline_config(self, a: AnalysisResult) -> UnderlineConfig:
        """Determine underline style and color from analysis."""
        style = a.suggested_underline_style

        # Underline color: use accent color, or derive a contrasting one
        accent = a.accent_color
        underline_color = self._make_underline_color(accent, a.is_dark_theme)

        # Style-specific defaults
        if style == "marker":
            return UnderlineConfig(
                style="marker",
                color=underline_color,
                thickness=3,
                opacity=0.45,
                wave_amplitude=2,
                wave_frequency=0.1,
                marker_height=22,
                marker_y_offset=-2,
                passes=1,
            )
        elif style == "brush":
            return UnderlineConfig(
                style="brush",
                color=underline_color,
                thickness=7,
                opacity=0.85,
                wave_amplitude=5,
                wave_frequency=0.12,
                marker_height=18,
                marker_y_offset=2,
                passes=3,
            )
        else:  # pencil
            return UnderlineConfig(
                style="pencil",
                color=underline_color,
                thickness=4,
                opacity=0.85,
                wave_amplitude=3,
                wave_frequency=0.15,
                marker_height=16,
                marker_y_offset=4,
                passes=2,
            )

    def _make_underline_color(self, accent: ColorInfo, is_dark: bool) -> str:
        """
        Create a good underline color from the accent.

        Ensures the color is saturated enough and visible against the background.
        """
        r, g, b = accent.rgb
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

        # Boost saturation for underlines — they need to pop
        s = max(s, 0.6)

        # Adjust lightness based on theme
        if is_dark:
            l = max(l, 0.5)  # ensure visible on dark backgrounds
        else:
            l = min(l, 0.45)  # ensure visible on light backgrounds

        r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
        return f"#{int(r2*255):02X}{int(g2*255):02X}{int(b2*255):02X}"

    # ── Image config ─────────────────────────────────────────────────

    def _build_image_config(self, a: AnalysisResult) -> ImageConfig:
        """Determine image placement from analysis."""
        position = a.image_zone

        # Bold/energetic styles: larger image, no radius
        if a.mood in ("bold", "energetic"):
            return ImageConfig(
                position=position,
                max_width_ratio=0.88,
                max_height_ratio=0.42,
                border_radius=0,
                y_offset=140,
                shadow=True,
                shadow_blur=20,
                shadow_color="#000000AA",
            )
        # Calm/minimal: softer corners, subtle shadow
        elif a.mood in ("calm", "minimal"):
            return ImageConfig(
                position=position,
                max_width_ratio=0.85,
                max_height_ratio=0.40,
                border_radius=28,
                y_offset=120,
                shadow=False,
            )
        else:
            return ImageConfig(
                position=position,
                max_width_ratio=0.88,
                max_height_ratio=0.42,
                border_radius=20,
                y_offset=130,
                shadow=True,
                shadow_blur=15,
                shadow_color="#00000060",
            )

    # ── Layout config ────────────────────────────────────────────────

    def _build_layout_config(self, a: AnalysisResult) -> LayoutConfig:
        """Determine layout parameters from analysis."""
        text_area = a.text_zone

        # Tighter padding for bold, more breathing room for calm
        if a.mood in ("bold", "energetic"):
            return LayoutConfig(
                padding_left=52,
                padding_right=52,
                padding_top=90,
                padding_bottom=130,
                text_area=text_area,
            )
        elif a.mood in ("calm", "minimal"):
            return LayoutConfig(
                padding_left=76,
                padding_right=76,
                padding_top=70,
                padding_bottom=100,
                text_area=text_area,
            )
        else:
            return LayoutConfig(
                padding_left=64,
                padding_right=64,
                padding_top=80,
                padding_bottom=120,
                text_area=text_area,
            )

    # ── Background config ────────────────────────────────────────────

    def _build_background_config(self, a: AnalysisResult) -> BackgroundConfig:
        """Determine background overlay/gradient from analysis."""
        overlay_color = a.dominant_color.hex
        overlay_opacity = a.suggested_overlay_opacity
        gradient_direction = a.suggested_gradient_direction

        # Dark themes: less overlay needed, stronger gradient
        if a.is_dark_theme:
            return BackgroundConfig(
                overlay_color=overlay_color,
                overlay_opacity=overlay_opacity,
                gradient=True,
                gradient_direction=gradient_direction,
                gradient_start_opacity=0.05,
                gradient_end_opacity=0.80,
            )
        else:
            return BackgroundConfig(
                overlay_color=overlay_color,
                overlay_opacity=max(overlay_opacity, 0.5),
                gradient=True,
                gradient_direction=gradient_direction,
                gradient_start_opacity=0.1,
                gradient_end_opacity=0.70,
            )

    # ── YAML serialization ───────────────────────────────────────────

    def _config_to_yaml_dict(self, config: StoryConfig) -> dict:
        """Convert StoryConfig to a clean dict for YAML output."""
        return {
            "name": config.name,
            "width": config.width,
            "height": config.height,
            "font": {
                "family": config.font.family,
                "size": config.font.size,
                "bold_size": config.font.bold_size,
                "line_spacing": config.font.line_spacing,
                "color": config.font.color,
                "shadow_color": config.font.shadow_color,
                "shadow_offset": list(config.font.shadow_offset),
            },
            "underline": {
                "style": config.underline.style,
                "color": config.underline.color,
                "thickness": config.underline.thickness,
                "opacity": config.underline.opacity,
                "wave_amplitude": config.underline.wave_amplitude,
                "wave_frequency": config.underline.wave_frequency,
                "marker_height": config.underline.marker_height,
                "marker_y_offset": config.underline.marker_y_offset,
                "passes": config.underline.passes,
            },
            "image": {
                "position": config.image.position,
                "max_width_ratio": config.image.max_width_ratio,
                "max_height_ratio": config.image.max_height_ratio,
                "border_radius": config.image.border_radius,
                "y_offset": config.image.y_offset,
                "shadow": config.image.shadow,
                "shadow_blur": config.image.shadow_blur,
                "shadow_color": config.image.shadow_color,
            },
            "layout": {
                "padding_left": config.layout.padding_left,
                "padding_right": config.layout.padding_right,
                "padding_top": config.layout.padding_top,
                "padding_bottom": config.layout.padding_bottom,
                "text_area": config.layout.text_area,
            },
            "background": {
                "overlay_color": config.background.overlay_color,
                "overlay_opacity": config.background.overlay_opacity,
                "gradient": config.background.gradient,
                "gradient_direction": config.background.gradient_direction,
                "gradient_start_opacity": config.background.gradient_start_opacity,
                "gradient_end_opacity": config.background.gradient_end_opacity,
            },
        }
