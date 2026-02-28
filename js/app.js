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
    renderBrandRadar();
    renderLead();
    renderFeatureGrid();
    renderSidebar();
    renderCategoryPills();
    renderNewsBoard();
    renderMetaStrip();
    renderTimeline();
    renderSources();
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
        .map(
            (trend) => `
        <article class="feature-card">
            <p class="eyebrow">${trend.category ? trend.category.toUpperCase() : 'AI'}</p>
            <h3><a class="headline-link" href="${trend.link}" target="_blank" rel="noopener">${trend.title}</a></h3>
            <img class="card-image" src="${resolveCardImage(trend)}" alt="${trend.title}" loading="lazy" />
            <p class="card-summary">${summarize(trend.summary)}</p>
        </article>`
        )
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
        .map(
            (trend) => `
        <li>
            <p class="eyebrow">${trend.category ? trend.category.toUpperCase() : 'AI'}</p>
            <a class="headline-link" href="${trend.link}" target="_blank" rel="noopener">${trend.title}</a>
            <img class="card-image compact" src="${resolveCardImage(trend)}" alt="${trend.title}" loading="lazy" />
            <p class="card-summary">${summarize(trend.summary, 100)}</p>
        </li>`
        )
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
        .map(
            (item) => `
        <article class="news-card">
            <img class="card-image board-image" src="${resolveCardImage(item)}" alt="${item.title}" loading="lazy" />
            <div class="news-card-body">
                <p class="eyebrow">${item.category ? item.category.toUpperCase() : 'TECHNOLOGY'}</p>
                <h4><a class="headline-link" href="${item.link}" target="_blank" rel="noopener">${item.title}</a></h4>
                <p class="card-summary">${summarize(item.summary, 150)}</p>
                <div class="news-card-meta">
                    <span>${formatDate(item.published_at)}</span>
                    <span>${item.source_count || 1} sources</span>
                </div>
            </div>
        </article>`
        )
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

