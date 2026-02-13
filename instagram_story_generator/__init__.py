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

    # Generate template from a reference image:
    from instagram_story_generator import TemplateLibrary

    library = TemplateLibrary()
    library.add_from_image("reference_story.png", name="my_brand")
    config = library.random(tags=["dark", "warm"])
"""

from .generator import StoryGenerator
from .text_analyzer import TextAnalyzer
from .renderer import StoryRenderer
from .config import StoryConfig
from .image_analyzer import ImageAnalyzer
from .template_builder import TemplateBuilder
from .template_library import TemplateLibrary

__all__ = [
    "StoryGenerator",
    "TextAnalyzer",
    "StoryRenderer",
    "StoryConfig",
    "ImageAnalyzer",
    "TemplateBuilder",
    "TemplateLibrary",
]
__version__ = "1.1.0"
