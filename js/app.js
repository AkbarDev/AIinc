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
    { key: 'saved', label: 'SAVED' },
    { key: 'sync', label: '⚙️ SYNC' },
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
    saved: { eyebrow: 'Saved stories', heading: 'Your bookmarked trends and clustered summaries' },
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
    sources: [],
    activeCategory: 'all',
    carouselIndex: 0,
    mobileMenuOpen: false,
    density: 'comfortable',
    briefMode: false,
    followedTopics: [],
    savedStoryIds: [],
    searchQuery: '',
    boostKeywords: [],
    muteKeywords: [],
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
    syncKey: 'snapfacts_user_sync_key',
    boosts: 'snapfacts_feed_boosts',
    mutes: 'snapfacts_feed_mutes',
};

document.addEventListener('DOMContentLoaded', () => {
    if (/SnapfactsiOS/i.test(navigator.userAgent)) {
        document.body.classList.add('is-ios-app');
    }
    initSyncKey();
    hydrateReaderPrefs();
    renderSkeletons();
    loadData();
    setupCategoryFilters();
    setupHeroCarousel();
    setupReaderInteractions();
    setupSyncDialog();
    setupSearch();
    registerServiceWorker();
    setupAIChat();
    setupPersonalization();

    // Close share popovers when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('[data-action="share"]') && !event.target.closest('.share-popover')) {
            document.querySelectorAll('.share-popover.show').forEach((popover) => {
                popover.classList.remove('show');
            });
        }
    });
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

    await fetchBackendSavedArticles();

    try {
        const res = await fetch(`config/sources.json?ts=${Date.now()}`);
        if (res.ok) {
            state.sources = await res.json();
        }
    } catch (error) {
        console.warn('Failed to load sources list', error);
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
    renderTrendChart();
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
            const isAiGenerated = image && (image.includes('/generated/') || image.startsWith('data:image/svg+xml'));
            const aiTag = isAiGenerated
                ? `<span class="hero-carousel-tag hero-carousel-tag-ai"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> AI</span>`
                : '';
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
                        ${aiTag}
                    </div>
                    <h2>${story.title}</h2>
                    <p>${summarize(story.summary, 190)}</p>
                    <div class="hero-carousel-meta">
                        <span>${formatDate(story.published_at)}</span>
                        <span>Score ${story.score ? story.score.toFixed(2) : '—'}</span>
                    </div>
                    <div class="story-actions hero-carousel-actions" data-story-actions data-story-id="${escapeAttr(String(story.id || story.link || story.title || '').trim().toLowerCase())}" data-story-link="${escapeAttr(story.link)}" data-story-title="${escapeAttr(story.title)}">
                        <a href="${story.link}" target="_blank" rel="noopener">Read full story</a>
                        <button class="hero-carousel-listen-btn" type="button" data-action="listen" aria-label="Listen to story" title="Listen"><i class="fa-solid fa-volume-high" aria-hidden="true"></i> Listen</button>
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
        track.addEventListener('click', async (event) => {
            const shell = event.target.closest('[data-story-actions]');
            if (!shell) return;
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            const storyId = shell.dataset.storyId || '';
            if (action === 'listen') {
                const story = state.trends.find(item => {
                    const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
                    return id === storyId;
                });
                if (story) {
                    const headline = cleanHeadline(story.title);
                    const summary = story.summary || '';
                    const whyItMatters = buildWhyItMatters(story);
                    const btn = event.target.closest('[data-action="listen"]');
                    speakStory(headline, summary, whyItMatters, btn);
                }
                return;
            }
        });
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
        if (state.activeCategory === 'saved') {
            grid.innerHTML = '<div class="empty-saved-state"><p>No saved stories yet.</p><span>Tap the bookmark icon on any news card to save it here.</span></div>';
        } else {
            grid.innerHTML = '<p>No stories available for this category.</p>';
        }
        return;
    }

    grid.classList.toggle('is-compact', !mobileReader && state.density === 'compact');
    grid.classList.toggle('is-brief-mode', !mobileReader && state.briefMode);

    grid.innerHTML = cards
        .map((item) => {
            const image = resolveCardImage(item);
            const isAiGenerated = image && (image.includes('/generated/') || image.startsWith('data:image/svg+xml'));
            const aiBadge = isAiGenerated 
                ? `<span class="ai-generated-badge"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> AI</span>` 
                : '';
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
            <div class="card-media-wrapper">
                ${renderCardMedia(item, image)}
                ${aiBadge}
                <div class="card-image-actions" data-story-actions data-story-id="${escapeAttr(storyId)}" data-story-link="${escapeAttr(item.link)}" data-story-title="${escapeAttr(item.title)}">
                    <button class="card-image-action-btn" type="button" data-action="listen" aria-label="Listen to story" title="Listen"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button>
                    <button class="card-image-action-btn" type="button" data-action="speed-read" aria-label="Speed Read Summary" title="Speed Read Summary"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i></button>
                    <button class="card-image-action-btn" type="button" data-action="export-card" aria-label="Download Visual Card" title="Download Visual Card"><i class="fa-solid fa-image" aria-hidden="true"></i></button>
                    <button class="card-image-action-btn" type="button" data-action="export-markdown" aria-label="Export to Obsidian" title="Export to Obsidian"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i></button>
                    <button class="card-image-action-btn" type="button" data-action="share" aria-label="Share story" title="Share"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i></button>
                    <div class="share-popover">
                        <a href="https://x.com/intent/tweet?text=${encodeURIComponent('Check out this trend on Snapfacts: ' + headline)}&url=${encodeURIComponent(item.link)}" target="_blank" rel="noopener" class="share-option x-twitter" title="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(item.link)}" target="_blank" rel="noopener" class="share-option facebook" title="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(item.link)}" target="_blank" rel="noopener" class="share-option linkedin" title="Share on LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                        <button class="share-option instagram" type="button" data-action="instagram-share" data-link="${escapeAttr(item.link)}" title="Share on Instagram"><i class="fa-brands fa-instagram"></i></button>
                    </div>
                </div>
            </div>
            <div class="news-card-body">
                <h4><a class="headline-link" href="${storyHref}" target="_blank" rel="noopener">${escapeHtml(headline)}</a></h4>
                <p class="card-summary">
                    ${escapeHtml(storyBrief)}
                    <a class="story-source-link" href="${storyHref}" target="_blank" rel="noopener" style="display: block; margin-top: 0.6rem; font-size: 0.82rem; font-weight: 600; color: #38bdf8; text-decoration: none; transition: opacity 0.2s;">
                        Read on ${escapeHtml(sourceName)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.72rem; margin-left: 0.2rem;"></i>
                    </a>
                </p>
            </div>
        </article>`;
        })
        .join('');
}


function getCategoryTrends(categoryKey) {
    const sorted = [...state.trends].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const unique = dedupeTrends(sorted);
    if (categoryKey === 'saved') {
        return unique.filter((item) => {
            const storyId = String(item.id || item.link || item.title || '').trim().toLowerCase();
            return state.savedStoryIds.includes(storyId);
        });
    }
    if (categoryKey === 'all') {
        return prioritizeFollowedTopics(unique);
    }
    return unique.filter((item) => matchesCategory(item, categoryKey));
}

function getEditorialTrends(categoryKey) {
    let list = [...getCategoryTrends(categoryKey)];

    // 1. Filter out muted keywords
    if (state.muteKeywords && state.muteKeywords.length > 0) {
        list = list.filter(item => {
            const title = (item.title || '').toLowerCase();
            const summary = (item.summary || '').toLowerCase();
            return !state.muteKeywords.some(keyword => {
                const k = keyword.trim().toLowerCase();
                return k && (title.includes(k) || summary.includes(k));
            });
        });
    }

    // 2. Apply search query
    if (state.searchQuery) {
        const query = state.searchQuery.trim().toLowerCase();
        list = list.filter(item => 
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.summary && item.summary.toLowerCase().includes(query)) ||
            (item.category && item.category.toLowerCase().includes(query))
        );
    }

    // 3. Sort by score with boost modifiers applied
    return list.sort((a, b) => {
        let aScore = a.score || 0;
        let bScore = b.score || 0;

        const aTitle = (a.title || '').toLowerCase();
        const aSummary = (a.summary || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        const bSummary = (b.summary || '').toLowerCase();

        if (state.boostKeywords && state.boostKeywords.length > 0) {
            state.boostKeywords.forEach(keyword => {
                const k = keyword.trim().toLowerCase();
                if (k) {
                    if (aTitle.includes(k) || aSummary.includes(k)) aScore += 10.0;
                    if (bTitle.includes(k) || bSummary.includes(k)) bScore += 10.0;
                }
            });
        }

        return bScore - aScore;
    });
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
    if (nextCategory === 'sync') {
        const dialog = document.getElementById('sync-dialog');
        if (dialog) {
            const currentKeyInput = document.getElementById('sync-current-key');
            if (currentKeyInput) {
                currentKeyInput.value = safeStorageGet(STORAGE_KEYS.syncKey) || initSyncKey();
            }
            dialog.showModal();
        }
        return;
    }
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

            if (action === 'listen') {
                const story = state.trends.find(item => {
                    const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
                    return id === storyId;
                });
                if (story) {
                    const headline = cleanHeadline(story.title);
                    const summary = story.summary || '';
                    const whyItMatters = buildWhyItMatters(story);
                    const btn = event.target.closest('[data-action="listen"]');
                    speakStory(headline, summary, whyItMatters, btn);
                }
                return;
            }

            if (action === 'export-markdown') {
                const story = state.trends.find(item => {
                    const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
                    return id === storyId;
                });
                if (story) {
                    exportStoryToMarkdown(story);
                }
                return;
            }

            if (action === 'speed-read') {
                const story = state.trends.find(item => {
                    const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
                    return id === storyId;
                });
                if (story) {
                    openSpeedReader(story.summary || '');
                }
                return;
            }

            if (action === 'export-card') {
                const story = state.trends.find(item => {
                    const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
                    return id === storyId;
                });
                if (story) {
                    exportStoryAsVisualCard(story);
                }
                return;
            }

            if (action === 'share') {
                const popover = shell.querySelector('.share-popover');
                if (popover) {
                    // Close all other open popovers first
                    document.querySelectorAll('.share-popover.show').forEach((other) => {
                        if (other !== popover) {
                            other.classList.remove('show');
                        }
                    });
                    popover.classList.toggle('show');
                }
                return;
            }

            if (action === 'instagram-share') {
                const instaBtn = event.target.closest('[data-action="instagram-share"]');
                const link = instaBtn ? instaBtn.dataset.link : storyLink;
                try {
                    await navigator.clipboard.writeText(link);
                    showToast("Link copied! Share it on your Instagram story.");
                } catch (e) {
                    const input = document.createElement('input');
                    input.value = link;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    showToast("Link copied! Share it on your Instagram story.");
                }
                const popover = shell.querySelector('.share-popover');
                if (popover) popover.classList.remove('show');
                return;
            }
        });

        // Close popover if other social link options are clicked
        board.addEventListener('click', (event) => {
            const otherShareBtn = event.target.closest('.share-option');
            if (otherShareBtn && otherShareBtn.tagName.toLowerCase() === 'a') {
                const popover = otherShareBtn.closest('.share-popover');
                if (popover) {
                    setTimeout(() => popover.classList.remove('show'), 200);
                }
            }
        });
    }
}

function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}


function hydrateReaderPrefs() {
    state.density = safeStorageGet(STORAGE_KEYS.density, 'comfortable');
    state.briefMode = safeStorageGet(STORAGE_KEYS.brief, 'false') === 'true';
    state.followedTopics = safeStorageArrayGet(STORAGE_KEYS.follows);
    state.savedStoryIds = safeStorageArrayGet(STORAGE_KEYS.saved);
    state.boostKeywords = safeStorageArrayGet(STORAGE_KEYS.boosts);
    state.muteKeywords = safeStorageArrayGet(STORAGE_KEYS.mutes);
}

function persistReaderPrefs() {
    safeStorageSet(STORAGE_KEYS.density, state.density);
    safeStorageSet(STORAGE_KEYS.brief, state.briefMode ? 'true' : 'false');
    safeStorageSet(STORAGE_KEYS.follows, JSON.stringify(state.followedTopics));
    safeStorageSet(STORAGE_KEYS.saved, JSON.stringify(state.savedStoryIds));
    safeStorageSet(STORAGE_KEYS.boosts, JSON.stringify(state.boostKeywords));
    safeStorageSet(STORAGE_KEYS.mutes, JSON.stringify(state.muteKeywords));
}

function toggleSavedStory(storyId) {
    if (!storyId) return;
    const userKey = initSyncKey();
    if (state.savedStoryIds.includes(storyId)) {
        state.savedStoryIds = state.savedStoryIds.filter((id) => id !== storyId);
        deleteSavedArticle(userKey, storyId);
    } else {
        state.savedStoryIds = [storyId, ...state.savedStoryIds].slice(0, 120);
        const story = state.trends.find(item => {
            const id = String(item.id || item.link || item.title || '').trim().toLowerCase();
            return id === storyId;
        });
        if (story) {
            uploadSavedArticle(userKey, story);
        }
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
        : `${state.sources.length || 0}`;
    strip.querySelectorAll('[data-meta="feeds"]').forEach((el) => (el.textContent = feedLabel));
}

function renderCardMedia(item, imageUrl) {
    if (imageUrl) {
        return `<img class="card-image board-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(cleanHeadline(item.title))}" loading="lazy" decoding="async" fetchpriority="low" width="640" height="360" sizes="(max-width: 768px) 96vw, (max-width: 1024px) 48vw, 24vw" />`;
    }
    return `<div class="board-image image-fallback" role="img" aria-label="No image available for this news feed"><i class="fa-regular fa-image" aria-hidden="true"></i><span>No image available from this feed</span></div>`;
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
    if (trend?.image && (/^(https?:\/\/|data:image\/svg\+xml)/i.test(trend.image) || trend.image.startsWith('assets/'))) {
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


// --- Sync Key generation & Backend API functions ---

function initSyncKey() {
    let key = safeStorageGet(STORAGE_KEYS.syncKey);
    if (!key || key.trim().length < 3) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        key = '';
        for (let i = 0; i < 16; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        safeStorageSet(STORAGE_KEYS.syncKey, key);
    }
    return key;
}

async function fetchBackendSavedArticles() {
    if (!API_BASE) return;
    const userKey = initSyncKey();
    try {
        const res = await fetch(`${API_BASE}/v1/saved?user_key=${encodeURIComponent(userKey)}`);
        if (!res.ok) throw new Error('API error');
        const items = await res.json();
        const backendIds = items.map(item => item.article_id);
        
        const localIds = state.savedStoryIds || [];
        const mergedSet = new Set([...localIds, ...backendIds]);
        state.savedStoryIds = Array.from(mergedSet).slice(0, 120);
        
        const missingOnBackend = localIds.filter(id => !backendIds.includes(id));
        for (const localId of missingOnBackend) {
            const story = state.trends.find(item => {
                const storyId = String(item.id || item.link || item.title || '').trim().toLowerCase();
                return storyId === localId;
            });
            if (story) {
                await uploadSavedArticle(userKey, story);
            }
        }
        
        persistReaderPrefs();
    } catch (e) {
        console.warn('Failed to sync bookmarks with backend API', e);
    }
}

async function uploadSavedArticle(userKey, story) {
    if (!API_BASE) return;
    const storyId = String(story.id || story.link || story.title || '').trim().toLowerCase();
    try {
        await fetch(`${API_BASE}/v1/saved`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_key: userKey,
                article_id: storyId,
                title: story.title || 'Untitled',
                link: story.link || 'https://www.snapfacts.in',
                category: story.category || 'all'
            })
        });
    } catch (e) {
        console.warn('Failed to upload saved article to backend', e);
    }
}

async function deleteSavedArticle(userKey, storyId) {
    if (!API_BASE) return;
    try {
        await fetch(`${API_BASE}/v1/saved?user_key=${encodeURIComponent(userKey)}&article_id=${encodeURIComponent(storyId)}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.warn('Failed to delete saved article from backend', e);
    }
}

function setupSyncDialog() {
    const dialog = document.getElementById('sync-dialog');
    const closeBtn = document.getElementById('sync-close-btn');
    const copyBtn = document.getElementById('sync-copy-btn');
    const currentKeyInput = document.getElementById('sync-current-key');
    const inputKey = document.getElementById('sync-input-key');
    const saveBtn = document.getElementById('sync-save-btn');
    
    if (!dialog) return;
    
    const userKey = safeStorageGet(STORAGE_KEYS.syncKey) || initSyncKey();
    if (currentKeyInput) currentKeyInput.value = userKey;
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            dialog.close();
        });
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(currentKeyInput.value);
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                }, 2000);
            } catch (e) {
                if (currentKeyInput) {
                    currentKeyInput.select();
                    document.execCommand('copy');
                }
            }
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const nextKey = (inputKey ? inputKey.value : '').trim();
            if (nextKey.length < 3) {
                alert('Please enter a valid Sync Key.');
                return;
            }
            if (nextKey === currentKeyInput.value) {
                alert('This is already the active Sync Key for this device.');
                return;
            }
            
            safeStorageSet(STORAGE_KEYS.syncKey, nextKey);
            state.savedStoryIds = [];
            persistReaderPrefs();
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Syncing...';
            
            await fetchBackendSavedArticles();
            
            alert('Bookmarks synced successfully!');
            dialog.close();
            window.location.reload();
        });
    }
}

