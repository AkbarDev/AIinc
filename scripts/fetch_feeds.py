#!/usr/bin/env python3
"""Fetch open RSS feeds, compute trend scores, and emit /data/trends.json."""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "config" / "sources.json"
OUTPUT_PATH = BASE_DIR / "data" / "trends.json"
BADGE_DIR = BASE_DIR / "data" / "badges"
USER_AGENT = "SnapFacts-TrendBot/1.0 (+https://www.snapfacts.in)"
IST = timezone(timedelta(hours=5, minutes=30))

KEYWORD_SIGNALS = {
    "technology": ["ai", "artificial intelligence", "quantum", "chip", "semiconductor", "cloud", "open source"],
    "media": ["streaming", "box office", "studio", "series", "film", "hollywood"],
    "gaming": ["game", "esports", "console", "dlc"],
    "culture": ["music", "tour", "festival", "award", "grammys"],
    "policy": ["regulation", "policy", "bill", "govern"],
}

SAMPLE_ITEMS = [
    {
        "title": "IBM and Samsung unveil 2nm chip alliance for AI compute surge",
        "summary": "Partnership targets 30% efficiency boost for data centers as both companies co-develop packaging pipelines.",
        "link": "https://newsroom.ibm.com/ibm-samsung-2nm-alliance",
        "published": datetime(2026, 2, 6, 8, 30, tzinfo=timezone.utc).isoformat(),
        "source": "Sample Feed",
        "category": "technology",
        "geo": "global",
        "authority": 0.8
    },
    {
        "title": "Warner Discovery greenlights global Dune spin-off trilogy",
        "summary": "New Max originals explore Bene Gesserit archives with simultaneous theatrical events.",
        "link": "https://variety.com/dune-spin-off",
        "published": datetime(2026, 2, 6, 7, 45, tzinfo=timezone.utc).isoformat(),
        "source": "Sample Feed",
        "category": "media",
        "geo": "global",
        "authority": 0.78
    },
    {
        "title": "Xbox Cloud ramps India rollout with Reliance Jio 5G bundles",
        "summary": "Pilot offers unlimited Game Pass streaming with edge servers across Mumbai and Hyderabad metros.",
        "link": "https://www.theverge.com/xbox-cloud-india",
        "published": datetime(2026, 2, 6, 9, 10, tzinfo=timezone.utc).isoformat(),
        "source": "Sample Feed",
        "category": "gaming",
        "geo": "apac",
        "authority": 0.75
    }
]

@dataclass
class FeedSource:
    name: str
    url: str
    category: str
    continent: str
    geo: str
    authority: float = 0.7

@dataclass
class TrendCluster:
    key: str
    title: str
    link: str
    summary: str
    image: Optional[str]
    category: str
    geo: str
    published: datetime
    sources: set = field(default_factory=set)
    keyword_hits: set = field(default_factory=set)
    authority_total: float = 0.0
    latest_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def add_source(self, source: FeedSource, keywords: Iterable[str]) -> None:
        self.sources.add(source.name)
        self.authority_total += source.authority
        self.keyword_hits.update(keywords)

    @property
    def source_count(self) -> int:
        return len(self.sources)

    @property
    def authority_score(self) -> float:
        return self.authority_total / max(self.source_count, 1)


def load_sources(path: Path) -> List[FeedSource]:
    data = json.loads(path.read_text())
    return [FeedSource(**item) for item in data]


def fetch_feed_xml(source: FeedSource) -> Optional[str]:
    req = Request(source.url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError) as exc:
        print(f"warn: failed to fetch {source.name}: {exc}", file=sys.stderr)
        return None


def parse_items(xml_payload: str, source: FeedSource) -> List[Dict[str, str]]:
    try:
        root = ET.fromstring(xml_payload)
    except ET.ParseError as exc:
        print(f"warn: XML parse failed for {source.name}: {exc}", file=sys.stderr)
        return []

    entries: List[Dict[str, str]] = []
    ns = {"media": "http://search.yahoo.com/mrss/"}

    if root.tag.lower().endswith("feed"):
        items = root.findall("{*}entry")
    else:
        channel = root.find("channel")
        items = channel.findall("item") if channel is not None else []

    for item in items:
        title = _first(item, ["title"])
        summary = _first(item, ["description", "summary", "content"])
        link = _first(item, ["link"]) or ""
        if not link:
            link_node = item.find("link")
            if link_node is not None:
                link = link_node.attrib.get("href", "") or link_node.attrib.get("{http://www.w3.org/1999/xlink}href", "")
        published_raw = _first(item, ["pubDate", "published", "updated"])
        published = _parse_date(published_raw)
        image = _extract_image(item, summary, ns)

        if not title or not link:
            continue
        entries.append(
            {
                "title": title.strip(),
                "summary": (summary or "").strip(),
                "link": link.strip(),
                "published": (published or datetime.now(timezone.utc)).isoformat(),
                "image": image,
                "source": source.name,
                "category": source.category,
                "continent": source.continent,
                "geo": source.geo,
                "authority": source.authority,
            }
        )
    return entries


