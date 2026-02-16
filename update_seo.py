#!/usr/bin/env python3
"""
Comprehensive SEO and performance update script for Swavey Services website.
Handles: titles, meta descriptions, OG tags, Twitter cards, canonical URLs,
structured data, lazy loading, alt text, heading fixes, preconnect hints,
and removes template leftovers.
"""

import re
import os
from pathlib import Path

SITE_ROOT = Path(__file__).parent
DOMAIN = "https://swavey.biz"

# Page-specific SEO data
PAGE_SEO = {
    "index.html": {
        "title": "Swavey Services | Photography & Custom Apparel Printing in South Florida",
        "description": "Swavey Services offers professional photography (portraits, events, sports, lifestyle) and custom apparel printing & embroidery in South Florida. No minimum order required.",
        "canonical": f"{DOMAIN}/",
        "og_type": "website",
    },
    "portfolio.html": {
        "title": "Photography Portfolio | Swavey Shots - South Florida Photographer",
        "description": "Browse our photography portfolio featuring baby, family, lifestyle, maternity, portrait, event, and sports photography by Swavey Shots in South Florida.",
        "canonical": f"{DOMAIN}/portfolio.html",
        "og_type": "website",
    },
    "babyshoot.html": {
        "title": "Baby Photography | Swavey Shots - Newborn & Baby Photo Sessions",
        "description": "Professional baby and newborn photography sessions by Swavey Shots. Capturing precious moments of your little ones in South Florida. Book your session today.",
        "canonical": f"{DOMAIN}/babyshoot.html",
        "og_type": "website",
    },
    "familyshoot.html": {
        "title": "Family Photography | Swavey Shots - Family Portrait Sessions",
        "description": "Professional family photography sessions by Swavey Shots in South Florida. Beautiful family portraits that capture your family's unique bond. Book now.",
        "canonical": f"{DOMAIN}/familyshoot.html",
        "og_type": "website",
    },
    "lifestyleshoot.html": {
        "title": "Lifestyle Photography | Swavey Shots - Creative Lifestyle Sessions",
        "description": "Creative lifestyle photography by Swavey Shots in South Florida. Authentic, candid lifestyle photos that tell your story. Book your session today.",
        "canonical": f"{DOMAIN}/lifestyleshoot.html",
        "og_type": "website",
    },
    "maternityshoot.html": {
        "title": "Maternity Photography | Swavey Shots - Pregnancy Photo Sessions",
        "description": "Beautiful maternity photography by Swavey Shots in South Florida. Celebrate your pregnancy with stunning maternity portraits. Book your session today.",
        "canonical": f"{DOMAIN}/maternityshoot.html",
        "og_type": "website",
    },
    "portraitshoot.html": {
        "title": "Portrait Photography | Swavey Shots - Professional Portrait Sessions",
        "description": "Professional portrait photography by Swavey Shots in South Florida. Individual, couple, and group portraits that showcase your personality. Book now.",
        "canonical": f"{DOMAIN}/portraitshoot.html",
        "og_type": "website",
    },
    "events.html": {
        "title": "Event Photography | Swavey Shots - Professional Event Coverage",
        "description": "Professional event photography by Swavey Shots in South Florida. Capturing memorable moments at parties, celebrations, and corporate events. Book now.",
        "canonical": f"{DOMAIN}/events.html",
        "og_type": "website",
    },
    "sportshoot.html": {
        "title": "Sports Photography | Swavey Shots - Action Sports Photo Coverage",
        "description": "Dynamic sports photography by Swavey Shots in South Florida. High-quality action shots of athletes and sporting events. Book your coverage today.",
        "canonical": f"{DOMAIN}/sportshoot.html",
        "og_type": "website",
    },
    "service.html": {
        "title": "Custom Apparel Printing & Embroidery | Swavey Prints - No Minimum Order",
        "description": "Custom apparel printing and embroidery services by Swavey Prints. T-shirts, polos, hats, and more. No minimum order required. Graphic and logo design available.",
        "canonical": f"{DOMAIN}/service.html",
        "og_type": "website",
    },
    "contact.html": {
        "title": "Contact Us | Swavey Services - Book Photography or Order Custom Apparel",
        "description": "Contact Swavey Services to book a photography session or place a custom apparel printing order. Quick response time, free quotes available.",
        "canonical": f"{DOMAIN}/contact.html",
        "og_type": "website",
    },
    "about.html": {
        "title": "About Us | Swavey Services - Photography & Custom Printing Team",
        "description": "Learn about the Swavey Services team. Professional photographers and custom apparel printers serving South Florida with passion and creativity.",
        "canonical": f"{DOMAIN}/about.html",
        "og_type": "website",
    },
    "pricing.html": {
        "title": "Pricing | Swavey Services - Photography & Printing Rates",
        "description": "View pricing for Swavey Shots photography sessions and Swavey Prints custom apparel services. Affordable rates with no minimum order for printing.",
        "canonical": f"{DOMAIN}/pricing.html",
        "og_type": "website",
    },
    "team.html": {
        "title": "Our Team | Swavey Services - Meet the Creatives",
        "description": "Meet the creative team behind Swavey Services. Professional photographers, designers, and apparel printing specialists serving South Florida.",
        "canonical": f"{DOMAIN}/team.html",
        "og_type": "website",
    },
    "blog.html": {
        "title": "Blog | Swavey Services - Photography Tips & Behind the Scenes",
        "description": "Read the latest from Swavey Services. Photography tips, behind-the-scenes stories, and custom apparel printing inspiration.",
        "canonical": f"{DOMAIN}/blog.html",
        "og_type": "website",
    },
    "single-post.html": {
        "title": "Blog Post | Swavey Services",
        "description": "Read this article from Swavey Services featuring photography insights and custom apparel printing tips.",
        "canonical": f"{DOMAIN}/single-post.html",
        "og_type": "article",
    },
    "404.html": {
        "title": "Page Not Found | Swavey Services",
        "description": "The page you're looking for doesn't exist. Browse Swavey Services for photography and custom apparel printing in South Florida.",
        "canonical": f"{DOMAIN}/404.html",
        "og_type": "website",
    },
}