// 100% Free & Client-Side Audio Narration
let currentUtterance = null;
let activeListenBtn = null;

function speakStory(title, summary, whyItMatters, button) {
    if (!('speechSynthesis' in window)) {
        alert("Sorry, your browser does not support audio narration.");
        return;
    }

    if (activeListenBtn === button && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setListenButtonState(button, false);
        activeListenBtn = null;
        return;
    }

    window.speechSynthesis.cancel();
    if (activeListenBtn) {
        setListenButtonState(activeListenBtn, false);
    }

    activeListenBtn = button;
    setListenButtonState(button, true);

    const cleanTitle = cleanHeadline(title);
    const textToRead = `${cleanTitle}. ... Summary: ${summary}. ... Why it matters: ${whyItMatters}`;
    
    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    
    // Ensure voices are loaded
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
        (v.name.includes("Google") || v.name.includes("Siri") || v.name.includes("Natural")) && v.lang.startsWith("en")
    ) || voices.find(v => v.lang.startsWith("en"));

    if (preferredVoice) {
        currentUtterance.voice = preferredVoice;
    }

    currentUtterance.rate = 1.02;
    currentUtterance.pitch = 1.0;

    currentUtterance.onend = () => {
        setListenButtonState(button, false);
        if (activeListenBtn === button) {
            activeListenBtn = null;
        }
    };

    currentUtterance.onerror = () => {
        setListenButtonState(button, false);
        if (activeListenBtn === button) {
            activeListenBtn = null;
        }
    };

    window.speechSynthesis.speak(currentUtterance);
}