def _first(node: ET.Element, tags: List[str]) -> Optional[str]:
    for tag in tags:
        child = node.find(tag)
        if child is not None and child.text:
            return child.text
    return None


def _extract_image(node: ET.Element, summary: Optional[str], ns: Dict[str, str]) -> Optional[str]:
    media_content = node.find("media:content", ns)
    if media_content is not None:
        url = media_content.attrib.get("url")
        if _looks_like_image(url):
            return url

    media_thumbnail = node.find("media:thumbnail", ns)
    if media_thumbnail is not None:
        url = media_thumbnail.attrib.get("url")
        if _looks_like_image(url):
            return url

    enclosure = node.find("enclosure")
    if enclosure is not None:
        url = enclosure.attrib.get("url")
        mime = (enclosure.attrib.get("type") or "").lower()
        if _looks_like_image(url) or mime.startswith("image/"):
            return url

    for content in node.findall("{http://www.w3.org/2005/Atom}content"):
        src = content.attrib.get("src")
        if _looks_like_image(src):
            return src

    if summary:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary, re.IGNORECASE)
        if match and _looks_like_image(match.group(1)):
            return match.group(1)
    return None


def _looks_like_image(url: Optional[str]) -> bool:
    if not url:
        return False
    return bool(re.search(r"\.(jpg|jpeg|png|webp|gif|avif)(\?|$)", url, re.IGNORECASE)) or url.startswith("http")


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (TypeError, ValueError):
        return None


