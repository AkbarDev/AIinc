const FALLBACK_DATA = {
    generated_at: "2026-02-06T09:30:00Z",
    sources_scanned: 12,
    clusters: 3,
    trends: [
        {
            id: "ibm-samsung-2nm",
            title: "IBM and Samsung unveil 2nm chip alliance for AI compute surge",
            summary: "Partnership targets 30% efficiency boost for data centers as both companies co-develop packaging pipelines.",
            link: "https://newsroom.ibm.com/ibm-samsung-2nm-alliance",
            category: "technology",
            geo: "global",
            published_at: "2026-02-06T08:30:00Z",
            source_count: 4,
            keywords: ["ai", "chip"],
            score: 0.82,
            signals: {
                recency: 0.89,
                keyword_volume: 0.4,
                source_signal: 0.8,
                authority: 0.88,
                engagement: 0.6,
            },
        },
        {
            id: "dune-spin-off",
            title: "Warner Discovery greenlights global Dune spin-off trilogy",
            summary: "New Max originals explore Bene Gesserit archives with simultaneous theatrical events.",
            link: "https://variety.com/dune-spin-off",
            category: "media",
            geo: "global",
            published_at: "2026-02-06T07:45:00Z",
            source_count: 3,
            keywords: ["series", "film"],
            score: 0.68,
            signals: {
                recency: 0.84,
                keyword_volume: 0.4,
                source_signal: 0.6,
                authority: 0.8,
                engagement: 0.5,
            },
        },
        {
            id: "xbox-cloud-india",
            title: "Xbox Cloud ramps India rollout with Reliance Jio 5G bundles",
            summary: "Pilot offers unlimited Game Pass streaming with edge servers across Mumbai and Hyderabad metros.",
            link: "https://www.theverge.com/xbox-cloud-india",
            category: "gaming",
            geo: "apac",
            published_at: "2026-02-06T09:10:00Z",
            source_count: 2,
            keywords: ["cloud", "game", "streaming"],
            score: 0.61,
            signals: {
                recency: 0.9,
                keyword_volume: 0.6,
                source_signal: 0.4,
                authority: 0.75,
                engagement: 0.55,
            },
        },
    ],
};

const CATEGORY_MAP = {
    technology: 'tech',
    advertising: 'ads',
    'digital-media': 'media',
    'social-media': 'media',
    ai: 'ai',
    commerce: 'commerce',
    startup: 'startup',
    startups: 'startup',
    brand: 'brands',
    brands: 'brands',
};

const HEADER_CATEGORIES = [
    { key: 'all', label: 'ALL NEWS' },
    { key: 'commerce', label: 'COMMERCE' },
    { key: 'tech', label: 'TECH' },
    { key: 'ads', label: 'ADS' },
    { key: 'startup', label: 'STARTUP' },
    { key: 'ai', label: 'AI' },
    { key: 'media', label: 'MEDIA' },
    { key: 'brands', label: 'BRANDS' },
];


const CATEGORY_COPY = {
    all: { eyebrow: 'Latest coverage', heading: 'Image-first cards with concise summaries' },
    commerce: { eyebrow: 'Commerce focus', heading: 'Retail, payments, and ecommerce intelligence' },
    tech: { eyebrow: 'Tech focus', heading: 'Platform, infrastructure, and product shifts' },
    ads: { eyebrow: 'Ads focus', heading: 'Campaign, adtech, and performance marketing trends' },
    startup: { eyebrow: 'Startup focus', heading: 'AI-native startups shaping analytics and growth stacks' },
    ai: { eyebrow: 'AI focus', heading: 'Models, tooling, and enterprise AI adoption' },
    media: { eyebrow: 'Media focus', heading: 'Digital media distribution and audience growth' },
    brands: { eyebrow: 'Brands focus', heading: 'Insights into how leading global and emerging brands connect with consumers through storytelling, innovation, and purpose-driven marketing.' },
};