function setListenButtonState(button, isPlaying) {
    if (!button) return;
    const icon = button.querySelector('i');
    if (icon) {
        if (isPlaying) {
            icon.className = 'fa-solid fa-circle-stop';
            button.setAttribute('title', 'Stop listening');
            button.classList.add('is-playing');
        } else {
            icon.className = 'fa-solid fa-volume-high';
            button.setAttribute('title', 'Listen to story');
            button.classList.remove('is-playing');
        }
    }
}

// Pre-load voices on voice-changed event
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

function renderTrendChart() {
    const chartDiv = document.getElementById('plotly-trend-chart');
    if (!chartDiv) return;

    if (typeof Plotly === 'undefined') {
        chartDiv.innerHTML = '<div style="color: rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; height: 100%;">Loading chart components...</div>';
        return;
    }

    const list = getEditorialTrends(state.activeCategory);
    const topTrends = list.slice(0, 10).reverse();

    if (!topTrends.length) {
        chartDiv.innerHTML = '<div style="color: rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; height: 100%;">No data available for this category.</div>';
        return;
    }

    const xValues = topTrends.map(item => item.score || 0);
    const yValues = topTrends.map(item => cleanHeadline(item.title));
    const hoverTexts = topTrends.map(item => `${cleanHeadline(item.title)}<br>Score: ${(item.score || 0).toFixed(3)}<br>Source: ${getPrimarySource(item)}`);

    const data = [{
        type: 'bar',
        x: xValues,
        y: yValues,
        orientation: 'h',
        text: xValues.map(v => v.toFixed(2)),
        textposition: 'auto',
        hoverinfo: 'text',
        hovertext: hoverTexts,
        marker: {
            color: topTrends.map(item => {
                const cat = normalizeCategory(item.category || 'all');
                const colors = {
                    ai: '#38bdf8',       // cyan
                    tech: '#10b981',     // emerald
                    commerce: '#f59e0b', // amber
                    ads: '#ec4899',      // pink
                    startup: '#8b5cf6',  // purple
                    media: '#3b82f6',    // blue
                    brands: '#f43f5e'    // rose
                };
                return colors[cat] || '#6b7280';
            }),
            opacity: 0.85,
            line: {
                color: 'rgba(255,255,255,0.1)',
                width: 1
            }
        }
    }];

    const layout = {
        margin: { l: window.innerWidth < 768 ? 120 : 250, r: 20, t: 10, b: 30 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: 'rgba(255, 255, 255, 0.75)',
            family: 'Inter, sans-serif',
            size: window.innerWidth < 768 ? 9 : 11
        },
        xaxis: {
            title: 'Editorial Score',
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            zerolinecolor: 'rgba(255, 255, 255, 0.1)',
            tickfont: { color: 'rgba(255, 255, 255, 0.5)' }
        },
        yaxis: {
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            tickfont: { color: 'rgba(255, 255, 255, 0.85)' }
        }
    };

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('plotly-trend-chart', data, layout, config);
}

