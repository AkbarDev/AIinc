#!/usr/bin/env python3
"""Basic SEO file validation for sitemap.xml and robots.txt."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / "sitemap.xml"
ROBOTS = ROOT / "robots.txt"


def fail(message: str) -> None:
    print(f"seo-check: FAIL - {message}")
    sys.exit(1)


def main() -> None:
    if not SITEMAP.exists():
        fail("sitemap.xml missing")
    if not ROBOTS.exists():
        fail("robots.txt missing")

    robots_text = ROBOTS.read_text(encoding="utf-8")
    if "Sitemap:" not in robots_text:
        fail("robots.txt missing Sitemap directive")

    try:
        tree = ET.parse(SITEMAP)
        root = tree.getroot()
    except ET.ParseError as exc:
        fail(f"invalid sitemap.xml: {exc}")

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text for loc in root.findall("sm:url/sm:loc", ns) if loc.text]
    if not urls:
        fail("sitemap.xml has no URLs")

    if len(urls) != len(set(urls)):
        fail("sitemap.xml has duplicate URLs")

    print(f"seo-check: PASS - {len(urls)} URLs validated")


if __name__ == "__main__":
    main()
