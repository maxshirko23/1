"""
Configuration and template loading for Instagram Story/Post/Carousel Generator.

Templates are YAML files that define the visual style of generated content.
Supports both legacy flat layout and the new grid-based layout system.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

from .grid_layout import GridConfig, ContentFormat, DEFAULT_GRIDS


TEMPLATES_DIR = Path(__file__).parent / "templates"
FONTS_DIR = Path(__file__).parent / "fonts"

STORY_WIDTH = 1080
STORY_HEIGHT = 1920
POST_WIDTH = 1080
POST_HEIGHT = 1350


@dataclass
class FontConfig:
    """Global font defaults (slots can override per-element)."""
    family: str = "Arial"
    google_font: Optional[str] = None   # e.g. "Montserrat" — auto-downloaded
    weight: int = 400
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
    wave_amplitude: int = 3
    wave_frequency: float = 0.15
    marker_height: int = 16
    marker_y_offset: int = 4
    passes: int = 2


@dataclass
class ImageConfig:
    """Preview image defaults (grid slots can override)."""
    position: str = "top"
    max_width_ratio: float = 0.9
    max_height_ratio: float = 0.45
    border_radius: int = 20
    y_offset: int = 120
    shadow: bool = True
    shadow_blur: int = 15
    shadow_color: str = "#00000060"


@dataclass
class LayoutConfig:
    """Legacy flat layout (kept for backward compatibility)."""
    padding_left: int = 60
    padding_right: int = 60
    padding_top: int = 80
    padding_bottom: int = 100
    text_area: str = "bottom"
    text_y_start: Optional[int] = None
    text_max_width: Optional[int] = None


@dataclass
class BackgroundConfig:
    """Background overlay configuration."""
    overlay_color: str = "#000000"
    overlay_opacity: float = 0.45
    gradient: bool = True
    gradient_direction: str = "bottom"
    gradient_start_opacity: float = 0.0
    gradient_end_opacity: float = 0.75


@dataclass
class StoryConfig:
    """
    Complete template configuration.

    Supports:
      - Three formats: story (1080x1920), post (1080x1350), carousel
      - Grid-based layout (new) alongside legacy flat layout
      - Google Fonts integration
      - Multiple element slots (title, body, image, graphic)
    """
    name: str = "default"
    format: str = "story"  # "story", "post", "carousel"
    width: int = STORY_WIDTH
    height: int = STORY_HEIGHT
    font: FontConfig = field(default_factory=FontConfig)
    underline: UnderlineConfig = field(default_factory=UnderlineConfig)
    image: ImageConfig = field(default_factory=ImageConfig)
    layout: LayoutConfig = field(default_factory=LayoutConfig)
    background: BackgroundConfig = field(default_factory=BackgroundConfig)
    # New grid-based layout (None = use legacy layout for backward compat)
    grid: Optional[GridConfig] = None

    def __post_init__(self):
        """Sync width/height from format if grid is present."""
        if self.grid:
            fmt = self.grid.content_format
            self.width = fmt.w
            self.height = fmt.h
            self.format = fmt.label

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
    def for_format(cls, format_name: str, template_name: str = "default") -> StoryConfig:
        """
        Create a config for a specific format with default grid.

        Parameters
        ----------
        format_name : str
            "story", "post", or "carousel"
        template_name : str
            Built-in style template to use for colors/fonts.
        """
        config = cls.from_template(template_name)
        fmt = ContentFormat.from_str(format_name)
        config.format = fmt.label
        config.width = fmt.w
        config.height = fmt.h

        grid_factory = DEFAULT_GRIDS.get(format_name)
        if grid_factory:
            config.grid = grid_factory()

        return config

    @classmethod
    def _from_dict(cls, data: dict) -> StoryConfig:
        """Build config from a dictionary."""
        config = cls()
        config.name = data.get("name", config.name)
        config.format = data.get("format", config.format)
        config.width = data.get("width", config.width)
        config.height = data.get("height", config.height)

        if "format" in data and "width" not in data:
            try:
                fmt = ContentFormat.from_str(data["format"])
                config.width = fmt.w
                config.height = fmt.h
            except ValueError:
                pass

        if "font" in data:
            f = data["font"]
            config.font = FontConfig(
                family=f.get("family", config.font.family),
                google_font=f.get("google_font", config.font.google_font),
                weight=f.get("weight", config.font.weight),
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

        if "grid" in data:
            config.grid = GridConfig.from_dict(data["grid"])
            fmt = config.grid.content_format
            config.width = fmt.w
            config.height = fmt.h
            config.format = fmt.label

        return config

    def to_dict(self) -> dict:
        """Serialize config to a dictionary."""
        from dataclasses import asdict
        d = asdict(self)
        if self.grid:
            d["grid"] = self.grid.to_dict()
        return d