const CATEGORY_FILTERS = {
    tech: {
        categories: ['tech', 'technology'],
        keywords: [/\bplatform\b/i, /\binfrastructure\b/i, /\bchip\b/i, /\bcloud\b/i, /\bsoftware\b/i],
    },
    commerce: {
        categories: ['commerce'],
        keywords: [/\be-?commerce\b/i, /\bretail\b/i, /\bpayment/i, /\bcheckout\b/i, /\bmerchant\b/i],
    },
    ads: {
        categories: ['ads', 'advertising'],
        keywords: [/\badvert/i, /\badtech\b/i, /\bcampaign\b/i, /\bmarketing\b/i, /\bmedia buy/i],
    },
    startup: {
        categories: ['startup', 'startups'],
        keywords: [/\bstartup\b/i, /\bfunding\b/i, /\bventure\b/i, /\bfounder\b/i, /\bseed\b/i],
    },
    ai: {
        categories: ['ai'],
        keywords: [/\bai\b/i, /\bllm\b/i, /\bgenai\b/i, /\bmodel\b/i, /\bagent\b/i],
    },
    media: {
        categories: ['media', 'digital-media', 'social-media'],
        keywords: [/\bmedia\b/i, /\baudience\b/i, /\bpublisher\b/i, /\bcreator\b/i, /\bstreaming\b/i],
    },
    brands: {
        categories: ['brands', 'brand'],
        keywords: [/\bbrand\b/i, /\bconsumer\b/i, /\bstorytelling\b/i, /\bpurpose\b/i, /\bmarketing\b/i],
    },
};

const API_BASE = String(window.SNAPFACTS_API_BASE || '').replace(/\/$/, '');

const state = {
    trends: [],
    meta: {},
    activeCategory: 'all',
    carouselIndex: 0,
};

const carouselTouch = {
    startX: 0,
    startY: 0,
    isTracking: false,
};

document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    loadData();
    setupCategoryFilters();
    setupHeroCarousel();
});

async function loadData() {
    try {
        const response = await fetch(`data/trends.json?ts=${Date.now()}`);
        if (!response.ok) throw new Error('Network error');
        const payload = await response.json();
        state.trends = payload.trends || [];
        state.meta = payload;
    } catch (error) {
        console.warn('Falling back to baked data', error);
        state.trends = FALLBACK_DATA.trends;
        state.meta = FALLBACK_DATA;
    }
    renderAll();
}

function renderSkeletons() {
    const carouselTrack = document.getElementById('hero-carousel-track');
    const carouselDots = document.getElementById('hero-carousel-dots');
    if (carouselTrack) {
        carouselTrack.innerHTML = `
            <article class="hero-carousel-slide is-active">
                <div class="hero-carousel-panel">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                </div>
            </article>
        `;
    }
    if (carouselDots) {
        carouselDots.innerHTML = '<span class="hero-carousel-dot active" aria-hidden="true"></span>';
    }
}

function renderAll() {
    renderHeroCarousel();
    renderCategoryPills();
    renderNewsBoard();
    renderSectionHeading();
    renderNewsArticleSchema();
    renderMetaStrip();
    syncActiveCategoryTheme();
}

function getCarouselStories() {
    return [...getCategoryTrends(state.activeCategory)]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);
}

