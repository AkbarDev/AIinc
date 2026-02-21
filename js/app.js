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
};

document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    loadData();
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
            <h3>${trend.title}</h3>
            <p>${trend.summary || 'Summary unavailable from feed.'}</p>
            <footer>
                <span>${formatDate(trend.published_at)}</span>
                <a href="${trend.link}" target="_blank" rel="noopener">Read</a>
            </footer>
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
            <a href="${trend.link}" target="_blank" rel="noopener">${trend.title}</a>
            <small>${formatTimeAgo(trend.published_at)}</small>
        </li>`
        )
        .join('');
}

function renderMetaStrip() {
    const strip = document.getElementById('status-strip');
    if (!strip) return;
    strip.querySelectorAll('[data-meta="generated"]').forEach((el) => (el.textContent = formatDate(state.meta.generated_at)));
    strip.querySelectorAll('[data-meta="feeds"]').forEach((el) => (el.textContent = state.sources.length || '10'));
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
