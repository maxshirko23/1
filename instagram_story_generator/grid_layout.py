"""
Grid-based adaptive layout engine.

Provides a 12×12 grid system for positioning elements on the canvas.
Supports named slots (title, body, image, graphic) with adaptive rules
that adjust positions based on content length.

Grid coordinates:
  - Columns: 0–11 (left to right)
  - Rows:    0–11 (top to bottom)
  - Each cell = (canvas_width / 12) × (canvas_height / 12) pixels
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


GRID_COLS = 12
GRID_ROWS = 12


class ContentFormat(Enum):
    """Instagram content format with dimensions."""
    STORY = ("story", 1080, 1920)
    POST = ("post", 1080, 1350)
    CAROUSEL = ("carousel", 1080, 1350)  # each slide

    def __init__(self, label: str, width: int, height: int):
        self.label = label
        self.w = width
        self.h = height

    @classmethod
    def from_str(cls, s: str) -> ContentFormat:
        """Parse format from string: 'story', 'post', or 'carousel'."""
        mapping = {f.label: f for f in cls}
        if s.lower() not in mapping:
            raise ValueError(
                f"Unknown format '{s}'. Available: {list(mapping.keys())}"
            )
        return mapping[s.lower()]


class HAlign(Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class VAlign(Enum):
    TOP = "top"
    CENTER = "center"
    BOTTOM = "bottom"


class ImageMode(Enum):
    """How an image element is placed on the canvas."""
    BACKGROUND = "background"  # stretched/blurred full canvas background
    SLOT = "slot"              # placed inside a grid slot with constraints
    OVERLAY = "overlay"        # placed on top of everything
    FILL_SLOT = "fill_slot"    # fills the entire grid slot area


class SlotType(Enum):
    """Type of content a slot holds."""
    TITLE = "title"
    BODY = "body"
    IMAGE = "image"
    GRAPHIC = "graphic"    # decorative element / icon / logo
    SPACER = "spacer"      # empty space for layout


@dataclass
class LayoutSlot:
    """
    A named slot in the grid layout.

    Grid positions use 0-based indices (0–11).
    col/row span = how many grid cells the slot occupies.
    """
    name: str
    slot_type: str  # SlotType value as string for YAML serialization
    # Grid position
    col_start: int = 0
    row_start: int = 0
    col_span: int = 12
    row_span: int = 3
    # Alignment within the slot
    h_align: str = "left"   # HAlign value
    v_align: str = "top"    # VAlign value
    # Padding inside the slot (pixels)
    padding_top: int = 0
    padding_bottom: int = 0
    padding_left: int = 0
    padding_right: int = 0
    # Z-index for rendering order
    z_index: int = 0
    # Slot-specific font overrides (None = use template defaults)
    font_size: Optional[int] = None
    font_color: Optional[str] = None
    font_family: Optional[str] = None
    font_weight: Optional[int] = None
    line_spacing: Optional[float] = None
    # For IMAGE/GRAPHIC slots
    image_mode: str = "slot"       # ImageMode value
    border_radius: int = 0
    opacity: float = 1.0
    # For GRAPHIC slots: scale relative to slot size
    scale: float = 1.0

    def to_dict(self) -> dict:
        """Serialize to dict for YAML."""
        d = {
            "name": self.name,
            "slot_type": self.slot_type,
            "col_start": self.col_start,
            "row_start": self.row_start,
            "col_span": self.col_span,
            "row_span": self.row_span,
            "h_align": self.h_align,
            "v_align": self.v_align,
        }
        if self.padding_top or self.padding_bottom or self.padding_left or self.padding_right:
            d["padding"] = {
                "top": self.padding_top,
                "bottom": self.padding_bottom,
                "left": self.padding_left,
                "right": self.padding_right,
            }
        if self.z_index:
            d["z_index"] = self.z_index
        if self.font_size is not None:
            d["font_size"] = self.font_size
        if self.font_color is not None:
            d["font_color"] = self.font_color
        if self.font_family is not None:
            d["font_family"] = self.font_family
        if self.font_weight is not None:
            d["font_weight"] = self.font_weight
        if self.line_spacing is not None:
            d["line_spacing"] = self.line_spacing
        if self.slot_type in ("image", "graphic"):
            d["image_mode"] = self.image_mode
            d["border_radius"] = self.border_radius
            d["opacity"] = self.opacity
        if self.slot_type == "graphic":
            d["scale"] = self.scale
        return d

    @classmethod
    def from_dict(cls, d: dict) -> LayoutSlot:
        """Deserialize from dict."""
        padding = d.get("padding", {})
        return cls(
            name=d["name"],
            slot_type=d["slot_type"],
            col_start=d.get("col_start", 0),
            row_start=d.get("row_start", 0),
            col_span=d.get("col_span", 12),
            row_span=d.get("row_span", 3),
            h_align=d.get("h_align", "left"),
            v_align=d.get("v_align", "top"),
            padding_top=padding.get("top", d.get("padding_top", 0)),
            padding_bottom=padding.get("bottom", d.get("padding_bottom", 0)),
            padding_left=padding.get("left", d.get("padding_left", 0)),
            padding_right=padding.get("right", d.get("padding_right", 0)),
            z_index=d.get("z_index", 0),
            font_size=d.get("font_size"),
            font_color=d.get("font_color"),
            font_family=d.get("font_family"),
            font_weight=d.get("font_weight"),
            line_spacing=d.get("line_spacing"),
            image_mode=d.get("image_mode", "slot"),
            border_radius=d.get("border_radius", 0),
            opacity=d.get("opacity", 1.0),
            scale=d.get("scale", 1.0),
        )


@dataclass
class AdaptiveRule:
    """
    A rule that adjusts slot positions based on content.

    Example: "if body text exceeds 5 lines, shift title up by 1 row"

    Conditions:
      - slot_name: which slot to check
      - condition: "lines_gt", "lines_lt", "has_content", "no_content"
      - threshold: numeric threshold for lines_gt/lines_lt

    Actions:
      - target_slot: which slot to modify
      - action: "shift_row", "shift_col", "resize_row", "resize_col",
                "change_font_size", "hide"
      - value: amount to shift/resize (can be negative)
    """
    slot_name: str
    condition: str
    threshold: int = 0
    target_slot: str = ""
    action: str = "shift_row"
    value: int = 0

    def evaluate(self, line_counts: dict[str, int]) -> bool:
        """Check if this rule's condition is met."""
        count = line_counts.get(self.slot_name, 0)
        if self.condition == "lines_gt":
            return count > self.threshold
        elif self.condition == "lines_lt":
            return count < self.threshold
        elif self.condition == "has_content":
            return count > 0
        elif self.condition == "no_content":
            return count == 0
        return False

    def to_dict(self) -> dict:
        return {
            "slot_name": self.slot_name,
            "condition": self.condition,
            "threshold": self.threshold,
            "target_slot": self.target_slot,
            "action": self.action,
            "value": self.value,
        }

    @classmethod
    def from_dict(cls, d: dict) -> AdaptiveRule:
        return cls(**d)


