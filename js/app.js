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
    mobileMenuOpen: false,
    density: 'comfortable',
    briefMode: false,
    followedTopics: [],
    savedStoryIds: [],
};

const carouselTouch = {
    startX: 0,
    startY: 0,
    isTracking: false,
};

const STORAGE_KEYS = {
    density: 'snapfacts_density_mode',
    brief: 'snapfacts_brief_mode',
    follows: 'snapfacts_followed_topics',
    saved: 'snapfacts_saved_story_ids',
};

document.addEventListener('DOMContentLoaded', () => {
    hydrateReaderPrefs();
    renderSkeletons();
    loadData();
    setupCategoryFilters();
    setupHeroCarousel();
    setupReaderInteractions();
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
    renderMobileCategoryMenu();
    renderMobileReaderChrome();
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

function renderMobileCategoryMenu() {
    const menu = document.getElementById('mobile-category-menu');
    const toggle = document.getElementById('mobile-menu-toggle');
    const allNews = document.getElementById('mobile-all-news');
    if (!menu || !toggle || !allNews) return;

    const options = HEADER_CATEGORIES.filter((item) => item.key !== 'all');
    menu.innerHTML = options
        .map(({ key, label }) => {
            const active = state.activeCategory === key ? 'active' : '';
            return `<button class="mobile-category-option ${active}" data-mobile-category="${key}" type="button">${label}</button>`;
        })
        .join('');

    const expanded = state.mobileMenuOpen ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', expanded);
    menu.classList.toggle('is-open', state.mobileMenuOpen);
    allNews.classList.toggle('active', state.activeCategory === 'all');
}

function renderMobileReaderChrome() {
    const contextCategory = document.getElementById('mobile-context-category');
    const contextMeta = document.getElementById('mobile-context-meta');
    const densityBtn = document.getElementById('density-toggle');
    const briefBtn = document.getElementById('brief-toggle');
    const followBtn = document.getElementById('follow-topic-toggle');
    const rail = document.getElementById('mobile-category-rail');
    const briefSection = document.getElementById('quick-brief');
    const briefList = document.getElementById('quick-brief-list');

    const activeLabel = (HEADER_CATEGORIES.find((item) => item.key === state.activeCategory)?.label || 'ALL NEWS').toUpperCase();
    const latestTime = formatDate(state.meta.generated_at);

    if (contextCategory) contextCategory.textContent = activeLabel;
    if (contextMeta) contextMeta.textContent = `Updated ${latestTime}`;

    if (densityBtn) {
        const isCompact = state.density === 'compact';
        densityBtn.textContent = isCompact ? 'Compact' : 'Comfortable';
        densityBtn.setAttribute('aria-pressed', isCompact ? 'true' : 'false');
    }
    if (briefBtn) {
        briefBtn.textContent = state.briefMode ? 'Shorts On' : 'Shorts';
        briefBtn.setAttribute('aria-pressed', state.briefMode ? 'true' : 'false');
    }
    if (followBtn) {
        const isFollowed = state.activeCategory !== 'all' && state.followedTopics.includes(state.activeCategory);
        followBtn.textContent = isFollowed ? 'Following' : 'Follow Topic';
        followBtn.setAttribute('aria-pressed', isFollowed ? 'true' : 'false');
    }

    if (rail) {
        rail.innerHTML = HEADER_CATEGORIES
            .map(({ key, label }) => {
                const active = key === state.activeCategory ? 'active' : '';
                const followed = state.followedTopics.includes(key) ? 'followed' : '';
                return `<button class="mobile-rail-pill ${active} ${followed}" data-mobile-rail="${key}" type="button">${label}</button>`;
            })
            .join('');
    }

    if (briefSection && briefList) {
        const briefItems = getEditorialTrends(state.activeCategory).slice(0, 5);
        briefSection.classList.toggle('is-active', state.briefMode);
        briefList.innerHTML = briefItems
            .map((item) => {
                const sourceName = getPrimarySource(item);
                const headline = cleanHeadline(item.title);
                return `<li><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener">${escapeHtml(headline)}</a><span>${escapeHtml(sourceName)} - ${escapeHtml(formatDate(item.published_at))}</span></li>`;
            })
            .join('');
    }
}

function renderNewsBoard() {
    const grid = document.getElementById('news-card-grid');
    if (!grid) return;

    const list = getEditorialTrends(state.activeCategory);
    const mobileReader = isMobileViewport();
    const cards = state.activeCategory === 'all' && !mobileReader ? list.slice(4, 16) : list.slice(0, 12);
    if (!cards.length) {
        grid.innerHTML = '<p>No stories available for this category.</p>';
        return;
    }

    grid.classList.toggle('is-compact', !mobileReader && state.density === 'compact');
    grid.classList.toggle('is-brief-mode', !mobileReader && state.briefMode);

    grid.innerHTML = cards
        .map((item) => {
            const image = resolveCardImage(item);
            const storyId = String(item.id || item.link || item.title || '').toLowerCase();
            const isSaved = state.savedStoryIds.includes(storyId);
            const headline = cleanHeadline(item.title);
            const categoryLabel = getCategoryLabel(item);
            const sourceName = getPrimarySource(item);
            const sourceLabel = getSourceSummary(item, sourceName);
            const storySignal = getStorySignalLabel(item);
            const whyItMatters = buildWhyItMatters(item);
            const storyBrief = buildStoryBrief(item, whyItMatters, mobileReader ? 72 : state.briefMode ? 48 : 72);
            const storyHref = escapeAttr(item.link);
            return `
        <article class="news-card ${image ? '' : 'no-image'}" data-theme-category="${normalizeCategory(item.category || 'all')}">
            ${renderCardMedia(item, image)}
            <div class="news-card-body">
                <div class="story-kicker">
                    <span>${escapeHtml(categoryLabel)}</span>
                    <span>${escapeHtml(storySignal)}</span>
                </div>
                <h4><a class="headline-link" href="${storyHref}" target="_blank" rel="noopener">${escapeHtml(headline)}</a></h4>
                <p class="card-summary">${escapeHtml(storyBrief)}</p>
                <p class="card-insight"><strong>Why it matters:</strong> ${escapeHtml(whyItMatters)}</p>
                <div class="news-card-meta">
                    <span class="source-name">${escapeHtml(sourceLabel)}</span>
                    <span>${escapeHtml(formatDate(item.published_at))}</span>
                </div>
                <div class="card-actions" data-story-actions data-story-id="${escapeAttr(storyId)}" data-story-link="${escapeAttr(item.link)}" data-story-title="${escapeAttr(item.title)}">
                    <button class="card-action-btn ${isSaved ? 'is-active' : ''}" type="button" data-action="save">${isSaved ? 'Saved' : 'Save'}</button>
                    <button class="card-action-btn" type="button" data-action="share">Share</button>
                </div>
            </div>
        </article>`;
        })
        .join('');
}


function getCategoryTrends(categoryKey) {
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const unique = dedupeTrends(sorted);
    if (categoryKey === 'all') {
        return prioritizeFollowedTopics(unique);
    }
    return unique.filter((item) => matchesCategory(item, categoryKey));
}

function getEditorialTrends(categoryKey) {
    return [...getCategoryTrends(categoryKey)].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function prioritizeFollowedTopics(list) {
    if (!state.followedTopics.length) return list;
    return [...list].sort((a, b) => {
        const aFollowed = state.followedTopics.includes(normalizeCategory(a.category || '')) ? 1 : 0;
        const bFollowed = state.followedTopics.includes(normalizeCategory(b.category || '')) ? 1 : 0;
        if (aFollowed !== bFollowed) return bFollowed - aFollowed;
        return new Date(b.published_at) - new Date(a.published_at);
    });
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
        setActiveCategory(button.dataset.category || 'all');
    });

    document.body.addEventListener('click', (event) => {
        const jump = event.target.closest('[data-category-jump]');
        if (!jump) return;
        setActiveCategory(jump.dataset.categoryJump || 'all');
        window.scrollTo({ top: document.getElementById('news-board')?.offsetTop || 0, behavior: 'smooth' });
    });

    setupMobileCategoryMenu();
}

function setupMobileCategoryMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const menu = document.getElementById('mobile-category-menu');
    const allNews = document.getElementById('mobile-all-news');
    const nav = document.getElementById('mobile-category-nav');
    if (!toggle || !menu || !allNews || !nav) return;

    toggle.addEventListener('click', () => {
        state.mobileMenuOpen = !state.mobileMenuOpen;
        renderMobileCategoryMenu();
    });

    allNews.addEventListener('click', () => {
        setActiveCategory('all');
        state.mobileMenuOpen = false;
        renderMobileCategoryMenu();
    });

    menu.addEventListener('click', (event) => {
        const button = event.target.closest('[data-mobile-category]');
        if (!button) return;
        setActiveCategory(button.dataset.mobileCategory || 'all');
        state.mobileMenuOpen = false;
        renderMobileCategoryMenu();
    });

    document.addEventListener('click', (event) => {
        if (!state.mobileMenuOpen) return;
        if (nav.contains(event.target)) return;
        state.mobileMenuOpen = false;
        renderMobileCategoryMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!state.mobileMenuOpen) return;
        state.mobileMenuOpen = false;
        renderMobileCategoryMenu();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && state.mobileMenuOpen) {
            state.mobileMenuOpen = false;
            renderMobileCategoryMenu();
        }
    });
}

