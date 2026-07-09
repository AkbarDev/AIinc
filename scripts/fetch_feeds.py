#!/usr/bin/env python3
"""Fetch open RSS feeds, compute trend scores, and emit /data/trends.json."""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs, quote
from xml.etree import ElementTree as ET

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "config" / "sources.json"
OUTPUT_PATH = BASE_DIR / "data" / "trends.json"
BADGE_DIR = BASE_DIR / "data" / "badges"
USER_AGENT = "SnapFacts-TrendBot/1.0 (+https://www.snapfacts.in)"
IST = timezone(timedelta(hours=5, minutes=30))

import socket

def resolve_hf_dns(hostname: str = "router.huggingface.co") -> Optional[str]:
    """Query Google DoH (using IP 8.8.8.8) and Cloudflare DoH (using IP 1.1.1.1) to resolve the given hostname."""
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    url = f"https://8.8.8.8/resolve?name={hostname}"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            answers = data.get("Answer", [])
            for ans in answers:
                if ans.get("type") == 1: # A record
                    return ans.get("data")
    except Exception as e:
        print(f"warn: DoH resolution of {hostname} via Google DNS (8.8.8.8) failed: {e}", file=sys.stderr)
        
    url_cf = f"https://1.1.1.1/dns-query?name={hostname}&type=A"
    req_cf = Request(url_cf, headers={"accept": "application/dns-json", "User-Agent": USER_AGENT})
    try:
        with urlopen(req_cf, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            answers = data.get("Answer", [])
            for ans in answers:
                if ans.get("type") == 1: # A record
                    return ans.get("data")
    except Exception as e:
        print(f"warn: DoH resolution of {hostname} via Cloudflare DNS (1.1.1.1) failed: {e}", file=sys.stderr)
        
    return None

_original_getaddrinfo = socket.getaddrinfo

def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host in ("router.huggingface.co", "api-inference.huggingface.co"):
        resolved_ip = resolve_hf_dns(host)
        if resolved_ip:
            # Construct and return socket address info tuple directly to avoid glibc resolver error with numeric IPs
            return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (resolved_ip, port))]
    return _original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = patched_getaddrinfo

KEYWORD_SIGNALS = {
    "technology": ["ai", "artificial intelligence", "quantum", "cloud", "open source", "platform", "enterprise"],
    "media": ["streaming", "box office", "studio", "series", "film", "hollywood"],
    "gaming": ["game", "esports", "console", "dlc"],
    "culture": ["music", "tour", "festival", "award", "grammys"],
    "policy": ["regulation", "policy", "bill", "govern"],
}