function renderBrandRadar() {
    const mount = document.getElementById('brand-radar');
    if (!mount) return;
    const counts = getContinentCounts();
    const max = Math.max(...Object.values(counts), 1);
    const angleMap = { NA: -160, SA: 138, EU: -62, AF: 52, AS: 2, OC: 94, global: -20 };
    const nodeBase = [
        { key: 'NA', color: '#f97316' },
        { key: 'SA', color: '#ec4899' },
        { key: 'EU', color: '#facc15' },
        { key: 'AF', color: '#22c55e' },
        { key: 'AS', color: '#38bdf8' },
        { key: 'OC', color: '#a78bfa' },
    ];
    const top = state.meta.top_continent || 'global';
    const topColor = nodeBase.find((node) => node.key === top)?.color || '#38bdf8';
    const orbitBase = 58;
    const nodes = nodeBase.map((node) => {
        const angle = angleMap[node.key];
        const rad = (angle * Math.PI) / 180;
        const ratio = max > 0 ? counts[node.key] / max : 0;
        const orbit = orbitBase + ratio * 8;
        const x = Number((Math.cos(rad) * orbit).toFixed(2));
        const y = Number((Math.sin(rad) * orbit).toFixed(2));
        const size = Number((3.9 + ratio * 4.6).toFixed(2));
        return { ...node, angle, x, y, size, value: counts[node.key], ratio, rad };
    });
    const wirePoints = nodes.map((node) => `${node.x},${node.y}`).join(' ');
    const outerNodes = nodes
        .flatMap((node) => {
            const spread = 0.15;
            const satellites = [
                { angle: node.rad - spread, dist: 14 },
                { angle: node.rad + spread, dist: 14 },
            ].map((sat) => {
                const sx = Number((node.x + Math.cos(sat.angle) * sat.dist).toFixed(2));
                const sy = Number((node.y + Math.sin(sat.angle) * sat.dist).toFixed(2));
                return {
                    x: sx,
                    y: sy,
                    r: Number(Math.max(node.size - 2, 2.2).toFixed(2)),
                    color: node.color,
                    cls: pulseClass(node.value, max),
                    parentX: node.x,
                    parentY: node.y,
                };
            });
            return [
                { x: node.x, y: node.y, r: node.size, color: node.color, cls: pulseClass(node.value, max), parentX: null, parentY: null },
                ...satellites,
            ];
        })
        .map(
            (item) =>
                `${item.parentX !== null ? `<line x1="${item.parentX}" y1="${item.parentY}" x2="${item.x}" y2="${item.y}" class="line-strike"/>` : ''}<circle cx="${item.x}" cy="${item.y}" r="${item.r}" fill="${item.color}" class="${item.cls}"/>`
        )
        .join('');
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 220 220" role="img" aria-label="Live global feed radar">
  <style>
    .wire { stroke: #94a3b8; stroke-opacity: 0.52; stroke-width: 2; fill: none; }
    .wire-core { stroke: #cbd5e1; stroke-opacity: 0.35; stroke-width: 1.1; fill: none; }
    .line-strike { stroke: #9ca3af; stroke-opacity: 0.55; stroke-width: 1.1; }
    .pulse-high { animation: pulseHigh 2.1s ease-in-out infinite; transform-origin: center; }
    .pulse-med { animation: pulseMed 2.8s ease-in-out infinite; transform-origin: center; }
    .pulse-low { animation: pulseLow 3.4s ease-in-out infinite; transform-origin: center; }
    @keyframes pulseHigh { 0%,100% { transform: scale(1); opacity: 0.96; } 50% { transform: scale(1.2); opacity: 0.66; } }
    @keyframes pulseMed { 0%,100% { transform: scale(1); opacity: 0.94; } 50% { transform: scale(1.12); opacity: 0.7; } }
    @keyframes pulseLow { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.08); opacity: 0.72; } }
  </style>
  <g transform="translate(110 108)">
    <polyline points="${wirePoints}" class="wire"/>
    <polyline points="${wirePoints}" class="wire-core"/>
    ${outerNodes}
    <circle cx="0" cy="0" r="31" fill="#071226" fill-opacity="0.78" stroke="${topColor}" stroke-opacity="0.4" stroke-width="1.2"/>
    <text x="0" y="7" text-anchor="middle" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="30" font-weight="700" fill="#e5e7eb">AI</text>
    <text x="0" y="24" text-anchor="middle" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="7.2" font-weight="700" fill="#cbd5e1" letter-spacing="1.4">SNAPFACTS</text>
  </g>
</svg>`;
    mount.innerHTML = svg;
}

function getContinentCounts() {
    if (state.meta.continent_counts) {
        return {
            NA: state.meta.continent_counts.NA || 0,
            SA: state.meta.continent_counts.SA || 0,
            EU: state.meta.continent_counts.EU || 0,
            AF: state.meta.continent_counts.AF || 0,
            AS: state.meta.continent_counts.AS || 0,
            OC: state.meta.continent_counts.OC || 0,
        };
    }
    const counts = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
    state.sources.forEach((src) => {
        if (counts[src.continent] !== undefined) counts[src.continent] += 1;
    });
    if (!Object.values(counts).some(Boolean)) counts.NA = 1;
    return counts;
}

function dotRadius(value, max) {
    if (max <= 0) return 3.9;
    return Number((3.9 + (value / max) * 4.6).toFixed(2));
}

function pulseClass(value, max) {
    if (max <= 0) return 'pulse-low';
    const ratio = value / max;
    if (ratio >= 0.75) return 'pulse-high';
    if (ratio >= 0.4) return 'pulse-med';
    return 'pulse-low';
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
            <span>${formatTimeAgo(item.published_at)} · ${capitalize(item.category)}</span>
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
        .replace(/\s*(\.\.\.|…|\[\.\.\.\])\s*$/g, '')
        .trim();
    if (!plain) return 'Summary unavailable from feed.';
    if (plain.length <= max) return plain;
    const clipped = plain.slice(0, max).trimEnd();
    const lastSpace = clipped.lastIndexOf(' ');
    if (lastSpace > Math.floor(max * 0.6)) {
        return clipped.slice(0, lastSpace).trimEnd();
    }
    return clipped;
}

function buildThumb(trend) {
    const source = getHostname(trend.link);
    const label = (trend.category || 'technology').toUpperCase();
    const title = trend.title || 'Snapfacts';
    const summary = trend.summary || 'Live technology signal from Snapfacts RSS monitoring.';
    const theme = pickThumbTheme(trend);
    const sourceLabel = sanitizeSvgText(source);
    const titleLines = wrapSvgText(title, 36, 2);
    const summaryLines = wrapSvgText(summary, 64, 2);
    const noiseX = 60 + (hashString(`${title}-x`) % 520);
    const noiseY = 80 + (hashString(`${title}-y`) % 180);
    const radius = 58 + (hashString(`${title}-r`) % 36);
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.gradientA}"/>
      <stop offset="100%" stop-color="${theme.gradientB}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <rect width="640" height="360" fill="${theme.overlay}" fill-opacity="0.22"/>
  <circle cx="${noiseX}" cy="${noiseY}" r="${radius}" fill="${theme.accent}" fill-opacity="0.2"/>
  <rect x="18" y="18" width="210" height="36" rx="6" fill="#0d1117" fill-opacity="0.72"/>
  <text x="32" y="42" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#eaf6ff">${sanitizeSvgText(label)}</text>
  <rect x="486" y="18" width="136" height="34" rx="6" fill="${theme.accent}" fill-opacity="0.2"/>
  <text x="498" y="40" font-family="Arial, sans-serif" font-size="14" fill="#f2f8ff">${sanitizeSvgText(theme.tag)}</text>
  <text x="32" y="280" font-family="Arial, sans-serif" font-size="16" fill="#d6e8f8">${sourceLabel}</text>
  <text x="32" y="314" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${titleLines}</text>
  <text x="32" y="344" font-family="Arial, sans-serif" font-size="14" fill="#deebf7">${summaryLines}</text>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveCardImage(trend) {
    if (trend?.image && /^https?:\/\//i.test(trend.image)) {
        return trend.image;
    }
    return buildThumb(trend);
}

function getHostname(link) {
    try {
        return new URL(link).hostname.replace(/^www\./, '');
    } catch {
        return 'snapfacts.in';
    }
}

function sanitizeSvgText(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function wrapSvgText(value, maxChars, maxLines) {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const attempt = current ? `${current} ${word}` : word;
        if (attempt.length <= maxChars) {
            current = attempt;
            continue;
        }
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
    }
    if (lines.length < maxLines && current) lines.push(current);
    const clipped = lines.slice(0, maxLines).map((line, idx, arr) => {
        const trimmed = idx === arr.length - 1 && words.join(' ').length > line.length ? `${line.slice(0, Math.max(line.length - 3, 1))}...` : line;
        return `<tspan x="32" dy="${idx === 0 ? 0 : 20}">${sanitizeSvgText(trimmed)}</tspan>`;
    });
    return clipped.join('');
}

function hashString(value = '') {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function pickThumbTheme(trend) {
    const themes = [
        { tag: 'AI MODELS', gradientA: '#0d4f8b', gradientB: '#171b2b', accent: '#4fd1ff', overlay: '#081421' },
        { tag: 'CLOUD STACK', gradientA: '#0a6f66', gradientB: '#162423', accent: '#4fffe0', overlay: '#061717' },
        { tag: 'SECURITY', gradientA: '#6f2f0b', gradientB: '#241611', accent: '#ffb26b', overlay: '#241106' },
        { tag: 'CHIPS', gradientA: '#3d2a7f', gradientB: '#17132a', accent: '#a58cff', overlay: '#100a1f' },
        { tag: 'POLICY', gradientA: '#7b2334', gradientB: '#25131a', accent: '#ff8ca8', overlay: '#1b0a10' },
        { tag: 'STARTUPS', gradientA: '#54400d', gradientB: '#1f1a11', accent: '#ffd96a', overlay: '#1a1306' },
    ];
    const text = `${trend?.title || ''} ${trend?.summary || ''}`.toLowerCase();
    if (/\bchip|gpu|nvidia|semiconductor|silicon\b/.test(text)) return themes[3];
    if (/\bpolicy|regulation|government|court|law\b/.test(text)) return themes[4];
    if (/\bsecurity|hack|breach|privacy|surveillance\b/.test(text)) return themes[2];
    if (/\bcloud|infra|kubernetes|server|datacenter\b/.test(text)) return themes[1];
    if (/\bstartup|funding|raises|venture|seed\b/.test(text)) return themes[5];
    if (/\bai|model|llm|gpt|agent|anthropic|openai|hugging\b/.test(text)) return themes[0];
    return themes[hashString(text) % themes.length];
}