function setActiveCategory(nextCategory) {
    state.activeCategory = nextCategory || 'all';
    renderCategoryPills();
    renderMobileCategoryMenu();
    renderMobileReaderChrome();
    renderNewsBoard();
    renderSectionHeading();
    renderNewsArticleSchema();
    syncActiveCategoryTheme();
}

function setupReaderInteractions() {
    const densityBtn = document.getElementById('density-toggle');
    const briefBtn = document.getElementById('brief-toggle');
    const followBtn = document.getElementById('follow-topic-toggle');
    const rail = document.getElementById('mobile-category-rail');
    const board = document.getElementById('news-card-grid');

    if (densityBtn) {
        densityBtn.addEventListener('click', () => {
            state.density = state.density === 'compact' ? 'comfortable' : 'compact';
            persistReaderPrefs();
            renderMobileReaderChrome();
            renderNewsBoard();
        });
    }

    if (briefBtn) {
        briefBtn.addEventListener('click', () => {
            state.briefMode = !state.briefMode;
            persistReaderPrefs();
            renderMobileReaderChrome();
            renderNewsBoard();
        });
    }

    if (followBtn) {
        followBtn.addEventListener('click', () => {
            if (state.activeCategory === 'all') return;
            const key = state.activeCategory;
            if (state.followedTopics.includes(key)) {
                state.followedTopics = state.followedTopics.filter((topic) => topic !== key);
            } else {
                state.followedTopics = [...state.followedTopics, key];
            }
            persistReaderPrefs();
            renderMobileReaderChrome();
            renderNewsBoard();
        });
    }

    if (rail) {
        rail.addEventListener('click', (event) => {
            const button = event.target.closest('[data-mobile-rail]');
            if (!button) return;
            setActiveCategory(button.dataset.mobileRail || 'all');
        });
    }

    if (board) {
        board.addEventListener('click', async (event) => {
            const shell = event.target.closest('[data-story-actions]');
            if (!shell) return;
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            const storyId = shell.dataset.storyId || '';
            const storyLink = shell.dataset.storyLink || '';
            const storyTitle = shell.dataset.storyTitle || 'Snapfacts story';

            if (action === 'save') {
                toggleSavedStory(storyId);
                renderNewsBoard();
                return;
            }

            if (action === 'share') {
                await shareStory(storyTitle, storyLink);
            }
        });
    }
}