# Alt text mapping for known images
ALT_TEXT_MAP = {
    "swaveylogo.png": "Swavey Services logo",
    "swaveylogow.png": "Swavey Services logo white",
    "swaveyprints-button-2.PNG": "Swavey Prints - Custom Apparel Printing",
    "swaveyshots-button-2.PNG": "Swavey Shots - Professional Photography",
    "babies1.jpg": "Baby photography portfolio by Swavey Shots",
    "families1.jpg": "Family photography portfolio by Swavey Shots",
    "lifestyle1.jpg": "Lifestyle photography portfolio by Swavey Shots",
    "maternity1.jpg": "Maternity photography portfolio by Swavey Shots",
    "portraits1.jpg": "Portrait photography portfolio by Swavey Shots",
    "events.jpg": "Event photography portfolio by Swavey Shots",
    "sports1.jpg": "Sports photography portfolio by Swavey Shots",
    "favi.jpg": "Swavey Services favicon",
    "about-us.jpg": "About Swavey Services",
    "company-image.jpg": "Swavey Services company",
    "company-image-2.jpg": "Swavey Services mission",
    "company-image-3.jpg": "Swavey Services vision",
}

# Category-based alt text for portfolio images
CATEGORY_ALT = {
    "Baby Shoots": "Baby photography by Swavey Shots",
    "Family Shoots": "Family photography by Swavey Shots",
    "Lifestyle Shots": "Lifestyle photography by Swavey Shots",
    "Maternity Shoots": "Maternity photography by Swavey Shots",
    "Portrait Shoots": "Portrait photography by Swavey Shots",
    "Events": "Event photography by Swavey Shots",
    "Sports Shots": "Sports photography by Swavey Shots",
    "PhotoGrid": "Custom apparel printing by Swavey Prints",
}


def get_alt_for_src(src: str) -> str:
    """Generate descriptive alt text based on image source path."""
    filename = src.split("/")[-1]

    # Check exact filename match
    if filename in ALT_TEXT_MAP:
        return ALT_TEXT_MAP[filename]

    # Check category-based alt text
    for category, alt in CATEGORY_ALT.items():
        if category in src:
            return alt

    # Client logos
    if "client-logo" in src:
        return "Swavey Services client testimonial"

    # Team photos
    if "team/" in src:
        return "Swavey Services team member"

    # Gallery photos
    if "gallery" in src:
        return "Swavey Services gallery"

    # Blog images
    if "blog/" in src:
        return "Swavey Services blog"

    # Slider images
    if "slider/" in src:
        return "Swavey Services"

    # Default
    return "Swavey Services photography and printing"