function setupSearch() {
    const searchInput = document.getElementById('header-search-input');
    const voiceBtn = document.getElementById('voice-search-btn');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!searchInput) return;

    let searchTimeout = null;
    searchInput.addEventListener('input', (event) => {
        const val = event.target.value;
        if (clearBtn) {
            clearBtn.style.display = val ? 'inline-flex' : 'none';
        }
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = val;
            renderNewsBoard();
            renderTrendChart();
        }, 150);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            clearBtn.style.display = 'none';
            renderNewsBoard();
            renderTrendChart();
            searchInput.focus();
        });
    }

    if (voiceBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceBtn.style.display = 'none';
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            voiceBtn.classList.add('listening');
            voiceBtn.setAttribute('title', 'Listening...');
            searchInput.placeholder = 'Listening to your voice...';
        };

        recognition.onend = () => {
            voiceBtn.classList.remove('listening');
            voiceBtn.setAttribute('title', 'Search by voice');
            searchInput.placeholder = 'Search trends...';
        };

        recognition.onerror = () => {
            voiceBtn.classList.remove('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            state.searchQuery = transcript;
            if (clearBtn) {
                clearBtn.style.display = 'inline-flex';
            }
            renderNewsBoard();
            renderTrendChart();
        };

        voiceBtn.addEventListener('click', () => {
            if (voiceBtn.classList.contains('listening')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }
}

function exportStoryToMarkdown(story) {
    const headline = cleanHeadline(story.title);
    const date = formatDate(story.published_at);
    const category = (story.category || 'all').toUpperCase();
    const summary = story.summary || '';
    const whyItMatters = buildWhyItMatters(story);
    const link = story.link || '';
    const source = getPrimarySource(story);

    const mdContent = `---
type: news-summary
category: ${category}
source: ${source}
date: ${date}
tags: [snapfacts, intelligence, ${category.toLowerCase()}]
---

# ${headline}

**Source**: [${source}](${link})  
**Date**: ${date}  

## Summary
${summary}

## Why it matters
${whyItMatters}

---
*Generated by [Snapfacts](https://www.snapfacts.in)*
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// RSVP Speed Reader Implementation
let speedReaderWords = [];
let speedReaderIndex = 0;
let speedReaderInterval = null;
let speedReaderIsPlaying = false;

function openSpeedReader(text) {
    const modal = document.getElementById('speed-reader-modal');
    const display = document.getElementById('speed-word-display');
    const playPauseBtn = document.getElementById('speed-reader-play-pause');
    const progressBar = document.getElementById('speed-progress-bar');

    if (!modal || !display) return;

    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (activeListenBtn) {
            setListenButtonState(activeListenBtn, false);
            activeListenBtn = null;
        }
    }

    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[#*`_-]/g, '').trim();
    speedReaderWords = cleanText.split(/\s+/).filter(w => w.length > 0);
    speedReaderIndex = 0;
    speedReaderIsPlaying = false;

    if (progressBar) progressBar.style.width = '0%';
    display.textContent = "READY";
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setupSpeedReaderEvents();
}