def normalize_title(title: str) -> str:
    cleaned = re.sub(r"[^a-z0-9 ]", "", title.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def detect_keywords(text: str) -> List[str]:
    hits = []
    lowered = text.lower()
    for label, words in KEYWORD_SIGNALS.items():
        for word in words:
            if word in lowered:
                hits.append(word)
    return hits


def build_clusters(entries: List[Dict[str, str]]) -> Dict[str, TrendCluster]:
    clusters: Dict[str, TrendCluster] = {}
    for entry in entries:
        key = normalize_title(entry["title"])
        published = datetime.fromisoformat(entry["published"])
        if key not in clusters:
            clusters[key] = TrendCluster(
                key=key,
                title=entry["title"],
                link=entry["link"],
                summary=entry["summary"],
                image=entry.get("image"),
                category=entry["category"],
                geo=entry["geo"],
                published=published,
                latest_seen=published,
            )
        cluster = clusters[key]
        # prefer freshest summary/category/geo
        if published > cluster.latest_seen:
            cluster.summary = entry["summary"]
            cluster.category = entry["category"] or cluster.category
            cluster.geo = entry["geo"] or cluster.geo
            cluster.link = entry["link"]
            cluster.image = entry.get("image") or cluster.image
            cluster.published = published
            cluster.latest_seen = published
        elif not cluster.image and entry.get("image"):
            cluster.image = entry.get("image")
        source = FeedSource(
            name=entry["source"],
            url="",
            category=entry["category"],
            continent=entry.get("continent", "global"),
            geo=entry["geo"],
            authority=entry.get("authority", 0.7),
        )
        keywords = detect_keywords(f"{entry['title']} {entry['summary']}")
        cluster.add_source(source, keywords)
    return clusters


def compute_score(cluster: TrendCluster, now: datetime) -> Dict[str, float]:
    age_hours = max((now - cluster.published).total_seconds() / 3600, 0.01)
    recency = math.exp(-age_hours / 6)  # half-life ~4.2h
    keyword_volume = min(len(cluster.keyword_hits) / 5.0, 1.0)
    source_signal = min(cluster.source_count / 5.0, 1.0)
    authority = min(cluster.authority_score, 1.0)
    engagement = 0.6 if "ai" in cluster.keyword_hits else 0.4
    score = (
        source_signal * 0.3
        + recency * 0.25
        + keyword_volume * 0.2
        + authority * 0.15
        + engagement * 0.1
    )
    return {
        "score": round(score, 4),
        "recency": recency,
        "keyword_volume": keyword_volume,
        "source_signal": source_signal,
        "authority": authority,
        "engagement": engagement,
    }


def aggregate(entries: List[Dict[str, str]], feeds_polled: int, feed_pool: int, window_hours: Optional[int] = 24) -> Dict[str, object]:
    now_utc = datetime.now(timezone.utc)
    cutoff_utc = None if window_hours is None else now_utc - timedelta(hours=window_hours)
    clusters = build_clusters(entries)
    continent_counts = defaultdict(int)
    for entry in entries:
        continent = entry.get("continent", "global")
        continent_counts[continent] += 1
    payload = []
    for cluster in clusters.values():
        if cutoff_utc and cluster.published < cutoff_utc:
            continue
        score_block = compute_score(cluster, now_utc)
        payload.append(
            {
                "id": cluster.key,
                "title": cluster.title,
                "summary": cluster.summary,
                "image": cluster.image,
                "link": cluster.link,
                "category": cluster.category,
                "geo": cluster.geo,
                "published_at": cluster.published.isoformat(),
                "source_count": cluster.source_count,
                "keywords": sorted(cluster.keyword_hits),
                "score": score_block["score"],
                "signals": score_block,
            }
        )
    payload.sort(key=lambda item: item["score"], reverse=True)
    ordered_continents = ["NA", "SA", "EU", "AF", "AS", "OC", "global"]
    normalized_counts = {key: continent_counts.get(key, 0) for key in ordered_continents}
    top_continent = max(normalized_counts, key=normalized_counts.get) if normalized_counts else "global"
    return {
        "generated_at": now_utc.isoformat(),
        "sources_scanned": len(entries),
        "feeds_polled": feeds_polled,
        "feed_pool": feed_pool,
        "continent_counts": normalized_counts,
        "top_continent": top_continent,
        "clusters": len(payload),
        "trends": payload,
    }


def load_existing(path: Path) -> Optional[Dict[str, object]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def comparable_signature(data: Dict[str, object]) -> Dict[str, object]:
    return {
        "trends": data.get("trends"),
        "feeds_polled": data.get("feeds_polled"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--sources", type=Path, default=CONFIG_PATH)
    parser.add_argument("--sample", action="store_true", help="Write sample data without network calls")
    args = parser.parse_args()

    sources = load_sources(args.sources)
    feed_pool = len(sources)
    entries: List[Dict[str, str]] = []
    successful_sources = set()

    if args.sample:
        entries = SAMPLE_ITEMS
    else:
        for source in sources:
            xml_payload = fetch_feed_xml(source)
            if not xml_payload:
                continue
            successful_sources.add(source.name)
            entries.extend(parse_items(xml_payload, source))
        if not entries:
            print("warn: no entries fetched; using sample payload", file=sys.stderr)
            entries = SAMPLE_ITEMS

    feeds_polled = feed_pool if args.sample else len(successful_sources)
    previous_data = None if args.sample else load_existing(args.output)
    window = None if args.sample else 24
    data = aggregate(entries, feeds_polled, feed_pool, window_hours=window)

    if previous_data and comparable_signature(previous_data) == comparable_signature(data):
        print("no-new-data: feeds unchanged; skipping write")
        return

    args.output.write_text(json.dumps(data, indent=2))
    write_badges(data)
    print(f"wrote {args.output.relative_to(BASE_DIR)} with {data['clusters']} clusters")


def write_badges(data: Dict[str, object]) -> None:
    BADGE_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = data.get("generated_at")
    try:
        timestamp = datetime.fromisoformat(generated_at).astimezone(timezone.utc)
        friendly = timestamp.strftime("%d %b %H:%M UTC")
    except Exception:
        friendly = "n/a"
    refresh_payload = {
        "schemaVersion": 1,
        "label": "last refresh",
        "message": friendly,
        "color": "blue",
    }
    (BADGE_DIR / "last-refresh.json").write_text(json.dumps(refresh_payload))

    feeds_polled = data.get("feeds_polled", 0)
    feed_pool = data.get("feed_pool", 0)
    color = "brightgreen" if feed_pool and feeds_polled == feed_pool else "orange"
    feeds_payload = {
        "schemaVersion": 1,
        "label": "feeds polled",
        "message": f"{feeds_polled}/{feed_pool} feeds",
        "color": color,
    }
    (BADGE_DIR / "feeds-polled.json").write_text(json.dumps(feeds_payload))


if __name__ == "__main__":
    main()
