"""
Template Library — manages a collection of templates with metadata.

Supports:
  - Adding templates from reference images (auto-analyze → YAML)
  - Adding templates from YAML files
  - Listing / searching by tags, mood, color
  - Random selection (uniform or weighted)
  - Selection by parameters (mood, warmth, tags)
  - Persistent storage as JSON index + YAML files
"""

from __future__ import annotations

import json
import random as _random
import shutil
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, Union

from PIL import Image

from .config import StoryConfig, TEMPLATES_DIR
from .image_analyzer import ImageAnalyzer, AnalysisResult
from .template_builder import TemplateBuilder


@dataclass
class TemplateEntry:
    """A template in the library with metadata for search/filter."""
    name: str
    yaml_path: str  # relative to library root
    tags: list[str] = field(default_factory=list)
    mood: str = "neutral"
    warmth: float = 0.0  # -1 to 1
    is_dark: bool = False
    avg_brightness: float = 128.0
    dominant_color: str = "#000000"
    accent_color: str = "#FF6B35"
    source_image: Optional[str] = None  # path to original reference image
    created_at: str = ""
    use_count: int = 0

    def matches_tags(self, required_tags: list[str]) -> bool:
        """Check if this entry has all required tags."""
        return all(t in self.tags for t in required_tags)

    def matches_mood(self, mood: str) -> bool:
        """Check if mood matches."""
        return self.mood == mood

    def matches_warmth(self, min_warmth: float, max_warmth: float) -> bool:
        """Check if warmth is within range."""
        return min_warmth <= self.warmth <= max_warmth


