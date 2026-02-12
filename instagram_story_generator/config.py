"""
Configuration and template loading for Instagram Story Generator.

Templates are YAML files that define the visual style of generated stories.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


TEMPLATES_DIR = Path(__file__).parent / "templates"
FONTS_DIR = Path(__file__).parent / "fonts"

STORY_WIDTH = 1080
STORY_HEIGHT = 1920


@dataclass
class FontConfig:
    """Font settings for text rendering."""
    family: str = "Arial"
    size: int = 64
    bold_size: int = 72
    line_spacing: float = 1.4
    color: str = "#FFFFFF"
    shadow_color: Optional[str] = "#00000080"
    shadow_offset: tuple[int, int] = (3, 3)


@dataclass
class UnderlineConfig:
    """Underline/highlight style configuration."""
    style: str = "pencil"  # "pencil", "marker", "brush"
    color: str = "#FF6B35"
    thickness: int = 4
    opacity: float = 0.85
    # Pencil-specific: waviness of the hand-drawn line
    wave_amplitude: int = 3
    wave_frequency: float = 0.15
    # Marker-specific: height of the highlight rectangle
    marker_height: int = 16
    marker_y_offset: int = 4
    # How many passes to draw (more = thicker pencil look)
    passes: int = 2


@dataclass
class ImageConfig:
    """Preview image placement configuration."""
    position: str = "top"  # "top", "center", "bottom", "fill"
    max_width_ratio: float = 0.9
    max_height_ratio: float = 0.45
    border_radius: int = 20
    y_offset: int = 120
    shadow: bool = True
    shadow_blur: int = 15
    shadow_color: str = "#00000060"


@dataclass
class LayoutConfig:
    """Overall layout configuration."""
    padding_left: int = 60
    padding_right: int = 60
    padding_top: int = 80
    padding_bottom: int = 100
    text_area: str = "bottom"  # "top", "bottom", "center"
    text_y_start: Optional[int] = None  # Auto-calculated if None
    text_max_width: Optional[int] = None  # Auto-calculated if None


@dataclass
class BackgroundConfig:
    """Background overlay configuration."""
    overlay_color: str = "#000000"
    overlay_opacity: float = 0.45
    gradient: bool = True
    gradient_direction: str = "bottom"  # "top", "bottom"
    gradient_start_opacity: float = 0.0
    gradient_end_opacity: float = 0.75


@dataclass
class StoryConfig:
    """Complete story template configuration."""
    name: str = "default"
    width: int = STORY_WIDTH
    height: int = STORY_HEIGHT
    font: FontConfig = field(default_factory=FontConfig)
    underline: UnderlineConfig = field(default_factory=UnderlineConfig)
    image: ImageConfig = field(default_factory=ImageConfig)
    layout: LayoutConfig = field(default_factory=LayoutConfig)
    background: BackgroundConfig = field(default_factory=BackgroundConfig)

    @classmethod
    def from_yaml(cls, path: str | Path) -> StoryConfig:
        """Load configuration from a YAML template file."""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls._from_dict(data)

    @classmethod
    def from_template(cls, template_name: str) -> StoryConfig:
        """Load a built-in template by name."""
        path = TEMPLATES_DIR / f"{template_name}.yaml"
        if not path.exists():
            available = [p.stem for p in TEMPLATES_DIR.glob("*.yaml")]
            raise FileNotFoundError(
                f"Template '{template_name}' not found. "
                f"Available: {available}"
            )
        return cls.from_yaml(path)

    @classmethod
    def _from_dict(cls, data: dict) -> StoryConfig:
        """Build config from a dictionary."""
        config = cls()
        config.name = data.get("name", config.name)
        config.width = data.get("width", config.width)
        config.height = data.get("height", config.height)

        if "font" in data:
            f = data["font"]
            config.font = FontConfig(
                family=f.get("family", config.font.family),
                size=f.get("size", config.font.size),
                bold_size=f.get("bold_size", config.font.bold_size),
                line_spacing=f.get("line_spacing", config.font.line_spacing),
                color=f.get("color", config.font.color),
                shadow_color=f.get("shadow_color", config.font.shadow_color),
                shadow_offset=tuple(f.get("shadow_offset", list(config.font.shadow_offset))),
            )

        if "underline" in data:
            u = data["underline"]
            config.underline = UnderlineConfig(
                style=u.get("style", config.underline.style),
                color=u.get("color", config.underline.color),
                thickness=u.get("thickness", config.underline.thickness),
                opacity=u.get("opacity", config.underline.opacity),
                wave_amplitude=u.get("wave_amplitude", config.underline.wave_amplitude),
                wave_frequency=u.get("wave_frequency", config.underline.wave_frequency),
                marker_height=u.get("marker_height", config.underline.marker_height),
                marker_y_offset=u.get("marker_y_offset", config.underline.marker_y_offset),
                passes=u.get("passes", config.underline.passes),
            )

        if "image" in data:
            i = data["image"]
            config.image = ImageConfig(
                position=i.get("position", config.image.position),
                max_width_ratio=i.get("max_width_ratio", config.image.max_width_ratio),
                max_height_ratio=i.get("max_height_ratio", config.image.max_height_ratio),
                border_radius=i.get("border_radius", config.image.border_radius),
                y_offset=i.get("y_offset", config.image.y_offset),
                shadow=i.get("shadow", config.image.shadow),
                shadow_blur=i.get("shadow_blur", config.image.shadow_blur),
                shadow_color=i.get("shadow_color", config.image.shadow_color),
            )

        if "layout" in data:
            l = data["layout"]
            config.layout = LayoutConfig(
                padding_left=l.get("padding_left", config.layout.padding_left),
                padding_right=l.get("padding_right", config.layout.padding_right),
                padding_top=l.get("padding_top", config.layout.padding_top),
                padding_bottom=l.get("padding_bottom", config.layout.padding_bottom),
                text_area=l.get("text_area", config.layout.text_area),
                text_y_start=l.get("text_y_start", config.layout.text_y_start),
                text_max_width=l.get("text_max_width", config.layout.text_max_width),
            )

        if "background" in data:
            b = data["background"]
            config.background = BackgroundConfig(
                overlay_color=b.get("overlay_color", config.background.overlay_color),
                overlay_opacity=b.get("overlay_opacity", config.background.overlay_opacity),
                gradient=b.get("gradient", config.background.gradient),
                gradient_direction=b.get("gradient_direction", config.background.gradient_direction),
                gradient_start_opacity=b.get("gradient_start_opacity", config.background.gradient_start_opacity),
                gradient_end_opacity=b.get("gradient_end_opacity", config.background.gradient_end_opacity),
            )

        return config

    def to_dict(self) -> dict:
        """Serialize config to a dictionary."""
        from dataclasses import asdict
        return asdict(self)
