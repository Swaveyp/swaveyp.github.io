#!/usr/bin/env python3
"""
Update img tags to use <picture> elements with WebP sources.
Also adds srcset for responsive images where thumbnails exist.
"""

import re
import glob
from pathlib import Path

SITE_ROOT = Path(__file__).parent


def get_webp_path(src: str) -> str:
    """Convert image path to WebP equivalent."""
    # Replace extension with .webp
    for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
        if src.endswith(ext):
            return src[:-len(ext)] + '.webp'
    return None


def get_thumb_path(src: str) -> str:
    """Get thumbnail path for an image."""
    for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
        if src.endswith(ext):
            stem = src[:-len(ext)]
            return f"{stem}-thumb{ext}"
    return None


def webp_exists(src: str) -> bool:
    """Check if WebP version exists on disk."""
    webp = get_webp_path(src)
    if webp:
        return (SITE_ROOT / webp).exists()
    return False


def thumb_exists(src: str) -> bool:
    """Check if thumbnail version exists on disk."""
    thumb = get_thumb_path(src)
    if thumb:
        return (SITE_ROOT / thumb).exists()
    return False


def convert_img_to_picture(match: str) -> str:
    """Convert an <img> tag to a <picture> element with WebP source."""
    tag = match.group(0)

    # Skip if already inside a <picture> element (avoid double-wrapping)
    # We handle this at the file level instead

    # Extract src
    src_match = re.search(r'src="([^"]*)"', tag)
    if not src_match:
        return tag

    src = src_match.group(1)

    # Skip non-image sources
    if not any(src.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png')):
        return tag

    # Check if WebP exists
    webp_src = get_webp_path(src)
    if not webp_src or not webp_exists(src):
        return tag

    # Build picture element
    # Determine media type
    if src.lower().endswith('.png'):
        fallback_type = 'image/png'
    else:
        fallback_type = 'image/jpeg'

    # Check for thumbnail for srcset
    thumb_src = get_thumb_path(src)
    thumb_webp = get_webp_path(thumb_src) if thumb_src else None

    webp_srcset = f'srcset="{webp_src}"'
    if thumb_webp and (SITE_ROOT / thumb_webp).exists():
        webp_thumb = thumb_webp
        webp_srcset = f'srcset="{webp_thumb} 800w, {webp_src} 1920w" sizes="(max-width: 768px) 100vw, 25vw"'

    picture = f'<picture>\n\t\t\t\t\t\t\t\t\t<source type="image/webp" {webp_srcset}>\n\t\t\t\t\t\t\t\t\t{tag}\n\t\t\t\t\t\t\t\t</picture>'

    return picture


def process_file(filepath: Path):
    """Process a single HTML file."""
    html = filepath.read_text(encoding='utf-8')

    # Skip if file already has <picture> elements (already processed)
    if '<picture>' in html:
        print(f"  SKIP: {filepath.name} (already has <picture> elements)")
        return

    # Find all img tags and convert to picture elements
    # Only convert img tags that are for portfolio/content images (not logos in nav, etc.)
    # We'll convert ALL img tags except those inside specific selectors

    # Convert img tags to picture elements
    original = html
    html = re.sub(r'<img\s[^>]+/?>', convert_img_to_picture, html)

    if html != original:
        filepath.write_text(html, encoding='utf-8')
        count = html.count('<picture>') - original.count('<picture>')
        print(f"  DONE: {filepath.name} ({count} images converted to <picture>)")
    else:
        print(f"  NOCHANGE: {filepath.name}")


def main():
    print("=" * 60)
    print("WebP <picture> Element Update Script")
    print("=" * 60)

    html_files = sorted(SITE_ROOT.glob("*.html"))
    print(f"\nFound {len(html_files)} HTML files\n")

    for fp in html_files:
        if fp.name in ('index-home.html', 'index-text.html', 'onepage-slider.html', 'onepage-text.html'):
            continue
        print(f"Processing: {fp.name}")
        process_file(fp)

    print("\nDone!")


if __name__ == '__main__':
    main()