function setupSpeedReaderEvents() {
    const modal = document.getElementById('speed-reader-modal');
    const closeBtn = document.getElementById('speed-reader-close');
    const playPauseBtn = document.getElementById('speed-reader-play-pause');
    const rewindBtn = document.getElementById('speed-reader-rewind');
    const wpmSelect = document.getElementById('speed-reader-wpm');

    if (!modal) return;

    const stopReader = () => {
        clearInterval(speedReaderInterval);
        speedReaderInterval = null;
        speedReaderIsPlaying = false;
        modal.style.display = 'none';
        document.body.style.overflow = '';
    };

    closeBtn.onclick = stopReader;
    modal.querySelector('.speed-modal-backdrop').onclick = stopReader;

    playPauseBtn.onclick = () => {
        if (speedReaderIsPlaying) {
            pauseSpeedReader();
        } else {
            playSpeedReader();
        }
    };

    rewindBtn.onclick = () => {
        speedReaderIndex = 0;
        updateSpeedDisplay();
    };

    wpmSelect.onchange = () => {
        if (speedReaderIsPlaying) {
            pauseSpeedReader();
            playSpeedReader();
        }
    };
}

function playSpeedReader() {
    const playPauseBtn = document.getElementById('speed-reader-play-pause');
    const wpmSelect = document.getElementById('speed-reader-wpm');
    if (!playPauseBtn || !wpmSelect) return;

    const wpm = parseInt(wpmSelect.value) || 350;
    const intervalMs = (60 / wpm) * 1000;

    speedReaderIsPlaying = true;
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

    speedReaderInterval = setInterval(() => {
        if (speedReaderIndex >= speedReaderWords.length) {
            pauseSpeedReader();
            return;
        }
        updateSpeedDisplay();
        speedReaderIndex++;
    }, intervalMs);
}