@dataclass
class GridConfig:
    """
    Complete grid layout configuration.

    Defines slots, adaptive rules, and the content format.
    """
    format: str = "story"          # ContentFormat label
    cols: int = GRID_COLS
    rows: int = GRID_ROWS
    slots: list[LayoutSlot] = field(default_factory=list)
    adaptive_rules: list[AdaptiveRule] = field(default_factory=list)
    # Carousel-specific
    max_lines_per_slide: int = 8   # for carousel: max body lines per slide
    carousel_title_on_first: bool = True  # show title only on first slide

    @property
    def content_format(self) -> ContentFormat:
        return ContentFormat.from_str(self.format)

    @property
    def canvas_width(self) -> int:
        return self.content_format.w

    @property
    def canvas_height(self) -> int:
        return self.content_format.h

    @property
    def cell_width(self) -> float:
        return self.canvas_width / self.cols

    @property
    def cell_height(self) -> float:
        return self.canvas_height / self.rows

    def get_slot(self, name: str) -> Optional[LayoutSlot]:
        """Find a slot by name."""
        for s in self.slots:
            if s.name == name:
                return s
        return None

    def slot_pixel_rect(self, slot: LayoutSlot) -> tuple[int, int, int, int]:
        """
        Calculate pixel rectangle for a slot.

        Returns (x, y, width, height) in pixels.
        """
        x = int(slot.col_start * self.cell_width) + slot.padding_left
        y = int(slot.row_start * self.cell_height) + slot.padding_top
        w = int(slot.col_span * self.cell_width) - slot.padding_left - slot.padding_right
        h = int(slot.row_span * self.cell_height) - slot.padding_top - slot.padding_bottom
        return (max(0, x), max(0, y), max(1, w), max(1, h))

    def apply_adaptive_rules(self, line_counts: dict[str, int]) -> list[LayoutSlot]:
        """
        Apply adaptive rules and return adjusted slots.

        Does NOT modify the original slots — returns copies.
        """
        # Deep copy slots
        adjusted = []
        for s in self.slots:
            adjusted.append(LayoutSlot(
                name=s.name, slot_type=s.slot_type,
                col_start=s.col_start, row_start=s.row_start,
                col_span=s.col_span, row_span=s.row_span,
                h_align=s.h_align, v_align=s.v_align,
                padding_top=s.padding_top, padding_bottom=s.padding_bottom,
                padding_left=s.padding_left, padding_right=s.padding_right,
                z_index=s.z_index,
                font_size=s.font_size, font_color=s.font_color,
                font_family=s.font_family, font_weight=s.font_weight,
                line_spacing=s.line_spacing,
                image_mode=s.image_mode, border_radius=s.border_radius,
                opacity=s.opacity, scale=s.scale,
            ))

        slot_map = {s.name: s for s in adjusted}
        hidden: set[str] = set()

        for rule in self.adaptive_rules:
            if rule.evaluate(line_counts):
                target = slot_map.get(rule.target_slot)
                if target is None:
                    continue
                if rule.action == "shift_row":
                    target.row_start = max(0, min(self.rows - 1, target.row_start + rule.value))
                elif rule.action == "shift_col":
                    target.col_start = max(0, min(self.cols - 1, target.col_start + rule.value))
                elif rule.action == "resize_row":
                    target.row_span = max(1, target.row_span + rule.value)
                elif rule.action == "resize_col":
                    target.col_span = max(1, target.col_span + rule.value)
                elif rule.action == "change_font_size":
                    current = target.font_size or 56
                    target.font_size = max(24, current + rule.value)
                elif rule.action == "hide":
                    hidden.add(rule.target_slot)

        return [s for s in adjusted if s.name not in hidden]

    def to_dict(self) -> dict:
        return {
            "format": self.format,
            "cols": self.cols,
            "rows": self.rows,
            "slots": [s.to_dict() for s in self.slots],
            "adaptive_rules": [r.to_dict() for r in self.adaptive_rules],
            "max_lines_per_slide": self.max_lines_per_slide,
            "carousel_title_on_first": self.carousel_title_on_first,
        }

    @classmethod
    def from_dict(cls, d: dict) -> GridConfig:
        return cls(
            format=d.get("format", "story"),
            cols=d.get("cols", GRID_COLS),
            rows=d.get("rows", GRID_ROWS),
            slots=[LayoutSlot.from_dict(s) for s in d.get("slots", [])],
            adaptive_rules=[
                AdaptiveRule.from_dict(r) for r in d.get("adaptive_rules", [])
            ],
            max_lines_per_slide=d.get("max_lines_per_slide", 8),
            carousel_title_on_first=d.get("carousel_title_on_first", True),
        )