function renderHeroCarousel() {
    const track = document.getElementById('hero-carousel-track');
    const dots = document.getElementById('hero-carousel-dots');
    if (!track || !dots) return;

    const stories = getCarouselStories();
    if (!stories.length) {
        track.innerHTML = '<article class="hero-carousel-slide is-active"><div class="hero-carousel-panel"><div class="hero-carousel-copy"><p class="eyebrow">TRENDING</p><h2>No trending stories available yet.</h2><p>The carousel will populate automatically when stories are available for this section.</p></div></div></article>';
        dots.innerHTML = '';
        return;
    }

    if (state.carouselIndex >= stories.length) {
        state.carouselIndex = 0;
    }

    track.innerHTML = stories
        .map((story, index) => {
            const image = resolveCardImage(story);
            const isActive = index === state.carouselIndex ? 'is-active' : '';
            const theme = normalizeCategory(story.category || 'all');
            const sourceBadge = story.source_count ? `${story.source_count} source${story.source_count === 1 ? '' : 's'}` : 'Live feed';
            return `
        <article class="hero-carousel-slide ${isActive}" data-carousel-index="${index}" data-theme-category="${theme}">
            <div class="hero-carousel-panel" style="background-image: linear-gradient(135deg, rgba(6, 10, 20, 0.12), rgba(6, 10, 20, 0.92)), url(${image});">
                <div class="hero-carousel-copy">
                    <div class="hero-carousel-tags">
                        <span class="hero-carousel-tag">${story.category ? story.category.toUpperCase() : 'TRENDING'}</span>
                        <span class="hero-carousel-tag hero-carousel-tag-muted">${sourceBadge}</span>
                    </div>
                    <h2>${story.title}</h2>
                    <p>${summarize(story.summary, 190)}</p>
                    <div class="hero-carousel-meta">
                        <span>${formatDate(story.published_at)}</span>
                        <span>Score ${story.score ? story.score.toFixed(2) : '—'}</span>
                    </div>
                    <div class="story-actions hero-carousel-actions">
                        <a href="${story.link}" target="_blank" rel="noopener">Read full story</a>
                    </div>
                </div>
            </div>
        </article>`;
        })
        .join('');

    dots.innerHTML = stories
        .map((story, index) => {
            const active = index === state.carouselIndex ? 'active' : '';
            return `<button class="hero-carousel-dot ${active}" type="button" data-carousel-target="${index}" aria-label="Show trending story ${index + 1}: ${escapeAttr(story.title)}"></button>`;
        })
        .join('');
}

function setupHeroCarousel() {
    const prev = document.getElementById('hero-carousel-prev');
    const next = document.getElementById('hero-carousel-next');
    const dots = document.getElementById('hero-carousel-dots');
    const track = document.getElementById('hero-carousel-track');

    if (prev) {
        prev.addEventListener('click', () => {
            moveHeroCarousel(-1);
        });
    }

    if (next) {
        next.addEventListener('click', () => {
            moveHeroCarousel(1);
        });
    }

    if (dots) {
        dots.addEventListener('click', (event) => {
            const button = event.target.closest('[data-carousel-target]');
            if (!button) return;
            state.carouselIndex = Number(button.dataset.carouselTarget || 0);
            renderHeroCarousel();
        });
    }

    if (track) {
        track.addEventListener('touchstart', handleCarouselTouchStart, { passive: true });
        track.addEventListener('touchend', handleCarouselTouchEnd, { passive: true });
        track.addEventListener('touchcancel', resetCarouselTouch, { passive: true });
    }

    window.setInterval(() => {
        if (!getCarouselStories().length) return;
        moveHeroCarousel(1);
    }, 6000);
}

function moveHeroCarousel(direction) {
    const stories = getCarouselStories();
    if (!stories.length) return;
    state.carouselIndex = (state.carouselIndex + direction + stories.length) % stories.length;
    renderHeroCarousel();
}

function handleCarouselTouchStart(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    carouselTouch.startX = touch.clientX;
    carouselTouch.startY = touch.clientY;
    carouselTouch.isTracking = true;
}

function handleCarouselTouchEnd(event) {
    if (!carouselTouch.isTracking) return;
    const touch = event.changedTouches?.[0];
    if (!touch) {
        resetCarouselTouch();
        return;
    }

    const deltaX = touch.clientX - carouselTouch.startX;
    const deltaY = touch.clientY - carouselTouch.startY;
    const minSwipe = 42;

    // Ignore mostly vertical gestures so page scrolling remains natural.
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
        resetCarouselTouch();
        return;
    }

    if (deltaX <= -minSwipe) {
        moveHeroCarousel(1);
    } else if (deltaX >= minSwipe) {
        moveHeroCarousel(-1);
    }

    resetCarouselTouch();
}

function resetCarouselTouch() {
    carouselTouch.startX = 0;
    carouselTouch.startY = 0;
    carouselTouch.isTracking = false;
}

function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;
    document.body.dataset.activeCategory = state.activeCategory;
    container.innerHTML = HEADER_CATEGORIES
        .map(({ key, label }) => {
            const active = state.activeCategory === key ? 'active' : '';
            return `<button class="category-pill ${active}" data-category="${key}" type="button">${label}</button>`;
        })
        .join('');
}