SAMPLE_ITEMS = [
    {
        "title": "IBM and Samsung expand AI infrastructure alliance for compute efficiency",
        "summary": "Partnership targets a major efficiency boost for data centers as both companies co-develop compute infrastructure pipelines.",
        "link": "https://newsroom.ibm.com/ibm-samsung-ai-infrastructure-alliance",
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
    ai_image_pending: bool = False
    image_failure_reason: str = ""

    def add_source(self, source: FeedSource, keywords: Iterable[str]) -> None:
        self.sources.add(source.name)
        self.authority_total += source.authority
        self.keyword_hits.update(keywords)

    @property
    def source_count(self) -> int:
        return len(self.sources)

    @property
    def source_names(self) -> List[str]:
        return sorted(self.sources)

    @property
    def authority_score(self) -> float:
        return self.authority_total / max(self.source_count, 1)


def load_sources(path: Path) -> List[FeedSource]:
    data = json.loads(path.read_text())
    return [FeedSource(**item) for item in data]


def fetch_feed_xml(source: FeedSource) -> Optional[str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }
    req = Request(source.url, headers=headers)
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
        raw_summary = _first(item, ["description", "summary", "content"]) or ""
        summary = summarize_feed_text(raw_summary)
        link = _first(item, ["link"]) or ""
        if not link:
            link_node = item.find("link")
            if link_node is not None:
                link = link_node.attrib.get("href", "") or link_node.attrib.get("{http://www.w3.org/1999/xlink}href", "")
        published_raw = _first(item, ["pubDate", "published", "updated"])
        published = _parse_date(published_raw)
        if not title or not link:
            continue
        title = title.strip()
        link = link.strip()
        image = _extract_image(item, raw_summary, ns) or build_generated_visual(title, summary, source.name, source.category)
        entries.append(
            {
                "title": title,
                "summary": summary,
                "link": link,
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

    content_encoded = node.find("{http://purl.org/rss/1.0/modules/content/}encoded")
    if content_encoded is not None and content_encoded.text:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_encoded.text, re.IGNORECASE)
        if match and _looks_like_image(match.group(1)):
            return match.group(1)

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
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False

    path = parsed.path or ""
    if re.search(r"\.(jpg|jpeg|png|webp|gif|avif)(\?|$)", path, re.IGNORECASE):
        return True

    query = parse_qs(parsed.query)
    for key in ("format", "fm", "ext", "type"):
        value = (query.get(key) or [""])[0].lower()
        if value in {"jpg", "jpeg", "png", "webp", "gif", "avif", "image"}:
            return True

    # Allow common image delivery path patterns even without extensions.
    if re.search(r"/(image|images|img|photo|photos|media)/", path, re.IGNORECASE):
        return True

    return False


def build_generated_visual(title: str, summary: str, source_name: str, category: str) -> str:
    """Create a lightweight SVG visual card when the RSS item has no image."""
    palettes = [
        ("#0f766e", "#042f2e", "#5eead4"),
        ("#1d4ed8", "#071a3b", "#93c5fd"),
        ("#be185d", "#2b0718", "#f9a8d4"),
        ("#92400e", "#211006", "#fdba74"),
        ("#334155", "#020617", "#cbd5e1"),
        ("#9f1239", "#2a0712", "#fda4af"),
        ("#15803d", "#052e16", "#86efac"),
    ]
    text_seed = f"{title} {source_name} {category}"
    color_a, color_b, accent = palettes[stable_hash(text_seed) % len(palettes)]
    label = visual_label(text_seed, category)
    mark = initials(source_name or label)
    headline_lines = wrap_svg_text(compact_headline(title), max_chars=28, max_lines=2)
    source = escape_svg((source_name or "Snapfacts").upper())
    label_text = escape_svg(label.upper())
    title_markup = "\n  ".join(
        f'<text x="48" y="{96 + idx * 44}" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#f8fbff">{escape_svg(line)}</text>'
        for idx, line in enumerate(headline_lines)
    )
    summary_line = escape_svg(wrap_svg_text(summary or "Fresh signal from monitored RSS feeds.", max_chars=56, max_lines=1)[0])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="{escape_svg(title)}">
  <defs>
    <linearGradient id="snapfactsGeneratedVisual" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{color_a}"/>
      <stop offset="100%" stop-color="{color_b}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#snapfactsGeneratedVisual)"/>
  <rect width="640" height="360" fill="#020617" fill-opacity="0.22"/>
  <circle cx="558" cy="86" r="72" fill="none" stroke="{accent}" stroke-width="2" stroke-opacity="0.6"/>
  <circle cx="558" cy="86" r="42" fill="#ffffff" fill-opacity="0.12" stroke="{accent}" stroke-width="1.5" stroke-opacity="0.75"/>
  <text x="558" y="98" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff">{escape_svg(mark)}</text>
  <text x="558" y="184" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="{accent}">GENERATED VISUAL</text>
  <text x="558" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff" fill-opacity="0.84">{label_text}</text>
  <rect x="28" y="36" width="430" height="220" rx="16" fill="#020617" fill-opacity="0.28"/>
  <text x="48" y="66" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="{accent}">{source}</text>
  {title_markup}
  <text x="48" y="224" font-family="Arial, sans-serif" font-size="16" font-weight="500" fill="#ffffff" fill-opacity="0.82">{summary_line}</text>
  <rect x="36" y="292" width="168" height="36" rx="18" fill="#ffffff" fill-opacity="0.16"/>
  <text x="120" y="315" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#f8fbff">{label_text}</text>
  <rect x="220" y="292" width="168" height="36" rx="18" fill="#ffffff" fill-opacity="0.16"/>
  <text x="304" y="315" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#f8fbff">SNAPFACTS</text>
</svg>'''
    return f"data:image/svg+xml;utf8,{quote(svg)}"


def is_generated_visual(url: Optional[str]) -> bool:
    return bool(url and url.startswith("data:image/svg+xml"))


def choose_preferred_image(existing: Optional[str], incoming: Optional[str]) -> Optional[str]:
    if not incoming:
        return existing
    if not existing:
        return incoming
    if is_generated_visual(existing) and not is_generated_visual(incoming):
        return incoming
    if not is_generated_visual(existing) and is_generated_visual(incoming):
        return existing
    return incoming


def visual_label(text: str, category: str) -> str:
    signals = [
        (r"\bopenai|chatgpt|llm|genai|model|agent\b", "AI"),
        (r"\badvertis|campaign|adtech|marketing\b", "ADS"),
        (r"\bretail|commerce|ecommerce|payment|shop\b", "COMMERCE"),
        (r"\bmedia|publisher|streaming|creator\b", "MEDIA"),
        (r"\bbrand|consumer|customer\b", "BRANDS"),
        (r"\bstartup|funding|venture\b", "STARTUP"),
    ]
    for pattern, label in signals:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return (category or "NEWS").replace("-", " ").upper()


def compact_headline(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value or "").strip()
    if not normalized:
        return "SNAPFACTS SIGNAL"
    candidate = re.split(r"\s[-:–—]\s|;\s|\s\|\s", normalized)[0] or normalized
    words = candidate.split()
    if len(words) > 10:
        candidate = " ".join(words[:10])
    return re.sub(r"\s+(and|or|with|for|to|from|via|by|amid|as|on|in)$", "", candidate, flags=re.IGNORECASE).strip().upper()


def wrap_svg_text(value: str, max_chars: int, max_lines: int) -> List[str]:
    words = re.sub(r"\s+", " ", value or "").strip().split()
    lines: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) >= max_lines - 1:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    return lines or ["SNAPFACTS"]


def initials(value: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", value or "")
    if not words:
        return "SF"
    if len(words) == 1:
        return words[0][:3].upper()
    return "".join(word[0] for word in words[:2]).upper()


def stable_hash(value: str) -> int:
    result = 0
    for char in value:
        result = (result * 31 + ord(char)) & 0xFFFFFFFF
    return result


def escape_svg(value: str) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


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


def summarize_feed_text(value: str, max_chars: int = 180) -> str:
    plain = re.sub(r"<[^>]+>", " ", value or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    if not plain:
        return "Summary unavailable from feed."

    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", plain) if part.strip()]
    sentence = parts[0] if parts else plain
    if len(sentence) < 40 and len(parts) > 1:
        sentence = f"{sentence} {parts[1]}".strip()

    if len(sentence) > max_chars:
        clipped = sentence[:max_chars].rstrip()
        cut = clipped.rfind(" ")
        sentence = (clipped[:cut] if cut > int(max_chars * 0.6) else clipped).rstrip()

    sentence = re.sub(r"[,:;\-]+$", "", sentence)
    sentence = re.sub(r"\s+(and|or|with|for|to|from|via|by|amid|as|on|in|of|at|into|over|under)$", "", sentence, flags=re.IGNORECASE)
    return sentence.strip()


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
            cluster.image = choose_preferred_image(cluster.image, entry.get("image"))
            cluster.published = published
            cluster.latest_seen = published
        elif entry.get("image"):
            cluster.image = choose_preferred_image(cluster.image, entry.get("image"))
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


def generate_creative_prompt(title: str, summary: str) -> str:
    prompt = (
        "Generate a premium editorial news illustration.\n\n"
        f"Article Headline:\n{title}\n\n"
        f"Article Summary:\n{summary}\n\n"
        "Style:\n"
        "Professional magazine cover illustration, realistic digital art, cinematic lighting, editorial quality, symbolic representation, visually engaging, high detail.\n\n"
        "Rules:\n"
        "• No text anywhere in the image\n"
        "• No logos\n"
        "• No watermarks\n"
        "• No website UI\n"
        "• No fake screenshots\n"
        "• No speech bubbles\n"
        "• Landscape 16:9\n"
        "• One central subject\n"
        "• Symbolic rather than literal depiction\n"
        "• Modern color grading\n"
        "• Suitable for a news website hero image"
    )
    return prompt


def enhance_cluster_metadata_with_llm(title: str, summary: str, current_category: str, api_key: str) -> Optional[Dict[str, str]]:
    """Use Hugging Face Chat API to generate a clean summary and classify the news article."""
    url = "https://router.huggingface.co/v1/chat/completions"
    
    system_instruction = (
        "You are an expert news editor and classifier. "
        "Your task is to analyze the given news article headline and raw summary, "
        "then output a valid JSON object containing exactly two keys:\n"
        "1. \"summary\": A premium, professional 1-sentence summary (max 25 words) of the news.\n"
        "2. \"category\": Classify the news into exactly one of these categories: "
        "[tech, ads, startup, ai, media, gaming, commerce, brands]. Use the most specific one.\n"
        "Do not include any markup, code fences, markdown syntax, prefix, or extra text. Output ONLY the raw JSON block."
    )
    user_content = f"Headline: {title}\nRaw Summary: {summary}\nSuggested Category: {current_category}"
    
    models = [
        "Qwen/Qwen2.5-72B-Instruct",
        "meta-llama/Llama-3-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.3"
    ]
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }
    
    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            "max_tokens": 150,
            "temperature": 0.3
        }
        try:
            req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                choices = resp_data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "").strip()
                    if content:
                        # Clean markdown code block wraps (like ```json ... ```) if present
                        if content.startswith("```"):
                            lines = content.splitlines()
                            if lines[0].startswith("```"):
                                lines = lines[1:]
                            if lines and lines[-1].startswith("```"):
                                lines = lines[:-1]
                            content = "\n".join(lines).strip()
                        
                        data = json.loads(content)
                        if "summary" in data and "category" in data:
                            print(f"info: Successfully enhanced metadata using {model}")
                            return data
        except Exception as e:
            print(f"warn: LLM metadata enhancement with {model} failed: {e}", file=sys.stderr)
            continue
            
    return None


def enhance_prompt_with_llm(title: str, summary: str, category: str, api_key: str) -> Optional[str]:
    """Use Hugging Face Chat API to enhance a simple title & summary into a visual description prompt."""
    url = "https://router.huggingface.co/v1/chat/completions"
    
    system_instruction = (
        "You are an Art Director creating editorial news-card images for a technology and marketing news website.\n\n"
        "Your task is to analyze the news headline and summary and produce a highly descriptive image prompt.\n\n"
        "The generated image should represent the story visually rather than literally.\n\n"
        "Instructions:\n"
        "1. Read the headline carefully.\n"
        "2. Identify:\n"
        "   - Primary company\n"
        "   - Secondary company\n"
        "   - Products\n"
        "   - Technologies\n"
        "   - Acquisitions\n"
        "   - Partnerships\n"
        "   - Industry\n"
        "3. Use official company logos only when they are globally recognizable.\n"
        "4. If a company owns another company, represent both companies naturally.\n"
        "5. Do NOT generate random illustrations unrelated to the news.\n"
        "6. Never include unreadable text, fake UI, fake charts or blurry billboards.\n"
        "7. Produce a realistic editorial illustration suitable for a technology news website.\n"
        "8. White or clean gradient background.\n"
        "9. Premium flat 3D illustration style.\n"
        "10. High contrast.\n"
        "11. Sharp edges.\n"
        "12. Ultra detailed.\n"
        "13. 4K quality.\n"
        "14. Professional lighting.\n"
        "15. Minimal composition.\n"
        "16. Leave negative space at the top for the article title.\n"
        "17. No watermarks.\n"
        "18. No copyright text.\n"
        "19. No paragraphs.\n"
        "20. No fake logos.\n\n"
        "Output only the final image prompt."
    )
    user_content = f"Headline: {title}\nSummary: {summary}\nCategory: {category}"
    
    # Try a few model options from Qwen to Deepseek and Llama to ensure high availability
    models = [
        "Qwen/Qwen2.5-72B-Instruct",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
        "meta-llama/Llama-3-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.3"
    ]
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }
    
    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            "max_tokens": 120,
            "temperature": 0.7
        }
        try:
            req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                choices = resp_data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "").strip()
                    if content:
                        # Clean up any potential markdown formatting or quotes
                        content = content.replace('"', '').replace('**', '').replace('`', '').strip()
                        print(f"info: Successfully enhanced prompt using {model}")
                        return content
        except Exception as e:
            print(f"warn: LLM prompt enhancement with {model} failed: {e}", file=sys.stderr)
            continue
            
    return None


def validate_image_quality(image_bytes: bytes) -> tuple:
    """Validate image bytes for color variance, blurriness, and size using PIL."""
    if len(image_bytes) < 8000:
        return False, "File size too small (under 8KB, low details)"
        
    try:
        from PIL import Image, ImageFilter, ImageStat
        import io
        
        # Verify basic image structure first
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        
        # Re-open image since verify() invalidates the file pointer
        img = Image.open(io.BytesIO(image_bytes))
        
        # 1. Color variance check (StdDev)
        stat = ImageStat.Stat(img.convert("L"))
        std_dev = stat.stddev[0]
        if std_dev < 12.0:
            return False, f"Color variance too low ({std_dev:.2f}) - likely flat background or placeholder layout"
            
        # 2. Sharpness/Blurry check (High pass FIND_EDGES variance)
        edges = img.convert("L").filter(ImageFilter.FIND_EDGES)
        edge_stat = ImageStat.Stat(edges)
        mean_edge = edge_stat.mean[0]
        if mean_edge < 3.5:
            return False, f"Image is too blurry or out of focus (mean edge {mean_edge:.2f} < 3.5)"
            
        return True, ""
    except ImportError:
        # If PIL is not installed, fallback to size check
        return True, ""
    except Exception as e:
        return False, f"Exception during validation: {e}"


def generate_hf_image(prompt: str, model_id: str, api_key: str) -> Optional[bytes]:
    """Generate high-definition image bytes using a specified Hugging Face Inference model."""
    url = f"https://api-inference.huggingface.co/models/{model_id}"
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "width": 768,
            "height": 432
        }
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }
    
    try:
        req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urlopen(req, timeout=40) as response:
            content_type = (response.info().get_content_type() or "").lower()
            resp_bytes = response.read()
            if "image" not in content_type:
                return None
            return resp_bytes
    except Exception as e:
        print(f"warn: Hugging Face image model {model_id} generation failed: {e}", file=sys.stderr)
        
    return None


def extract_companies(title: str, summary: str, category: str) -> List[str]:
    # 1. Start with a list of known tech/media/business giants to look for (case-insensitive)
    known = [
        "Apple", "Microsoft", "Google", "Amazon", "Meta", "Netflix", "Nvidia", "Tesla", "Samsung",
        "Intel", "AMD", "Sony", "Nintendo", "Disney", "Warner", "Paramount", "Comcast", "Reliance",
        "Jio", "Tata", "OpenAI", "Anthropic", "TikTok", "SpaceX", "IBM", "Uber", "Spotify", "Shopify",
        "Salesforce", "Oracle", "Adobe", "Figma", "Stripe", "PayPal", "Zoom", "Slack", "Warner Discovery",
        "Warner Bros", "HBO", "Xbox", "PlayStation"
    ]
    
    found = []
    lower_title = title.lower()
    lower_summary = summary.lower()
    
    for name in known:
        pattern = r"\b" + re.escape(name.lower()) + r"\b"
        if re.search(pattern, lower_title) or re.search(pattern, lower_summary):
            if name not in found:
                found.append(name)
                
    # 2. Extract sequences of capitalized words from the title
    candidates = re.findall(r"\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\b", title)
    
    exclusions = {
        "India", "US", "USA", "UK", "Ebola", "Russia", "Ukraine", "Kenya", "Europe", "Asia", "Africa",
        "America", "London", "New York", "Tokyo", "Paris", "Berlin", "Beijing", "Delhi", "Mumbai",
        "AI", "Artificial Intelligence", "App", "Pro", "Max", "Dune", "Game", "Pass", "Cloud",
        "The", "A", "An", "In", "On", "At", "For", "With", "By", "To", "Of", "And", "Or", "New", "Old",
        "Tech", "Media", "Gaming", "Commerce", "Startup", "Ad", "Ads", "Brands", "Brand", "Silicon",
        "Chip", "Chips", "Server", "Data", "Network", "Quantum", "Open Source", "Platform", "Enterprise",
        "Hollywood", "Studio", "Series", "Film", "Movie", "Console", "DLC", "Beta", "Alpha", "Pilot",
        "Security", "Cybersecurity", "Hack", "Hacker", "Hackers", "Code", "Coding", "Software", "Hardware",
        "Federal", "Court", "Government", "Congress", "Senate", "President", "Minister", "CEO", "CTO",
        "Dollar", "Dollars", "Percent", "Percentage", "Bill", "Billion", "Million", "Trillion",
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
        "January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December"
    }
    
    for cand in candidates:
        cand_clean = cand.strip()
        if not cand_clean or len(cand_clean) < 2 or cand_clean.lower() in [e.lower() for e in exclusions]:
            continue
        is_submatch = False
        for f in found:
            if cand_clean.lower() in f.lower() or f.lower() in cand_clean.lower():
                is_submatch = True
                break
        if not is_submatch and cand_clean not in found:
            found.append(cand_clean)
            
    # 3. Fallbacks if we have fewer than 3 companies
    category_fallbacks = {
        "commerce": ["RetailCorp", "ShopFlow", "CartSystems"],
        "tech": ["TechCorp", "InnoSystems", "ByteScale"],
        "technology": ["TechCorp", "InnoSystems", "ByteScale"],
        "ads": ["AdFlow", "PromoScale", "MediaReach"],
        "startup": ["LaunchPad", "VentureHub", "SeedSync"],
        "ai": ["NeuralNet", "DeepScale", "Synthetix"],
        "media": ["NetShow", "StreamLine", "ViewMax"],
        "brands": ["BrandForge", "NameScale", "MarkFlow"],
        "gaming": ["PlayMax", "GameSync", "QuestLabs"],
    }
    
    fallbacks = category_fallbacks.get(category.lower(), ["GlobalCorp", "CoreSystems", "FutureSoft"])
    for fb in fallbacks:
        if len(found) >= 3:
            break
        if fb not in found:
            found.append(fb)
            
    return found[:3]


def generate_gemini_image(prompt: str, api_key: str) -> Optional[bytes]:
    """Generate image bytes using Google Imagen 3 (Nano Banana) via Gemini API."""
    import base64
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={api_key}"
    payload = {
        "instances": [
            {
                "prompt": prompt
            }
        ],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "16:9",
            "outputMimeType": "image/jpeg"
        }
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }
    try:
        req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urlopen(req, timeout=30) as response:
            res = json.loads(response.read().decode("utf-8"))
            if "predictions" in res and len(res["predictions"]) > 0:
                pred = res["predictions"][0]
                img_b64 = pred.get("bytesBase64Encoded") or pred.get("imageBytes")
                if img_b64:
                    return base64.b64decode(img_b64)
    except Exception as e:
        print(f"warn: Google Imagen 3 generation failed: {e}", file=sys.stderr)
    return None


def fetch_ai_image(title: str, summary: str, category: str, trend_id: str) -> Optional[str]:
    import time
    print(f"debug: Environment keys check - HF_API_KEY: {'present' if os.environ.get('HF_API_KEY') else 'missing'}, GEMINI_API_KEY: {'present' if os.environ.get('GEMINI_API_KEY') else 'missing'}")
    generated_dir = BASE_DIR / "assets" / "images" / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)
    image_path = generated_dir / f"{trend_id}.jpg"

    if image_path.exists():
        try:
            is_valid = True
            if image_path.stat().st_size < 1000:
                is_valid = False
            else:
                try:
                    from PIL import Image
                    with Image.open(image_path) as img:
                        img.verify()
                except ImportError:
                    pass
            if is_valid:
                return f"assets/images/generated/{trend_id}.jpg"
            else:
                raise ValueError("File size too small")
        except Exception as e:
            print(f"warn: Existing image {trend_id}.jpg failed validation ({e}). Deleting for regeneration...", file=sys.stderr)
            try:
                image_path.unlink()
            except Exception:
                pass

    print(f"info: Initiating image generation for cluster: {trend_id}...")
    
    # 2. Check for HF_API_KEY
    api_key = os.environ.get("HF_API_KEY")
    enhanced_prompt = None
    if api_key:
        print("info: HF_API_KEY detected. Enhancing prompt using Hugging Face LLM...")
        enhanced_prompt = enhance_prompt_with_llm(title, summary, category, api_key)
        
    # Determine the prompt to use
    if enhanced_prompt:
        prompt_to_use = enhanced_prompt
    else:
        companies = extract_companies(title, summary, category)
        company_1 = companies[0]
        prompt_to_use = (
            f"Minimalist flat vector editorial news illustration about {company_1} and {category}. "
            f"A single clean symbolic visual concept, modern high-contrast color palette, flat vector design. "
            f"Visual elements representing {category} and industry themes. "
            f"No text, no logos, no watermarks, landscape 16:9, clean negative space, premium news hero layout."
        )

    # Setup prompt variations
    prompt_variations = [
        prompt_to_use,
        f"{prompt_to_use}. Award-winning editorial illustration, cinematic lighting, sharp details, high contrast, 8k resolution, photorealistic composition."
    ]

    # 2.5 Try Google Imagen 3 (Nano Banana) first if GEMINI_API_KEY is available
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        print("info: GEMINI_API_KEY detected. Attempting generation with Google Imagen 3 (Nano Banana)...")
        for p_idx, prompt in enumerate(prompt_variations):
            print(f"info: Trying prompt variation {p_idx + 1} on Google Imagen 3...")
            image_bytes = generate_gemini_image(prompt, gemini_key)
            if image_bytes:
                is_valid, validation_msg = validate_image_quality(image_bytes)
                if is_valid:
                    try:
                        image_path.write_bytes(image_bytes)
                        print(f"info: AI image successfully generated and validated via Google Imagen 3: {image_path}")
                        return f"assets/images/generated/{trend_id}.jpg"
                    except Exception as e:
                        print(f"warn: Failed to write Google Imagen 3 image bytes: {e}", file=sys.stderr)
                else:
                    print(f"warn: Google Imagen 3 image failed quality validation: {validation_msg}", file=sys.stderr)

    # Models pipeline to loop through
    MODELS_PIPELINE = [
        {"name": "FLUX.1 Dev", "hf_id": "black-forest-labs/FLUX.1-dev", "pollinations_model": "flux-realism"},
        {"name": "FLUX.1 Schnell", "hf_id": "black-forest-labs/FLUX.1-schnell", "pollinations_model": "flux"},
        {"name": "SDXL 1.0", "hf_id": "stabilityai/stable-diffusion-xl-base-1.0", "pollinations_model": "turbo"},
        {"name": "SDXL Lightning", "hf_id": "ByteDance/SDXL-Lightning", "pollinations_model": "turbo"},
        {"name": "Juggernaut XL", "hf_id": "cagliostrolab/animagine-xl-3.1", "pollinations_model": "flux"},
        {"name": "DreamShaper XL", "hf_id": "Lykon/dreamshaper-xl-v2-turbo", "pollinations_model": "turbo"},
        {"name": "Playground v2.5", "hf_id": "playgroundai/playground-v2.5", "pollinations_model": "flux"}
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # Loop through models in priority
    for model in MODELS_PIPELINE:
        print(f"info: Testing model: {model['name']}...")
        
        # Loop through prompt variations for each model
        for p_idx, prompt in enumerate(prompt_variations):
            print(f"info: Attempting prompt variation {p_idx + 1} on model {model['name']}...")
            image_bytes = None
            
            # Try HF if API key is present
            if api_key and model["hf_id"]:
                print(f"info: Trying Hugging Face inference for model: {model['hf_id']}...")
                image_bytes = generate_hf_image(prompt, model["hf_id"], api_key)
                
            # If HF fails or is skipped, try Pollinations (if pollinations_model parameter is supported)
            if not image_bytes and model["pollinations_model"]:
                print(f"info: Falling back to Pollinations for model: {model['pollinations_model']}...")
                encoded_prompt = quote(prompt)
                pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=640&height=360&nologo=true&private=true&model={model['pollinations_model']}"
                
                try:
                    req = Request(pollinations_url, headers=headers, method="GET")
                    with urlopen(req, timeout=30) as response:
                        content_type = (response.info().get_content_type() or "").lower()
                        resp_bytes = response.read()
                        if "image" in content_type:
                            image_bytes = resp_bytes
                except Exception as exc:
                    print(f"warn: Pollinations fetch failed for model {model['name']}: {exc}", file=sys.stderr)

            # If image was successfully generated, check quality
            if image_bytes:
                is_valid, validation_msg = validate_image_quality(image_bytes)
                if is_valid:
                    try:
                        image_path.write_bytes(image_bytes)
                        print(f"info: AI image successfully validated and saved via {model['name']}: {image_path}")
                        return f"assets/images/generated/{trend_id}.jpg"
                    except Exception as e:
                        print(f"warn: Failed to write image bytes: {e}", file=sys.stderr)
                else:
                    print(f"warn: Generated image failed quality assessment: {validation_msg}. Trying next variant/model...", file=sys.stderr)

    # 3. Public domain free-use Unsplash stock image fallback (if all models fail)
    print(f"info: Using curated open stock image fallback for category: {category}")
    curated_stock = {
        "ai": "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=640&q=80",
        "tech": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
        "technology": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
        "commerce": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=640&q=80",
        "ads": "https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=640&q=80",
        "marketing": "https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=640&q=80",
        "startup": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=640&q=80",
        "media": "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=640&q=80",
        "digital-media": "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=640&q=80",
        "brands": "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=640&q=80",
        "gaming": "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=640&q=80"
    }
    
    fallback_url = curated_stock.get(category.lower(), "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=640&q=80")
    
    try:
        req = Request(fallback_url, headers=headers, method="GET")
        with urlopen(req, timeout=15) as response:
            resp_bytes = response.read()
            image_path.write_bytes(resp_bytes)
            print(f"info: Stock fallback image successfully saved: {image_path}")
            return f"assets/images/generated/{trend_id}.jpg"
    except Exception as e:
        print(f"warn: failed to fetch stock fallback image: {e}", file=sys.stderr)
        
    return None


def cleanup_old_generated_images(active_ids: List[str]) -> None:
    generated_dir = BASE_DIR / "assets" / "images" / "generated"
    if not generated_dir.exists():
        return

    active_filenames = {f"{tid}.jpg" for tid in active_ids}
    deleted_count = 0
    for file in generated_dir.glob("*.jpg"):
        if file.name not in active_filenames:
            try:
                file.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"warn: failed to delete old generated image {file.name}: {e}", file=sys.stderr)

    if deleted_count > 0:
        print(f"info: Deleted {deleted_count} stale generated images")


CATEGORY_FILTERS = {
    'tech': {
        'categories': ['tech', 'technology'],
        'keywords': [r'\bplatform\b', r'\binfrastructure\b', r'\bchip\b', r'\bcloud\b', r'\bsoftware\b']
    },
    'commerce': {
        'categories': ['commerce'],
        'keywords': [r'\be-?commerce\b', r'\bretail\b', r'\bpayment', r'\bcheckout\b', r'\bmerchant\b']
    },
    'ads': {
        'categories': ['ads', 'advertising'],
        'keywords': [r'\badvert', r'\badtech\b', r'\bcampaign\b', r'\bmarketing\b', r'\bmedia buy\b']
    },
    'startup': {
        'categories': ['startup', 'startups'],
        'keywords': [r'\bstartup\b', r'\bfunding\b', r'\bventure\b', r'\bfounder\b', r'\bseed\b']
    },
    'ai': {
        'categories': ['ai'],
        'keywords': [r'\bai\b', r'\bllm\b', r'\bgenai\b', r'\bmodel\b', r'\bagent\b']
    },
    'media': {
        'categories': ['media', 'digital-media', 'social-media'],
        'keywords': [r'\bmedia\b', r'\baudience\b', r'\bpublisher\b', r'\bcreator\b', r'\bstreaming\b']
    },
    'brands': {
        'categories': ['brands', 'brand'],
        'keywords': [r'\bbrand\b', r'\bconsumer\b', r'\bstorytelling\b', r'\bpurpose\b', r'\bmarketing\b']
    }
}


def matches_ui_category(cluster_category: str, title: str, summary: str, ui_category: str) -> bool:
    if not cluster_category:
        return False
    cat = cluster_category.strip().lower()
    mapping = {
        'marketing': 'ads',
        'adtech': 'ads',
        'advertising': 'ads',
        'technology': 'tech',
        'tech': 'tech',
        'startup': 'startup',
        'startups': 'startup',
        'commerce': 'commerce',
        'retail': 'commerce',
        'ai': 'ai',
        'artificialintelligence': 'ai',
        'media': 'media',
        'publishing': 'media',
        'brand': 'brands',
        'brands': 'brands',
    }
    normalized = mapping.get(cat, cat)
    if normalized == ui_category:
        return True

    config = CATEGORY_FILTERS.get(ui_category)
    if not config:
        return False

    if normalized in config.get('categories', []):
        return True

    haystack = f"{title or ''} {summary or ''}".lower()
    for pattern in config.get('keywords', []):
        if re.search(pattern, haystack, re.IGNORECASE):
            return True

    return False


def aggregate(entries: List[Dict[str, str]], feeds_polled: int, feed_pool: int, window_hours: Optional[int] = 24) -> Dict[str, object]:
    now_utc = datetime.now(timezone.utc)
    cutoff_utc = None if window_hours is None else now_utc - timedelta(hours=window_hours)
    clusters = build_clusters(entries)
    
    # Clean up stale images and fetch AI images for active clusters lacking real ones
    active_keys = [c.key for c in clusters.values() if not (cutoff_utc and c.published < cutoff_utc)]
    cleanup_old_generated_images(active_keys)

    continent_counts = defaultdict(int)
    for entry in entries:
        continent = entry.get("continent", "global")
        continent_counts[continent] += 1

    # First, calculate scores and filter active clusters
    scored_clusters = []
    for cluster in clusters.values():
        if cutoff_utc and cluster.published < cutoff_utc:
            continue
        score_block = compute_score(cluster, now_utc)
        scored_clusters.append((cluster, score_block))

    # Sort clusters by score descending
    scored_clusters.sort(key=lambda item: item[1]["score"], reverse=True)

    # Enhance metadata (summaries & categories) for top trends using LLM if api_key is available
    api_key = os.environ.get("HF_API_KEY")
    if api_key:
        print("info: HF_API_KEY detected. Enhancing metadata (summaries & categories) for top trends...")
        # Enhance up to top 15 active clusters
        for idx, (cluster, score_block) in enumerate(scored_clusters[:15]):
            enhanced = enhance_cluster_metadata_with_llm(cluster.title, cluster.summary, cluster.category, api_key)
            if enhanced:
                cluster.summary = enhanced["summary"]
                cluster.category = enhanced["category"]

    # Build the set of clusters to target for image generation to cover all UI tabs
    target_clusters_set = {}  # cluster.key -> (cluster, score_block)
    
    # 1. Add top 10 overall trends
    for cluster, score_block in scored_clusters[:10]:
        target_clusters_set[cluster.key] = (cluster, score_block)

    # 2. Add top 6 trends for each category tab to ensure all tabs are populated with images
    ui_categories = ['commerce', 'tech', 'ads', 'startup', 'ai', 'media', 'brands']
    for ui_cat in ui_categories:
        cat_count = 0
        for cluster, score_block in scored_clusters:
            if matches_ui_category(cluster.category, cluster.title, cluster.summary, ui_cat):
                target_clusters_set[cluster.key] = (cluster, score_block)
                cat_count += 1
                if cat_count >= 6:
                    break

    # Convert back to sorted list by overall score descending
    to_generate = list(target_clusters_set.values())
    to_generate.sort(key=lambda item: item[1]["score"], reverse=True)

    # Generate AI images for target clusters that lack a real image (limit to 15 new generations per run)
    gen_count = 0
    max_generations_per_run = 15
    for cluster, score_block in to_generate:
        if not cluster.image or is_generated_visual(cluster.image):
            # 1. Has AI Image? Validate existing file
            trend_id = cluster.key
            generated_dir = BASE_DIR / "assets" / "images" / "generated"
            image_path = generated_dir / f"{trend_id}.jpg"
            is_valid = False
            if image_path.exists():
                try:
                    if image_path.stat().st_size >= 1000:
                        try:
                            from PIL import Image
                            with Image.open(image_path) as img:
                                img.verify()
                            is_valid = True
                        except ImportError:
                            is_valid = True
                except Exception:
                    pass

            if is_valid:
                cluster.image = f"assets/images/generated/{trend_id}.jpg"
                cluster.ai_image_pending = False
                cluster.image_failure_reason = ""
            else:
                if image_path.exists():
                    try:
                        image_path.unlink()
                    except Exception:
                        pass
                
                # 2. Generate new image
                if gen_count < max_generations_per_run:
                    ai_image = fetch_ai_image(cluster.title, cluster.summary, cluster.category, cluster.key)
                    if ai_image:
                        cluster.image = ai_image
                        cluster.ai_image_pending = False
                        cluster.image_failure_reason = ""
                        gen_count += 1
                        time.sleep(5)
                    else:
                        cluster.ai_image_pending = True
                        cluster.image_failure_reason = "Image generation failed (all service endpoints timed out or returned invalid data)"
                else:
                    cluster.ai_image_pending = True
                    cluster.image_failure_reason = "Generation skipped during this run to respect rate limits (max 15 generations per run)"

    payload = []
    for cluster, score_block in scored_clusters:
        ai_pending = getattr(cluster, "ai_image_pending", False)
        fail_reason = getattr(cluster, "image_failure_reason", "")
        
        # Double check validity of images for elements that were not in the to_generate block
        if not cluster.image or is_generated_visual(cluster.image):
            trend_id = cluster.key
            generated_dir = BASE_DIR / "assets" / "images" / "generated"
            image_path = generated_dir / f"{trend_id}.jpg"
            is_valid = False
            if image_path.exists():
                try:
                    if image_path.stat().st_size >= 1000:
                        try:
                            from PIL import Image
                            with Image.open(image_path) as img:
                                img.verify()
                            is_valid = True
                        except ImportError:
                            is_valid = True
                except Exception:
                    pass
            if is_valid:
                cluster.image = f"assets/images/generated/{trend_id}.jpg"
                ai_pending = False
                fail_reason = ""
            else:
                ai_pending = True
                if not fail_reason:
                    fail_reason = "Skipped generation (exceeded target generation limits or not in target categories)"

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
                "source_names": cluster.source_names,
                "keywords": sorted(cluster.keyword_hits),
                "score": score_block["score"],
                "signals": score_block,
                "ai_image_pending": ai_pending,
                "image_failure_reason": fail_reason if ai_pending else "",
            }
        )
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


def load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key, val = parts[0].strip(), parts[1].strip()
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        val = val[1:-1]
                    if key not in os.environ:
                        os.environ[key] = val
            print("info: Loaded environment variables from local .env file")
        except Exception as e:
            print(f"warn: failed to load local .env file: {e}", file=sys.stderr)


def main() -> None:
    load_env_file()
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