def build_head_block(filename: str, original_head: str) -> str:
    """Build the new <head> content with SEO improvements."""
    seo = PAGE_SEO.get(filename)
    if not seo:
        return original_head

    title = seo["title"]
    desc = seo["description"]
    canonical = seo["canonical"]
    og_type = seo["og_type"]
    og_image = f"{DOMAIN}/images/swaveylogo.png"

    new_head = f'''
  <!-- Basic Page Needs
  ================================================== -->
  <meta charset="utf-8">
  <title>{title}</title>

  <!-- Mobile Specific Metas
  ================================================== -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="{desc}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="author" content="Swavey Services">

  <!-- Canonical URL -->
  <link rel="canonical" href="{canonical}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="{og_type}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:image" content="{og_image}" />
  <meta property="og:site_name" content="Swavey Services" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{og_image}" />

  <!-- Favicon -->
  <link rel="shortcut icon" type="image/x-icon" href="images/favi.jpg" />

  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <!-- CSS
  ================================================== -->
  <!-- Themefisher Icon font -->
  <link rel="stylesheet" href="plugins/themefisher-font/style.css">
  <!-- bootstrap.min css -->
  <link rel="stylesheet" href="plugins/bootstrap/bootstrap.min.css">
  <!-- Lightbox.min css -->
  <link rel="stylesheet" href="plugins/lightbox2/css/lightbox.min.css">
  <!-- animation css -->
  <link rel="stylesheet" href="plugins/animate/animate.css">
  <!-- Slick Carousel -->
  <link rel="stylesheet" href="plugins/slick/slick.css">
  <!-- Main Stylesheet -->
  <link rel="stylesheet" href="css/style.css">
'''
    return new_head


def add_lazy_loading(html: str) -> str:
    """Add loading='lazy' to all img tags that don't have it."""
    def add_lazy(match):
        tag = match.group(0)
        if 'loading=' in tag:
            return tag
        return tag.replace('<img ', '<img loading="lazy" ')

    return re.sub(r'<img\s[^>]+>', add_lazy, html)


def fix_alt_text(html: str) -> str:
    """Fix empty and missing alt attributes."""
    def fix_alt(match):
        tag = match.group(0)
        # Extract src
        src_match = re.search(r'src="([^"]*)"', tag)
        if not src_match:
            return tag

        src = src_match.group(1)
        alt = get_alt_for_src(src)

        # Replace empty alt=""
        if 'alt=""' in tag:
            tag = tag.replace('alt=""', f'alt="{alt}"')
        # Add alt if missing entirely
        elif 'alt=' not in tag:
            tag = tag.replace('/>', f'alt="{alt}" />')
            tag = tag.replace('>', f' alt="{alt}">', 1) if '/>' not in tag else tag

        return tag

    return re.sub(r'<img\s[^>]+/?>', fix_alt, html)


def fix_logo_dimensions(html: str) -> str:
    """Fix logo img tags with invalid vw/vh units."""
    # Fix width = "250vw" height = "75vh" -> width="250" height="75"
    html = re.sub(
        r'width\s*=\s*"250vw"\s*height\s*=\s*"75vh"',
        'width="250" height="75"',
        html
    )
    html = re.sub(
        r'width\s*=\s*"150vw"\s*height\s*=\s*"75vh"',
        'width="150" height="75"',
        html
    )
    return html


def fix_heading_hierarchy(html: str, filename: str) -> str:
    """Fix heading hierarchy issues."""
    # For index.html, the h1 tags in the slider are OK (only one visible at a time)
    # But for other pages, ensure proper hierarchy
    if filename != "index.html":
        # Pages with section headers as h2 should get an h1
        # Add h1 if the page has a single-page-header with h2
        if 'single-page-header' in html and '<h1' not in html:
            # The h2 in single-page-header should become h1
            html = re.sub(
                r'(<section class="single-page-header">.*?)<h2>(.*?)</h2>',
                r'\1<h1>\2</h1>',
                html,
                count=1,
                flags=re.DOTALL
            )
    return html