function renderNewsBoard() {
    const grid = document.getElementById('news-card-grid');
    if (!grid) return;

    const list = getCategoryTrends(state.activeCategory);
    const cards = state.activeCategory === 'all' ? list.slice(4, 16) : list.slice(0, 12);
    if (!cards.length) {
        grid.innerHTML = '<p>No stories available for this category.</p>';
        return;
    }
    grid.innerHTML = cards
        .map((item) => {
            const image = resolveCardImage(item);
            return `
        <article class="news-card ${image ? '' : 'no-image'}" data-theme-category="${normalizeCategory(item.category || 'all')}">
            ${renderCardMedia(item, image)}
            <div class="news-card-body ${image ? '' : 'centered-text'}">
                <h4><a class="headline-link" href="${item.link}" target="_blank" rel="noopener">${item.title}</a></h4>
                <p class="card-summary">${summarize(item.summary, 150)}</p>
                <div class="news-card-meta">
                    <span>${formatDate(item.published_at)}</span>
                </div>
            </div>
        </article>`;
        })
        .join('');
}


function getCategoryTrends(categoryKey) {
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const unique = dedupeTrends(sorted);
    if (categoryKey === 'all') return unique;
    return unique.filter((item) => matchesCategory(item, categoryKey));
}

function matchesCategory(item, categoryKey) {
    const normalized = normalizeCategory(item.category || '');
    if (normalized === categoryKey) return true;

    const config = CATEGORY_FILTERS[categoryKey];
    if (!config) return false;
    if (config.categories && config.categories.includes(normalized)) return true;

    const haystack = `${item.title || ''} ${item.summary || ''}`;
    return (config.keywords || []).some((pattern) => pattern.test(haystack));
}

function dedupeTrends(list) {
    const seen = new Set();
    const unique = [];
    for (const item of list) {
        const key = String(item.id || item.link || item.title || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }
    return unique;
}

function renderNewsArticleSchema() {
    const mount = document.getElementById('news-article-schema');
    if (!mount) return;

    const list = getCategoryTrends(state.activeCategory).slice(0, 12);
    const graph = list.map((item) => ({
        '@type': 'NewsArticle',
        headline: item.title,
        description: summarize(item.summary, 150),
        datePublished: item.published_at,
        dateModified: item.published_at,
        mainEntityOfPage: item.link,
        articleSection: normalizeCategory(item.category || 'all').toUpperCase(),
        publisher: {
            '@type': 'Organization',
            name: 'Snapfacts'
        },
        image: item.image && /^https?:\/\//i.test(item.image)
            ? [item.image]
            : ['https://www.snapfacts.in/assets/images/og-image.jpg']
    }));

    const payload = {
        '@context': 'https://schema.org',
        '@graph': graph
    };
    mount.textContent = JSON.stringify(payload);
}

function getCategoryHeading(categoryKey) {
    const copy = CATEGORY_COPY[categoryKey] || CATEGORY_COPY.all;
    return copy.heading;
}

function renderSectionHeading() {
    const eyebrow = document.getElementById('news-eyebrow');
    const heading = document.getElementById('news-heading');
    if (!eyebrow || !heading) return;
    const copy = CATEGORY_COPY[state.activeCategory] || CATEGORY_COPY.all;
    eyebrow.textContent = copy.eyebrow;
    heading.textContent = copy.heading;
}

function setupCategoryFilters() {
    const container = document.getElementById('category-pills');
    if (!container) return;
    container.addEventListener('click', (event) => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        state.activeCategory = button.dataset.category || 'all';
        renderCategoryPills();
        renderNewsBoard();
        renderSectionHeading();
        renderNewsArticleSchema();
        syncActiveCategoryTheme();
    });

    document.body.addEventListener('click', (event) => {
        const jump = event.target.closest('[data-category-jump]');
        if (!jump) return;
        state.activeCategory = jump.dataset.categoryJump || 'all';
        renderCategoryPills();
        renderNewsBoard();
        renderSectionHeading();
        renderNewsArticleSchema();
        syncActiveCategoryTheme();
        window.scrollTo({ top: document.getElementById('news-board')?.offsetTop || 0, behavior: 'smooth' });
    });
}

function syncActiveCategoryTheme() {
    document.body.dataset.activeCategory = state.activeCategory || 'all';
}

