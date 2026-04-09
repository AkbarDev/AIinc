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
    { key: 'saved', label: 'SAVED' },
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
    saved: { eyebrow: 'Saved focus', heading: 'Your saved stories stored for quick access.' },
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
const STORAGE_USER_KEY = 'snapfacts_user_key';
const STORAGE_SAVED_KEY = 'snapfacts_saved_articles';

const state = {
    trends: [],
    meta: {},
    sources: [],
    activeCategory: 'all',
    savedIds: new Set(),
    savedRecords: [],
    carouselIndex: 0,
};

document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    loadData();
    setupCategoryFilters();
    setupSaveActions();
    setupStoryPreview();
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

    try {
        const res = await fetch('config/sources.json');
        if (res.ok) {
            state.sources = await res.json();
        }
    } catch (error) {
        console.warn('Failed to load sources list', error);
    }

    await loadSavedArticles();
    renderAll();
}

function renderSkeletons() {
    const lead = document.getElementById('lead-card');
    const carouselTrack = document.getElementById('hero-carousel-track');
    const carouselDots = document.getElementById('hero-carousel-dots');
    if (lead) {
        lead.innerHTML = `
            <div class="skeleton-block"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        `;
    }
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
    renderLead();
    renderCategoryPills();
    renderNewsBoard();
    renderSectionHeading();
    renderNewsArticleSchema();
    renderMetaStrip();
    renderTimeline();
    renderSources();
    renderFooterLinks();
    syncActiveCategoryTheme();
}

function getCarouselStories() {
    return [...state.trends]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
}

function renderHeroCarousel() {
    const track = document.getElementById('hero-carousel-track');
    const dots = document.getElementById('hero-carousel-dots');
    if (!track || !dots) return;

    const stories = getCarouselStories();
    if (!stories.length) {
        track.innerHTML = '<article class="hero-carousel-slide is-active"><div class="hero-carousel-panel"><p>No trending stories available yet.</p></div></article>';
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
            return `
        <article class="hero-carousel-slide ${isActive}" data-carousel-index="${index}">
            <div class="hero-carousel-panel" style="background-image: linear-gradient(135deg, rgba(6, 10, 20, 0.12), rgba(6, 10, 20, 0.92)), url(${image});">
                <div class="hero-carousel-copy">
                    <p class="eyebrow">${story.category ? story.category.toUpperCase() : 'TRENDING'}</p>
                    <h2>${story.title}</h2>
                    <p>${summarize(story.summary, 190)}</p>
                    <div class="hero-carousel-meta">
                        <span>${formatDate(story.published_at)}</span>
                        <span>${story.source_count || 1} sources</span>
                        <span>Score ${story.score ? story.score.toFixed(2) : '—'}</span>
                    </div>
                    <div class="story-actions hero-carousel-actions">
                        ${renderPreviewButton(story, 'Preview')}
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

function renderLead() {
    const card = document.getElementById('lead-card');
    if (!card) return;
    const topStory = [...state.trends].sort((a, b) => b.score - a.score)[0];
    if (!topStory) return;

    const image = resolveCardImage(topStory);
    const theme = normalizeCategory(topStory.category || 'all');
    card.dataset.themeCategory = theme;
    card.classList.toggle('has-image', Boolean(image));
    card.style.backgroundImage = image
        ? `linear-gradient(180deg, rgba(5, 8, 18, 0.04), rgba(5, 8, 18, 0.92)), url(${image})`
        : '';

    card.innerHTML = `
        <p class="eyebrow">${topStory.category ? topStory.category.toUpperCase() : 'LEAD STORY'}</p>
        <h1>${topStory.title}</h1>
        <p class="lead-copy">${summarize(topStory.summary, 180)}</p>
        <div class="lead-meta">
            <span>${formatDate(topStory.published_at)}</span>
            <span>${topStory.source_count || 1} sources</span>
            <span>Score ${topStory.score ? topStory.score.toFixed(2) : '—'}</span>
        </div>
        <div class="story-actions hero-actions">
            ${renderPreviewButton(topStory, 'Preview')}
            <a href="${topStory.link}" target="_blank" rel="noopener">Read full story</a>
        </div>
    `;
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
                    <div class="story-actions compact-actions">
                        ${renderPreviewButton(item, 'Preview')}
                        ${renderSaveButton(item)}
                    </div>
                </div>
            </div>
        </article>`;
        })
        .join('');
}