function pauseSpeedReader() {
    const playPauseBtn = document.getElementById('speed-reader-play-pause');
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    
    speedReaderIsPlaying = false;
    clearInterval(speedReaderInterval);
    speedReaderInterval = null;
}

function updateSpeedDisplay() {
    const display = document.getElementById('speed-word-display');
    const progressBar = document.getElementById('speed-progress-bar');
    if (!display) return;

    if (speedReaderIndex >= speedReaderWords.length) {
        display.textContent = "FINISHED";
        if (progressBar) progressBar.style.width = '100%';
        return;
    }

    display.textContent = speedReaderWords[speedReaderIndex];

    if (progressBar && speedReaderWords.length) {
        const pct = (speedReaderIndex / speedReaderWords.length) * 100;
        progressBar.style.width = `${pct}%`;
    }
}

// Visual Share Card Exporter
function exportStoryAsVisualCard(story) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const imageSrc = resolveCardImage(story);
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    
    bgImage.onload = () => {
        drawVisualCard(ctx, bgImage, story, canvas);
    };
    
    bgImage.onerror = () => {
        drawVisualCard(ctx, null, story, canvas);
    };

    if (imageSrc) {
        bgImage.src = imageSrc;
    } else {
        drawVisualCard(ctx, null, story, canvas);
    }
}

