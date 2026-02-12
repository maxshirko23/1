"""
Main Story Generator — the public API of the module.

Orchestrates text analysis, image rendering, and output.

Usage:
    from instagram_story_generator import StoryGenerator

    gen = StoryGenerator()                          # default template
    gen = StoryGenerator(template="bold_dark")      # built-in template
    gen = StoryGenerator(config_path="my.yaml")     # custom YAML

    # From file paths
    png_bytes = gen.generate(
        text="Article text here...",
        image_path="preview.jpg",
    )

    # From PIL Image + explicit highlights
    png_bytes = gen.generate(
        text="Article text here...",
        image=pil_image,
        highlight_words=["Article", "text"],
    )

    # Save to file
    gen.generate_to_file(
        text="...", image_path="preview.jpg", output_path="story.png"
    )
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Optional, Union

from PIL import Image

from .config import StoryConfig
from .text_analyzer import TextAnalyzer
from .renderer import StoryRenderer


class StoryGenerator:
    """
    Instagram Story image generator.

    Receives article text + preview image, returns a beautiful
    1080x1920 PNG with highlighted key words.

    Parameters
    ----------
    template : str
        Name of a built-in template ("default", "minimal", "bold_dark").
    config_path : str | Path | None
        Path to a custom YAML template file. Overrides `template`.
    config : StoryConfig | None
        Direct config object. Overrides both `template` and `config_path`.
    max_keywords : int
        Maximum number of key phrases to highlight.
    custom_stop_words : set[str] | None
        Additional stop words for the text analyzer.
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

    @property
    def config(self) -> StoryConfig:
        """Current configuration."""
        return self._config

    def generate(
        self,
        text: str,
        image_path: Optional[Union[str, Path]] = None,
        image: Optional[Image.Image] = None,
        highlight_words: Optional[list[str]] = None,
    ) -> bytes:
        """
        Generate an Instagram Story image.

        Parameters
        ----------
        text : str
            Article text / caption to display on the story.
        image_path : str | Path | None
            Path to the preview image file.
        image : PIL.Image.Image | None
            PIL Image object (alternative to image_path).
        highlight_words : list[str] | None
            Explicit list of words/phrases to underline.
            If None, the text analyzer will auto-detect key words.

        Returns
        -------
        bytes
            PNG image as bytes, ready to send or save.

        Raises
        ------
        ValueError
            If neither image_path nor image is provided.
        """
        # Load image
        preview = self._load_image(image_path, image)

        # Determine highlights
        if highlight_words is None:
            highlights = self._analyzer.extract_highlight_words(text)
        else:
            highlights = highlight_words

        # Word-wrap text and assign highlights to lines
        text_lines = self._renderer.wrap_text(text, highlights)

        # Render the story
        story_image = self._renderer.render(preview, text_lines)

        # Export to PNG bytes
        return self._image_to_png_bytes(story_image)

    def generate_to_file(
        self,
        text: str,
        output_path: Union[str, Path],
        image_path: Optional[Union[str, Path]] = None,
        image: Optional[Image.Image] = None,
        highlight_words: Optional[list[str]] = None,
    ) -> Path:
        """
        Generate a story and save directly to a file.

        Returns the Path to the saved file.
        """
        png_bytes = self.generate(
            text=text,
            image_path=image_path,
            image=image,
            highlight_words=highlight_words,
        )
        output = Path(output_path)
        output.write_bytes(png_bytes)
        return output

    def generate_image(
        self,
        text: str,
        image_path: Optional[Union[str, Path]] = None,
        image: Optional[Image.Image] = None,
        highlight_words: Optional[list[str]] = None,
    ) -> Image.Image:
        """
        Generate and return a PIL Image object (instead of bytes).

        Useful when you want to do additional processing before saving.
        """
        preview = self._load_image(image_path, image)

        if highlight_words is None:
            highlights = self._analyzer.extract_highlight_words(text)
        else:
            highlights = highlight_words

        text_lines = self._renderer.wrap_text(text, highlights)
        return self._renderer.render(preview, text_lines)

    def _load_image(
        self,
        image_path: Optional[Union[str, Path]],
        image: Optional[Image.Image],
    ) -> Image.Image:
        """Load image from path or use provided PIL Image."""
        if image is not None:
            return image.copy()
        if image_path is not None:
            return Image.open(image_path)
        raise ValueError(
            "Either 'image_path' or 'image' must be provided."
        )

    def _image_to_png_bytes(self, img: Image.Image) -> bytes:
        """Convert a PIL Image to PNG bytes."""
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