# ── Preset grid layouts ─────────────────────────────────────────────

def default_story_grid() -> GridConfig:
    """Default story layout: image on top, title + body on bottom."""
    return GridConfig(
        format="story",
        slots=[
            LayoutSlot(
                name="image", slot_type="image",
                col_start=1, row_start=1, col_span=10, row_span=5,
                h_align="center", v_align="center",
                padding_left=20, padding_right=20,
                padding_top=20, padding_bottom=20,
                image_mode="slot", border_radius=24,
            ),
            LayoutSlot(
                name="title", slot_type="title",
                col_start=1, row_start=7, col_span=10, row_span=2,
                h_align="left", v_align="bottom",
                padding_left=24, padding_right=24,
                font_size=66, font_weight=700,
                line_spacing=1.3,
            ),
            LayoutSlot(
                name="body", slot_type="body",
                col_start=1, row_start=9, col_span=10, row_span=3,
                h_align="left", v_align="top",
                padding_left=24, padding_right=24,
                padding_top=10,
                font_size=44, line_spacing=1.5,
            ),
        ],
        adaptive_rules=[
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="title", action="shift_row", value=-1,
            ),
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="shift_row", value=-1,
            ),
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="resize_row", value=1,
            ),
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=6,
                target_slot="body", action="change_font_size", value=-6,
            ),
        ],
    )


