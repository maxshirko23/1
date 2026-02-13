"""
Google Fonts downloader and cache.

Downloads .ttf files from Google Fonts and caches them locally
in the module's fonts/ directory for use by the renderer.

Usage:
    from instagram_story_generator.google_fonts import GoogleFonts

    gf = GoogleFonts()
    path = gf.get("Montserrat", weight=700)   # downloads if needed
    path = gf.get("Roboto")                    # regular weight
    gf.list_cached()                           # see what's downloaded
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from .config import FONTS_DIR


# Google Fonts CSS2 API endpoint
_CSS_API = "https://fonts.googleapis.com/css2"

# Weight name mapping
WEIGHT_NAMES = {
    100: "Thin",
    200: "ExtraLight",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
    900: "Black",
}


class GoogleFonts:
    """
    Downloads and caches Google Fonts for use with the renderer.

    Fonts are stored as .ttf files in the fonts/ directory.
    A JSON manifest tracks what has been downloaded.
    """

    MANIFEST_FILE = "_google_fonts.json"

    def __init__(self, cache_dir: Optional[Path] = None):
        self._cache_dir = cache_dir or FONTS_DIR
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._manifest = self._load_manifest()

    def get(
        self,
        family: str,
        weight: int = 400,
        italic: bool = False,
    ) -> Path:
        """
        Get a Google Font file path, downloading if necessary.

        Parameters
        ----------
        family : str
            Font family name (e.g., "Montserrat", "Roboto", "Open Sans").
        weight : int
            Font weight (100-900). Default 400 (Regular).
        italic : bool
            Whether to get the italic variant.

        Returns
        -------
        Path
            Path to the cached .ttf file.

        Raises
        ------
        RuntimeError
            If the font cannot be downloaded.
        """
        key = self._cache_key(family, weight, italic)

        # Check cache first
        if key in self._manifest:
            cached_path = self._cache_dir / self._manifest[key]["filename"]
            if cached_path.exists():
                return cached_path

        # Download
        ttf_path = self._download_font(family, weight, italic)
        self._manifest[key] = {
            "family": family,
            "weight": weight,
            "italic": italic,
            "filename": ttf_path.name,
        }
        self._save_manifest()
        return ttf_path

    def get_family(
        self,
        family: str,
        weights: Optional[list[int]] = None,
    ) -> dict[int, Path]:
        """
        Download multiple weights of a font family.

        Parameters
        ----------
        family : str
            Font family name.
        weights : list[int] | None
            Weights to download. Defaults to [400, 700].

        Returns
        -------
        dict[int, Path]
            Mapping of weight → file path.
        """
        if weights is None:
            weights = [400, 700]
        result = {}
        for w in weights:
            result[w] = self.get(family, weight=w)
        return result

    def is_cached(self, family: str, weight: int = 400, italic: bool = False) -> bool:
        """Check if a font variant is already cached."""
        key = self._cache_key(family, weight, italic)
        if key not in self._manifest:
            return False
        return (self._cache_dir / self._manifest[key]["filename"]).exists()

    def list_cached(self) -> list[dict]:
        """List all cached fonts."""
        result = []
        for key, info in self._manifest.items():
            path = self._cache_dir / info["filename"]
            result.append({
                "family": info["family"],
                "weight": info["weight"],
                "italic": info.get("italic", False),
                "path": str(path),
                "exists": path.exists(),
            })
        return result

    def clear_cache(self) -> int:
        """Remove all cached Google Font files. Returns count of removed files."""
        count = 0
        for info in self._manifest.values():
            path = self._cache_dir / info["filename"]
            if path.exists():
                path.unlink()
                count += 1
        self._manifest = {}
        self._save_manifest()
        return count

    # ── Internal ─────────────────────────────────────────────────────

    def _download_font(self, family: str, weight: int, italic: bool) -> Path:
        """Download a font from Google Fonts API."""
        # Build CSS2 API URL
        ital = 1 if italic else 0
        spec = f"ital,wght@{ital},{weight}"
        url = f"{_CSS_API}?family={family.replace(' ', '+')}:{spec}"

        # Fetch CSS to extract .ttf URL
        # Use a User-Agent that triggers TTF response (not woff2)
        req = urllib.request.Request(url, headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        })

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                css = resp.read().decode("utf-8")
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Failed to fetch Google Fonts CSS for '{family}' "
                f"weight={weight}: {e}"
            )

        # Extract font URL from CSS
        # Pattern: url(https://fonts.gstatic.com/s/...)
        urls = re.findall(r'url\((https://[^)]+\.ttf)\)', css)
        if not urls:
            # Try woff2 as fallback
            urls = re.findall(r'url\((https://[^)]+)\)', css)
            if not urls:
                raise RuntimeError(
                    f"Could not extract font URL from CSS for '{family}' "
                    f"weight={weight}. CSS content:\n{css[:500]}"
                )

        font_url = urls[0]

        # Download the font file
        weight_name = WEIGHT_NAMES.get(weight, str(weight))
        ital_suffix = "-Italic" if italic else ""
        filename = f"{family.replace(' ', '')}-{weight_name}{ital_suffix}.ttf"
        dest = self._cache_dir / filename

        try:
            urllib.request.urlretrieve(font_url, str(dest))
        except urllib.error.URLError as e:
            raise RuntimeError(f"Failed to download font file: {e}")

        return dest

    def _cache_key(self, family: str, weight: int, italic: bool) -> str:
        """Generate a unique cache key."""
        return f"{family.lower()}_{weight}_{'i' if italic else 'r'}"

    def _load_manifest(self) -> dict:
        """Load the font cache manifest."""
        path = self._cache_dir / self.MANIFEST_FILE
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_manifest(self) -> None:
        """Save the font cache manifest."""
        path = self._cache_dir / self.MANIFEST_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._manifest, f, indent=2, ensure_ascii=False)