function getCategoryTrends(categoryKey) {
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const unique = dedupeTrends(sorted);
    if (categoryKey === 'saved') return getSavedTrends(unique);
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

function getSavedTrends(uniqueFeedTrends) {
    const feedSaved = uniqueFeedTrends.filter((item) => state.savedIds.has(getArticleId(item)));
    const seen = new Set(feedSaved.map((item) => getArticleId(item)));
    const extraSaved = state.savedRecords
        .filter((record) => !seen.has(record.article_id))
        .map((record) => ({
            id: record.article_id,
            title: record.title,
            summary: record.summary || 'Saved article from Snapfacts.',
            link: record.link,
            category: record.category || 'saved',
            published_at: record.saved_at || state.meta.generated_at || new Date().toISOString(),
            image: null,
        }));
    return [...feedSaved, ...extraSaved];
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
            : ['https://www.snapfacts.in/assets/images/snapfacts-logo-neon.png']
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

function setupSaveActions() {
    const container = document.getElementById('news-card-grid');
    if (!container) return;
    container.addEventListener('click', async (event) => {
        const button = event.target.closest('.save-btn');
        if (!button) return;
        event.preventDefault();
        const articleId = button.dataset.saveId;
        if (!articleId) return;
        const article = findArticleById(articleId);
        if (!article) return;
        await toggleSave(article);
        renderNewsBoard();
        renderNewsArticleSchema();
    });
}

function renderSaveButton(item) {
    const articleId = getArticleId(item);
    const isSaved = state.savedIds.has(articleId);
    const label = isSaved ? 'Saved' : 'Save';
    return `<button class="save-btn ${isSaved ? 'is-saved' : ''}" type="button" data-save-id="${escapeAttr(articleId)}" aria-pressed="${isSaved}">${label}</button>`;
}

function renderPreviewButton(item, label = 'Preview') {
    const articleId = getArticleId(item);
    return `<button class="preview-btn" type="button" data-preview-id="${escapeAttr(articleId)}">${label}</button>`;
}

function syncActiveCategoryTheme() {
    document.body.dataset.activeCategory = state.activeCategory || 'all';
}

function getUserKey() {
    const existing = localStorage.getItem(STORAGE_USER_KEY);
    if (existing) return existing;
    const generated = `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_USER_KEY, generated);
    return generated;
}

function getArticleId(item) {
    return String(item.id || item.link || item.title || '').trim().toLowerCase();
}

function findArticleById(articleId) {
    const normalized = articleId.toLowerCase();
    const inFeed = dedupeTrends([...state.trends]).find((item) => getArticleId(item) === normalized);
    if (inFeed) return inFeed;
    const inSaved = state.savedRecords.find((item) => item.article_id === normalized);
    if (!inSaved) return null;
    return {
        id: inSaved.article_id,
        title: inSaved.title,
        link: inSaved.link,
        category: inSaved.category || 'saved',
        summary: inSaved.summary || '',
    };
}

function readLocalSavedRecords() {
    try {
        const raw = localStorage.getItem(STORAGE_SAVED_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLocalSavedRecords(records) {
    localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(records));
}

async function loadSavedArticles() {
    if (!API_BASE) {
        state.savedRecords = readLocalSavedRecords();
        state.savedIds = new Set(state.savedRecords.map((item) => item.article_id));
        return;
    }
    try {
        const userKey = encodeURIComponent(getUserKey());
        const response = await fetch(`${API_BASE}/v1/saved?user_key=${userKey}`);
        if (!response.ok) throw new Error(`Save API failed: ${response.status}`);
        const payload = await response.json();
        state.savedRecords = Array.isArray(payload) ? payload : [];
        state.savedIds = new Set(state.savedRecords.map((item) => item.article_id));
    } catch (error) {
        console.warn('Falling back to browser saved storage', error);
        state.savedRecords = readLocalSavedRecords();
        state.savedIds = new Set(state.savedRecords.map((item) => item.article_id));
    }
}

async function toggleSave(article) {
    const articleId = getArticleId(article);
    const userKey = getUserKey();
    const isSaved = state.savedIds.has(articleId);

    if (!API_BASE) {
        updateLocalSaved(article, articleId, isSaved);
        return;
    }

    try {
        if (isSaved) {
            const params = new URLSearchParams({ user_key: userKey, article_id: articleId });
            const response = await fetch(`${API_BASE}/v1/saved?${params.toString()}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
            state.savedIds.delete(articleId);
            state.savedRecords = state.savedRecords.filter((item) => item.article_id !== articleId);
        } else {
            const payload = {
                user_key: userKey,
                article_id: articleId,
                title: article.title || 'Untitled',
                link: article.link,
                category: normalizeCategory(article.category || 'all'),
            };
            const response = await fetch(`${API_BASE}/v1/saved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`Save failed: ${response.status}`);
            const created = await response.json();
            state.savedIds.add(articleId);
            if (!state.savedRecords.some((item) => item.article_id === articleId)) {
                state.savedRecords.unshift(created);
            }
        }
    } catch (error) {
        console.warn('Save API unavailable; using browser storage fallback', error);
        updateLocalSaved(article, articleId, isSaved);
    }
}

function updateLocalSaved(article, articleId, isSaved) {
    if (isSaved) {
        state.savedIds.delete(articleId);
        state.savedRecords = state.savedRecords.filter((item) => item.article_id !== articleId);
    } else {
        state.savedIds.add(articleId);
        state.savedRecords.unshift({
            article_id: articleId,
            title: article.title || 'Untitled',
            link: article.link,
            category: normalizeCategory(article.category || 'all'),
            saved_at: new Date().toISOString(),
        });
    }
    writeLocalSavedRecords(state.savedRecords);
}

function setupStoryPreview() {
    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('.preview-btn');
        if (!button) return;
        const articleId = button.dataset.previewId;
        if (!articleId) return;
        const article = findArticleById(articleId);
        if (!article) return;
        openStoryPreview(article);
    });

    const dialog = document.getElementById('story-dialog');
    if (dialog) {
        dialog.addEventListener('click', (event) => {
            const rect = dialog.getBoundingClientRect();
            const inDialog = rect.top <= event.clientY && event.clientY <= rect.bottom
                && rect.left <= event.clientX && event.clientX <= rect.right;
            if (!inDialog) dialog.close();
        });
    }
}

function openStoryPreview(article) {
    const dialog = document.getElementById('story-dialog');
    if (!dialog) return;

    const image = resolveCardImage(article);
    const media = document.getElementById('story-dialog-media');
    const category = document.getElementById('story-dialog-category');
    const title = document.getElementById('story-dialog-title');
    const meta = document.getElementById('story-dialog-meta');
    const summary = document.getElementById('story-dialog-summary');
    const link = document.getElementById('story-dialog-link');
    const theme = normalizeCategory(article.category || 'all');

    dialog.dataset.themeCategory = theme;
    if (media) {
        media.innerHTML = image
            ? `<img src="${image}" alt="${escapeAttr(article.title || 'Story image')}" loading="lazy" />`
            : `<div class="story-dialog-fallback"><span>${escapeHtml(article.title || 'Story preview')}</span></div>`;
    }
    if (category) category.textContent = (article.category || 'Story preview').toUpperCase();
    if (title) title.textContent = article.title || 'Untitled story';
    if (meta) meta.textContent = `${formatDate(article.published_at)} · ${article.source_count || 1} source${article.source_count === 1 ? '' : 's'}`;
    if (summary) summary.textContent = summarize(article.summary || 'Summary unavailable from feed.', 260);
    if (link) link.href = article.link || '#';

    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.setAttribute('open', 'open');
    }
}

function renderMetaStrip() {
    const strip = document.getElementById('status-strip');
    if (!strip) return;
    strip.querySelectorAll('[data-meta="generated"]').forEach((el) => (el.textContent = formatDate(state.meta.generated_at)));
    const feedsPolled = Number(state.meta.feeds_polled || 0);
    const feedPool = Number(state.meta.feed_pool || 0);
    const feedLabel = feedPool > 0
        ? `${feedsPolled}/${feedPool}`
        : `${state.sources.length || 0}`;
    strip.querySelectorAll('[data-meta="feeds"]').forEach((el) => (el.textContent = feedLabel));
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

function renderFooterLinks() {
    const mount = document.getElementById('footer-category-links');
    if (!mount) return;
    mount.innerHTML = HEADER_CATEGORIES
        .filter((item) => item.key !== 'saved')
        .map((item) => `<button class="footer-chip" type="button" data-category-jump="${item.key}">${item.label}</button>`)
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
        .slice(0, 12)
        .map(
            (source) => `
        <article class="source-card source-card-${normalizeCategory(source.category || 'all')}">
            <p class="eyebrow">${normalizeCategory(source.category || 'all').toUpperCase()}</p>
            <strong>${source.name}</strong>
            <p class="source-copy">Coverage focus: ${capitalize(source.geo || 'global')} with authority ${(source.authority || 0.7).toFixed(2)}.</p>
            <div class="source-meta-row">
                <span>${capitalize(source.category || 'general')}</span>
                <span>${capitalize(source.geo || 'global')}</span>
            </div>
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

function escapeHtml(value = '') {
    return escapeAttr(value).replaceAll("'", '&#39;');
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
