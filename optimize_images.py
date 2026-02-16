#!/usr/bin/env python3
"""
Image optimization script for Swavey Services website.
- Resizes images to max 1920px wide (preserving aspect ratio)
- Compresses JPEGs to quality 82
- Generates WebP versions alongside originals
- Generates 800px thumbnails for mobile srcset
- Skips already-optimized images
"""

import os
import sys
from pathlib import Path
from PIL import Image

SITE_ROOT = Path(__file__).parent
IMAGES_DIR = SITE_ROOT / "images"

MAX_WIDTH = 1920
THUMB_WIDTH = 800
JPEG_QUALITY = 82
WEBP_QUALITY = 80

# Skip these directories (small utility images that don't need optimization)
SKIP_DIRS = set()

SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}

stats = {
    'processed': 0,
    'skipped': 0,
    'errors': 0,
    'original_bytes': 0,
    'final_bytes': 0,
}


def optimize_image(filepath: Path):
    """Optimize a single image file."""
    try:
        original_size = filepath.stat().st_size
        stats['original_bytes'] += original_size

        img = Image.open(filepath)

        # Convert RGBA to RGB for JPEG compatibility
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Auto-orient based on EXIF
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)

        w, h = img.size

        # Resize if wider than MAX_WIDTH
        if w > MAX_WIDTH:
            ratio = MAX_WIDTH / w
            new_h = int(h * ratio)
            img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)

        # Determine output format
        ext = filepath.suffix.lower()

        # Save optimized original (overwrite)
        if ext in ('.jpg', '.jpeg'):
            img.save(filepath, 'JPEG', quality=JPEG_QUALITY, optimize=True)
        elif ext == '.png':
            img.save(filepath, 'PNG', optimize=True)

        # Generate WebP version
        webp_path = filepath.with_suffix('.webp')
        img.save(webp_path, 'WEBP', quality=WEBP_QUALITY, method=4)

        # Generate thumbnail (800px wide) for mobile
        w_current, h_current = img.size
        if w_current > THUMB_WIDTH:
            ratio = THUMB_WIDTH / w_current
            thumb_h = int(h_current * ratio)
            thumb = img.resize((THUMB_WIDTH, thumb_h), Image.LANCZOS)

            # Save thumbnail with -thumb suffix
            stem = filepath.stem
            thumb_path = filepath.parent / f"{stem}-thumb{filepath.suffix}"
            thumb_webp_path = filepath.parent / f"{stem}-thumb.webp"

            if ext in ('.jpg', '.jpeg'):
                thumb.save(thumb_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
            elif ext == '.png':
                thumb.save(thumb_path, 'PNG', optimize=True)

            thumb.save(thumb_webp_path, 'WEBP', quality=WEBP_QUALITY, method=4)

        final_size = filepath.stat().st_size
        stats['final_bytes'] += final_size
        stats['processed'] += 1

        saved_pct = ((original_size - final_size) / original_size * 100) if original_size > 0 else 0
        print(f"  OK: {filepath.name} ({original_size // 1024}KB -> {final_size // 1024}KB, -{saved_pct:.0f}%)")

    except Exception as e:
        stats['errors'] += 1
        print(f"  ERROR: {filepath.name}: {e}")


def main():
    print("=" * 60)
    print("Swavey Image Optimization Script")
    print("=" * 60)

    if not IMAGES_DIR.exists():
        print(f"ERROR: Images directory not found: {IMAGES_DIR}")
        sys.exit(1)

    # Collect all image files
    image_files = []
    for root, dirs, files in os.walk(IMAGES_DIR):
        root_path = Path(root)
        # Skip directories
        if any(skip in str(root_path) for skip in SKIP_DIRS):
            continue
        for f in files:
            fp = root_path / f
            if fp.suffix in SUPPORTED_EXTENSIONS:
                # Skip already-generated thumbnails
                if '-thumb' in fp.stem:
                    continue
                image_files.append(fp)

    total = len(image_files)
    print(f"\nFound {total} images to optimize\n")

    for i, fp in enumerate(image_files, 1):
        rel = fp.relative_to(SITE_ROOT)
        print(f"[{i}/{total}] {rel}")
        optimize_image(fp)

    print("\n" + "=" * 60)
    print("OPTIMIZATION COMPLETE")
    print("=" * 60)
    print(f"Processed: {stats['processed']}")
    print(f"Skipped:   {stats['skipped']}")
    print(f"Errors:    {stats['errors']}")
    if stats['original_bytes'] > 0:
        saved = stats['original_bytes'] - stats['final_bytes']
        pct = saved / stats['original_bytes'] * 100
        print(f"Original total:  {stats['original_bytes'] / 1024 / 1024:.1f} MB")
        print(f"Optimized total: {stats['final_bytes'] / 1024 / 1024:.1f} MB")
        print(f"Saved:           {saved / 1024 / 1024:.1f} MB ({pct:.1f}%)")


if __name__ == '__main__':
    main()
