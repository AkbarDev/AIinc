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

const state = {
    trends: [],
    meta: {},
    sources: [],
    activeCategory: 'all',
};

document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    loadData();
    setupCategoryFilters();
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

    try {
        const res = await fetch('config/sources.json');
        if (res.ok) {
            state.sources = await res.json();
        }
    } catch (error) {
        console.warn('Failed to load sources list', error);
    }

    renderAll();
}

function renderSkeletons() {
    const lead = document.getElementById('lead-card');
    const feature = document.getElementById('feature-grid');
    const sidebar = document.querySelector('#sidebar-list ul');
    if (lead) {
        lead.innerHTML = `
            <div class="skeleton-block"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        `;
    }
    if (feature) {
        feature.innerHTML = Array.from({ length: 4 })
            .map(
                () => `
                <article class="feature-card skeleton-card">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </article>`
            )
            .join('');
    }
    if (sidebar) {
        sidebar.innerHTML = Array.from({ length: 4 })
            .map(() => `<li class="skeleton-line"></li>`)
            .join('');
    }
}

function renderAll() {
    renderLead();
    renderFeatureGrid();
    renderSidebar();
    renderCategoryPills();
    renderNewsBoard();
    renderMetaStrip();
    renderTimeline();
    renderSources();
    renderResourceMenu();
}

function renderLead() {
    const card = document.getElementById('lead-card');
    if (!card) return;
    const topStory = [...state.trends].sort((a, b) => b.score - a.score)[0];
    if (!topStory) return;

    card.innerHTML = `
        <p class="eyebrow">${topStory.category ? topStory.category.toUpperCase() : 'LEAD STORY'}</p>
        <h1>${topStory.title}</h1>
        <p class="lead-copy">${topStory.summary || 'Signal boost from multiple publishers.'}</p>
        <div class="lead-meta">
            <span>${formatDate(topStory.published_at)}</span>
            <span>${topStory.source_count || 1} sources</span>
            <span>Score ${topStory.score ? topStory.score.toFixed(2) : '—'}</span>
        </div>
        <a href="${topStory.link}" target="_blank" rel="noopener">Read full story</a>
    `;
}

function renderFeatureGrid() {
    const grid = document.getElementById('feature-grid');
    if (!grid) return;
    const sorted = [...state.trends].sort((a, b) => b.score - a.score);
    const features = sorted.slice(1, 5);
    if (!features.length) {
        grid.innerHTML = '<p>No additional signals yet.</p>';
        return;
    }
    grid.innerHTML = features
        .map((trend) => {
            const image = resolveCardImage(trend);
            return `
        <article class="feature-card">
            <h3><a class="headline-link" href="${trend.link}" target="_blank" rel="noopener">${trend.title}</a></h3>
            ${image ? `<img class="card-image" src="${image}" alt="${trend.title}" loading="lazy" />` : ''}
            <p class="card-summary">${summarize(trend.summary)}</p>
        </article>`;
        })
        .join('');
}

function renderSidebar() {
    const sidebar = document.querySelector('#sidebar-list ul');
    if (!sidebar) return;
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const items = sorted.slice(5, 12);
    if (!items.length) {
        sidebar.innerHTML = '<li>No additional items.</li>';
        return;
    }
    sidebar.innerHTML = items
        .map((trend) => {
            const image = resolveCardImage(trend);
            return `
        <li>
            <a class="headline-link" href="${trend.link}" target="_blank" rel="noopener">${trend.title}</a>
            ${image ? `<img class="card-image compact" src="${image}" alt="${trend.title}" loading="lazy" />` : ''}
            <p class="card-summary">${summarize(trend.summary, 100)}</p>
        </li>`;
        })
        .join('');
}

function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;
    const categories = ['all', ...new Set(state.trends.map((item) => item.category).filter(Boolean))];
    container.innerHTML = categories
        .map((category) => {
            const active = state.activeCategory === category ? 'active' : '';
            const label = category === 'all' ? 'All News' : capitalize(category);
            return `<button class="category-pill ${active}" data-category="${category}" type="button">${label}</button>`;
        })
        .join('');
}

function renderNewsBoard() {
    const grid = document.getElementById('news-card-grid');
    if (!grid) return;
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const list = state.activeCategory === 'all' ? sorted : sorted.filter((item) => item.category === state.activeCategory);
    const cards = list.slice(0, 12);
    if (!cards.length) {
        grid.innerHTML = '<p>No stories available for this category.</p>';
        return;
    }
    grid.innerHTML = cards
        .map((item) => {
            const image = resolveCardImage(item);
            return `
        <article class="news-card ${image ? '' : 'no-image'}">
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

function setupCategoryFilters() {
    const container = document.getElementById('category-pills');
    if (!container) return;
    container.addEventListener('click', (event) => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        state.activeCategory = button.dataset.category || 'all';
        renderCategoryPills();
        renderNewsBoard();
    });
}

function renderMetaStrip() {
    const strip = document.getElementById('status-strip');
    if (!strip) return;
    strip.querySelectorAll('[data-meta="generated"]').forEach((el) => (el.textContent = formatDate(state.meta.generated_at)));
    strip.querySelectorAll('[data-meta="feeds"]').forEach((el) => (el.textContent = state.sources.length || '10'));
}


function renderResourceMenu() {
    const menu = document.getElementById('resources-menu');
    if (!menu) return;
    if (!state.sources.length) {
        menu.innerHTML = '<span class="dropdown-empty">No resources loaded.</span>';
        return;
    }
    menu.innerHTML = state.sources
        .map((source) => {
            const label = source.url ? `${source.name} - ${new URL(source.url).hostname.replace(/^www\./, '')}` : source.name;
            return `<a href="${source.url}" target="_blank" rel="noopener">${label}</a>`;
        })
        .join('');
}

function renderCardMedia(item, imageUrl) {
    if (imageUrl) {
        return `<img class="card-image board-image" src="${imageUrl}" alt="${item.title}" loading="lazy" />`;
    }
    return `<div class="board-image image-fallback"><span>${item.title}</span></div>`;
}

function renderTimeline() {
    const container = document.getElementById('timeline-list');
    if (!container) return;
    const sorted = [...state.trends]
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, 6);
    container.innerHTML = sorted
        .map(
            (item) => `
        <article class="timeline-card">
            <h4>${item.title}</h4>
            <span>${formatTimeAgo(item.published_at)}</span>
        </article>`
        )
        .join('');
}

function renderSources() {
    const grid = document.getElementById('source-grid');
    if (!grid || !state.sources.length) {
        if (grid) {
            grid.innerHTML = '<p>Source list available once config loads.</p>';
        }
        return;
    }
    grid.innerHTML = state.sources
        .map(
            (source) => `
        <article class="source-card">
            <strong>${source.name}</strong>
            <span>${capitalize(source.category)} · ${source.geo}</span>
            <span>Authority ${(source.authority || 0.7).toFixed(2)}</span>
        </article>`
        )
        .join('');
}

function formatTimeAgo(value) {
    if (!value) return '—';
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.max(Math.round(diff / 60000), 1);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
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