function drawVisualCard(ctx, bgImage, story, canvas) {
    const headline = cleanHeadline(story.title);
    const category = (story.category || 'all').toUpperCase();
    const date = formatDate(story.published_at);
    const summary = story.summary || '';
    const source = getPrimarySource(story);

    if (bgImage) {
        const hRatio = canvas.width / bgImage.width;
        const vRatio = canvas.height / bgImage.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - bgImage.width * ratio) / 2;
        const centerShift_y = (canvas.height - bgImage.height * ratio) / 2;
        ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height,
            centerShift_x, centerShift_y, bgImage.width * ratio, bgImage.height * ratio);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
        gradient.addColorStop(0, '#060a14');
        gradient.addColorStop(1, '#111827');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1280, 720);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, 720);
    overlay.addColorStop(0, 'rgba(6, 10, 20, 0.45)');
    overlay.addColorStop(1, 'rgba(6, 10, 20, 0.95)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(60, 60, 160, 36, 6);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(category, 140, 84);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '500 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${source} • ${date}`, 240, 84);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Space Grotesk", sans-serif';
    
    const titleLines = wrapText(ctx, headline, 1160);
    let currentY = 170;
    titleLines.forEach(line => {
        ctx.fillText(line, 60, currentY);
        currentY += 56;
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, currentY + 10);
    ctx.lineTo(1220, currentY + 10);
    ctx.stroke();
    currentY += 50;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '500 24px Inter, sans-serif';
    
    const summaryLines = wrapText(ctx, summary, 1160);
    summaryLines.forEach(line => {
        ctx.fillText(line, 60, currentY);
        currentY += 34;
    });

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SNAPFACTS', 1220, 660);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Real-Time Signals', 1220, 680);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                console.log('info: ServiceWorker registration successful with scope: ', reg.scope);
            }).catch((err) => {
                console.warn('warn: ServiceWorker registration failed: ', err);
            });
        });
    }
}

function setupAIChat() {
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const panel = document.getElementById('chat-panel');
    const closeBtn = document.getElementById('chat-close-btn');
    const form = document.getElementById('chat-input-form');
    const userInput = document.getElementById('chat-user-input');
    const messageArea = document.getElementById('chat-messages');

    if (!toggleBtn || !panel || !closeBtn || !form || !messageArea) return;

    toggleBtn.addEventListener('click', () => {
        const isClosed = panel.style.display === 'none';
        panel.style.display = isClosed ? 'flex' : 'none';
        if (isClosed) {
            userInput.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        userInput.value = '';

        setTimeout(() => {
            const reply = processAgentQuery(text);
            appendChatMessage('agent', reply);
        }, 300);
    });
}

function appendChatMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msg = document.createElement('div');
    if (sender === 'user') {
        msg.style.cssText = "background: #38bdf8; color: #000; border-radius: 12px 12px 0 12px; padding: 0.8rem; max-width: 85%; align-self: flex-end; margin-left: auto;";
    } else {
        msg.style.cssText = "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px 12px 12px 0; padding: 0.8rem; max-width: 85%; align-self: flex-start;";
    }
    msg.innerHTML = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function processAgentQuery(query) {
    const q = query.toLowerCase();

    if (!state.trends || !state.trends.length) {
        return "I don't have access to the news feed right now. Please wait while the page completes loading.";
    }

    const matches = state.trends.filter(item => {
        const title = (item.title || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        return title.includes(q) || summary.includes(q) || cat.includes(q);
    });

    if (matches.length > 0) {
        const topMatches = matches.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
        let response = `I found **${matches.length} matching trends** today. Here is the synthesized briefing:<br><br>`;
        
        topMatches.forEach((item, idx) => {
            const headline = cleanHeadline(item.title);
            const source = getPrimarySource(item);
            const score = item.score ? item.score.toFixed(2) : '—';
            response += `${idx + 1}. **${headline}** (Score: ${score})<br>`;
            response += `<em>"${item.summary}"</em><br>`;
            response += `<a href="${item.link}" target="_blank" rel="noopener" style="color: #38bdf8; text-decoration: underline; font-size: 0.8rem;">Read full story at ${source}</a><br><br>`;
        });

        if (matches.length > 3) {
            response += `<em>And ${matches.length - 3} other matching trends. You can search them using the main header search bar!</em>`;
        }
        return response;
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
        return "Hello! I am ready to answer your questions. You can ask me to search and summarize topics like <em>\"Google\"</em>, <em>\"AI\"</em>, or <em>\"advertising\"</em>.";
    }

    if (q.includes('summary') || q.includes('today') || q.includes('trends')) {
        const topOverall = [...state.trends]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 3);
        
        let response = "Here is the quick executive briefing on today's **top 3 trends**:<br><br>";
        topOverall.forEach((item, idx) => {
            response += `• **${cleanHeadline(item.title)}**: ${item.summary}<br><br>`;
        });
        return response;
    }

    return "I couldn't find any trends matching your query. Try asking about a specific keyword like <em>\"OpenAI\"</em>, <em>\"Google\"</em>, <em>\"marketing\"</em>, or ask for <em>\"today's top trends\"</em>!";
}

function setupPersonalization() {
    const btn = document.getElementById('personalize-feed-btn');
    const dialog = document.getElementById('personalize-dialog');
    const closeBtn = document.getElementById('personalize-close-btn');
    const saveBtn = document.getElementById('save-personalization-btn');
    const boostInput = document.getElementById('feed-boost-input');
    const muteInput = document.getElementById('feed-mute-input');

    if (!btn || !dialog || !closeBtn || !saveBtn || !boostInput || !muteInput) return;

    btn.onclick = () => {
        boostInput.value = (state.boostKeywords || []).join(', ');
        muteInput.value = (state.muteKeywords || []).join(', ');
        dialog.showModal();
    };

    closeBtn.onclick = () => {
        dialog.close();
    };

    saveBtn.onclick = () => {
        state.boostKeywords = boostInput.value
            .split(',')
            .map(word => word.trim())
            .filter(word => word.length > 0);

        state.muteKeywords = muteInput.value
            .split(',')
            .map(word => word.trim())
            .filter(word => word.length > 0);

        persistReaderPrefs();
        renderNewsBoard();
        renderTrendChart();
        dialog.close();
    };
}





