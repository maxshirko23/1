#!/usr/bin/env python3
"""
Example usage of Instagram Story Generator.

Shows all main use cases: default template, custom template,
explicit highlights, and integration patterns.
"""

from pathlib import Path

from instagram_story_generator import StoryGenerator


def example_basic():
    """Basic usage with default template and auto-detected keywords."""
    gen = StoryGenerator()

    text = (
        "Искусственный интеллект меняет мир технологий. "
        "Новые модели машинного обучения способны генерировать "
        "изображения, писать код и анализировать данные "
        "с невероятной точностью."
    )

    png_bytes = gen.generate(
        text=text,
        image_path="preview.jpg",  # your preview image
    )

    Path("story_basic.png").write_bytes(png_bytes)
    print(f"Generated story_basic.png ({len(png_bytes)} bytes)")


def example_custom_template():
    """Using a built-in dark template."""
    gen = StoryGenerator(template="bold_dark")

    text = (
        "Breaking: Major tech companies announce "
        "revolutionary quantum computing breakthrough "
        "that could transform cryptography forever."
    )

    gen.generate_to_file(
        text=text,
        image_path="preview.jpg",
        output_path="story_dark.png",
    )
    print("Generated story_dark.png")


def example_explicit_highlights():
    """Manually specifying which words to highlight."""
    gen = StoryGenerator(template="minimal")

    text = (
        "Рынок криптовалют показал рекордный рост. "
        "Bitcoin преодолел отметку в 100 тысяч долларов, "
        "а Ethereum обновил исторический максимум."
    )

    png_bytes = gen.generate(
        text=text,
        image_path="preview.jpg",
        highlight_words=["рекордный рост", "Bitcoin", "Ethereum"],
    )

    Path("story_highlights.png").write_bytes(png_bytes)
    print("Generated story_highlights.png")


def example_custom_yaml_config():
    """Loading a custom YAML template."""
    gen = StoryGenerator(config_path="my_brand_template.yaml")

    text = "Your article text here..."
    png_bytes = gen.generate(text=text, image_path="preview.jpg")
    Path("story_custom.png").write_bytes(png_bytes)
    print("Generated story_custom.png")


def example_pil_image_input():
    """Passing a PIL Image object instead of file path."""
    from PIL import Image

    gen = StoryGenerator()
    preview = Image.new("RGB", (800, 600), color=(50, 100, 200))

    text = "This is a test story with a solid color preview image."
    png_bytes = gen.generate(text=text, image=preview)

    Path("story_pil.png").write_bytes(png_bytes)
    print("Generated story_pil.png")


def example_integration_pattern():
    """
    Integration with an external service.

    Your service sends text + image → this module returns PNG bytes.
    """
    gen = StoryGenerator()

    def handle_story_request(article_text: str, image_bytes: bytes) -> bytes:
        """Handler that your service would call."""
        from PIL import Image
        import io

        # Convert raw bytes to PIL Image
        preview = Image.open(io.BytesIO(image_bytes))

        # Generate story
        return gen.generate(text=article_text, image=preview)

    # Simulate a request
    from PIL import Image
    import io

    fake_image = Image.new("RGB", (800, 600), (100, 150, 200))
    buf = io.BytesIO()
    fake_image.save(buf, format="JPEG")
    fake_image_bytes = buf.getvalue()

    result = handle_story_request(
        article_text="Тестовая статья для генерации Instagram-сторис.",
        image_bytes=fake_image_bytes,
    )
    Path("story_integration.png").write_bytes(result)
    print(f"Generated story_integration.png ({len(result)} bytes)")


if __name__ == "__main__":
    # Run the PIL-based examples that don't need external files
    example_pil_image_input()
    example_integration_pattern()
    print("\nDone! Check generated files.")
