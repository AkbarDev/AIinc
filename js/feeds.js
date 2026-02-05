const FEED_SOURCES = [
    // 1) Core AI Research & Labs
    {
        name: "OpenAI",
        category: "research",
        url: "https://openai.com/blog/rss",
        logo: "fa-solid fa-bolt"
    },
    {
        name: "Google AI",
        category: "research",
        url: "https://ai.googleblog.com/feeds/posts/default",
        logo: "fa-brands fa-google"
    },
    {
        name: "DeepMind",
        category: "research",
        url: "https://deepmind.google/discover/rss.xml",
        logo: "fa-solid fa-brain"
    },
    {
        name: "Meta AI",
        category: "research",
        url: "https://ai.facebook.com/blog/rss/",
        logo: "fa-brands fa-meta"
    },
    {
        name: "Microsoft Research",
        category: "research",
        url: "https://www.microsoft.com/en-us/research/feed/",
        logo: "fa-brands fa-microsoft"
    },

    // 2) AI Tools, Frameworks & Dev Platforms
    {
        name: "Hugging Face",
        category: "tools",
        url: "https://huggingface.co/blog/feed.xml",
        logo: "fa-solid fa-face-smile"
    },
    {
        name: "NVIDIA Developer",
        category: "tools",
        url: "https://developer.nvidia.com/blog/feed/",
        logo: "fa-solid fa-microchip"
    },

    // 3) AI News & Industry Coverage
    {
        name: "VentureBeat AI",
        category: "industry",
        url: "https://venturebeat.com/category/ai/feed/",
        logo: "fa-solid fa-newspaper"
    },
    {
        name: "MIT Tech Review",
        category: "industry",
        url: "https://www.technologyreview.com/feed/",
        logo: "fa-solid fa-university"
    },
    {
        name: "The Verge AI",
        category: "industry",
        url: "https://www.theverge.com/rss/index.xml",
        logo: "fa-brands fa-readme" // approximated icon
    },
    {
        name: "Wired AI",
        category: "industry",
        url: "https://www.wired.com/feed/rss",
        logo: "fa-solid fa-plug"
    }
];

// Fallback/Generic Logo if needed
const DEFAULT_LOGO = "fa-solid fa-robot";