def build_structured_data(filename: str) -> str:
    """Generate JSON-LD structured data."""
    seo = PAGE_SEO.get(filename)
    if not seo:
        return ""

    # Organization schema (on every page)
    org_schema = '''{
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Swavey Services",
    "url": "https://swavey.biz",
    "logo": "https://swavey.biz/images/swaveylogo.png",
    "description": "Professional photography and custom apparel printing & embroidery services in South Florida.",
    "sameAs": [
      "https://www.instagram.com/swavey.shots/",
      "https://www.instagram.com/swaveyprints/"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "url": "https://swavey.biz/contact.html"
    }
  }'''

    # LocalBusiness schema (on index and contact)
    local_schema = '''{
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Swavey Services",
    "url": "https://swavey.biz",
    "image": "https://swavey.biz/images/swaveylogo.png",
    "description": "Professional photography and custom apparel printing & embroidery services in South Florida. No minimum order required.",
    "priceRange": "$$",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Professional Photography",
            "description": "Portrait, lifestyle, event, sports, family, baby, and maternity photography."
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Custom Apparel Printing & Embroidery",
            "description": "Custom t-shirts, polos, hats, and apparel. No minimum order required."
          }
        }
      ]
    }
  }'''

    scripts = f'<script type="application/ld+json">\n  {org_schema}\n  </script>'

    if filename in ("index.html", "contact.html"):
        scripts += f'\n  <script type="application/ld+json">\n  {local_schema}\n  </script>'

    # BreadcrumbList for sub-pages
    if filename not in ("index.html",):
        page_name = seo["title"].split("|")[0].strip()
        breadcrumb = f'''{{"@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://swavey.biz/"
      }},
      {{
        "@type": "ListItem",
        "position": 2,
        "name": "{page_name}",
        "item": "{seo['canonical']}"
      }}
    ]
  }}'''
        scripts += f'\n  <script type="application/ld+json">\n  {breadcrumb}\n  </script>'

    return scripts


def fix_footer_links(html: str) -> str:
    """Fix leftover themefisher social links in footer."""
    html = html.replace(
        'href="https://www.facebook.com/themefisher/"',
        'href="https://www.instagram.com/swavey.shots/"'
    )
    html = html.replace(
        'href="https://www.twitter.com/themefisher/"',
        'href="https://www.instagram.com/swaveyprints/"'
    )
    # Fix the label too
    html = re.sub(
        r'<a href="https://www\.instagram\.com/swavey\.shots/">Facebook</a>',
        '<a href="https://www.instagram.com/swavey.shots/">Swavey Shots IG</a>',
        html
    )
    html = re.sub(
        r'<a href="https://www\.instagram\.com/swaveyprints/\?hl=en">Twitter</a>',
        '<a href="https://www.instagram.com/swaveyprints/?hl=en">Swavey Prints IG</a>',
        html
    )
    return html


def remove_google_maps_from_non_contact(html: str, filename: str) -> str:
    """Remove Google Maps API script from pages that don't use it."""
    if filename != "contact.html":
        html = re.sub(
            r'<script src="https://maps\.googleapis\.com/maps/api/js\?key=[^"]*"></script>\s*\n?',
            '',
            html
        )
        html = re.sub(
            r'<script src="plugins/google-map/gmap\.js"></script>\s*\n?',
            '',
            html
        )
    return html


def process_file(filepath: Path):
    """Process a single HTML file with all optimizations."""
    filename = filepath.name

    if filename not in PAGE_SEO:
        print(f"  SKIP: {filename} (not in SEO config)")
        return

    html = filepath.read_text(encoding='utf-8')

    # 1. Replace <head> content
    head_match = re.search(r'<head>(.*?)</head>', html, re.DOTALL)
    if head_match:
        new_head = build_head_block(filename, head_match.group(1))
        html = html[:head_match.start(1)] + new_head + html[head_match.end(1):]

    # 2. Remove old template comments at top
    html = re.sub(
        r'<!--\s*\n\s*// WEBSITE: https://themefisher\.com.*?-->\s*\n',
        '',
        html,
        flags=re.DOTALL
    )

    # 3. Add structured data before </head>
    structured_data = build_structured_data(filename)
    if structured_data:
        html = html.replace('</head>', f'\n  {structured_data}\n</head>')

    # 4. Add lazy loading to all images
    html = add_lazy_loading(html)

    # 5. Fix alt text
    html = fix_alt_text(html)

    # 6. Fix logo dimensions
    html = fix_logo_dimensions(html)

    # 7. Fix heading hierarchy
    html = fix_heading_hierarchy(html, filename)

    # 8. Fix footer social links
    html = fix_footer_links(html)

    # 9. Remove Google Maps from non-contact pages
    html = remove_google_maps_from_non_contact(html, filename)

    # 10. Remove generator meta tag leftover
    html = re.sub(r'\s*<meta name="generator"[^>]*>\s*', '\n', html)

    # Write back
    filepath.write_text(html, encoding='utf-8')
    print(f"  DONE: {filename}")


def main():
    print("=" * 60)
    print("Swavey SEO & Performance Update Script")
    print("=" * 60)

    # Process all HTML files in root
    html_files = list(SITE_ROOT.glob("*.html"))
    print(f"\nFound {len(html_files)} HTML files\n")

    for fp in sorted(html_files):
        print(f"Processing: {fp.name}")
        process_file(fp)

    print("\nAll files processed!")


if __name__ == '__main__':
    main()
