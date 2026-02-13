"""
Instagram Content Generator Module.

Generates beautiful Instagram Stories (1080x1920), Posts (1080x1350),
and Carousels (series of 1080x1350) from text and preview images.
Key words are automatically highlighted with pencil/marker underline effects.

Usage:
    from instagram_story_generator import StoryGenerator

    # Story
    gen = StoryGenerator()
    png = gen.generate(text="...", image_path="preview.jpg")

    # Post (1080x1350)
    gen = StoryGenerator.for_post()
    png = gen.generate(text="...", title="Headline", image_path="img.jpg")

    # Carousel (auto-splits text into slides)
    gen = StoryGenerator.for_carousel()
    slides = gen.generate_carousel(text="Long text...", title="Title", image_path="img.jpg")

    # Template from reference image
    from instagram_story_generator import TemplateLibrary
    library = TemplateLibrary()
    library.add_from_image("reference.png", name="my_brand")
    config = library.random(tags=["dark", "warm"])
"""

from .generator import StoryGenerator
from .text_analyzer import TextAnalyzer
from .renderer import StoryRenderer
from .config import StoryConfig
from .image_analyzer import ImageAnalyzer
from .template_builder import TemplateBuilder
from .template_library import TemplateLibrary
from .grid_layout import GridConfig, LayoutSlot, AdaptiveRule, ContentFormat
from .google_fonts import GoogleFonts

__all__ = [
    "StoryGenerator",
    "TextAnalyzer",
    "StoryRenderer",
    "StoryConfig",
    "ImageAnalyzer",
    "TemplateBuilder",
    "TemplateLibrary",
    "GridConfig",
    "LayoutSlot",
    "AdaptiveRule",
    "ContentFormat",
    "GoogleFonts",
]
__version__ = "2.0.0"
