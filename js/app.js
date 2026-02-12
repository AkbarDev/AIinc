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
    filter: 'all',
    meta: {},
    sources: [],
};

document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    loadData();
    setupFilters();
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
    const grid = document.getElementById('trend-cards');
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 6 })
        .map(
            () => `
        <article class="skeleton">
            <div class="line long"></div>
            <div class="line mid"></div>
            <div class="line short"></div>
        </article>`
        )
        .join('');
}

function renderAll() {
    renderHero();
    renderStats();
    renderTrends();
    renderTimeline();
    renderSources();
}

function renderHero() {
    const card = document.getElementById('top-story');
    const metaList = document.getElementById('hero-meta');
    if (!card) return;
    const topStory = [...state.trends].sort((a, b) => b.score - a.score)[0];
    if (!topStory) return;

    card.innerHTML = `
        <p class="eyebrow">Top story</p>
        <h2>${topStory.title}</h2>
        <p class="muted">${topStory.summary || 'Signal boost from multiple publishers.'}</p>
        <div class="badge-row">
            <span class="pill ghost">Score ${topStory.score.toFixed(2)}</span>
            <span class="pill ghost">${capitalize(topStory.category)}</span>
            <span class="pill ghost">${topStory.source_count} sources</span>
        </div>
        <a class="btn primary" href="${topStory.link}" target="_blank" rel="noopener">Open story</a>
    `;

    if (metaList) {
        const generated = metaList.querySelector('[data-meta="generated"]');
        const feeds = metaList.querySelector('[data-meta="feeds"]');
        if (generated) generated.textContent = formatDate(state.meta.generated_at);
        if (feeds) feeds.textContent = state.sources.length || '10+';
    }
}

function renderStats() {
    const grid = document.getElementById('stat-grid');
    if (!grid) return;
    const stats = [
        { label: 'Stories processed', value: state.meta.sources_scanned || state.trends.length * 3 },
        { label: 'Trend clusters', value: state.meta.clusters || state.trends.length },
        { label: 'Avg. authority', value: avgAuthority(state.trends).toFixed(2) },
        { label: 'Median score', value: medianScore(state.trends).toFixed(2) },
    ];
    grid.innerHTML = stats
        .map(
            (stat) => `
        <article class="stat-card">
            <h4>${stat.value}</h4>
            <p>${stat.label}</p>
        </article>`
        )
        .join('');
}

function renderTrends() {
    const grid = document.getElementById('trend-cards');
    if (!grid) return;
    const filtered = state.filter === 'all' ? state.trends : state.trends.filter((trend) => trend.category === state.filter);
    if (!filtered.length) {
        grid.innerHTML = '<p>No signals for this category yet.</p>';
        return;
    }
    grid.innerHTML = filtered
        .map(
            (trend, index) => `
        <article class="trend-card" data-score="${trend.score.toFixed(2)}">
            <span class="tag">${String(index + 1).padStart(2, '0')}</span>
            <h4>${trend.title}</h4>
            <p>${trend.summary || 'Summary unavailable from feed.'}</p>
            <footer>
                <span>${formatTimeAgo(trend.published_at)}</span>
                <a href="${trend.link}" target="_blank" rel="noopener">Read</a>
            </footer>
        </article>`
        )
        .join('');
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
            <h5>${item.title}</h5>
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

function setupFilters() {
    const filterRow = document.getElementById('filter-row');
    if (!filterRow) return;
    filterRow.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        state.filter = button.dataset.filter;
        filterRow.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        renderTrends();
    });
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

function avgAuthority(trends) {
    if (!trends.length) return 0;
    const total = trends.reduce((sum, item) => sum + (item.signals?.authority || 0), 0);
    return total / trends.length;
}

function medianScore(trends) {
    if (!trends.length) return 0;
    const scores = [...trends].map((item) => item.score).sort((a, b) => a - b);
    const mid = Math.floor(scores.length / 2);
    return scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
}

function capitalize(value = '') {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
