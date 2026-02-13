"""
Main Content Generator — the public API of the module.

Generates Instagram Stories (1080x1920), Posts (1080x1350),
and Carousels (series of 1080x1350 slides).

Usage:
    from instagram_story_generator import StoryGenerator

    # Story (legacy or grid)
    gen = StoryGenerator()
    png = gen.generate(text="...", image_path="preview.jpg")

    # Post (1080x1350)
    gen = StoryGenerator.for_post()
    png = gen.generate(text="...", title="Headline", image_path="img.jpg")

    # Carousel (multiple slides)
    gen = StoryGenerator.for_carousel()
    slides = gen.generate_carousel(
        text="Long article text...",
        title="Headline",
        image_path="img.jpg",
    )

    # With template library
    gen = StoryGenerator.from_library_random(library, tags=["dark"])
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Optional, Union

from PIL import Image

from .config import StoryConfig
from .grid_layout import ContentFormat, default_story_grid, default_post_grid, default_carousel_grid
from .text_analyzer import TextAnalyzer
from .renderer import StoryRenderer


class StoryGenerator:
    """
    Instagram content generator for Stories, Posts, and Carousels.

    Parameters
    ----------
    template : str
        Built-in template name ("default", "minimal", "bold_dark").
    config_path : str | Path | None
        Custom YAML template file path.
    config : StoryConfig | None
        Direct config object.
    max_keywords : int
        Max key phrases to highlight.
    custom_stop_words : set[str] | None
        Additional stop words for text analyzer.
    """

    def __init__(
        self,
        template: str = "default",
        config_path: Optional[Union[str, Path]] = None,
        config: Optional[StoryConfig] = None,
        max_keywords: int = 5,
        custom_stop_words: Optional[set[str]] = None,
    ):
        if config is not None:
            self._config = config
        elif config_path is not None:
            self._config = StoryConfig.from_yaml(config_path)
        else:
            self._config = StoryConfig.from_template(template)

        self._analyzer = TextAnalyzer(
            max_keywords=max_keywords,
            custom_stop_words=custom_stop_words,
        )
        self._renderer = StoryRenderer(self._config)

    # ── Format-specific constructors ─────────────────────────────────

    @classmethod
    def for_story(cls, template: str = "default", **kwargs) -> StoryGenerator:
        """Create a generator for Instagram Stories (1080x1920)."""
        config = StoryConfig.for_format("story", template)
        return cls(config=config, **kwargs)

    @classmethod
    def for_post(cls, template: str = "default", **kwargs) -> StoryGenerator:
        """Create a generator for Instagram Posts (1080x1350)."""
        config = StoryConfig.for_format("post", template)
        return cls(config=config, **kwargs)

    @classmethod
    def for_carousel(cls, template: str = "default", **kwargs) -> StoryGenerator:
        """Create a generator for Instagram Carousels (series of 1080x1350)."""
        config = StoryConfig.for_format("carousel", template)
        return cls(config=config, **kwargs)

    # ── Library-based constructors ───────────────────────────────────

    @classmethod
    def from_library(
        cls, library, mood=None, tags=None, is_dark=None,
        warmth_range=None, prefer_least_used=False, **kwargs,
    ) -> StoryGenerator:
        """Create with the best matching template from a TemplateLibrary."""
        config = library.select(
            mood=mood, tags=tags, is_dark=is_dark,
            warmth_range=warmth_range, prefer_least_used=prefer_least_used,
        )
        if config is None:
            raise ValueError(
                f"No template matches filters. Library has {library.size} templates."
            )
        return cls(config=config, **kwargs)

    @classmethod
    def from_library_random(
        cls, library, tags=None, mood=None, is_dark=None,
        exclude=None, **kwargs,
    ) -> StoryGenerator:
        """Create with a random template from the library."""
        config = library.random(tags=tags, mood=mood, is_dark=is_dark, exclude=exclude)
        if config is None:
            raise ValueError(
                f"No template matches filters ({library.size} templates total)."
            )
        return cls(config=config, **kwargs)

    # ── Properties ───────────────────────────────────────────────────

    @property
    def config(self) -> StoryConfig:
        return self._config

    @property
    def format(self) -> str:
        return self._config.format

    # ── Single image generation ──────────────────────────────────────

    def generate(
        self,
        text: str,
        image_path: Optional[Union[str, Path]] = None,
        image: Optional[Image.Image] = None,
        title: Optional[str] = None,
        highlight_words: Optional[list[str]] = None,
        graphic_image: Optional[Image.Image] = None,
        graphic_path: Optional[Union[str, Path]] = None,
    ) -> bytes:
        """
        Generate a single content image (Story or Post).

        Parameters
        ----------
        text : str
            Body text to display.
        image_path / image :
            Preview image (file path or PIL Image).
        title : str | None
            Title/headline text. If None, only body text is shown.
        highlight_words : list[str] | None
            Words to underline. Auto-detected if None.
        graphic_image / graphic_path :
            Optional graphic element (logo, icon).

        Returns
        -------
        bytes
            PNG image bytes.
        """
        preview = self._load_image(image_path, image)
        graphic = self._load_graphic(graphic_image, graphic_path)
        highlights = highlight_words or self._analyzer.extract_highlight_words(text)

        # Wrap text
        body_lines = self._renderer.wrap_text(text, highlights)
        title_lines = None
        if title and self._config.grid:
            title_slot = self._config.grid.get_slot("title")
            if title_slot:
                _, _, tw, _ = self._config.grid.slot_pixel_rect(title_slot)
                title_lines = self._renderer.wrap_text(
                    title, [],
                    max_width=tw,
                    font_size=title_slot.font_size,
                    font_family=title_slot.font_family,
                )

        result = self._renderer.render(
            preview, body_lines,
            title_lines=title_lines,
            graphic_image=graphic,
        )
        return self._to_png(result)

    def generate_to_file(
        self, text: str, output_path: Union[str, Path], **kwargs,
    ) -> Path:
        """Generate and save to file. Returns the file path."""
        png = self.generate(text=text, **kwargs)
        out = Path(output_path)
        out.write_bytes(png)
        return out

    def generate_image(self, text: str, **kwargs) -> Image.Image:
        """Generate and return a PIL Image object."""
        png = self.generate(text=text, **kwargs)
        return Image.open(io.BytesIO(png))

    # ── Carousel generation ──────────────────────────────────────────

    def generate_carousel(
        self,
        text: str,
        image_path: Optional[Union[str, Path]] = None,
        image: Optional[Image.Image] = None,
        title: Optional[str] = None,
        highlight_words: Optional[list[str]] = None,
        graphic_image: Optional[Image.Image] = None,
        graphic_path: Optional[Union[str, Path]] = None,
    ) -> list[bytes]:
        """
        Generate a carousel — multiple slides from long text.

        The text is automatically split across slides. The title
        appears on the first slide, subsequent slides continue
        the body text.

        Parameters
        ----------
        text : str
            Full body text (will be split across slides).
        title : str | None
            Title for the first slide.
        ... (same as generate())

        Returns
        -------
        list[bytes]
            List of PNG bytes, one per carousel slide.
        """
        preview = self._load_image(image_path, image)
        graphic = self._load_graphic(graphic_image, graphic_path)
        highlights = highlight_words or self._analyzer.extract_highlight_words(text)

        # Get max lines per slide from grid config
        grid = self._config.grid
        max_lines = grid.max_lines_per_slide if grid else 6
        title_on_first = grid.carousel_title_on_first if grid else True

        # Wrap all body text
        all_body_lines = self._renderer.wrap_text(text, highlights)

        # Split into chunks for slides
        chunks = []
        for i in range(0, len(all_body_lines), max_lines):
            chunks.append(all_body_lines[i:i + max_lines])

        if not chunks:
            chunks = [all_body_lines]

        # Generate each slide
        slides = []
        for idx, chunk in enumerate(chunks):
            # Title only on first slide
            title_lines = None
            if title and idx == 0 and title_on_first and grid:
                title_slot = grid.get_slot("title")
                if title_slot:
                    _, _, tw, _ = grid.slot_pixel_rect(title_slot)
                    title_lines = self._renderer.wrap_text(
                        title, [],
                        max_width=tw,
                        font_size=title_slot.font_size,
                        font_family=title_slot.font_family,
                    )

            result = self._renderer.render(
                preview, chunk,
                title_lines=title_lines,
                graphic_image=graphic if idx == 0 else None,
            )
            slides.append(self._to_png(result))

        return slides

    def generate_carousel_to_files(
        self,
        text: str,
        output_dir: Union[str, Path],
        prefix: str = "slide",
        **kwargs,
    ) -> list[Path]:
        """Generate carousel and save each slide to a file."""
        slides = self.generate_carousel(text=text, **kwargs)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        paths = []
        for i, png in enumerate(slides):
            path = out_dir / f"{prefix}_{i+1:02d}.png"
            path.write_bytes(png)
            paths.append(path)
        return paths

    # ── Helpers ───────────────────────────────────────────────────────

    def _load_image(self, path, image):
        if image is not None:
            return image.copy()
        if path is not None:
            return Image.open(path)
        raise ValueError("Either 'image_path' or 'image' must be provided.")

    def _load_graphic(self, image, path):
        if image is not None:
            return image.copy()
        if path is not None:
            return Image.open(path)
        return None

    def _to_png(self, img: Image.Image) -> bytes:
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