function renderMetaStrip() {
    const strip = document.getElementById('status-strip');
    if (!strip) return;
    strip.querySelectorAll('[data-meta="generated"]').forEach((el) => (el.textContent = formatDate(state.meta.generated_at)));
    const feedsPolled = Number(state.meta.feeds_polled || 0);
    const feedPool = Number(state.meta.feed_pool || 0);
    const feedLabel = feedPool > 0
        ? `${feedsPolled}/${feedPool}`
        : `${feedsPolled || 0}`;
    strip.querySelectorAll('[data-meta="feeds"]').forEach((el) => (el.textContent = feedLabel));
}


function renderCardMedia(item, imageUrl) {
    if (imageUrl) {
        return `<img class="card-image board-image" src="${imageUrl}" alt="${item.title}" loading="lazy" decoding="async" fetchpriority="low" width="640" height="360" sizes="(max-width: 768px) 96vw, (max-width: 1024px) 48vw, 24vw" />`;
    }
    return `<div class="board-image image-fallback"><span>${item.title}</span></div>`;
}

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function normalizeCategory(value = '') {
    const key = String(value || '').toLowerCase();
    return CATEGORY_MAP[key] || key;
}

function capitalize(value = '') {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function summarize(value = '', max = 130) {
    const plain = String(value || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*(\.\.\.|…|\[\.\.\.\])\s*$/g, '')
        .trim();
    if (!plain) return 'Summary unavailable from feed.';

    const sentence = extractLeadSentence(plain);
    if (sentence.length <= max) {
        return trimTrailingConnector(sentence);
    }

    const clipped = sentence.slice(0, max).trimEnd();
    const lastSpace = clipped.lastIndexOf(' ');
    const compact = lastSpace > Math.floor(max * 0.6) ? clipped.slice(0, lastSpace).trimEnd() : clipped;
    return trimTrailingConnector(compact);
}

function extractLeadSentence(text) {
    const parts = text
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return text;
    const first = parts[0];
    if (first.length < 35 && parts[1]) {
        return `${first} ${parts[1]}`.trim();
    }
    return first;
}

function trimTrailingConnector(text) {
    return String(text)
        .replace(/[,:;\-]+$/g, '')
        .replace(/\s+(and|or|with|for|to|from|via|by|amid|as|on|in|of|at|into|over|under)$/i, '')
        .trim();
}

function escapeAttr(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function resolveCardImage(trend) {
    if (trend?.image && /^https?:\/\//i.test(trend.image)) {
        return trend.image;
    }
    return buildHeadlineThemeImage(trend);
}

const VISUAL_SIGNALS = [
    { pattern: /\bmeta\b/i, label: 'META', palette: ['#0a66ff', '#041633'], accent: '#7fb0ff' },
    { pattern: /\bnetflix\b/i, label: 'NETFLIX', palette: ['#b9090b', '#1b0202'], accent: '#ff7f7f' },
    { pattern: /\byahoo\b/i, label: 'YAHOO', palette: ['#6001d2', '#15052f'], accent: '#c99bff' },
    { pattern: /\btarget\b/i, label: 'TARGET', palette: ['#d90429', '#33060f'], accent: '#ff9ca9' },
    { pattern: /\bgoogle\b/i, label: 'GOOGLE', palette: ['#188038', '#081f12'], accent: '#7ee0a1' },
    { pattern: /\bmicrosoft\b/i, label: 'MICROSOFT', palette: ['#0b72c7', '#051a2d'], accent: '#7fd2ff' },
    { pattern: /\bopenai\b/i, label: 'OPENAI', palette: ['#1f7a5a', '#061a13'], accent: '#7ce6be' },
    { pattern: /\bai|llm|genai|model|agent\b/i, label: 'AI', palette: ['#0e7490', '#072033'], accent: '#89dbff' },
    { pattern: /\badvertis|campaign|marketing|ad\b/i, label: 'ADS', palette: ['#7c3aed', '#1a0d36'], accent: '#c0a4ff' },
    { pattern: /\bcredit card|payments|fintech\b/i, label: 'PAYMENTS', palette: ['#1d4ed8', '#071331'], accent: '#9ab8ff' },
    { pattern: /\be-commerce|ecommerce|retail\b/i, label: 'ECOMMERCE', palette: ['#be185d', '#2b0718'], accent: '#ff99c5' },
    { pattern: /\bsearch|seo|geo vendors\b/i, label: 'SEARCH', palette: ['#2563eb', '#071736'], accent: '#8db4ff' },
    { pattern: /\bnews|media|publishing\b/i, label: 'MEDIA', palette: ['#0f766e', '#061f1d'], accent: '#86e8dd' },
    { pattern: /\bgraph|growth|analytics|insight\b/i, label: 'ANALYTICS', palette: ['#9f1239', '#2a0712'], accent: '#ff9db8' },
];

function buildHeadlineThemeImage(trend) {
    const headline = String(trend?.title || 'Snapfacts').trim();
    const artHeadline = compactHeadlineForArt(headline);
    const summary = summarize(trend?.summary || 'Fresh headline from monitored RSS feeds.', 110);
    const text = `${headline} ${summary}`;
    const tags = detectVisualSignals(text).slice(0, 4);
    const theme = tags[0] || { label: 'TECH', palette: ['#0b5ed7', '#08162d'], accent: '#8cb8ff' };
    const gradientId = `g${hashValue(headline).toString(36)}`;
    const ringX = 560;
    const ringY = 84;
    const titleLines = wrapForSvg(artHeadline, 28, 2);
    const chips = tags.length ? tags : [theme];
    const chipMarkup = chips
        .slice(0, 3)
        .map((tag, idx) => {
            const x = 36 + idx * 182;
            return `<g transform="translate(${x},288)"><rect width="170" height="36" rx="18" fill="#ffffff" fill-opacity="0.16"/><text x="85" y="23" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#f8fbff">${escapeSvg(tag.label)}</text></g>`;
        })
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${escapeSvg(headline)}">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.palette[0]}"/>
      <stop offset="100%" stop-color="${theme.palette[1]}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#${gradientId})"/>
  <rect width="640" height="360" fill="#020617" fill-opacity="0.22"/>
  <circle cx="${ringX}" cy="${ringY}" r="72" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-opacity="0.6"/>
  <circle cx="${ringX}" cy="${ringY}" r="42" fill="none" stroke="${theme.accent}" stroke-width="1.5" stroke-opacity="0.65"/>
  <circle cx="${ringX}" cy="${ringY}" r="14" fill="${theme.accent}" fill-opacity="0.9"/>
  <rect x="28" y="36" width="430" height="208" rx="16" fill="#020617" fill-opacity="0.28"/>
  ${titleLines.map((line, idx) => `<text x="48" y="${86 + idx * 44}" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f8fbff">${escapeSvg(line)}</text>`).join('')}
  ${chipMarkup}
</svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function detectVisualSignals(text) {
    const unique = new Map();
    VISUAL_SIGNALS.forEach((signal) => {
        if (signal.pattern.test(text) && !unique.has(signal.label)) {
            unique.set(signal.label, signal);
        }
    });
    return Array.from(unique.values());
}


function compactHeadlineForArt(headline) {
    const normalized = String(headline || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'SNAPFACTS SIGNAL';

    // Keep fallback art headlines concise and avoid trailing connector words.
    const splitOn = /\s[-:–—]\s|;\s|\s\|\s/i;
    let candidate = normalized.split(splitOn)[0] || normalized;

    const words = candidate.split(' ');
    if (words.length > 7) {
        const andIdx = words.findIndex((w, i) => i >= 4 && /^and$/i.test(w));
        if (andIdx > 0) candidate = words.slice(0, andIdx).join(' ');
    }

    candidate = candidate
        .replace(/\s+(and|or|with|for|to|from|via|by|amid|as|on|in)$/i, '')
        .trim();

    const upper = candidate.toUpperCase();
    if (upper.length <= 56) return upper;
    const clipped = upper.slice(0, 56).trimEnd();
    const cut = clipped.lastIndexOf(' ');
    return (cut > 24 ? clipped.slice(0, cut) : clipped).trim();
}

function wrapForSvg(value, maxChars, maxLines) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
            current = next;
            continue;
        }
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (!lines.length) return [value.slice(0, maxChars)];
    return lines.slice(0, maxLines);
}

function escapeSvg(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function hashValue(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}