function hydrateReaderPrefs() {
    state.density = safeStorageGet(STORAGE_KEYS.density, 'comfortable');
    state.briefMode = safeStorageGet(STORAGE_KEYS.brief, 'false') === 'true';
    state.followedTopics = safeStorageArrayGet(STORAGE_KEYS.follows);
    state.savedStoryIds = safeStorageArrayGet(STORAGE_KEYS.saved);
}

function persistReaderPrefs() {
    safeStorageSet(STORAGE_KEYS.density, state.density);
    safeStorageSet(STORAGE_KEYS.brief, state.briefMode ? 'true' : 'false');
    safeStorageSet(STORAGE_KEYS.follows, JSON.stringify(state.followedTopics));
    safeStorageSet(STORAGE_KEYS.saved, JSON.stringify(state.savedStoryIds));
}

function toggleSavedStory(storyId) {
    if (!storyId) return;
    if (state.savedStoryIds.includes(storyId)) {
        state.savedStoryIds = state.savedStoryIds.filter((id) => id !== storyId);
    } else {
        state.savedStoryIds = [storyId, ...state.savedStoryIds].slice(0, 120);
    }
    persistReaderPrefs();
}

async function shareStory(title, url) {
    if (!url) return;
    try {
        if (navigator.share) {
            await navigator.share({ title, url });
            return;
        }
    } catch (error) {
        // Ignore cancellation and fall back to clipboard.
    }

    try {
        await navigator.clipboard.writeText(url);
    } catch (error) {
        window.prompt('Copy story URL', url);
    }
}