def default_post_grid() -> GridConfig:
    """Default post layout: image on top half, text on bottom half."""
    return GridConfig(
        format="post",
        slots=[
            LayoutSlot(
                name="image", slot_type="image",
                col_start=0, row_start=0, col_span=12, row_span=6,
                h_align="center", v_align="center",
                padding_left=40, padding_right=40,
                padding_top=40, padding_bottom=20,
                image_mode="slot", border_radius=20,
            ),
            LayoutSlot(
                name="title", slot_type="title",
                col_start=1, row_start=7, col_span=10, row_span=2,
                h_align="left", v_align="bottom",
                padding_left=20, padding_right=20,
                font_size=56, font_weight=700,
                line_spacing=1.3,
            ),
            LayoutSlot(
                name="body", slot_type="body",
                col_start=1, row_start=9, col_span=10, row_span=3,
                h_align="left", v_align="top",
                padding_left=20, padding_right=20,
                padding_top=8,
                font_size=38, line_spacing=1.5,
            ),
        ],
        adaptive_rules=[
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="title", action="shift_row", value=-1,
            ),
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="shift_row", value=-1,
            ),
            AdaptiveRule(
                slot_name="body", condition="lines_gt", threshold=4,
                target_slot="body", action="resize_row", value=1,
            ),
        ],
    )


def default_carousel_grid() -> GridConfig:
    """
    Default carousel layout.

    First slide: title + short body.
    Subsequent slides: body continuation.
    """
    return GridConfig(
        format="carousel",
        slots=[
            LayoutSlot(
                name="image", slot_type="image",
                col_start=0, row_start=0, col_span=12, row_span=5,
                h_align="center", v_align="center",
                padding_left=40, padding_right=40,
                padding_top=40, padding_bottom=20,
                image_mode="slot", border_radius=20,
            ),
            LayoutSlot(
                name="title", slot_type="title",
                col_start=1, row_start=6, col_span=10, row_span=2,
                h_align="left", v_align="bottom",
                padding_left=20, padding_right=20,
                font_size=54, font_weight=700,
                line_spacing=1.3,
            ),
            LayoutSlot(
                name="body", slot_type="body",
                col_start=1, row_start=8, col_span=10, row_span=4,
                h_align="left", v_align="top",
                padding_left=20, padding_right=20,
                padding_top=8,
                font_size=38, line_spacing=1.5,
            ),
        ],
        max_lines_per_slide=6,
        carousel_title_on_first=True,
    )


DEFAULT_GRIDS = {
    "story": default_story_grid,
    "post": default_post_grid,
    "carousel": default_carousel_grid,
}
