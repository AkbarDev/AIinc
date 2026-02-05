document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.getElementById('feed-container');
    const refreshBtn = document.getElementById('refresh-btn');
    const navLinks = document.querySelectorAll('.nav-links a');

    // State
    let allFeeds = [];
    let displayedCategory = 'all';

    // CORS Proxy Configuration
    const CORS_PROXY = "https://api.allorigins.win/get?url=";

    // Initialize
    init();

    function init() {
        console.log("AI Nexus Initializing...");
        fetchAllFeeds();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Refresh Button
        refreshBtn.addEventListener('click', () => {
            rotateIcon(refreshBtn.querySelector('i'));
            feedContainer.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Refreshing global AI streams...</p>
                </div>
            `;
            allFeeds = []; // Clear cache
            fetchAllFeeds();
        });

        // Category Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active state
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Filter content
                displayedCategory = link.getAttribute('data-category');
                renderFeeds();
            });
        });
    }

    async function fetchAllFeeds() {
        const promises = FEED_SOURCES.map(source => fetchFeed(source));

        try {
            const results = await Promise.allSettled(promises);

            // Process results
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    allFeeds.push(...result.value);
                }
            });

            // Sort by date (newest first)
            allFeeds.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

            renderFeeds();

        } catch (error) {
            console.error("Global error fetching feeds:", error);
            feedContainer.innerHTML = `<p class="error-msg">Failed to load feeds. Please try again later.</p>`;
        }
    }

    async function fetchFeed(source) {
        try {
            const response = await fetch(`${CORS_PROXY}${encodeURIComponent(source.url)}`);
            const data = await response.json();

            if (!data.contents) throw new Error("No content received");

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.contents, "text/xml");

            // Check for RSS vs Atom
            let items = xmlDoc.querySelectorAll("item"); // RSS
            let isAtom = false;

            if (items.length === 0) {
                items = xmlDoc.querySelectorAll("entry"); // Atom
                isAtom = true;
            }

            const entries = [];

            items.forEach(item => {
                // Title
                const title = getTagValue(item, "title");

                // Description/Summary
                // RSS uses description, Atom uses summary or content
                let description = "";
                if (isAtom) {
                    description = getTagValue(item, "summary") || getTagValue(item, "content");
                } else {
                    description = getTagValue(item, "description") || getTagValue(item, "content:encoded");
                }

                const snippet = stripHtml(description).substring(0, 160) + "...";

                // Link
                let link = "";
                if (isAtom) {
                    // Atom links are attributes usually <link href="..." />
                    const linkNode = item.querySelector("link");
                    if (linkNode) link = linkNode.getAttribute("href");
                } else {
                    link = getTagValue(item, "link");
                }

                // Date
                let pubDateRaw = "";
                if (isAtom) {
                    pubDateRaw = getTagValue(item, "published") || getTagValue(item, "updated");
                } else {
                    pubDateRaw = getTagValue(item, "pubDate") || getTagValue(item, "dc:date");
                }

                if (title && link) {
                    entries.push({
                        sourceName: source.name,
                        sourceLogo: source.logo,
                        category: source.category,
                        title,
                        snippet,
                        link,
                        pubDate: pubDateRaw ? new Date(pubDateRaw) : new Date()
                    });
                }
            });

            return entries;

        } catch (error) {
            console.warn(`Failed to fetch ${source.name}:`, error);
            return null;
        }
    }

    function renderFeeds() {
        feedContainer.innerHTML = '';

        const filtered = displayedCategory === 'all'
            ? allFeeds
            : allFeeds.filter(f => f.category === displayedCategory);

        if (filtered.length === 0) {
            if (allFeeds.length === 0) {
                // Still loading or everything failed?
                // If we are here after sorting, it means we have no data.
                // But this function is called after fetch.
                // Check if we have processed anything.
                // This state might just mean empty category.
            }
            feedContainer.innerHTML = '<p class="no-data">No updates found for this category at the moment.</p>';
            return;
        }

        filtered.forEach(item => {
            const card = createCard(item);
            feedContainer.appendChild(card);
        });
    }

    function createCard(item) {
        let dateStr = "Recent";
        try {
            if (item.pubDate && !isNaN(item.pubDate.getTime())) {
                dateStr = formatDate(item.pubDate);
            }
        } catch (e) { }

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div>
                <div class="card-source">
                    <i class="${item.sourceLogo}"></i>
                    <span>${item.sourceName}</span>
                </div>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-snippet">${item.snippet}</p>
            </div>
            <div class="card-meta">
                <span>${dateStr}</span>
                <a href="${item.link}" target="_blank" class="read-more">
                    Read Feed <i class="fa-solid fa-arrow-right"></i>
                </a>
            </div>
        `;
        return card;
    }

    // --- Helpers ---

    function getTagValue(parent, tagName) {
        const node = parent.querySelector(tagName);
        return node ? node.textContent : "";
    }

    function stripHtml(html) {
        if (!html) return "";
        const tmp = document.createElement("DIV");
        // Handle encoded HTML entities if present
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    function formatDate(dateObj) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return dateObj.toLocaleDateString('en-US', options);
    }

    function rotateIcon(element) {
        if (!element) return;
        element.style.transition = 'transform 0.5s ease';
        element.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            element.style.transform = 'none';
        }, 500);
    }
});
