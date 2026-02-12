"""
Instagram Story Generator Module.

Generates beautiful 1080x1920 Instagram Story images from text and preview images.
Key words are automatically highlighted with pencil/marker underline effects.

Usage:
    from instagram_story_generator import StoryGenerator

    generator = StoryGenerator()  # uses default template
    png_bytes = generator.generate(
        text="Your article text here...",
        image_path="preview.jpg",
    )
"""

from .generator import StoryGenerator
from .text_analyzer import TextAnalyzer
from .renderer import StoryRenderer
from .config import StoryConfig

__all__ = ["StoryGenerator", "TextAnalyzer", "StoryRenderer", "StoryConfig"]
__version__ = "1.0.0"
