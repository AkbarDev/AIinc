/**
 * HFBoard: Hugging Face Open Model Hub Explorer for Snapfacts
 * Live interactive charts, license distributions, home-page-style rails,
 * and responsive model comparison.
 */

class HFBoard {
  constructor(containerId = 'hf-board-container') {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // Core State
    this.state = {
      mainTab: 'models', // 'models' | 'licenses'
      subCategory: 'multimodal',
      sortField: 'trendingScore', // 'trendingScore' | 'downloads' | 'likes' | 'lastModified'
      searchQuery: '',
      filterLibrary: '',
      filterLicense: '',
      filterGated: 'all', // 'all' | 'gated' | 'open'
      commercialOnly: false,
      compareList: [], // Model objects up to 4
      tableFallbacks: {}, // chartId -> boolean
      status: 'live', // 'live' | 'cached' | 'offline'
      lastRefreshed: new Date().toLocaleTimeString(),
      models: [],
      datasets: [],
      spaces: [],
      config: null,
      isLoading: false
    };

    this.init();
  }

  async init() {
    this.readUrlState();
    await this.loadConfig();
    await this.loadInitialData();
    this.render();
    this.bindGlobalEvents();
  }

  readUrlState() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('hf_main')) this.state.mainTab = params.get('hf_main');
      if (params.get('hf_sub')) this.state.subCategory = params.get('hf_sub');
      if (params.get('hf_sort')) this.state.sortField = params.get('hf_sort');
      if (params.get('hf_q')) this.state.searchQuery = params.get('hf_q');
    } catch (e) {
      console.warn('URL state read failed:', e);
    }
  }

  updateUrlState() {
    try {
      const url = new URL(window.location);
      url.searchParams.set('category', 'hfboard');
      url.searchParams.set('hf_main', this.state.mainTab);
      url.searchParams.set('hf_sub', this.state.subCategory);
      url.searchParams.set('hf_sort', this.state.sortField);
      if (this.state.searchQuery) {
        url.searchParams.set('hf_q', this.state.searchQuery);
      } else {
        url.searchParams.delete('hf_q');
      }
      window.history.replaceState({}, '', url);
    } catch (e) {
      console.warn('URL state update failed:', e);
    }
  }

  async loadConfig() {
    try {
      const res = await fetch('data/hf_config.json');
      if (res.ok) {
        this.state.config = await res.json();
      } else {
        throw new Error('Config load non-200');
      }
    } catch (err) {
      console.warn('Fallback to embedded default config:', err);
      this.state.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      subheaders: [
        { id: "multimodal", label: "Multimodal", pipelineTags: ["image-text-to-text", "visual-question-answering", "document-question-answering", "any-to-any"] },
        { id: "computer-vision", label: "Computer Vision", pipelineTags: ["image-classification", "object-detection", "image-segmentation", "text-to-image"] },
        { id: "nlp", label: "NLP", pipelineTags: ["text-generation", "text-classification", "sentence-similarity", "summarization"] },
        { id: "tabular", label: "Tabular", pipelineTags: ["tabular-classification", "tabular-regression"] },
        { id: "machine-learning", label: "Machine Learning", libraries: ["scikit-learn", "xgboost", "lightgbm"] },
        { id: "deep-learning", label: "Deep Learning", libraries: ["pytorch", "tensorflow", "jax", "keras"] },
        { id: "statistical", label: "Statistical", pipelineTags: ["time-series-forecasting"] },
        { id: "data-analyst", label: "Data Analyst models", pipelineTags: ["table-question-answering", "text-to-sql"], definitionNote: "How this category is defined: Curated pipeline targeting automated data analysis, SQL query generation, natural language table exploration, and automated reporting." },
        { id: "data-engineering", label: "Data Engineering models", pipelineTags: ["token-classification", "sentence-similarity"], definitionNote: "How this category is defined: Curated pipeline targeting ETL pipelines, entity extraction (NER), semantic deduplication, and high-density vector search embeddings." }
      ],
      licenses: {
        commercialFriendly: ["apache-2.0", "mit", "bsd-2-clause", "bsd-3-clause", "cc-by-4.0", "isc"],
        communityOrRestricted: ["llama3.3", "llama3.1", "llama3", "llama2", "gemma", "deepseek", "openrail", "other"]
      }
    };
  }

  async loadInitialData() {
    this.state.isLoading = true;
    try {
      // 1. Try Live Hugging Face API with sessionStorage caching
      await this.fetchLiveOrCachedCategory(this.state.subCategory);
      // 2. Fetch rails (datasets and spaces)
      await this.fetchRailsData();
    } catch (err) {
      console.warn('HF Hub live fetch failed, using pre-cached snapshot:', err);
      await this.loadFallbackCache();
    } finally {
      this.state.isLoading = false;
    }
  }

  async fetchLiveOrCachedCategory(subId, forceRefresh = false) {
    const cacheKey = `hf_cache_${subId}_${this.state.sortField}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached && !forceRefresh) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 900000) { // 15 mins TTL
          this.state.models = parsed.data;
          this.state.status = 'cached';
          this.state.lastRefreshed = new Date(parsed.timestamp).toLocaleTimeString();
          return;
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
      }
    }

    // Live query construction
    const subConf = this.state.config?.subheaders?.find(s => s.id === subId);
    let url = `https://huggingface.co/api/models?limit=36&direction=-1`;

    if (this.state.sortField === 'trendingScore') {
      url += `&sort=trendingScore`;
    } else if (this.state.sortField === 'downloads') {
      url += `&sort=downloads`;
    } else if (this.state.sortField === 'likes') {
      url += `&sort=likes`;
    } else {
      url += `&sort=lastModified`;
    }

    if (subConf?.pipelineTags && subConf.pipelineTags.length > 0) {
      url += `&pipeline_tag=${encodeURIComponent(subConf.pipelineTags[0])}`;
    } else if (subConf?.libraries && subConf.libraries.length > 0) {
      url += `&library=${encodeURIComponent(subConf.libraries[0])}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 429) {
      throw new Error('HTTP 429: HF Hub Rate Limited');
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from HF Hub`);
    }

    const rawData = await res.json();
    const normalized = rawData.map(m => this.normalizeModelData(m, subId));
    this.state.models = normalized;
    this.state.status = 'live';
    this.state.lastRefreshed = new Date().toLocaleTimeString();

    // Cache in sessionStorage
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: normalized
      }));
    } catch (e) {
      console.warn('Session storage quota exceeded:', e);
    }
  }

  normalizeModelData(m, subId) {
    // Extract license
    let license = 'Unspecified';
    if (m.tags && Array.isArray(m.tags)) {
      const licTag = m.tags.find(t => t.startsWith('license:'));
      if (licTag) {
        license = licTag.replace('license:', '').trim();
      }
    }
    if (m.license && typeof m.license === 'string') {
      license = m.license;
    }

    // Extract param size approximation
    let paramCount = 'n/r';
    if (m.tags && Array.isArray(m.tags)) {
      const sizeTag = m.tags.find(t => /^\d+(\.\d+)?[bm]$/i.test(t));
      if (sizeTag) {
        paramCount = sizeTag.toUpperCase();
      }
    }
    if (paramCount === 'n/r') {
      const match = m.id.match(/[-_](\d+(\.\d+)?)[bm]([-_]|$)/i);
      if (match) {
        paramCount = match[1].toUpperCase() + (m.id.toLowerCase().includes('b') ? 'B' : 'M');
      }
    }

    // Parse numeric param in Billions for scatter plot
    let numParamsB = null;
    if (paramCount !== 'n/r') {
      if (paramCount.endsWith('B')) {
        numParamsB = parseFloat(paramCount);
      } else if (paramCount.endsWith('M')) {
        numParamsB = parseFloat(paramCount) / 1000;
      }
    }

    // Author
    const author = m.id.includes('/') ? m.id.split('/')[0] : 'community';

    return {
      id: m.id,
      author: author,
      pipeline_tag: m.pipeline_tag || 'general',
      library_name: m.library_name || (m.tags?.find(t => ['transformers', 'diffusers', 'pytorch', 'jax', 'scikit-learn'].includes(t)) || 'other'),
      tags: m.tags || [],
      license: license,
      downloads: Number(m.downloads || 0),
      likes: Number(m.likes || 0),
      trendingScore: Number(m.trendingScore || 0),
      lastModified: m.lastModified || m.createdAt || 'n/r',
      createdAt: m.createdAt || 'n/r',
      gated: Boolean(m.gated || (m.tags && m.tags.includes('gated'))),
      paramCount: paramCount,
      numParamsB: numParamsB,
      category: subId
    };
  }

  async fetchRailsData() {
    try {
      const [dRes, sRes] = await Promise.all([
        fetch('https://huggingface.co/api/datasets?limit=4&sort=downloads&direction=-1'),
        fetch('https://huggingface.co/api/spaces?limit=4&sort=likes&direction=-1')
      ]);
      if (dRes.ok) this.state.datasets = await dRes.json();
      if (sRes.ok) this.state.spaces = await sRes.json();
    } catch (e) {
      console.warn('Rails fetch failed, loading local fallback rails:', e);
    }
  }

  async loadFallbackCache() {
    try {
      const res = await fetch('data/hf_models_cache.json');
      if (res.ok) {
        const cache = await res.json();
        this.state.models = (cache.models || []).map(m => this.normalizeModelData(m, this.state.subCategory));
        this.state.datasets = cache.trendingDatasets || [];
        this.state.spaces = cache.trendingSpaces || [];
        this.state.status = 'offline';
        this.state.lastRefreshed = 'Cached Snapshot (Offline)';
      }
    } catch (err) {
      console.error('Critical: unable to load fallback cache:', err);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="container hf-board-shell">
        ${this.renderHeader()}
        ${this.renderSubheaderFilters()}
        ${this.renderDefinitionNote()}
        ${this.renderToolbar()}
        ${this.renderFilterPanel()}
        ${this.renderTrendingRails()}

        <main id="hf-main-content">
          ${this.state.mainTab === 'models' ? this.renderModelsTab() : this.renderLicensesTab()}
        </main>

        ${this.renderCompareTray()}
        ${this.renderCompareModal()}
        ${this.renderAttributionFooter()}
      </div>
    `;

    this.bindInteractions();
    this.renderCharts();
  }

  renderHeader() {
    const statusClass = this.state.status === 'live' ? 'hf-status-live' : (this.state.status === 'cached' ? 'hf-status-cached' : 'hf-status-offline');
    const statusText = this.state.status === 'live' ? '🟢 Live (HF Hub API)' : (this.state.status === 'cached' ? '🟡 Session Cache' : '⚪ Cached Snapshot');

    return `
      <header class="hf-master-header">
        <div class="hf-header-top">
          <div class="hf-title-group">
            <h2>
              HFBoard
              <span class="hf-title-badge">Hugging Face Live Telemetry</span>
            </h2>
            <p class="hf-subtitle">Empirical open-weight model analytics, parameter scales, and license distributions across 9 research domains.</p>
          </div>
          <div class="hf-status-block">
            <span class="hf-status-pill ${statusClass}" aria-live="polite">${statusText}</span>
            <span class="hf-refreshed-time">Refreshed: ${this.state.lastRefreshed}</span>
            <button class="hf-btn-tool" id="hf-force-refresh-btn" title="Refresh Live Hugging Face Data" aria-label="Refresh data">
              <i class="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
        </div>

        <nav class="hf-main-tabs" role="tablist" aria-label="Main HFBoard Views">
          <button class="hf-main-tab-btn ${this.state.mainTab === 'models' ? 'active' : ''}" 
                  id="tab-btn-models" 
                  role="tab" 
                  aria-selected="${this.state.mainTab === 'models'}" 
                  aria-controls="hf-main-content">
            <i class="fa-solid fa-layer-group"></i> MODELS
          </button>
          <button class="hf-main-tab-btn ${this.state.mainTab === 'licenses' ? 'active' : ''}" 
                  id="tab-btn-licenses" 
                  role="tab" 
                  aria-selected="${this.state.mainTab === 'licenses'}" 
                  aria-controls="hf-main-content">
            <i class="fa-solid fa-scale-balanced"></i> LICENSES
          </button>
        </nav>
      </header>
    `;
  }

  renderSubheaderFilters() {
    const subheaders = this.state.config?.subheaders || [];
    return `
      <div class="hf-subheader-bar" role="tablist" aria-label="Subheader Filters">
        ${subheaders.map(sub => `
          <button class="hf-sub-btn ${this.state.subCategory === sub.id ? 'active' : ''}"
                  data-sub-id="${sub.id}"
                  role="tab"
                  aria-selected="${this.state.subCategory === sub.id}">
            ${sub.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  renderDefinitionNote() {
    const currentSub = this.state.config?.subheaders?.find(s => s.id === this.state.subCategory);
    if (!currentSub?.definitionNote) return '';

    return `
      <div class="hf-definition-note" role="region" aria-label="Category Definition">
        <i class="fa-solid fa-circle-info" style="margin-top: 2px;"></i>
        <div>${currentSub.definitionNote}</div>
      </div>
    `;
  }

  renderToolbar() {
    return `
      <section class="hf-toolbar" aria-label="Search and Filter Controls">
        <div class="hf-search-wrapper">
          <i class="fa-solid fa-magnifying-glass hf-search-icon"></i>
          <input type="text" 
                 class="hf-search-input" 
                 id="hf-search-input" 
                 placeholder="Search models by name, author, or task (e.g. Qwen, Llama, Tapas)..." 
                 value="${this.escapeHtml(this.state.searchQuery)}" 
                 aria-label="Search models" />
          ${this.state.searchQuery ? `<button class="hf-search-clear" id="hf-search-clear" aria-label="Clear search"><i class="fa-solid fa-xmark"></i></button>` : ''}
          <div class="hf-suggestions-box" id="hf-suggestions-box"></div>
        </div>

        <div class="hf-filter-actions">
          <select class="hf-select" id="hf-sort-select" aria-label="Sort by metric">
            <option value="trendingScore" ${this.state.sortField === 'trendingScore' ? 'selected' : ''}>🔥 Most Trending</option>
            <option value="downloads" ${this.state.sortField === 'downloads' ? 'selected' : ''}>⬇️ Most Downloaded</option>
            <option value="likes" ${this.state.sortField === 'likes' ? 'selected' : ''}>❤️ Most Liked</option>
            <option value="lastModified" ${this.state.sortField === 'lastModified' ? 'selected' : ''}>🕒 Recently Updated</option>
          </select>

          <button class="hf-btn-tool" id="hf-toggle-filters-btn" aria-expanded="false" aria-controls="hf-filter-panel">
            <i class="fa-solid fa-filter"></i> Filters
          </button>

          <button class="hf-btn-tool" id="hf-export-csv-btn" title="Export Current Table as CSV" aria-label="Export CSV">
            <i class="fa-solid fa-file-csv"></i> Export CSV
          </button>

          <button class="hf-btn-tool" id="hf-share-url-btn" title="Copy Shareable View URL" aria-label="Share URL">
            <i class="fa-solid fa-share-nodes"></i> Share
          </button>
        </div>
      </section>
    `;
  }

  renderFilterPanel() {
    return `
      <section class="hf-filter-panel" id="hf-filter-panel" aria-label="Advanced Filters">
        <div class="hf-filter-group">
          <label for="hf-filter-library">Library Runtime</label>
          <select class="hf-select" id="hf-filter-library" style="width: 100%;">
            <option value="">All Libraries</option>
            <option value="transformers" ${this.state.filterLibrary === 'transformers' ? 'selected' : ''}>Transformers</option>
            <option value="diffusers" ${this.state.filterLibrary === 'diffusers' ? 'selected' : ''}>Diffusers</option>
            <option value="sentence-transformers" ${this.state.filterLibrary === 'sentence-transformers' ? 'selected' : ''}>Sentence-Transformers</option>
            <option value="pytorch" ${this.state.filterLibrary === 'pytorch' ? 'selected' : ''}>PyTorch</option>
            <option value="jax" ${this.state.filterLibrary === 'jax' ? 'selected' : ''}>JAX / Flax</option>
            <option value="scikit-learn" ${this.state.filterLibrary === 'scikit-learn' ? 'selected' : ''}>Scikit-Learn</option>
          </select>
        </div>

        <div class="hf-filter-group">
          <label for="hf-filter-license">License Classification</label>
          <select class="hf-select" id="hf-filter-license" style="width: 100%;">
            <option value="">All Licenses</option>
            <option value="apache-2.0" ${this.state.filterLicense === 'apache-2.0' ? 'selected' : ''}>Apache 2.0</option>
            <option value="mit" ${this.state.filterLicense === 'mit' ? 'selected' : ''}>MIT</option>
            <option value="llama" ${this.state.filterLicense === 'llama' ? 'selected' : ''}>Llama Community</option>
            <option value="commercial" ${this.state.commercialOnly ? 'selected' : ''}>Commercial-Friendly Only</option>
            <option value="Unspecified" ${this.state.filterLicense === 'Unspecified' ? 'selected' : ''}>Unspecified Only</option>
          </select>
        </div>

        <div class="hf-filter-group">
          <label for="hf-filter-gated">Gated Access</label>
          <select class="hf-select" id="hf-filter-gated" style="width: 100%;">
            <option value="all" ${this.state.filterGated === 'all' ? 'selected' : ''}>All Models</option>
            <option value="open" ${this.state.filterGated === 'open' ? 'selected' : ''}>Open Access Only</option>
            <option value="gated" ${this.state.filterGated === 'gated' ? 'selected' : ''}>Gated / Agreement Required</option>
          </select>
        </div>
      </section>
    `;
  }

  renderTrendingRails() {
    const topDatasets = (this.state.datasets || []).slice(0, 3);
    const topSpaces = (this.state.spaces || []).slice(0, 3);
    const risingModels = this.getFilteredModels().slice(0, 3);

    return `
      <section class="hf-trending-rails" aria-label="Trending Community Rails">
        <!-- Rail 1: Rising Models -->
        <article class="hf-rail-card">
          <div class="hf-rail-header">
            <h3 class="hf-rail-title"><i class="fa-solid fa-chart-line" style="color: var(--hf-accent-blue);"></i> Rising Models</h3>
            <span class="hf-title-badge">This Week</span>
          </div>
          <ul class="hf-rail-list">
            ${risingModels.map(m => `
              <li class="hf-rail-item">
                <a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener" class="hf-rail-item-name" title="${m.id}">${m.id}</a>
                <span class="hf-rail-item-stat"><i class="fa-solid fa-arrow-down"></i> ${this.formatNumber(m.downloads)}</span>
              </li>
            `).join('')}
          </ul>
        </article>

        <!-- Rail 2: Trending Datasets -->
        <article class="hf-rail-card">
          <div class="hf-rail-header">
            <h3 class="hf-rail-title"><i class="fa-solid fa-database" style="color: var(--hf-accent-teal);"></i> Trending Datasets</h3>
            <span class="hf-title-badge">Curated</span>
          </div>
          <ul class="hf-rail-list">
            ${topDatasets.map(d => `
              <li class="hf-rail-item">
                <a href="https://huggingface.co/datasets/${d.id}" target="_blank" rel="noopener" class="hf-rail-item-name" title="${d.id}">${d.id}</a>
                <span class="hf-rail-item-stat"><i class="fa-solid fa-heart"></i> ${this.formatNumber(d.likes || 0)}</span>
              </li>
            `).join('')}
          </ul>
        </article>

        <!-- Rail 3: Trending Spaces -->
        <article class="hf-rail-card">
          <div class="hf-rail-header">
            <h3 class="hf-rail-title"><i class="fa-solid fa-cube" style="color: var(--hf-accent-purple);"></i> Trending Spaces</h3>
            <span class="hf-title-badge">Interactive</span>
          </div>
          <ul class="hf-rail-list">
            ${topSpaces.map(s => `
              <li class="hf-rail-item">
                <a href="https://huggingface.co/spaces/${s.id}" target="_blank" rel="noopener" class="hf-rail-item-name" title="${s.id}">${s.id}</a>
                <span class="hf-rail-item-stat"><i class="fa-solid fa-heart"></i> ${this.formatNumber(s.likes || 0)}</span>
              </li>
            `).join('')}
          </ul>
        </article>
      </section>
    `;
  }

  renderModelsTab() {
    const models = this.getFilteredModels();

    return `
      <!-- Charts Grid -->
      <section class="hf-charts-grid" aria-label="Interactive Model Charts">
        <!-- Chart 1: Top-N Leaderboard -->
        <article class="hf-chart-card">
          <div class="hf-chart-header">
            <h3 class="hf-chart-title">Top Models Leaderboard</h3>
            <div class="hf-chart-tools">
              <button class="hf-btn-tool" data-toggle-table="chart-top-n" title="Toggle Table View">
                <i class="fa-solid fa-table"></i>
              </button>
              <button class="hf-btn-tool" data-export-png="chart-top-n" title="Export Chart as PNG">
                <i class="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
          <div id="chart-top-n" class="hf-chart-viewport"></div>
          <div id="table-chart-top-n" class="hf-table-fallback">
            ${this.renderLeaderboardTableFallback(models.slice(0, 10))}
          </div>
        </article>

        <!-- Chart 2: Size vs Popularity Scatter -->
        <article class="hf-chart-card">
          <div class="hf-chart-header">
            <h3 class="hf-chart-title">Size vs Popularity (Params vs Downloads)</h3>
            <div class="hf-chart-tools">
              <button class="hf-btn-tool" data-toggle-table="chart-size-scatter" title="Toggle Table View">
                <i class="fa-solid fa-table"></i>
              </button>
              <button class="hf-btn-tool" data-export-png="chart-size-scatter" title="Export Chart as PNG">
                <i class="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
          <div id="chart-size-scatter" class="hf-chart-viewport"></div>
          <div id="table-chart-size-scatter" class="hf-table-fallback">
            ${this.renderScatterTableFallback(models)}
          </div>
        </article>

        <!-- Chart 3: Library Runtime Mix Donut -->
        <article class="hf-chart-card">
          <div class="hf-chart-header">
            <h3 class="hf-chart-title">Runtime &amp; Library Ecosystem Mix</h3>
            <div class="hf-chart-tools">
              <button class="hf-btn-tool" data-toggle-table="chart-library-donut" title="Toggle Table View">
                <i class="fa-solid fa-table"></i>
              </button>
            </div>
          </div>
          <div id="chart-library-donut" class="hf-chart-viewport"></div>
          <div id="table-chart-library-donut" class="hf-table-fallback">
            ${this.renderLibraryTableFallback(models)}
          </div>
        </article>

        <!-- Chart 4: Downloads Distribution -->
        <article class="hf-chart-card">
          <div class="hf-chart-header">
            <h3 class="hf-chart-title">Download Volume Distribution</h3>
            <div class="hf-chart-tools">
              <button class="hf-btn-tool" data-toggle-table="chart-downloads-bar" title="Toggle Table View">
                <i class="fa-solid fa-table"></i>
              </button>
            </div>
          </div>
          <div id="chart-downloads-bar" class="hf-chart-viewport"></div>
          <div id="table-chart-downloads-bar" class="hf-table-fallback">
            ${this.renderLeaderboardTableFallback(models.slice(0, 8))}
          </div>
        </article>
      </section>

      <!-- Model Cards Grid Section -->
      <section class="hf-models-section" aria-label="Model Card Catalog">
        <div class="hf-cards-section-header">
          <h3 class="hf-chart-title">Model Catalog (${models.length} Models Found)</h3>
          <span class="hf-cards-count">Showing page results matching filter</span>
        </div>

        <div class="hf-models-grid">
          ${models.map(m => this.renderModelCard(m)).join('')}
        </div>
      </section>
    `;
  }

  renderModelCard(m) {
    const isCommercial = this.state.config?.licenses?.commercialFriendly?.includes(m.license?.toLowerCase());
    const licClass = isCommercial ? 'hf-badge-license-commercial' : 'hf-badge-license-restricted';
    const isSelected = this.state.compareList.some(item => item.id === m.id);

    return `
      <article class="hf-model-card" data-model-id="${m.id}">
        <div>
          <div class="hf-card-top">
            <span class="hf-author-tag">${m.author}</span>
            ${m.gated ? `<span class="hf-gated-badge" title="Gated: requires license agreement">GATED</span>` : ''}
          </div>
          <a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener" class="hf-model-id-link" title="${m.id}">
            ${m.id.split('/').pop()}
          </a>
          <div class="hf-card-badges">
            <span class="hf-badge hf-badge-task">${m.pipeline_tag}</span>
            <span class="hf-badge">${m.library_name}</span>
            <span class="hf-badge hf-badge-license ${licClass}">
              ${m.license || 'Unspecified'}
            </span>
            <span class="hf-badge" title="Estimated Parameter Size">${m.paramCount}</span>
          </div>
        </div>

        <div>
          <div class="hf-card-metrics">
            <span class="hf-metric-item" title="Monthly Downloads">
              <i class="fa-solid fa-arrow-down"></i> ${this.formatNumber(m.downloads)}
            </span>
            <span class="hf-metric-item" title="Community Likes">
              <i class="fa-solid fa-heart" style="color: #e11d48;"></i> ${this.formatNumber(m.likes)}
            </span>
            <span class="hf-metric-item" title="Trending Score">
              <i class="fa-solid fa-fire" style="color: #f97316;"></i> ${m.trendingScore || 'n/r'}
            </span>
          </div>

          <div class="hf-card-footer">
            <button class="hf-btn-compare ${isSelected ? 'selected' : ''}" data-compare-id="${m.id}" aria-label="Compare ${m.id}">
              <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i> ${isSelected ? 'Added' : 'Compare'}
            </button>
            <a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener" class="hf-btn-tool" style="font-size: 0.75rem;">
              View on Hub <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  renderLicensesTab() {
    const models = this.getFilteredModels();
    const licenseStats = this.calculateLicenseMetrics(models);

    return `
      <section class="hf-licenses-view" aria-label="Open-Weight License Telemetry">
        <!-- KPIs -->
        <div class="hf-license-kpis">
          <div class="hf-kpi-card">
            <div class="hf-kpi-title">Commercial-Friendly Models</div>
            <div class="hf-kpi-value" style="color: #059669;">${licenseStats.commercialCount}</div>
            <div class="hf-kpi-sub">${licenseStats.commercialPercent}% of analyzed repos</div>
          </div>
          <div class="hf-kpi-card">
            <div class="hf-kpi-title">Community / Restricted</div>
            <div class="hf-kpi-value" style="color: #d97706;">${licenseStats.restrictedCount}</div>
            <div class="hf-kpi-sub">Llama, Gemma, DeepSeek, OpenRAIL</div>
          </div>
          <div class="hf-kpi-card">
            <div class="hf-kpi-title">Unspecified License Bucket</div>
            <div class="hf-kpi-value" style="color: #64748b;">${licenseStats.unspecifiedPercent}%</div>
            <div class="hf-kpi-sub">${licenseStats.unspecifiedCount} models without explicit SPDX tag</div>
          </div>
          <div class="hf-kpi-card">
            <div class="hf-kpi-title">Dominant License</div>
            <div class="hf-kpi-value" style="color: var(--hf-accent-blue);">${licenseStats.topLicense}</div>
            <div class="hf-kpi-sub">Leading by total download volume</div>
          </div>
        </div>

        <!-- Quick Filter & Legal Notice -->
        <div class="hf-disclaimer-box" role="note">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>License Guidance Note:</strong> Commercial readiness is derived from open metadata tags (e.g. Apache-2.0, MIT, BSD vs. custom community agreements). This serves as a quick developer guide and does not constitute formal legal counsel. Always review the repository's source license file.
          </div>
        </div>

        <!-- License Charts Grid -->
        <div class="hf-charts-grid">
          <article class="hf-chart-card">
            <div class="hf-chart-header">
              <h3 class="hf-chart-title">License Frequency Distribution</h3>
              <div class="hf-chart-tools">
                <button class="hf-btn-tool" data-toggle-table="chart-license-dist"><i class="fa-solid fa-table"></i></button>
              </div>
            </div>
            <div id="chart-license-dist" class="hf-chart-viewport"></div>
            <div id="table-chart-license-dist" class="hf-table-fallback">
              ${this.renderLicenseFrequencyTable(licenseStats.breakdown)}
            </div>
          </article>

          <article class="hf-chart-card">
            <div class="hf-chart-header">
              <h3 class="hf-chart-title">License vs Real Download Volume</h3>
              <div class="hf-chart-tools">
                <button class="hf-btn-tool" data-toggle-table="chart-license-downloads"><i class="fa-solid fa-table"></i></button>
              </div>
            </div>
            <div id="chart-license-downloads" class="hf-chart-viewport"></div>
            <div id="table-chart-license-downloads" class="hf-table-fallback">
              ${this.renderLicenseDownloadsTable(licenseStats.downloadsByLicense)}
            </div>
          </article>
        </div>

        <!-- License Table -->
        <div class="hf-license-table-card">
          <h3 class="hf-chart-title" style="margin-bottom: 1rem;">Model Repository License Index</h3>
          <table class="hf-license-table">
            <thead>
              <tr>
                <th>Model Identifier</th>
                <th>Author</th>
                <th>Task Category</th>
                <th>License Type</th>
                <th>Commercial Status</th>
                <th>Downloads</th>
                <th>Repository</th>
              </tr>
            </thead>
            <tbody>
              ${models.map(m => {
                const isComm = this.state.config?.licenses?.commercialFriendly?.includes(m.license?.toLowerCase());
                return `
                  <tr>
                    <td><strong>${m.id}</strong></td>
                    <td>${m.author}</td>
                    <td><span class="hf-badge">${m.pipeline_tag}</span></td>
                    <td><span class="hf-badge ${isComm ? 'hf-badge-license-commercial' : 'hf-badge-license-restricted'}">${m.license || 'Unspecified'}</span></td>
                    <td>${isComm ? '✅ Commercial Ready' : (m.license === 'Unspecified' ? '⚪ Unspecified' : '⚠️ Community/Review')}</td>
                    <td>${this.formatNumber(m.downloads)}</td>
                    <td><a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener">View License <i class="fa-solid fa-arrow-up-right-from-square"></i></a></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  renderCompareTray() {
    const list = this.state.compareList;
    return `
      <aside class="hf-compare-tray ${list.length > 0 ? 'visible' : ''}" id="hf-compare-tray" aria-label="Model Comparison Bar">
        <span style="font-weight: 700; font-size: 0.85rem;">Compare Models (${list.length}/4):</span>
        <div class="hf-compare-chips">
          ${list.map(m => `
            <span class="hf-compare-chip">
              ${m.id.split('/').pop()}
              <button class="hf-chip-remove" data-remove-compare="${m.id}" aria-label="Remove ${m.id}">&times;</button>
            </span>
          `).join('')}
        </div>
        <button class="hf-btn-view-compare" id="hf-open-compare-btn">View Side-by-Side</button>
        <button class="hf-btn-tool" id="hf-clear-compare-btn" style="color: #94a3b8; border-color: #334155;">Clear</button>
      </aside>
    `;
  }

  renderCompareModal() {
    const list = this.state.compareList;
    return `
      <div class="hf-modal-backdrop" id="hf-compare-modal" role="dialog" aria-modal="true" aria-labelledby="hf-modal-title">
        <div class="hf-modal-content">
          <button class="hf-modal-close" id="hf-close-compare-modal" aria-label="Close modal">&times;</button>
          <h2 id="hf-modal-title" style="font-family: var(--hf-font-display); font-size: 1.6rem; margin-top: 0;">Side-by-Side Open Model Comparison</h2>
          <p style="color: var(--hf-text-muted); font-size: 0.9rem;">Comparing technical parameters, license constraints, and adoption metrics.</p>

          ${list.length === 0 ? `<p>No models selected for comparison.</p>` : `
            <table class="hf-compare-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  ${list.map(m => `<th><strong>${m.id.split('/').pop()}</strong><br><small style="font-weight: normal; color: #64748b;">${m.author}</small></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pipeline Task</td>
                  ${list.map(m => `<td><span class="hf-badge hf-badge-task">${m.pipeline_tag}</span></td>`).join('')}
                </tr>
                <tr>
                  <td>Estimated Parameters</td>
                  ${list.map(m => `<td><strong>${m.paramCount}</strong></td>`).join('')}
                </tr>
                <tr>
                  <td>License</td>
                  ${list.map(m => `<td><span class="hf-badge">${m.license || 'Unspecified'}</span></td>`).join('')}
                </tr>
                <tr>
                  <td>Monthly Downloads</td>
                  ${list.map(m => `<td>${this.formatNumber(m.downloads)}</td>`).join('')}
                </tr>
                <tr>
                  <td>Community Likes</td>
                  ${list.map(m => `<td>${this.formatNumber(m.likes)}</td>`).join('')}
                </tr>
                <tr>
                  <td>Runtime Library</td>
                  ${list.map(m => `<td>${m.library_name}</td>`).join('')}
                </tr>
                <tr>
                  <td>Gated Repository</td>
                  ${list.map(m => `<td>${m.gated ? '🔒 Yes' : '🟢 Open'}</td>`).join('')}
                </tr>
                <tr>
                  <td>Hugging Face Hub</td>
                  ${list.map(m => `<td><a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener">Open Repo &rarr;</a></td>`).join('')}
                </tr>
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  renderAttributionFooter() {
    return `
      <footer class="hf-attribution-footer">
        <div>
          <span>Data: <a href="https://huggingface.co" target="_blank" rel="noopener">Hugging Face Hub Public API</a></span>
          <span style="margin: 0 0.5rem;">•</span>
          <span>OpenAPI Spec Verified</span>
        </div>
        <div>
          <span>Snapfacts HFBoard • Research &amp; Practitioner Telemetry</span>
        </div>
      </footer>
    `;
  }

  // --- CHART RENDERING ENGINE (Plotly.js + Accessible Table Fallbacks) ---
  renderCharts() {
    if (!window.Plotly) {
      console.warn('Plotly.js not available; table fallbacks active.');
      return;
    }

    if (this.state.mainTab === 'models') {
      this.renderTopNChart();
      this.renderScatterChart();
      this.renderLibraryDonutChart();
      this.renderDownloadsBarChart();
    } else {
      this.renderLicenseFrequencyChart();
      this.renderLicenseDownloadsChart();
    }
  }

  renderTopNChart() {
    const div = document.getElementById('chart-top-n');
    if (!div) return;

    const models = this.getFilteredModels().slice(0, 8);
    const names = models.map(m => m.id.split('/').pop());
    const values = models.map(m => m[this.state.sortField] || m.downloads);

    const data = [{
      type: 'bar',
      orientation: 'h',
      x: values.reverse(),
      y: names.reverse(),
      marker: {
        color: '#0284c7',
        line: { color: '#0369a1', width: 1 }
      },
      hoverinfo: 'x+y'
    }];

    const layout = {
      margin: { l: 140, r: 20, t: 20, b: 40 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      xaxis: { title: this.state.sortField.toUpperCase(), gridcolor: '#e2e8f0' },
      yaxis: { automargin: true },
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  renderScatterChart() {
    const div = document.getElementById('chart-size-scatter');
    if (!div) return;

    const models = this.getFilteredModels().filter(m => m.numParamsB !== null && m.downloads > 0);
    const xVals = models.map(m => m.numParamsB);
    const yVals = models.map(m => m.downloads);
    const texts = models.map(m => `${m.id}<br>Params: ${m.paramCount}<br>Downloads: ${this.formatNumber(m.downloads)}<br>Likes: ${m.likes}`);
    const sizes = models.map(m => Math.max(10, Math.min(36, Math.sqrt(m.likes) * 0.7)));

    const data = [{
      type: 'scatter',
      mode: 'markers',
      x: xVals,
      y: yVals,
      text: texts,
      hoverinfo: 'text',
      marker: {
        size: sizes,
        color: '#2563eb',
        opacity: 0.75,
        line: { color: '#1d4ed8', width: 1.5 }
      }
    }];

    const layout = {
      margin: { l: 60, r: 20, t: 20, b: 40 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      xaxis: { title: 'Parameter Count (Billions)', type: 'log', gridcolor: '#e2e8f0' },
      yaxis: { title: 'Downloads', type: 'log', gridcolor: '#e2e8f0' },
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  renderLibraryDonutChart() {
    const div = document.getElementById('chart-library-donut');
    if (!div) return;

    const models = this.getFilteredModels();
    const counts = {};
    models.forEach(m => {
      const lib = m.library_name || 'other';
      counts[lib] = (counts[lib] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const data = [{
      type: 'pie',
      hole: 0.55,
      labels: labels,
      values: values,
      marker: {
        colors: ['#0284c7', '#2563eb', '#0d9488', '#d97706', '#7c3aed', '#64748b']
      },
      textinfo: 'label+percent',
      hoverinfo: 'label+value+percent'
    }];

    const layout = {
      margin: { l: 20, r: 20, t: 20, b: 20 },
      paper_bgcolor: 'transparent',
      showlegend: false,
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  renderDownloadsBarChart() {
    const div = document.getElementById('chart-downloads-bar');
    if (!div) return;

    const models = this.getFilteredModels().slice(0, 8);
    const names = models.map(m => m.id.split('/').pop());
    const downloads = models.map(m => m.downloads);

    const data = [{
      type: 'bar',
      x: names,
      y: downloads,
      marker: { color: '#0d9488' }
    }];

    const layout = {
      margin: { l: 60, r: 20, t: 20, b: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      xaxis: { tickangle: -25, automargin: true },
      yaxis: { title: 'Downloads', gridcolor: '#e2e8f0' },
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  renderLicenseFrequencyChart() {
    const div = document.getElementById('chart-license-dist');
    if (!div) return;

    const stats = this.calculateLicenseMetrics(this.getFilteredModels());
    const labels = Object.keys(stats.breakdown);
    const values = Object.values(stats.breakdown);

    const data = [{
      type: 'pie',
      hole: 0.45,
      labels: labels,
      values: values,
      marker: {
        colors: ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#64748b']
      }
    }];

    const layout = {
      margin: { l: 20, r: 20, t: 20, b: 20 },
      paper_bgcolor: 'transparent',
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  renderLicenseDownloadsChart() {
    const div = document.getElementById('chart-license-downloads');
    if (!div) return;

    const stats = this.calculateLicenseMetrics(this.getFilteredModels());
    const licenses = Object.keys(stats.downloadsByLicense);
    const dls = Object.values(stats.downloadsByLicense);

    const data = [{
      type: 'bar',
      x: licenses,
      y: dls,
      marker: { color: '#1d4ed8' }
    }];

    const layout = {
      margin: { l: 70, r: 20, t: 20, b: 40 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      yaxis: { title: 'Total Downloads', gridcolor: '#e2e8f0' },
      font: { family: 'Inter, sans-serif', size: 11, color: '#475569' }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false });
  }

  // --- ACCESSIBLE TABLE FALLBACKS FOR SCREEN READERS ---
  renderLeaderboardTableFallback(models) {
    return `
      <table class="hf-fallback-table" summary="Top models leaderboard table">
        <thead>
          <tr>
            <th>Model ID</th>
            <th>Author</th>
            <th>Downloads</th>
            <th>Likes</th>
          </tr>
        </thead>
        <tbody>
          ${models.map(m => `
            <tr>
              <td>${m.id}</td>
              <td>${m.author}</td>
              <td>${this.formatNumber(m.downloads)}</td>
              <td>${this.formatNumber(m.likes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderScatterTableFallback(models) {
    return `
      <table class="hf-fallback-table" summary="Size vs Popularity table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Param Count</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          ${models.slice(0, 8).map(m => `
            <tr>
              <td>${m.id}</td>
              <td>${m.paramCount}</td>
              <td>${this.formatNumber(m.downloads)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderLibraryTableFallback(models) {
    const counts = {};
    models.forEach(m => counts[m.library_name] = (counts[m.library_name] || 0) + 1);
    return `
      <table class="hf-fallback-table" summary="Library runtime counts">
        <thead><tr><th>Library</th><th>Count</th></tr></thead>
        <tbody>
          ${Object.entries(counts).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  renderLicenseFrequencyTable(breakdown) {
    return `
      <table class="hf-fallback-table" summary="License counts">
        <thead><tr><th>License</th><th>Models Count</th></tr></thead>
        <tbody>
          ${Object.entries(breakdown).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  renderLicenseDownloadsTable(dls) {
    return `
      <table class="hf-fallback-table" summary="Downloads by license">
        <thead><tr><th>License</th><th>Total Downloads</th></tr></thead>
        <tbody>
          ${Object.entries(dls).map(([k, v]) => `<tr><td>${k}</td><td>${this.formatNumber(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // --- FILTERING & METRICS ---
  getFilteredModels() {
    return this.state.models.filter(m => {
      // Search
      if (this.state.searchQuery) {
        const q = this.state.searchQuery.toLowerCase();
        const match = m.id.toLowerCase().includes(q) || 
                      m.author.toLowerCase().includes(q) || 
                      m.pipeline_tag.toLowerCase().includes(q);
        if (!match) return false;
      }
      // Library
      if (this.state.filterLibrary && m.library_name !== this.state.filterLibrary) {
        return false;
      }
      // License
      if (this.state.filterLicense) {
        if (this.state.filterLicense === 'llama' && !m.license?.toLowerCase().includes('llama')) return false;
        if (this.state.filterLicense === 'commercial') {
          const isComm = this.state.config?.licenses?.commercialFriendly?.includes(m.license?.toLowerCase());
          if (!isComm) return false;
        } else if (this.state.filterLicense !== 'llama' && m.license !== this.state.filterLicense) {
          return false;
        }
      }
      // Commercial quick filter
      if (this.state.commercialOnly) {
        const isComm = this.state.config?.licenses?.commercialFriendly?.includes(m.license?.toLowerCase());
        if (!isComm) return false;
      }
      // Gated
      if (this.state.filterGated === 'open' && m.gated) return false;
      if (this.state.filterGated === 'gated' && !m.gated) return false;

      return true;
    });
  }

  calculateLicenseMetrics(models) {
    const total = models.length || 1;
    let commercial = 0;
    let restricted = 0;
    let unspecified = 0;
    const breakdown = {};
    const dls = {};

    models.forEach(m => {
      const lic = m.license || 'Unspecified';
      breakdown[lic] = (breakdown[lic] || 0) + 1;
      dls[lic] = (dls[lic] || 0) + m.downloads;

      if (lic === 'Unspecified' || lic === 'n/r') {
        unspecified++;
      } else if (this.state.config?.licenses?.commercialFriendly?.includes(lic.toLowerCase())) {
        commercial++;
      } else {
        restricted++;
      }
    });

    let topLicense = 'Apache-2.0';
    let maxDl = -1;
    Object.entries(dls).forEach(([lic, val]) => {
      if (val > maxDl) {
        maxDl = val;
        topLicense = lic;
      }
    });

    return {
      commercialCount: commercial,
      commercialPercent: Math.round((commercial / total) * 100),
      restrictedCount: restricted,
      unspecifiedCount: unspecified,
      unspecifiedPercent: Math.round((unspecified / total) * 100),
      topLicense: topLicense,
      breakdown: breakdown,
      downloadsByLicense: dls
    };
  }

  // --- EVENT BINDINGS ---
  bindInteractions() {
    // Main tab toggle
    document.getElementById('tab-btn-models')?.addEventListener('click', () => {
      this.state.mainTab = 'models';
      this.updateUrlState();
      this.render();
    });

    document.getElementById('tab-btn-licenses')?.addEventListener('click', () => {
      this.state.mainTab = 'licenses';
      this.updateUrlState();
      this.render();
    });

    // Subheader pills
    document.querySelectorAll('.hf-sub-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const subId = e.currentTarget.getAttribute('data-sub-id');
        this.state.subCategory = subId;
        this.updateUrlState();
        this.state.isLoading = true;
        this.render();
        await this.fetchLiveOrCachedCategory(subId);
        this.state.isLoading = false;
        this.render();
      });
    });

    // Force Refresh
    document.getElementById('hf-force-refresh-btn')?.addEventListener('click', async () => {
      this.state.isLoading = true;
      this.render();
      await this.fetchLiveOrCachedCategory(this.state.subCategory, true);
      this.state.isLoading = false;
      this.render();
    });

    // Search Input
    const searchInput = document.getElementById('hf-search-input');
    const suggestBox = document.getElementById('hf-suggestions-box');

    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.trim();
      this.updateUrlState();
      this.showSuggestions(e.target.value, suggestBox);
      // Debounce card re-render
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => this.render(), 300);
    });

    document.getElementById('hf-search-clear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.updateUrlState();
      this.render();
    });

    // Sort select
    document.getElementById('hf-sort-select')?.addEventListener('change', async (e) => {
      this.state.sortField = e.target.value;
      this.updateUrlState();
      await this.fetchLiveOrCachedCategory(this.state.subCategory);
      this.render();
    });

    // Filters toggle
    document.getElementById('hf-toggle-filters-btn')?.addEventListener('click', (e) => {
      const panel = document.getElementById('hf-filter-panel');
      panel?.classList.toggle('open');
      e.currentTarget.classList.toggle('active');
    });

    // Library filter
    document.getElementById('hf-filter-library')?.addEventListener('change', (e) => {
      this.state.filterLibrary = e.target.value;
      this.render();
    });

    // License filter
    document.getElementById('hf-filter-license')?.addEventListener('change', (e) => {
      this.state.filterLicense = e.target.value;
      this.state.commercialOnly = e.target.value === 'commercial';
      this.render();
    });

    // Gated filter
    document.getElementById('hf-filter-gated')?.addEventListener('change', (e) => {
      this.state.filterGated = e.target.value;
      this.render();
    });

    // Export CSV
    document.getElementById('hf-export-csv-btn')?.addEventListener('click', () => {
      this.exportCSV();
    });

    // Share URL
    document.getElementById('hf-share-url-btn')?.addEventListener('click', () => {
      this.shareURL();
    });

    // Compare button clicks
    document.querySelectorAll('.hf-btn-compare').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-compare-id');
        this.toggleCompareModel(id);
      });
    });

    // Chip remove
    document.querySelectorAll('.hf-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-remove-compare');
        this.toggleCompareModel(id);
      });
    });

    // Open Compare Modal
    document.getElementById('hf-open-compare-btn')?.addEventListener('click', () => {
      document.getElementById('hf-compare-modal')?.classList.add('open');
    });

    // Close Compare Modal
    document.getElementById('hf-close-compare-modal')?.addEventListener('click', () => {
      document.getElementById('hf-compare-modal')?.classList.remove('open');
    });

    // Clear compare
    document.getElementById('hf-clear-compare-btn')?.addEventListener('click', () => {
      this.state.compareList = [];
      this.render();
    });

    // Table fallback toggles
    document.querySelectorAll('[data-toggle-table]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chartId = e.currentTarget.getAttribute('data-toggle-table');
        const table = document.getElementById(`table-${chartId}`);
        const chart = document.getElementById(chartId);
        if (table && chart) {
          const isTable = table.classList.toggle('visible');
          chart.style.display = isTable ? 'none' : 'block';
        }
      });
    });

    // PNG Export for Charts
    document.querySelectorAll('[data-export-png]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chartId = e.currentTarget.getAttribute('data-export-png');
        if (window.Plotly) {
          window.Plotly.downloadImage(chartId, { format: 'png', filename: `snapfacts-hf-${chartId}` });
        }
      });
    });
  }

  bindGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('hf-compare-modal')?.classList.remove('open');
        const box = document.getElementById('hf-suggestions-box');
        if (box) box.style.display = 'none';
      }
    });
  }

  showSuggestions(val, box) {
    if (!box || !val || val.length < 2) {
      if (box) box.style.display = 'none';
      return;
    }

    const matches = this.state.models.filter(m => m.id.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    if (matches.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.innerHTML = matches.map(m => `
      <div class="hf-suggestion-item" data-suggestion="${m.id}">
        <strong>${m.id}</strong>
        <span style="font-size: 0.75rem; color: #64748b;">${m.pipeline_tag}</span>
      </div>
    `).join('');
    box.style.display = 'block';

    box.querySelectorAll('.hf-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const modelId = item.getAttribute('data-suggestion');
        this.state.searchQuery = modelId;
        const input = document.getElementById('hf-search-input');
        if (input) input.value = modelId;
        box.style.display = 'none';
        this.render();
      });
    });
  }

  toggleCompareModel(modelId) {
    const existingIndex = this.state.compareList.findIndex(m => m.id === modelId);
    if (existingIndex > -1) {
      this.state.compareList.splice(existingIndex, 1);
    } else {
      if (this.state.compareList.length >= 4) {
        alert('You can compare a maximum of 4 models simultaneously.');
        return;
      }
      const model = this.state.models.find(m => m.id === modelId);
      if (model) this.state.compareList.push(model);
    }
    this.render();
  }

  exportCSV() {
    const models = this.getFilteredModels();
    const headers = ['Model ID', 'Author', 'Pipeline Task', 'Library', 'License', 'Downloads', 'Likes', 'Param Size', 'Gated'];
    const rows = models.map(m => [
      `"${m.id}"`,
      `"${m.author}"`,
      `"${m.pipeline_tag}"`,
      `"${m.library_name}"`,
      `"${m.license}"`,
      m.downloads,
      m.likes,
      `"${m.paramCount}"`,
      m.gated ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapfacts-hf-models-${this.state.subCategory}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  shareURL() {
    this.updateUrlState();
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('View URL copied to clipboard!');
    }).catch(() => {
      alert(`Shareable URL: ${window.location.href}`);
    });
  }

  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Export for module systems or window global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HFBoard };
}
if (typeof window !== 'undefined') {
  window.HFBoard = HFBoard;
}