function safeStorageGet(key, fallback = '') {
    try {
        return window.localStorage.getItem(key) ?? fallback;
    } catch (error) {
        return fallback;
    }
}

function safeStorageArrayGet(key) {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const value = JSON.parse(raw);
        return Array.isArray(value) ? value : [];
    } catch (error) {
        return [];
    }
}

function safeStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        // Ignore storage write failures in restricted contexts.
    }
}

function cleanHeadline(title = '') {
    const original = String(title || '').trim();
    const publisher = extractPublisherFromTitle(original);
    if (!publisher) return original;
    const suffixPattern = new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`);
    return original.replace(suffixPattern, '').trim() || original;
}

function getCategoryLabel(item) {
    const category = normalizeCategory(item.category || 'all');
    const found = HEADER_CATEGORIES.find((entry) => entry.key === category);
    return found ? found.label : category.toUpperCase();
}

function getPrimarySource(item) {
    const names = Array.isArray(item.source_names) ? item.source_names.filter(Boolean) : [];
    if (names.length) return names[0];

    const publisher = extractPublisherFromTitle(item.title || '');
    if (publisher) return publisher;

    try {
        const hostname = new URL(item.link || '').hostname.replace(/^www\./, '');
        return hostname || 'Live feed';
    } catch (error) {
        return 'Live feed';
    }
}

function getSourceSummary(item, sourceName) {
    const count = Number(item.source_count || 0);
    if (count > 1 && sourceName && sourceName !== 'Live feed') {
        return `${sourceName} + ${count - 1} more`;
    }
    return sourceName || (count ? `${count} source${count === 1 ? '' : 's'}` : 'Live feed');
}

function extractPublisherFromTitle(title = '') {
    const text = String(title || '').trim();
    const match = text.match(/\s+-\s+([^|-]{2,48})$/);
    if (!match) return '';
    return match[1].replace(/\s+/g, ' ').trim();
}

function summarizeWords(value = '', maxWords = 60) {
    const plain = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!plain) return 'Summary unavailable from feed.';

    const words = plain.split(' ').filter(Boolean);
    if (words.length <= maxWords) return trimTrailingConnector(plain);

    return trimTrailingConnector(words.slice(0, maxWords).join(' '));
}

function buildStoryBrief(item, whyItMatters, maxWords = 72) {
    const summary = summarizeWords(item.summary, maxWords);
    const headline = cleanHeadline(item.title || '');
    const sourceName = getPrimarySource(item);
    const signal = getStorySignalLabel(item).toLowerCase();
    const weakSummary = isWeakSummary(summary, headline, sourceName);

    if (!weakSummary) {
        return summarizeWords(`${summary}. ${whyItMatters}`, maxWords);
    }

    const fallback = `Snapfacts is tracking this ${signal} from ${sourceName}. The RSS feed has limited article detail, so the key takeaway is the market context: ${whyItMatters}`;
    return summarizeWords(fallback, maxWords);
}

function isWeakSummary(summary = '', headline = '', sourceName = '') {
    const cleanSummary = normalizeComparableText(summary);
    if (!cleanSummary || cleanSummary === normalizeComparableText('Summary unavailable from feed.')) return true;
    if (cleanSummary.length < 65) return true;

    const cleanHeadline = normalizeComparableText(headline);
    const cleanSource = normalizeComparableText(sourceName);
    if (cleanHeadline && (cleanSummary.includes(cleanHeadline) || cleanHeadline.includes(cleanSummary))) return true;
    if (cleanSource && cleanSummary.endsWith(cleanSource)) return true;

    const summaryWords = new Set(cleanSummary.split(' ').filter((word) => word.length > 3));
    const headlineWords = cleanHeadline.split(' ').filter((word) => word.length > 3);
    if (!summaryWords.size || !headlineWords.length) return false;

    const overlap = headlineWords.filter((word) => summaryWords.has(word)).length / headlineWords.length;
    return overlap > 0.72;
}

function normalizeComparableText(value = '') {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/[^a-z0-9 ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getStorySignalLabel(item) {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    const patterns = [
        { label: 'Product Launch', test: /\blaunch|unveil|introduc|rollout|release\b/ },
        { label: 'Partnership', test: /\bpartner|alliance|collaborat|team up|deal\b/ },
        { label: 'Funding', test: /\bfunding|fundraise|raises|series [a-z]|seed\b/ },
        { label: 'Retail Expansion', test: /\bretail|store|marketplace|commerce|ecommerce|quick commerce\b/ },
        { label: 'Ad Campaign', test: /\badvertis|campaign|media buying|adtech|marketing\b/ },
        { label: 'AI Signal', test: /\bai|artificial intelligence|llm|agentic|model\b/ },
    ];
    return patterns.find((pattern) => pattern.test.test(text))?.label || 'Market Signal';
}

function escapeRegExp(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWhyItMatters(item) {
    const category = normalizeCategory(item.category || 'all');
    const playbooks = {
        ai: 'AI adoption may shift platform, tooling, or operating priorities.',
        tech: 'Platform and infrastructure moves can ripple across teams quickly.',
        commerce: 'Retail and ecommerce signals can affect demand, margins, or channel strategy.',
        ads: 'Campaign and adtech movement can change budget and media planning decisions.',
        media: 'Audience and distribution changes can reshape publisher growth plans.',
        startup: 'Funding and product momentum can show where growth bets are forming.',
        brands: 'Brand moves signal where consumer attention and positioning are shifting.',
        all: 'Cross-category momentum makes this useful for market watchers.',
    };
    return playbooks[category] || playbooks.all;
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
        return `<img class="card-image board-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(cleanHeadline(item.title))}" loading="lazy" decoding="async" fetchpriority="low" width="640" height="360" sizes="(max-width: 768px) 96vw, (max-width: 1024px) 48vw, 24vw" />`;
    }
    return `<div class="board-image image-fallback"><span>${escapeHtml(cleanHeadline(item.title))}</span></div>`;
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

function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
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

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
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

const ENTITY_VISUALS = [
    { pattern: /\bopenai|chatgpt\b/i, label: 'OpenAI', mark: 'OA', palette: ['#0f766e', '#061b18'], accent: '#89f0d0' },
    { pattern: /\bnvidia|nvda\b/i, label: 'NVIDIA', mark: 'NV', palette: ['#3f6212', '#102006'], accent: '#bef264' },
    { pattern: /\badobe|adbe\b/i, label: 'Adobe', mark: 'AD', palette: ['#b91c1c', '#260909'], accent: '#fca5a5' },
    { pattern: /\bwpp\b/i, label: 'WPP', mark: 'WP', palette: ['#1d4ed8', '#071a3b'], accent: '#93c5fd' },
    { pattern: /\bpublicis\b/i, label: 'Publicis', mark: 'PB', palette: ['#be123c', '#2b0712'], accent: '#fda4af' },
    { pattern: /\bomnicom|omc\b/i, label: 'Omnicom', mark: 'OM', palette: ['#0369a1', '#082f49'], accent: '#7dd3fc' },
    { pattern: /\bamazon|aws\b/i, label: 'Amazon', mark: 'AM', palette: ['#92400e', '#211006'], accent: '#fbbf24' },
    { pattern: /\bshopify\b/i, label: 'Shopify', mark: 'SH', palette: ['#15803d', '#052e16'], accent: '#86efac' },
    { pattern: /\bwalmart\b/i, label: 'Walmart', mark: 'WM', palette: ['#1d4ed8', '#082154'], accent: '#fde047' },
    { pattern: /\bflipkart\b/i, label: 'Flipkart', mark: 'FK', palette: ['#1e40af', '#08163e'], accent: '#facc15' },
    { pattern: /\breliance|jio\b/i, label: 'Reliance', mark: 'RJ', palette: ['#0f4c81', '#071d34'], accent: '#93c5fd' },
    { pattern: /\bmeta|facebook|instagram\b/i, label: 'Meta', mark: 'ME', palette: ['#0a66ff', '#041633'], accent: '#7fb0ff' },
    { pattern: /\bgoogle|alphabet\b/i, label: 'Google', mark: 'GO', palette: ['#188038', '#081f12'], accent: '#fdd663' },
    { pattern: /\bmicrosoft|azure\b/i, label: 'Microsoft', mark: 'MS', palette: ['#0b72c7', '#051a2d'], accent: '#7fd2ff' },
    { pattern: /\bapple\b/i, label: 'Apple', mark: 'AP', palette: ['#334155', '#020617'], accent: '#cbd5e1' },
    { pattern: /\bnetflix\b/i, label: 'Netflix', mark: 'NF', palette: ['#b9090b', '#1b0202'], accent: '#ff7f7f' },
    { pattern: /\btarget\b/i, label: 'Target', mark: 'TG', palette: ['#d90429', '#33060f'], accent: '#ff9ca9' },
];

const SOURCE_VISUALS = [
    { pattern: /\bdigiday\b/i, label: 'Digiday', mark: 'DI', palette: ['#111827', '#020617'], accent: '#60a5fa' },
    { pattern: /\badexchanger\b/i, label: 'AdExchanger', mark: 'AX', palette: ['#0f766e', '#042f2e'], accent: '#5eead4' },
    { pattern: /\badweek\b/i, label: 'Adweek', mark: 'AW', palette: ['#1d4ed8', '#071a3b'], accent: '#93c5fd' },
    { pattern: /\bmarketing week\b/i, label: 'Marketing Week', mark: 'MW', palette: ['#9f1239', '#300610'], accent: '#fda4af' },
    { pattern: /\bretail dive\b/i, label: 'Retail Dive', mark: 'RD', palette: ['#be185d', '#2b0718'], accent: '#f9a8d4' },
    { pattern: /\bmodern retail\b/i, label: 'Modern Retail', mark: 'MR', palette: ['#92400e', '#241006'], accent: '#fdba74' },
    { pattern: /\bdigital commerce 360\b/i, label: 'Digital Commerce 360', mark: 'DC', palette: ['#1e40af', '#071946'], accent: '#93c5fd' },
    { pattern: /\byahoo finance|yahoo\b/i, label: 'Yahoo Finance', mark: 'YF', palette: ['#6001d2', '#15052f'], accent: '#c99bff' },
    { pattern: /\bmarketbeat\b/i, label: 'MarketBeat', mark: 'MB', palette: ['#155e75', '#06252f'], accent: '#67e8f9' },
    { pattern: /\bhuman resources online\b/i, label: 'HR Online', mark: 'HR', palette: ['#4f46e5', '#171044'], accent: '#c4b5fd' },
    { pattern: /\btechcrunch\b/i, label: 'TechCrunch', mark: 'TC', palette: ['#15803d', '#052e16'], accent: '#86efac' },
    { pattern: /\bthe verge\b/i, label: 'The Verge', mark: 'TV', palette: ['#7c3aed', '#1e103f'], accent: '#c4b5fd' },
    { pattern: /\bmit technology review\b/i, label: 'MIT Tech Review', mark: 'MIT', palette: ['#991b1b', '#260707'], accent: '#fca5a5' },
    { pattern: /\bsearch engine journal\b/i, label: 'Search Engine Journal', mark: 'SEJ', palette: ['#2563eb', '#071736'], accent: '#8db4ff' },
    { pattern: /\bgoogle news\b/i, label: 'Google News', mark: 'GN', palette: ['#188038', '#081f12'], accent: '#fdd663' },
];

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
    const headline = cleanHeadline(String(trend?.title || 'Snapfacts').trim());
    const artHeadline = compactHeadlineForArt(headline);
    const summary = summarize(trend?.summary || 'Fresh headline from monitored RSS feeds.', 110);
    const sourceName = getPrimarySource(trend);
    const text = `${headline} ${summary} ${sourceName}`;
    const tags = detectVisualSignals(text).slice(0, 4);
    const association = getVisualAssociation(trend, text);
    const theme = association || tags[0] || { label: 'TECH', mark: 'SF', palette: ['#0b5ed7', '#08162d'], accent: '#8cb8ff' };
    const sourceLabel = association?.source === 'entity' ? 'ENTITY SIGNAL' : association?.source === 'publisher' ? 'SOURCE SIGNAL' : 'TOPIC SIGNAL';
    const mark = theme.mark || initialsFromLabel(theme.label || sourceName || 'SF');
    const gradientId = `g${hashValue(headline).toString(36)}`;
    const ringX = 560;
    const ringY = 84;
    const titleLines = wrapForSvg(artHeadline, 28, 2);
    const chips = [theme, ...tags.filter((tag) => tag.label !== theme.label)].slice(0, 3);
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
  <circle cx="${ringX}" cy="${ringY}" r="42" fill="#ffffff" fill-opacity="0.12" stroke="${theme.accent}" stroke-width="1.5" stroke-opacity="0.75"/>
  <text x="${ringX}" y="${ringY + 11}" text-anchor="middle" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="${mark.length > 2 ? 25 : 31}" font-weight="800" fill="#ffffff">${escapeSvg(mark)}</text>
  <text x="${ringX}" y="${ringY + 98}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="${theme.accent}">${escapeSvg(sourceLabel)}</text>
  <text x="${ringX}" y="${ringY + 118}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff" fill-opacity="0.84">${escapeSvg(theme.label)}</text>
  <rect x="28" y="36" width="430" height="208" rx="16" fill="#020617" fill-opacity="0.28"/>
  <text x="48" y="66" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="${theme.accent}">${escapeSvg(sourceName.toUpperCase())}</text>
  ${titleLines.map((line, idx) => `<text x="48" y="${86 + idx * 44}" font-family="Space Grotesk, Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f8fbff">${escapeSvg(line)}</text>`).join('')}
  ${chipMarkup}
</svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getVisualAssociation(trend, text) {
    const entity = ENTITY_VISUALS.find((visual) => visual.pattern.test(text));
    if (entity) return { ...entity, source: 'entity' };

    const sourceName = getPrimarySource(trend);
    const source = SOURCE_VISUALS.find((visual) => visual.pattern.test(sourceName));
    if (source) return { ...source, source: 'publisher' };

    if (sourceName && sourceName !== 'Live feed') {
        return {
            label: sourceName,
            mark: initialsFromLabel(sourceName),
            palette: paletteFromText(sourceName),
            accent: accentFromText(sourceName),
            source: 'publisher',
        };
    }

    return null;
}

function initialsFromLabel(label = '') {
    const words = String(label)
        .replace(/[^a-z0-9 ]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean);
    if (!words.length) return 'SF';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function paletteFromText(value = '') {
    const palettes = [
        ['#0f766e', '#042f2e'],
        ['#1d4ed8', '#071a3b'],
        ['#be185d', '#2b0718'],
        ['#92400e', '#211006'],
        ['#334155', '#020617'],
        ['#9f1239', '#2a0712'],
        ['#15803d', '#052e16'],
    ];
    return palettes[hashValue(String(value)) % palettes.length];
}

function accentFromText(value = '') {
    const accents = ['#5eead4', '#93c5fd', '#f9a8d4', '#fdba74', '#cbd5e1', '#fda4af', '#86efac'];
    return accents[hashValue(String(value)) % accents.length];
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
