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
      isLoading: false,
      // Model Technical Specifications & Architecture Explorer State
      specMetric: 'numParams', // 'numParams' | 'contextLength' | 'embeddingLength' | 'projectorParams' | 'projectorEmbedding' | 'projectorDimensions'
      specFilterArch: 'all',
      specFilterCap: 'all',
      specFilterQuant: 'all',
      specSortDir: 'desc', // 'desc' | 'asc'
      inspectedModelId: null,
      showSpecTable: true
    };

    this.init();
  }

  async init() {
    this.readUrlState();
    this.state.config = this.getDefaultConfig();
    
    // 1. Immediately load snapshot cache so all models & specs appear with zero latency
    await this.loadFallbackCache();
    this.render();
    this.bindGlobalEvents();

    // 2. Background fetch remote config and live Hugging Face Hub telemetry
    this.loadConfig().catch(() => {});
    this.loadInitialData().then(() => this.render()).catch((err) => {
      console.warn('Background live telemetry fetch complete or defaulted:', err);
    });
  }

  readUrlState() {
    try {
      if (typeof window === 'undefined' || !window.location || !window.location.search) return;
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
    const cacheKey = `hf_cache_v3_${subId}_${this.state.sortField}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached && !forceRefresh) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 900000) { // 15 mins TTL
          this.state.models = (parsed.data || []).map(m => this.normalizeModelData(m, subId));
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

  parseParamValue(str) {
    if (!str || typeof str !== 'string' || str === 'n/r') return null;
    const clean = str.trim().toUpperCase();
    const match = clean.match(/^([\d.]+)\s*([BMK]?)$/i);
    if (!match) return null;
    const num = parseFloat(match[1]);
    if (isNaN(num)) return null;
    const unit = match[2];
    if (unit === 'B') return Math.round(num * 1e9);
    if (unit === 'M') return Math.round(num * 1e6);
    if (unit === 'K') return Math.round(num * 1e3);
    return Math.round(num);
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
    if (typeof m.paramCount === 'string' && m.paramCount !== 'n/r') {
      paramCount = m.paramCount;
    } else if (m.tags && Array.isArray(m.tags)) {
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

    // Convert parameter count string (e.g. 11.8B, 421.29M) to raw numeric integer
    const numParamsRaw = this.parseParamValue(paramCount);
    let numParamsB = numParamsRaw ? (numParamsRaw / 1e9) : null;

    // Architecture identification
    let architecture = m.architecture || null;
    if (!architecture && m.tags && Array.isArray(m.tags)) {
      const archKeywords = [
        'gemma3', 'gemma2', 'gemma', 'llama3.3', 'llama3', 'llama2', 'llama',
        'deepseek_v3', 'deepseek_r1', 'deepseek', 'qwen2.5', 'qwen2_vl', 'qwen2', 'qwen',
        'bert', 'roberta', 'tapas', 'tabpfn', 'catboost', 'hist_gbm', 'xgboost',
        'resnet', 'flux', 'stable-diffusion', 'llava', 'clip', 'timestral', 't5'
      ];
      for (const kw of archKeywords) {
        if (m.tags.includes(kw) || m.tags.some(t => t.toLowerCase() === kw)) {
          architecture = kw;
          break;
        }
      }
    }
    if (!architecture) {
      const lowerId = m.id.toLowerCase();
      if (lowerId.includes('gemma-3') || lowerId.includes('gemma3')) architecture = 'gemma3';
      else if (lowerId.includes('gemma')) architecture = 'gemma';
      else if (lowerId.includes('llama-3') || lowerId.includes('llama3')) architecture = 'llama3';
      else if (lowerId.includes('llama')) architecture = 'llama';
      else if (lowerId.includes('deepseek-v3') || lowerId.includes('deepseek_v3')) architecture = 'deepseek_v3';
      else if (lowerId.includes('deepseek')) architecture = 'deepseek';
      else if (lowerId.includes('qwen2-vl') || lowerId.includes('qwen2_vl')) architecture = 'qwen2_vl';
      else if (lowerId.includes('qwen2') || lowerId.includes('qwen')) architecture = 'qwen2';
      else if (lowerId.includes('llava')) architecture = 'llava';
      else if (lowerId.includes('bert')) architecture = 'bert';
      else if (lowerId.includes('roberta')) architecture = 'roberta';
      else if (lowerId.includes('tapas')) architecture = 'tapas';
      else if (lowerId.includes('tabpfn')) architecture = 'tabpfn';
      else if (lowerId.includes('catboost')) architecture = 'catboost';
      else if (lowerId.includes('xgboost')) architecture = 'xgboost';
      else if (lowerId.includes('resnet')) architecture = 'resnet';
      else if (lowerId.includes('flux')) architecture = 'flux';
      else if (lowerId.includes('stable-diffusion') || lowerId.includes('sd3')) architecture = 'stable-diffusion';
      else if (lowerId.includes('timestral')) architecture = 'timestral';
      else if (lowerId.includes('t5') || lowerId.includes('chronos')) architecture = 't5';
      else architecture = m.config?.model_type || 'unspecified';
    }

    // Context Length (numerical integer tokens)
    let contextLength = (typeof m.contextLength === 'number' && !isNaN(m.contextLength)) ? m.contextLength : null;
    if (contextLength === null) {
      if (m.tags && Array.isArray(m.tags)) {
        if (m.tags.includes('128k') || m.tags.includes('131072')) contextLength = 131072;
        else if (m.tags.includes('32k') || m.tags.includes('32768')) contextLength = 32768;
        else if (m.tags.includes('8k') || m.tags.includes('8192')) contextLength = 8192;
        else if (m.tags.includes('4k') || m.tags.includes('4096')) contextLength = 4096;
      }
    }
    if (contextLength === null) {
      if (['gemma3', 'llama3', 'deepseek_v3', 'qwen2'].includes(architecture)) contextLength = 131072;
      else if (architecture === 'qwen2_vl') contextLength = 32768;
      else if (['llava', 'timestral', 'llama2'].includes(architecture)) contextLength = 4096;
      else if (architecture === 'tabpfn') contextLength = 1024;
      else if (['bert', 'roberta', 'tapas', 't5', 'flux', 'stable-diffusion'].includes(architecture)) contextLength = 512;
      else if (['catboost', 'xgboost'].includes(architecture)) contextLength = 256;
      else if (architecture === 'resnet') contextLength = 224;
    }

    // Embedding Length / Hidden Dimension (numerical integer)
    let embeddingLength = (typeof m.embeddingLength === 'number' && !isNaN(m.embeddingLength)) ? m.embeddingLength : null;
    if (embeddingLength === null) {
      if (architecture === 'gemma3') embeddingLength = (numParamsRaw && numParamsRaw >= 10e9) ? 3840 : 2560;
      else if (architecture === 'llama3' || architecture === 'llama2') embeddingLength = (numParamsRaw && numParamsRaw >= 60e9) ? 8192 : 4096;
      else if (architecture === 'deepseek_v3') embeddingLength = 7168;
      else if (architecture === 'qwen2') embeddingLength = (numParamsRaw && numParamsRaw >= 60e9) ? 8192 : 5120;
      else if (architecture === 'qwen2_vl') embeddingLength = 8192;
      else if (architecture === 'llava') embeddingLength = 5120;
      else if (['flux', 'stable-diffusion'].includes(architecture)) embeddingLength = 4096;
      else if (architecture === 'resnet') embeddingLength = 2048;
      else if (['bge-m3', 'timestral', 't5'].includes(architecture)) embeddingLength = 1024;
      else if (['bert', 'roberta', 'tapas'].includes(architecture)) embeddingLength = 768;
      else if (architecture === 'tabpfn') embeddingLength = 512;
      else if (m.id.includes('all-MiniLM')) embeddingLength = 384;
      else if (['catboost', 'xgboost'].includes(architecture)) embeddingLength = 128;
    }

    // Quantization
    let quantization = m.quantization || null;
    if (!quantization && m.tags && Array.isArray(m.tags)) {
      const qTag = m.tags.find(t => /^(q\d+_\w+|fp8|bf16|fp16|int8|int4|awq|gptq|gguf)$/i.test(t));
      if (qTag) quantization = qTag.toUpperCase();
    }
    if (!quantization) {
      if (['gemma3'].includes(architecture)) quantization = 'Q4_K_M';
      else if (['llama3', 'qwen2', 'qwen2_vl', 'flux', 'timestral'].includes(architecture)) quantization = 'BF16';
      else if (architecture === 'deepseek_v3') quantization = 'FP8';
      else if (['llava', 'stable-diffusion'].includes(architecture)) quantization = 'FP16';
      else quantization = 'FP32';
    }

    // Capabilities
    let capabilities = Array.isArray(m.capabilities) ? m.capabilities : null;
    if (!capabilities) {
      const caps = new Set();
      const pTag = m.pipeline_tag || '';
      const tags = m.tags || [];
      const lower = (pTag + ' ' + tags.join(' ') + ' ' + m.id).toLowerCase();

      if (lower.includes('vision') || lower.includes('image-text') || pTag === 'image-text-to-text' || architecture === 'gemma3' || architecture === 'llava' || architecture === 'qwen2_vl') {
        caps.add('vision');
      }
      if (pTag === 'text-generation' || pTag === 'image-text-to-text' || lower.includes('completion')) {
        caps.add('completion');
      }
      if (lower.includes('chat') || lower.includes('instruct') || lower.includes('conversational')) {
        caps.add('chat');
      }
      if (lower.includes('code') || lower.includes('sql') || lower.includes('coder')) {
        caps.add('code');
      }
      if (lower.includes('reasoning') || lower.includes('deepseek')) {
        caps.add('reasoning');
      }
      if (pTag === 'sentence-similarity' || pTag === 'feature-extraction' || lower.includes('embedding')) {
        caps.add('embedding');
      }
      if (lower.includes('tabular') || pTag.includes('tabular') || ['catboost', 'xgboost', 'tabpfn'].includes(architecture)) {
        caps.add('tabular');
      }
      if (lower.includes('time-series') || pTag.includes('forecasting')) {
        caps.add('forecasting');
      }
      if (lower.includes('text-to-image') || architecture === 'flux' || architecture === 'stable-diffusion') {
        caps.add('generation');
        caps.add('vision');
      }
      if (caps.size === 0) caps.add('general');
      capabilities = Array.from(caps);
    }

    // Multimodal Projector metadata (architecture, parameters, embeddingLength, dimensions)
    let projector = null;
    if (m.projector && typeof m.projector === 'object') {
      projector = {
        architecture: m.projector.architecture || 'clip',
        parameters: m.projector.parameters || '421.29M',
        numParamsRaw: this.parseParamValue(m.projector.parameters || '421.29M'),
        embeddingLength: Number(m.projector.embeddingLength || 1152),
        dimensions: Number(m.projector.dimensions || 3840)
      };
    } else if (capabilities.includes('vision') && (capabilities.includes('completion') || architecture === 'gemma3' || architecture === 'llava' || architecture === 'qwen2_vl')) {
      // Vision-Language models have projector architectures
      if (architecture === 'gemma3') {
        const pSize = (numParamsRaw && numParamsRaw >= 10e9) ? '421.29M' : '280.5M';
        const pDim = (numParamsRaw && numParamsRaw >= 10e9) ? 3840 : 2560;
        projector = {
          architecture: 'clip',
          parameters: pSize,
          numParamsRaw: this.parseParamValue(pSize),
          embeddingLength: 1152,
          dimensions: pDim
        };
      } else if (architecture === 'qwen2_vl') {
        projector = {
          architecture: 'spatial_conv',
          parameters: '675M',
          numParamsRaw: 675000000,
          embeddingLength: 1280,
          dimensions: 8192
        };
      } else if (architecture === 'llava') {
        projector = {
          architecture: 'mlp',
          parameters: '304M',
          numParamsRaw: 304000000,
          embeddingLength: 1024,
          dimensions: 5120
        };
      }
    }

    // Model Generation Parameters (top_p, temperature, top_k)
    let generationParams = null;
    if (m.generationParams && typeof m.generationParams === 'object') {
      generationParams = { ...m.generationParams };
    } else if (capabilities.includes('completion') || capabilities.includes('chat')) {
      generationParams = {
        top_p: 0.95,
        temperature: 1.0,
        top_k: 64
      };
    }

    // Author
    const author = m.id.includes('/') ? m.id.split('/')[0] : 'community';

    return {
      id: m.id,
      name: m.id.split('/').pop(),
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
      numParamsRaw: numParamsRaw,
      numParamsB: numParamsB,
      architecture: architecture,
      contextLength: contextLength,
      embeddingLength: embeddingLength,
      quantization: quantization,
      capabilities: capabilities,
      projector: projector,
      generationParams: generationParams,
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
    this.container = document.getElementById(this.containerId) || this.container;
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="container hf-board-shell">
        ${this.renderHeader()}
        ${this.renderSubheaderFilters()}
        ${this.renderDefinitionNote()}

        <main id="hf-main-content">
          ${this.state.mainTab === 'models' ? this.renderModelsTab() : this.renderLicensesTab()}
        </main>

        ${this.renderTrendingRails()}
        ${this.renderCompareTray()}
        ${this.renderCompareModal()}
        ${this.renderModelSpecModal()}
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
      <!-- Model Technical Specifications & Architecture Explorer -->
      ${this.renderModelSpecsExplorer(models)}

      <!-- Toolbar & Secondary Catalog Controls -->
      ${this.renderToolbar()}
      ${this.renderFilterPanel()}

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

  // --- MODEL TECHNICAL SPECIFICATIONS & ARCHITECTURE EXPLORER ---
  getSpecMetricConfig(metricKey) {
    const configs = {
      numParams: {
        id: 'numParams',
        label: 'Model Parameter Count',
        shortLabel: 'Model Parameters',
        unit: 'Parameters',
        axisTitle: 'Trainable Parameter Count',
        getValue: (m) => m.numParamsRaw,
        formatValue: (v, m) => m.paramCount || (v ? (v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(1) + 'M') : 'N/A'),
        description: 'Measures total trainable model weights normalized into raw numbers (e.g. 11.8B, 70B, 421.29M).'
      },
      contextLength: {
        id: 'contextLength',
        label: 'Context Window Length',
        shortLabel: 'Context Length',
        unit: 'Tokens',
        axisTitle: 'Context Length (Tokens)',
        getValue: (m) => m.contextLength,
        formatValue: (v) => v ? v.toLocaleString() + ' tokens' : 'N/A',
        description: 'Sequence token context length supported by attention layers (e.g. 131,072 tokens for Gemma 3).'
      },
      embeddingLength: {
        id: 'embeddingLength',
        label: 'Hidden Embedding Length',
        shortLabel: 'Embedding Dimension',
        unit: 'Dimensions',
        axisTitle: 'Embedding Dimensions',
        getValue: (m) => m.embeddingLength,
        formatValue: (v) => v ? v.toLocaleString() + ' dims' : 'N/A',
        description: 'Hidden state vector representation dimension size (e.g. 3,840 dims for Gemma 3 12B).'
      },
      projectorParams: {
        id: 'projectorParams',
        label: 'Projector Parameter Count',
        shortLabel: 'Projector Params',
        unit: 'Parameters',
        axisTitle: 'Projector Parameters (Count)',
        getValue: (m) => m.projector ? m.projector.numParamsRaw : null,
        formatValue: (v, m) => m.projector ? m.projector.parameters : 'N/A',
        description: 'Multimodal vision-language connector parameter count (e.g. CLIP 421.29M for Gemma 3). Text-only models omitted.'
      },
      projectorEmbedding: {
        id: 'projectorEmbedding',
        label: 'Projector Embedding Length',
        shortLabel: 'Projector Embedding',
        unit: 'Dimensions',
        axisTitle: 'Projector Embedding (Dims)',
        getValue: (m) => m.projector ? m.projector.embeddingLength : null,
        formatValue: (v, m) => m.projector ? m.projector.embeddingLength.toLocaleString() + ' dims' : 'N/A',
        description: 'Multimodal connector token embedding dimension (e.g. 1,152 dims for Gemma 3 CLIP projector).'
      },
      projectorDimensions: {
        id: 'projectorDimensions',
        label: 'Projector Hidden Dimensions',
        shortLabel: 'Projector Dimensions',
        unit: 'Dimensions',
        axisTitle: 'Projector Dimensions (Dims)',
        getValue: (m) => m.projector ? m.projector.dimensions : null,
        formatValue: (v, m) => m.projector ? m.projector.dimensions.toLocaleString() + ' dims' : 'N/A',
        description: 'Projector output hidden dimension matching backbone LLM (e.g. 3,840 dims for Gemma 3).'
      }
    };
    return configs[metricKey] || configs.numParams;
  }

  getEligibleSpecModels(models) {
    return models.filter(m => {
      if (this.state.specFilterArch !== 'all' && m.architecture !== this.state.specFilterArch) {
        return false;
      }
      if (this.state.specFilterCap !== 'all' && (!m.capabilities || !m.capabilities.includes(this.state.specFilterCap))) {
        return false;
      }
      if (this.state.specFilterQuant !== 'all' && m.quantization !== this.state.specFilterQuant) {
        return false;
      }
      return true;
    });
  }

  renderModelSpecsExplorer(models) {
    const metricCfg = this.getSpecMetricConfig(this.state.specMetric);
    const eligibleModels = this.getEligibleSpecModels(models);

    // Compute plotted vs excluded (without treating missing values as zero)
    const plottedModels = eligibleModels.filter(m => {
      const val = metricCfg.getValue(m);
      return val !== null && val !== undefined && !isNaN(val);
    });
    const excludedCount = eligibleModels.length - plottedModels.length;

    // Collect dynamic filter options
    const architectures = Array.from(new Set(models.map(m => m.architecture).filter(Boolean))).sort();
    const capabilities = Array.from(new Set(models.flatMap(m => m.capabilities || []))).sort();
    const quantizations = Array.from(new Set(models.map(m => m.quantization).filter(Boolean))).sort();

    const metricPills = [
      { id: 'numParams', label: 'Model Parameters', icon: 'fa-cube' },
      { id: 'contextLength', label: 'Context Length', icon: 'fa-arrows-left-right' },
      { id: 'embeddingLength', label: 'Embedding Dimension', icon: 'fa-diagram-project' },
      { id: 'projectorParams', label: 'Projector Parameters', icon: 'fa-microchip' },
      { id: 'projectorEmbedding', label: 'Projector Embedding', icon: 'fa-network-wired' },
      { id: 'projectorDimensions', label: 'Projector Dimensions', icon: 'fa-vector-square' }
    ];

    return `
      <section class="hf-spec-explorer-card" id="hf-spec-explorer-section" aria-label="Model Technical Specifications and Architecture Explorer">
        <div class="hf-spec-header-row">
          <div class="hf-spec-title-group">
            <h3>
              <i class="fa-solid fa-microchip" style="color: var(--hf-accent-blue);"></i>
              Model Technical Specifications &amp; Architecture Explorer
              <span class="hf-spec-badge">Gemma 3 Schema Verified</span>
            </h3>
            <p class="hf-spec-description">
              Interactive technical comparison across model parameters, context window lengths, embedding dimensions, multimodal projector configurations, and generation hyperparameters.
            </p>
          </div>
          <div class="hf-chart-tools">
            <button class="hf-btn-tool" data-toggle-table="chart-model-specs" title="Toggle Table View" aria-label="Toggle Table View">
              <i class="fa-solid fa-table"></i>
            </button>
            <button class="hf-btn-tool" data-export-png="chart-model-specs" title="Export Specifications Chart as PNG" aria-label="Export PNG">
              <i class="fa-solid fa-download"></i>
            </button>
          </div>
        </div>

        <!-- Controls: Metric Selector & Filters -->
        <div class="hf-spec-controls">
          <div class="hf-spec-metric-row">
            <span class="hf-spec-control-label">Y-Axis Metric:</span>
            <div class="hf-spec-metric-pills">
              ${metricPills.map(p => `
                <button class="hf-spec-metric-btn ${this.state.specMetric === p.id ? 'active' : ''}" 
                        data-spec-metric="${p.id}"
                        type="button"
                        aria-pressed="${this.state.specMetric === p.id}">
                  <i class="fa-solid ${p.icon}"></i> ${p.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="hf-spec-filters-row">
            <div class="hf-spec-filter-item">
              <label for="hf-spec-filter-arch">Architecture:</label>
              <select class="hf-spec-filter-select" id="hf-spec-filter-arch">
                <option value="all" ${this.state.specFilterArch === 'all' ? 'selected' : ''}>All Architectures (${architectures.length})</option>
                ${architectures.map(arch => `
                  <option value="${arch}" ${this.state.specFilterArch === arch ? 'selected' : ''}>${arch}</option>
                `).join('')}
              </select>
            </div>

            <div class="hf-spec-filter-item">
              <label for="hf-spec-filter-cap">Capability:</label>
              <select class="hf-spec-filter-select" id="hf-spec-filter-cap">
                <option value="all" ${this.state.specFilterCap === 'all' ? 'selected' : ''}>All Capabilities (${capabilities.length})</option>
                ${capabilities.map(cap => `
                  <option value="${cap}" ${this.state.specFilterCap === cap ? 'selected' : ''}>${cap}</option>
                `).join('')}
              </select>
            </div>

            <div class="hf-spec-filter-item">
              <label for="hf-spec-filter-quant">Quantization:</label>
              <select class="hf-spec-filter-select" id="hf-spec-filter-quant">
                <option value="all" ${this.state.specFilterQuant === 'all' ? 'selected' : ''}>All Precision / Quants (${quantizations.length})</option>
                ${quantizations.map(quant => `
                  <option value="${quant}" ${this.state.specFilterQuant === quant ? 'selected' : ''}>${quant}</option>
                `).join('')}
              </select>
            </div>

            <div class="hf-spec-filter-item">
              <label for="hf-spec-sort-dir">Order:</label>
              <select class="hf-spec-filter-select" id="hf-spec-sort-dir">
                <option value="desc" ${this.state.specSortDir === 'desc' ? 'selected' : ''}>Highest First &darr;</option>
                <option value="asc" ${this.state.specSortDir === 'asc' ? 'selected' : ''}>Lowest First &uarr;</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Metric Summary & Guidance Note -->
        <div class="hf-spec-metric-summary" role="status">
          <div class="hf-spec-metric-desc">
            <i class="fa-solid fa-circle-info" style="color: var(--hf-accent-blue);"></i>
            <span><strong>${metricCfg.label} (${metricCfg.unit}):</strong> ${metricCfg.description}</span>
          </div>
          <div>
            ${excludedCount > 0 ? `
              <span class="hf-spec-excluded-pill" title="Missing or non-applicable values are excluded from the axis to prevent false zero representations.">
                Showing ${plottedModels.length} of ${eligibleModels.length} models (${excludedCount} excluded: no published / applicable ${metricCfg.shortLabel})
              </span>
            ` : `
              <span class="hf-spec-excluded-pill" style="color: var(--hf-accent-blue); background: rgba(2, 132, 199, 0.1); border-color: rgba(2, 132, 199, 0.25);">
                All ${plottedModels.length} models have verified ${metricCfg.shortLabel}
              </span>
            `}
          </div>
        </div>

        <!-- Chart Viewport -->
        <div id="chart-model-specs" class="hf-spec-chart-viewport"></div>
        <div id="table-chart-model-specs" class="hf-table-fallback">
          ${this.renderModelSpecsTableFallback(plottedModels)}
        </div>

        <!-- Metadata Table Below Chart -->
        ${this.renderModelSpecsTable(eligibleModels)}
      </section>
    `;
  }

  renderModelSpecsTableFallback(models) {
    const metricCfg = this.getSpecMetricConfig(this.state.specMetric);
    return `
      <table class="hf-fallback-table" summary="Model Specifications benchmark table for ${metricCfg.label}">
        <thead>
          <tr>
            <th>Model ID</th>
            <th>Architecture</th>
            <th>${metricCfg.label}</th>
            <th>Quantization</th>
            <th>Capabilities</th>
          </tr>
        </thead>
        <tbody>
          ${models.map(m => {
            const val = metricCfg.getValue(m);
            return `
              <tr>
                <td>${m.id}</td>
                <td>${m.architecture}</td>
                <td>${metricCfg.formatValue(val, m)}</td>
                <td>${m.quantization || 'N/A'}</td>
                <td>${(m.capabilities || []).join(', ')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderModelSpecsTable(models) {
    return `
      <div class="hf-spec-table-wrapper">
        <div class="hf-spec-table-header">
          <h4>
            <i class="fa-solid fa-table-list" style="color: var(--hf-accent-blue);"></i>
            Model Technical Specifications Registry (${models.length} Models)
          </h4>
          <span style="font-size: 0.8rem; color: var(--hf-text-muted);">
            Click <strong>Inspect</strong> to view complete technical dossier
          </span>
        </div>

        <div class="hf-spec-table-card">
          <table class="hf-spec-table">
            <thead>
              <tr>
                <th>Model Identifier</th>
                <th>Architecture</th>
                <th>Parameters</th>
                <th>Context Length</th>
                <th>Embedding Dim</th>
                <th>Quantization</th>
                <th>Capabilities</th>
                <th>Multimodal Projector</th>
                <th>Generation Parameters</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${models.map(m => {
                const archClass = ['gemma', 'llama', 'deepseek', 'qwen'].find(k => m.architecture?.toLowerCase().includes(k)) || '';
                return `
                  <tr>
                    <td>
                      <strong>${m.name || m.id.split('/').pop()}</strong><br>
                      <small style="color: var(--hf-text-muted);">${m.author}</small>
                    </td>
                    <td>
                      <span class="hf-arch-badge ${archClass}">${m.architecture || 'unspecified'}</span>
                    </td>
                    <td>
                      <strong title="${m.numParamsRaw ? m.numParamsRaw.toLocaleString() + ' trainable weights' : 'Unspecified'}">
                        ${m.paramCount || 'n/r'}
                      </strong>
                    </td>
                    <td>
                      ${m.contextLength ? `${m.contextLength.toLocaleString()} tokens` : '<span style="color: var(--hf-text-subtle);">N/A</span>'}
                    </td>
                    <td>
                      ${m.embeddingLength ? `${m.embeddingLength.toLocaleString()} dims` : '<span style="color: var(--hf-text-subtle);">N/A</span>'}
                    </td>
                    <td>
                      <span class="hf-quant-badge ${m.quantization && m.quantization !== 'FP32' ? 'quantized' : ''}">
                        ${m.quantization || 'FP32'}
                      </span>
                    </td>
                    <td>
                      ${(m.capabilities || []).map(c => `
                        <span class="hf-cap-pill ${c}">${c}</span>
                      `).join('')}
                    </td>
                    <td>
                      ${m.projector ? `
                        <span class="hf-badge" style="font-size: 0.72rem; background: rgba(2, 132, 199, 0.08); border-color: rgba(2, 132, 199, 0.25);" title="Arch: ${m.projector.architecture}, Params: ${m.projector.parameters}, Embed: ${m.projector.embeddingLength}, Dim: ${m.projector.dimensions}">
                          ${m.projector.architecture} • ${m.projector.parameters}
                        </span>
                      ` : '<span style="color: var(--hf-text-subtle); font-size: 0.78rem;">N/A (Text / Dense)</span>'}
                    </td>
                    <td>
                      ${m.generationParams ? `
                        <span class="hf-param-chip" title="top_p">p:${m.generationParams.top_p}</span>
                        <span class="hf-param-chip" title="temperature">t:${m.generationParams.temperature}</span>
                        ${m.generationParams.top_k ? `<span class="hf-param-chip" title="top_k">k:${m.generationParams.top_k}</span>` : ''}
                      ` : '<span style="color: var(--hf-text-subtle); font-size: 0.78rem;">N/A</span>'}
                    </td>
                    <td style="text-align: right;">
                      <button class="hf-btn-inspect" data-inspect-id="${m.id}" aria-label="Inspect ${m.id} specifications">
                        <i class="fa-solid fa-magnifying-glass-chart"></i> Inspect
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderModelSpecsChart() {
    const div = document.getElementById('chart-model-specs');
    if (!div || !window.Plotly) return;

    const metricCfg = this.getSpecMetricConfig(this.state.specMetric);
    const eligibleModels = this.getEligibleSpecModels(this.getFilteredModels());

    // Filter out missing values (DO NOT treat missing values as zero)
    const plotted = eligibleModels.filter(m => {
      const val = metricCfg.getValue(m);
      return val !== null && val !== undefined && !isNaN(val);
    });

    if (plotted.length === 0) {
      div.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--hf-text-muted); font-size: 0.95rem;">
          <i class="fa-solid fa-circle-exclamation" style="margin-right: 0.5rem;"></i>
          No models in the current selection have valid ${metricCfg.label} metadata. Select another metric or loosen filters.
        </div>
      `;
      return;
    }

    // Sort models
    plotted.sort((a, b) => {
      const valA = metricCfg.getValue(a);
      const valB = metricCfg.getValue(b);
      return this.state.specSortDir === 'asc' ? (valA - valB) : (valB - valA);
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const mutedColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';

    const archColorMap = {
      gemma3: '#0284c7',
      gemma: '#0284c7',
      llama3: '#2563eb',
      llama2: '#1d4ed8',
      llama: '#2563eb',
      deepseek_v3: '#0d9488',
      deepseek: '#0d9488',
      qwen2: '#d97706',
      qwen2_vl: '#ea580c',
      qwen: '#d97706',
      llava: '#7c3aed',
      flux: '#e11d48',
      'stable-diffusion': '#ec4899',
      resnet: '#059669',
      bert: '#475569',
      roberta: '#475569',
      tapas: '#3b82f6',
      tabpfn: '#10b981',
      catboost: '#84cc16',
      xgboost: '#eab308',
      timestral: '#8b5cf6',
      t5: '#6366f1'
    };

    const names = plotted.map(m => m.name || m.id.split('/').pop());
    const values = plotted.map(m => metricCfg.getValue(m));
    const colors = plotted.map(m => archColorMap[m.architecture] || '#0284c7');
    const borderColors = plotted.map(m => archColorMap[m.architecture] || '#0369a1');

    const customdata = plotted.map(m => [
      m.id,
      m.author,
      metricCfg.unit,
      m.architecture,
      m.quantization,
      (m.capabilities || []).join(', '),
      m.projector ? `${m.projector.architecture} (${m.projector.parameters}) [embed ${m.projector.embeddingLength}, dim ${m.projector.dimensions}]` : 'None (Text / Dense)',
      m.generationParams ? `top_p=${m.generationParams.top_p}, temp=${m.generationParams.temperature}, top_k=${m.generationParams.top_k || 'n/a'}` : 'N/A',
      metricCfg.formatValue(metricCfg.getValue(m), m)
    ]);

    const data = [{
      type: 'bar',
      x: names,
      y: values,
      marker: {
        color: colors,
        line: { color: borderColors, width: 1.5 }
      },
      customdata: customdata,
      hovertemplate:
        '<b>%{customdata[0]}</b> (%{customdata[1]})<br>' +
        '<b>' + metricCfg.label + ':</b> %{customdata[8]} (%{y:,.0f} %{customdata[2]})<br>' +
        'Architecture: <b>%{customdata[3]}</b> | Quantization: <b>%{customdata[4]}</b><br>' +
        'Capabilities: <i>%{customdata[5]}</i><br>' +
        'Projector: <i>%{customdata[6]}</i><br>' +
        'Generation Parameters: %{customdata[7]}<br>' +
        '<i>(Click bar to inspect full model specification)</i>' +
        '<extra></extra>'
    }];

    const layout = {
      margin: { l: 75, r: 25, t: 30, b: 90 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      xaxis: {
        title: { text: 'Hugging Face Model', font: { family: 'Inter, sans-serif', size: 12, color: textColor } },
        tickangle: -28,
        automargin: true,
        tickfont: { family: 'Inter, sans-serif', size: 11, color: mutedColor },
        gridcolor: 'transparent'
      },
      yaxis: {
        title: { text: `${metricCfg.label} (${metricCfg.unit})`, font: { family: 'Inter, sans-serif', size: 12, color: textColor } },
        gridcolor: gridColor,
        tickfont: { family: 'Inter, sans-serif', size: 11, color: mutedColor },
        automargin: true
      },
      font: { family: 'Inter, sans-serif', size: 11, color: mutedColor }
    };

    window.Plotly.newPlot(div, data, layout, { responsive: true, displayModeBar: false }).then(() => {
      if (div.removeAllListeners) {
        div.removeAllListeners('plotly_click');
      }
      div.on('plotly_click', (eventData) => {
        if (eventData.points && eventData.points[0]) {
          const clickedId = eventData.points[0].customdata[0];
          this.openModelSpecModal(clickedId);
        }
      });
    });
  }

  renderModelSpecModal() {
    return `
      <div class="hf-modal-backdrop" id="hf-spec-modal" role="dialog" aria-modal="true" aria-labelledby="hf-spec-modal-title">
        <div class="hf-modal-content" style="max-width: 920px;">
          <button class="hf-modal-close" id="hf-close-spec-modal" aria-label="Close modal">&times;</button>
          <div id="hf-spec-modal-container">
            ${this.renderModelSpecModalContent()}
          </div>
        </div>
      </div>
    `;
  }

  renderModelSpecModalContent() {
    const m = this.state.models.find(item => item.id === this.state.inspectedModelId) || this.state.models[0];
    if (!m) {
      return `<p>No model selected for technical inspection.</p>`;
    }

    const archClass = ['gemma', 'llama', 'deepseek', 'qwen'].find(k => m.architecture?.toLowerCase().includes(k)) || '';
    const ctxPercent = m.contextLength ? Math.min(100, Math.round((m.contextLength / 131072) * 100)) : 0;

    return `
      <div class="hf-spec-modal-header">
        <div>
          <span class="hf-author-tag">${m.author}</span>
          ${m.gated ? `<span class="hf-gated-badge" style="margin-left: 0.5rem;">GATED</span>` : ''}
          <h2 id="hf-spec-modal-title" style="font-family: var(--hf-font-display); font-size: 1.5rem; margin: 0.35rem 0 0.2rem 0; color: var(--hf-text-main);">
            ${m.id}
          </h2>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem;">
            <span class="hf-badge hf-badge-task">${m.pipeline_tag}</span>
            <span class="hf-badge">${m.library_name}</span>
            <span class="hf-badge hf-badge-license">${m.license}</span>
          </div>
        </div>
        <div>
          <a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener" class="hf-btn-tool" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;">
            View on Hugging Face Hub <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>

      <div class="hf-spec-modal-body">
        <div class="hf-spec-dossier-grid">
          <!-- Card 1: Core Architecture & Parameters -->
          <div class="hf-spec-dossier-box">
            <h4><i class="fa-solid fa-cube" style="color: var(--hf-accent-blue);"></i> Core Architecture &amp; Weights</h4>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Architecture</span>
              <span class="hf-arch-badge ${archClass}">${m.architecture}</span>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Parameter Scale</span>
              <span class="hf-spec-dossier-val">${m.paramCount}</span>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Trainable Weights</span>
              <span class="hf-spec-dossier-val">${m.numParamsRaw ? m.numParamsRaw.toLocaleString() : 'Unspecified'}</span>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Quantization / Precision</span>
              <span class="hf-quant-badge quantized">${m.quantization}</span>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Runtime Engine</span>
              <span class="hf-spec-dossier-val">${m.library_name}</span>
            </div>
          </div>

          <!-- Card 2: Context Window & Representation -->
          <div class="hf-spec-dossier-box">
            <h4><i class="fa-solid fa-arrows-left-right" style="color: var(--hf-accent-teal);"></i> Context &amp; Representations</h4>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Context Window</span>
              <span class="hf-spec-dossier-val">${m.contextLength ? m.contextLength.toLocaleString() + ' tokens' : 'N/A'}</span>
            </div>
            <div style="margin: 0.4rem 0;">
              <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--hf-text-muted); margin-bottom: 3px;">
                <span>Token Scale vs 128k Baseline</span>
                <span>${ctxPercent}%</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(148, 163, 184, 0.25); border-radius: 9999px; overflow: hidden;">
                <div style="width: ${ctxPercent}%; height: 100%; background: var(--hf-accent-teal); border-radius: 9999px;"></div>
              </div>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">Embedding Dimensions</span>
              <span class="hf-spec-dossier-val">${m.embeddingLength ? m.embeddingLength.toLocaleString() + ' dims' : 'N/A'}</span>
            </div>
            <div class="hf-spec-dossier-row">
              <span class="hf-spec-dossier-label">SPDX License</span>
              <span class="hf-spec-dossier-val">${m.license}</span>
            </div>
          </div>

          <!-- Card 3: Multimodal Projector Specifications -->
          <div class="hf-spec-dossier-box" style="grid-column: 1 / -1;">
            <h4><i class="fa-solid fa-microchip" style="color: var(--hf-accent-amber);"></i> Multimodal Projector Specifications</h4>
            ${m.projector ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 0.5rem;">
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">Projector Architecture</span>
                  <span class="hf-arch-badge" style="background: rgba(217, 119, 6, 0.12); color: #d97706; border-color: rgba(217, 119, 6, 0.3);">
                    ${m.projector.architecture.toUpperCase()}
                  </span>
                </div>
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">Projector Parameters</span>
                  <span class="hf-spec-dossier-val">${m.projector.parameters} (${m.projector.numParamsRaw ? m.projector.numParamsRaw.toLocaleString() : 'N/A'} weights)</span>
                </div>
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">Projector Embedding Length</span>
                  <span class="hf-spec-dossier-val">${m.projector.embeddingLength.toLocaleString()} dims</span>
                </div>
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">Projector Dimensions</span>
                  <span class="hf-spec-dossier-val">${m.projector.dimensions.toLocaleString()} dims</span>
                </div>
              </div>
            ` : `
              <p style="margin: 0.5rem 0 0 0; font-size: 0.84rem; color: var(--hf-text-muted);">
                <i class="fa-solid fa-circle-check" style="color: var(--hf-accent-teal);"></i>
                Text / Dense Representation Foundation Model — No multimodal visual projector attached.
              </p>
            `}
          </div>

          <!-- Card 4: Model Generation Parameters -->
          <div class="hf-spec-dossier-box">
            <h4><i class="fa-solid fa-sliders" style="color: var(--hf-accent-purple);"></i> Generation Hyperparameters</h4>
            ${m.generationParams ? `
              <div class="hf-spec-dossier-row">
                <span class="hf-spec-dossier-label">top_p</span>
                <span class="hf-spec-dossier-val">${m.generationParams.top_p ?? 'default'}</span>
              </div>
              <div class="hf-spec-dossier-row">
                <span class="hf-spec-dossier-label">temperature</span>
                <span class="hf-spec-dossier-val">${m.generationParams.temperature ?? 'default'}</span>
              </div>
              <div class="hf-spec-dossier-row">
                <span class="hf-spec-dossier-label">top_k</span>
                <span class="hf-spec-dossier-val">${m.generationParams.top_k ?? 'default'}</span>
              </div>
              ${m.generationParams.steps ? `
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">diffusion steps</span>
                  <span class="hf-spec-dossier-val">${m.generationParams.steps}</span>
                </div>
              ` : ''}
              ${m.generationParams.guidance !== undefined ? `
                <div class="hf-spec-dossier-row">
                  <span class="hf-spec-dossier-label">guidance scale</span>
                  <span class="hf-spec-dossier-val">${m.generationParams.guidance}</span>
                </div>
              ` : ''}
            ` : `
              <p style="margin: 0.5rem 0 0 0; font-size: 0.84rem; color: var(--hf-text-muted);">
                Non-generative pipeline (Embedding / Classifier / Tabular).
              </p>
            `}
          </div>

          <!-- Card 5: Supported Capabilities & Tags -->
          <div class="hf-spec-dossier-box">
            <h4><i class="fa-solid fa-tags" style="color: var(--hf-accent-rose);"></i> Capabilities &amp; Hub Tags</h4>
            <div style="margin-bottom: 0.75rem;">
              <span class="hf-spec-dossier-label" style="display: block; margin-bottom: 0.35rem;">Capabilities:</span>
              ${(m.capabilities || []).map(c => `
                <span class="hf-cap-pill ${c}">${c}</span>
              `).join('')}
            </div>
            <div>
              <span class="hf-spec-dossier-label" style="display: block; margin-bottom: 0.35rem;">Repository Tags:</span>
              <div style="display: flex; flex-wrap: wrap; gap: 0.3rem; max-height: 90px; overflow-y: auto;">
                ${(m.tags || []).slice(0, 16).map(t => `
                  <span class="hf-badge" style="font-size: 0.7rem;">${t}</span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  openModelSpecModal(modelId) {
    this.state.inspectedModelId = modelId;
    const modal = document.getElementById('hf-spec-modal');
    if (!modal) return;
    const container = document.getElementById('hf-spec-modal-container');
    if (container) {
      container.innerHTML = this.renderModelSpecModalContent();
    }
    modal.classList.add('open');
  }

  closeModelSpecModal() {
    this.state.inspectedModelId = null;
    const modal = document.getElementById('hf-spec-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  // --- CHART RENDERING ENGINE (Plotly.js + Accessible Table Fallbacks) ---
  renderCharts() {
    if (!window.Plotly) {
      console.warn('Plotly.js not available; table fallbacks active.');
      return;
    }

    if (this.state.mainTab === 'models') {
      this.renderModelSpecsChart();
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

    // Model Specification Metric Selector Pills
    document.querySelectorAll('[data-spec-metric]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const metric = e.currentTarget.getAttribute('data-spec-metric');
        this.state.specMetric = metric;
        this.render();
      });
    });

    // Model Specification Filters
    document.getElementById('hf-spec-filter-arch')?.addEventListener('change', (e) => {
      this.state.specFilterArch = e.target.value;
      this.render();
    });

    document.getElementById('hf-spec-filter-cap')?.addEventListener('change', (e) => {
      this.state.specFilterCap = e.target.value;
      this.render();
    });

    document.getElementById('hf-spec-filter-quant')?.addEventListener('change', (e) => {
      this.state.specFilterQuant = e.target.value;
      this.render();
    });

    document.getElementById('hf-spec-sort-dir')?.addEventListener('change', (e) => {
      this.state.specSortDir = e.target.value;
      this.render();
    });

    // Inspect Model Buttons (opens deep technical dossier modal)
    document.querySelectorAll('[data-inspect-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-inspect-id');
        this.openModelSpecModal(id);
      });
    });

    // Close Model Specification Modal
    document.getElementById('hf-close-spec-modal')?.addEventListener('click', () => {
      this.closeModelSpecModal();
    });

    // Close Model Specification Modal on backdrop click
    document.getElementById('hf-spec-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'hf-spec-modal') {
        this.closeModelSpecModal();
      }
    });
  }

  bindGlobalEvents() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.getElementById('hf-compare-modal')?.classList.remove('open');
          this.closeModelSpecModal();
          const box = document.getElementById('hf-suggestions-box');
          if (box) box.style.display = 'none';
        }
      });
    }
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