class TemplateLibrary:
    """
    Manages a searchable collection of story templates.

    Templates are stored as YAML files in a library directory,
    with a JSON index for fast search and metadata.

    Usage:
        library = TemplateLibrary()  # uses default directory

        # Add template from a reference image
        library.add_from_image("screenshot.png", name="my_brand")

        # Add existing YAML template
        library.add_from_yaml("my_template.yaml")

        # Get random template
        config = library.random()

        # Get template by parameters
        config = library.select(mood="bold", tags=["dark", "warm"])

        # List all templates
        for entry in library.list():
            print(entry.name, entry.tags)
    """

    INDEX_FILENAME = "_library_index.json"

    def __init__(self, library_dir: Optional[Union[str, Path]] = None):
        """
        Parameters
        ----------
        library_dir : str | Path | None
            Directory to store library templates.
            Defaults to the built-in templates directory.
        """
        self._dir = Path(library_dir) if library_dir else TEMPLATES_DIR
        self._dir.mkdir(parents=True, exist_ok=True)
        self._analyzer = ImageAnalyzer()
        self._builder = TemplateBuilder()
        self._entries: list[TemplateEntry] = []
        self._load_index()

    @property
    def directory(self) -> Path:
        """Library root directory."""
        return self._dir

    @property
    def size(self) -> int:
        """Number of templates in the library."""
        return len(self._entries)

    # ── Adding templates ─────────────────────────────────────────────

    def add_from_image(
        self,
        image_or_path: Union[str, Path, Image.Image],
        name: Optional[str] = None,
        extra_tags: Optional[list[str]] = None,
        save_source: bool = False,
    ) -> TemplateEntry:
        """
        Analyze a reference image and create a template from it.

        Parameters
        ----------
        image_or_path : str | Path | PIL.Image.Image
            Reference image (screenshot of a story design).
        name : str | None
            Template name. Auto-generated if None.
        extra_tags : list[str] | None
            Additional tags to add beyond auto-detected ones.
        save_source : bool
            If True, copies the source image into the library directory.

        Returns
        -------
        TemplateEntry
            The created library entry.
        """
        # Analyze the image
        analysis = self._analyzer.analyze(image_or_path)

        # Build config from analysis
        config = self._builder.build(analysis, name=name)

        # Ensure unique name
        config.name = self._ensure_unique_name(config.name)

        # Save YAML
        yaml_filename = f"{config.name}.yaml"
        yaml_path = self._dir / yaml_filename
        self._builder.save_yaml(config, yaml_path)

        # Optionally save source image
        source_path = None
        if save_source:
            if isinstance(image_or_path, (str, Path)):
                src = Path(image_or_path)
                dest = self._dir / f"_source_{config.name}{src.suffix}"
                shutil.copy2(src, dest)
                source_path = dest.name
            elif isinstance(image_or_path, Image.Image):
                dest = self._dir / f"_source_{config.name}.png"
                image_or_path.save(dest)
                source_path = dest.name

        # Build tags
        tags = analysis.tags.copy()
        if extra_tags:
            tags.extend(extra_tags)
        tags = list(dict.fromkeys(tags))  # deduplicate preserving order

        # Create entry
        entry = TemplateEntry(
            name=config.name,
            yaml_path=yaml_filename,
            tags=tags,
            mood=analysis.mood,
            warmth=round(analysis.warmth, 3),
            is_dark=analysis.is_dark_theme,
            avg_brightness=round(analysis.avg_brightness, 1),
            dominant_color=analysis.dominant_color.hex,
            accent_color=analysis.accent_color.hex,
            source_image=source_path,
            created_at=datetime.now().isoformat(),
        )

        self._entries.append(entry)
        self._save_index()

        return entry

    def add_from_yaml(
        self,
        yaml_path: Union[str, Path],
        tags: Optional[list[str]] = None,
        mood: str = "neutral",
    ) -> TemplateEntry:
        """
        Add an existing YAML template to the library.

        The YAML file is copied into the library directory.
        """
        src = Path(yaml_path)
        config = StoryConfig.from_yaml(src)

        config.name = self._ensure_unique_name(config.name)
        dest_filename = f"{config.name}.yaml"
        dest = self._dir / dest_filename

        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)

        entry = TemplateEntry(
            name=config.name,
            yaml_path=dest_filename,
            tags=tags or [],
            mood=mood,
            created_at=datetime.now().isoformat(),
        )

        self._entries.append(entry)
        self._save_index()

        return entry

    # ── Removing templates ───────────────────────────────────────────

    def remove(self, name: str) -> bool:
        """Remove a template from the library by name."""
        entry = self._find_entry(name)
        if entry is None:
            return False

        # Delete YAML file
        yaml_file = self._dir / entry.yaml_path
        if yaml_file.exists():
            yaml_file.unlink()

        # Delete source image if stored
        if entry.source_image:
            src_file = self._dir / entry.source_image
            if src_file.exists():
                src_file.unlink()

        self._entries.remove(entry)
        self._save_index()
        return True

    # ── Querying templates ───────────────────────────────────────────

    def list(
        self,
        tags: Optional[list[str]] = None,
        mood: Optional[str] = None,
        is_dark: Optional[bool] = None,
    ) -> list[TemplateEntry]:
        """
        List templates, optionally filtered.

        Parameters
        ----------
        tags : list[str] | None
            Filter: entry must have ALL of these tags.
        mood : str | None
            Filter by mood.
        is_dark : bool | None
            Filter by dark/light theme.
        """
        results = self._entries.copy()

        if tags:
            results = [e for e in results if e.matches_tags(tags)]
        if mood:
            results = [e for e in results if e.matches_mood(mood)]
        if is_dark is not None:
            results = [e for e in results if e.is_dark == is_dark]

        return results

    def get(self, name: str) -> Optional[StoryConfig]:
        """Get a specific template config by name."""
        entry = self._find_entry(name)
        if entry is None:
            return None
        return StoryConfig.from_yaml(self._dir / entry.yaml_path)

    def get_entry(self, name: str) -> Optional[TemplateEntry]:
        """Get a specific template entry (metadata) by name."""
        return self._find_entry(name)

    def random(
        self,
        tags: Optional[list[str]] = None,
        mood: Optional[str] = None,
        is_dark: Optional[bool] = None,
        exclude: Optional[list[str]] = None,
    ) -> Optional[StoryConfig]:
        """
        Pick a random template, optionally filtered.

        Parameters
        ----------
        tags : list[str] | None
            Filter: must have all tags.
        mood : str | None
            Filter by mood.
        is_dark : bool | None
            Filter by dark/light.
        exclude : list[str] | None
            Template names to exclude (e.g., recently used).

        Returns
        -------
        StoryConfig | None
            Random template config, or None if no templates match.
        """
        candidates = self.list(tags=tags, mood=mood, is_dark=is_dark)

        if exclude:
            candidates = [e for e in candidates if e.name not in exclude]

        if not candidates:
            return None

        chosen = _random.choice(candidates)
        chosen.use_count += 1
        self._save_index()

        return StoryConfig.from_yaml(self._dir / chosen.yaml_path)

    def select(
        self,
        mood: Optional[str] = None,
        tags: Optional[list[str]] = None,
        is_dark: Optional[bool] = None,
        warmth_range: Optional[tuple[float, float]] = None,
        prefer_least_used: bool = False,
    ) -> Optional[StoryConfig]:
        """
        Select the best matching template based on parameters.

        Scores each template by how well it matches the criteria,
        then returns the best match.

        Parameters
        ----------
        mood : str | None
            Preferred mood.
        tags : list[str] | None
            Preferred tags (more matching = higher score).
        is_dark : bool | None
            Preferred theme.
        warmth_range : tuple[float, float] | None
            Preferred warmth range (-1 to 1).
        prefer_least_used : bool
            If True, breaks ties by preferring less-used templates.
        """
        if not self._entries:
            return None

        scored: list[tuple[float, TemplateEntry]] = []

        for entry in self._entries:
            score = 0.0

            # Mood match
            if mood and entry.mood == mood:
                score += 3.0

            # Tag matches (partial matching: each matching tag adds score)
            if tags:
                matching = sum(1 for t in tags if t in entry.tags)
                score += matching * 1.5

            # Theme match
            if is_dark is not None and entry.is_dark == is_dark:
                score += 2.0

            # Warmth range match
            if warmth_range:
                if warmth_range[0] <= entry.warmth <= warmth_range[1]:
                    score += 1.5

            # Least-used bonus
            if prefer_least_used:
                score -= entry.use_count * 0.1

            scored.append((score, entry))

        # Sort by score descending
        scored.sort(key=lambda x: x[0], reverse=True)

        if scored[0][0] <= 0 and (mood or tags or is_dark is not None):
            # No matches at all — return None
            return None

        best_entry = scored[0][1]
        best_entry.use_count += 1
        self._save_index()

        return StoryConfig.from_yaml(self._dir / best_entry.yaml_path)

    # ── Batch import ─────────────────────────────────────────────────

    def import_images(
        self,
        image_paths: list[Union[str, Path]],
        prefix: str = "imported",
        extra_tags: Optional[list[str]] = None,
    ) -> list[TemplateEntry]:
        """
        Batch-import multiple reference images as templates.

        Returns list of created entries.
        """
        entries = []
        for i, path in enumerate(image_paths):
            name = f"{prefix}_{i+1:03d}"
            entry = self.add_from_image(
                path, name=name, extra_tags=extra_tags
            )
            entries.append(entry)
        return entries

    # ── Internal helpers ─────────────────────────────────────────────

    def _find_entry(self, name: str) -> Optional[TemplateEntry]:
        """Find an entry by name."""
        for entry in self._entries:
            if entry.name == name:
                return entry
        return None

    def _ensure_unique_name(self, name: str) -> str:
        """Make a name unique within the library."""
        existing = {e.name for e in self._entries}
        if name not in existing:
            return name
        i = 2
        while f"{name}_{i}" in existing:
            i += 1
        return f"{name}_{i}"

    def _load_index(self) -> None:
        """Load the library index from JSON file."""
        index_path = self._dir / self.INDEX_FILENAME
        if not index_path.exists():
            self._entries = []
            # Auto-discover existing YAML files (built-in templates)
            self._discover_existing_yamls()
            return

        with open(index_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._entries = []
        for item in data.get("templates", []):
            # Verify YAML file still exists
            yaml_file = self._dir / item["yaml_path"]
            if not yaml_file.exists():
                continue
            self._entries.append(TemplateEntry(
                name=item["name"],
                yaml_path=item["yaml_path"],
                tags=item.get("tags", []),
                mood=item.get("mood", "neutral"),
                warmth=item.get("warmth", 0.0),
                is_dark=item.get("is_dark", False),
                avg_brightness=item.get("avg_brightness", 128.0),
                dominant_color=item.get("dominant_color", "#000000"),
                accent_color=item.get("accent_color", "#FF6B35"),
                source_image=item.get("source_image"),
                created_at=item.get("created_at", ""),
                use_count=item.get("use_count", 0),
            ))

    def _discover_existing_yamls(self) -> None:
        """Auto-discover YAML templates that aren't in the index yet."""
        known = {e.yaml_path for e in self._entries}
        for yaml_file in sorted(self._dir.glob("*.yaml")):
            if yaml_file.name.startswith("_"):
                continue
            if yaml_file.name in known:
                continue
            try:
                config = StoryConfig.from_yaml(yaml_file)
                self._entries.append(TemplateEntry(
                    name=config.name,
                    yaml_path=yaml_file.name,
                    created_at=datetime.now().isoformat(),
                ))
            except Exception:
                continue

        if self._entries:
            self._save_index()

    def _save_index(self) -> None:
        """Persist the library index to JSON."""
        index_path = self._dir / self.INDEX_FILENAME
        data = {
            "version": 1,
            "updated_at": datetime.now().isoformat(),
            "templates": [asdict(e) for e in self._entries],
        }
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
