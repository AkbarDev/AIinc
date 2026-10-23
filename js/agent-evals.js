/**
 * AgentEvals: AI Agent Rankings & Benchmark Evaluations Explorer
 * SnapFacts (snapfacts.in)
 * 
 * Interactive board ranking AI agents (coding, personal/productivity, creative, entertainment)
 * by usage telemetry (OpenRouter gateway volume, GitHub proxies, package downloads)
 * and evaluation benchmarks (SWE-bench, BFCL V4, Terminal-Bench, Aider Polyglot, LMSYS Arena).
 */

class AgentEvals {
  constructor(containerId = 'agent-evals-container') {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    this.state = {
      agents: [],
      harnessModelMatrix: [],
      config: null,
      activeTab: 'rankings', // 'rankings' | 'evals' | 'harness'
      timeHorizon: '7d', // 'today' | '7d' | '30d' | 'all'
      selectedCategory: 'all', // 'all' | 'coding' | 'productivity' | 'creative' | 'entertainment'
      selectedLicense: 'all', // 'all' | 'open-source' | 'proprietary'
      searchQuery: '',
      sortField: 'usage',
      sortDir: 'desc',
      currentPage: 1,
      pageSize: 10,
      compareList: [], // Array of agent IDs (max 4)
      activeInspectId: null,
      showCompareModal: false,
      status: 'cached', // 'live' | 'cached' | 'offline'
      lastRefreshed: new Date().toLocaleTimeString(),
      chartVisibleTables: {}
    };

    this.init();
  }

  async init() {
    this.readUrlState();
    
    // 1. Immediately hydrate from cache snapshot for 0ms latency
    await this.loadFallbackCache();
    this.render();

    // 2. Background refresh telemetry
    this.fetchLiveTelemetry().catch(err => {
      console.warn('AgentEvals background refresh defaulted:', err);
    });
  }

  readUrlState() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')) this.state.activeTab = params.get('tab');
      if (params.get('time')) this.state.timeHorizon = params.get('time');
      if (params.get('cat')) this.state.selectedCategory = params.get('cat');
      if (params.get('q')) this.state.searchQuery = params.get('q');
      if (params.get('compare')) {
        this.state.compareList = params.get('compare').split(',').slice(0, 4);
      }
    } catch (e) {
      console.warn('URL state parsing error:', e);
    }
  }

  syncUrlState() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('category', 'agentevals');
      url.searchParams.set('tab', this.state.activeTab);
      url.searchParams.set('time', this.state.timeHorizon);
      if (this.state.selectedCategory !== 'all') {
        url.searchParams.set('cat', this.state.selectedCategory);
      } else {
        url.searchParams.delete('cat');
      }
      if (this.state.searchQuery) {
        url.searchParams.set('q', this.state.searchQuery);
      } else {
        url.searchParams.delete('q');
      }
      if (this.state.compareList.length > 0) {
        url.searchParams.set('compare', this.state.compareList.join(','));
      } else {
        url.searchParams.delete('compare');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Failed to sync URL state:', e);
    }
  }

  async loadFallbackCache() {
    try {
      const res = await fetch('./data/agent_evals_cache.json?v=20261023_1');
      if (res.ok) {
        const data = await res.json();
        this.state.agents = data.agents || [];
        this.state.harnessModelMatrix = data.harnessModelMatrix || [];
        this.state.status = 'cached';
        this.state.lastRefreshed = new Date(data.metadata?.timestamp || Date.now()).toLocaleTimeString();
        return;
      }
    } catch (err) {
      console.warn('Using embedded emergency fallback:', err);
    }

    // Emergency embedded fallback if fetch fails
    this.state.agents = this.getEmbeddedFallbackAgents();
    this.state.harnessModelMatrix = this.getEmbeddedFallbackMatrix();
  }

  async fetchLiveTelemetry() {
    // In production, polls the ingestion endpoint or re-validates cache
    try {
      const res = await fetch('./data/agent_evals_cache.json?ts=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        this.state.agents = data.agents || [];
        this.state.harnessModelMatrix = data.harnessModelMatrix || [];
        this.state.status = 'live';
        this.state.lastRefreshed = new Date().toLocaleTimeString();
        this.render();
      }
    } catch (e) {
      console.info('Live telemetry check complete; keeping cached snapshot.');
    }
  }

  // --- RENDERING PIPELINE ---
  render() {
    this.container = document.getElementById(this.containerId) || this.container;
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="ae-shell">
        ${this.renderHeader()}
        ${this.renderDisclaimerBanner()}
        ${this.renderMainTabs()}

        <main id="ae-main-content">
          ${this.state.activeTab === 'rankings' ? this.renderRankingsView() : ''}
          ${this.state.activeTab === 'evals' ? this.renderEvalsView() : ''}
          ${this.state.activeTab === 'harness' ? this.renderHarnessView() : ''}
        </main>

        ${this.renderCompareTray()}
        ${this.renderCompareModal()}
        ${this.renderInspectModal()}
      </div>
    `;

    this.bindEvents();
    if (this.state.activeTab === 'evals') {
      this.renderCharts();
    }
  }

  renderHeader() {
    const statusClass = this.state.status === 'live' ? 'ae-status-live' : (this.state.status === 'cached' ? 'ae-status-cached' : 'ae-status-offline');
    const statusText = this.state.status === 'live' ? '🟢 Live Ingestion' : (this.state.status === 'cached' ? '🟡 Cached Snapshot' : '⚪ Offline Fallback');

    return `
      <header class="ae-header">
        <div class="ae-header-top">
          <div class="ae-title-group">
            <h2>
              <i class="fa-solid fa-robot" style="color: var(--ae-primary);"></i>
              AgentEvals
              <span class="ae-title-badge">AI Agent Telemetry &amp; Evals</span>
            </h2>
            <p class="ae-subtitle">
              Comprehensive ranking of coding agents, productivity assistants, CLI tools, and autonomous scaffolds by real-world usage and rigorous empirical benchmarks.
            </p>
          </div>
          <div class="ae-status-cluster">
            <span class="ae-status-pill ${statusClass}" title="Telemetry feed status">
              ${statusText}
            </span>
            <span style="font-size: 0.78rem; color: var(--ae-text-muted);">
              Updated: ${this.state.lastRefreshed}
            </span>
            <button class="ae-refresh-btn" id="ae-refresh-btn" type="button" title="Refresh Telemetry">
              <i class="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
            <button class="ae-refresh-btn" id="ae-export-csv-btn" type="button" title="Export Agent Rankings as CSV">
              <i class="fa-solid fa-file-csv"></i> Export CSV
            </button>
          </div>
        </div>
      </header>
    `;
  }

  renderDisclaimerBanner() {
    return `
      <div class="ae-disclaimer-box" role="note">
        <i class="fa-solid fa-shield-halved" style="color: var(--ae-primary); font-size: 1.1rem; margin-top: 0.1rem;"></i>
        <div>
          <strong>Usage &amp; Benchmark Provenance Notice:</strong>
          OpenRouter usage metrics represent <em>OpenRouter gateway traffic only, not total market use</em> (local IDE and offline CLI usage are tracked via transparent public proxies like GitHub stars, releases, and editor marketplace installs). Missing evaluation metrics are strictly designated as <code>n/r</code> (not reported) and are never extrapolated. Evaluation data courtesy of Epoch AI Benchmarking Hub (CC-BY 4.0), SWE-bench (Princeton NLP), UC Berkeley Gorilla BFCL V4, and LMSYS Agent Arena.
        </div>
      </div>
    `;
  }

  renderMainTabs() {
    return `
      <nav class="ae-main-tabs" role="tablist" aria-label="AgentEvals Sections">
        <button class="ae-tab-btn ${this.state.activeTab === 'rankings' ? 'active' : ''}" 
                data-tab-switch="rankings" role="tab" aria-selected="${this.state.activeTab === 'rankings'}">
          <i class="fa-solid fa-trophy"></i> Rankings &amp; Usage
        </button>
        <button class="ae-tab-btn ${this.state.activeTab === 'evals' ? 'active' : ''}" 
                data-tab-switch="evals" role="tab" aria-selected="${this.state.activeTab === 'evals'}">
          <i class="fa-solid fa-chart-line"></i> Benchmark Evals &amp; Matrix
        </button>
        <button class="ae-tab-btn ${this.state.activeTab === 'harness' ? 'active' : ''}" 
                data-tab-switch="harness" role="tab" aria-selected="${this.state.activeTab === 'harness'}">
          <i class="fa-solid fa-cubes"></i> Harness vs Model Matrix
        </button>
      </nav>
    `;
  }

  // ==========================================================================
  // VIEW 1: RANKINGS & USAGE
  // ==========================================================================
  renderRankingsView() {
    return `
      <!-- 1. Top 3 Hero Cards -->
      ${this.renderTop3HeroCards()}

      <!-- 2. Trending Strip -->
      ${this.renderTrendingStrip()}

      <!-- 3. Category Sections -->
      ${this.renderCategorySections()}

      <!-- 4. Global Ranking Table -->
      ${this.renderGlobalRankingSection()}
    `;
  }

  renderTop3HeroCards() {
    const top3 = this.getSortedAgentsByTime(this.state.timeHorizon).slice(0, 3);
    if (!top3.length) return '';

    const rankPills = ['gold', 'silver', 'bronze'];
    const rankTitles = ['#1 Ranked Agent', '#2 Ranked Agent', '#3 Ranked Agent'];

    return `
      <section class="ae-hero-grid" aria-label="Top 3 Ranked AI Agents">
        ${top3.map((agent, idx) => {
          const initials = agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const headlineVal = agent.headlineMetric?.value || this.formatMetricVal(agent);
          const headlineLabel = agent.headlineMetric?.label || 'Gateway Volume';

          return `
            <article class="ae-hero-card rank-${idx + 1}">
              <div>
                <div class="ae-hero-badge-row">
                  <span class="ae-rank-pill ${rankPills[idx]}">
                    <i class="fa-solid fa-crown"></i> ${rankTitles[idx]}
                  </span>
                  <span class="ae-category-tag">${agent.category}</span>
                </div>

                <div class="ae-hero-content">
                  <h3 class="ae-hero-name">
                    <span class="ae-avatar-initials">${initials}</span>
                    <span>${agent.name}</span>
                  </h3>
                  <p class="ae-hero-desc">${agent.headline}</p>
                </div>
              </div>

              <div>
                <div class="ae-hero-metric-box">
                  <div>
                    <div class="ae-metric-label">${headlineLabel}</div>
                    <div class="ae-metric-val">${headlineVal}</div>
                  </div>
                  ${agent.usage?.growthRate7d ? `
                    <span class="ae-growth-pill">
                      <i class="fa-solid fa-arrow-trend-up"></i> +${agent.usage.growthRate7d}%
                    </span>
                  ` : ''}
                </div>

                <div class="ae-hero-footer">
                  <span class="ae-license-badge ${agent.license === 'open-source' ? 'ae-license-oss' : 'ae-license-prop'}">
                    <i class="fa-solid ${agent.license === 'open-source' ? 'fa-code-branch' : 'fa-lock'}"></i>
                    ${agent.license === 'open-source' ? 'Open-Source' : 'Proprietary'}
                  </span>
                  <div class="ae-hero-actions">
                    <button class="ae-btn-action" data-inspect="${agent.id}" title="Inspect Technical Dossier">
                      <i class="fa-solid fa-circle-info"></i> Details
                    </button>
                    <button class="ae-btn-action" data-toggle-compare="${agent.id}" title="Add to Compare Tray">
                      <i class="fa-solid fa-scale-balanced"></i>
                      ${this.state.compareList.includes(agent.id) ? 'Added' : 'Compare'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </section>
    `;
  }

  renderTrendingStrip() {
    // Fastest growing agents sorted by growthRate7d
    const trending = [...this.state.agents]
      .filter(a => a.usage?.growthRate7d)
      .sort((a, b) => (b.usage.growthRate7d || 0) - (a.usage.growthRate7d || 0))
      .slice(0, 5);

    if (!trending.length) return '';

    return `
      <section style="margin-bottom: 2.5rem;" aria-label="Trending AI Agents">
        <h3 class="ae-section-title">
          <i class="fa-solid fa-fire" style="color: var(--ae-rose);"></i>
          Trending: Fastest-Growing Agents This Week
        </h3>
        <div class="ae-trending-strip">
          ${trending.map(agent => `
            <div class="ae-trending-card">
              <div class="ae-trending-header">
                <span class="ae-trending-name">${agent.name}</span>
                <span class="ae-growth-pill">
                  <i class="fa-solid fa-arrow-trend-up"></i> +${agent.usage.growthRate7d}%
                </span>
              </div>
              <div class="ae-trending-sub">
                ${agent.category.toUpperCase()} • ${agent.agentType.toUpperCase()}
              </div>
              <div style="font-size: 0.82rem; font-weight: 600; color: var(--ae-text-main);">
                ${this.formatTokenVol(agent.usage.tokens7d)} tokens (7D)
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderCategorySections() {
    const categories = [
      { id: 'coding', name: 'Coding Agents', icon: 'fa-code', desc: 'Software engineering harnesses & IDE copilots' },
      { id: 'productivity', name: 'Personal & Productivity', icon: 'fa-briefcase', desc: 'Desktop operators & reasoning canvases' },
      { id: 'creative', name: 'Creative & Design', icon: 'fa-palette', desc: 'Generative UI and frontend scaffolding builders' },
      { id: 'entertainment', name: 'Entertainment & Social', icon: 'fa-gamepad', desc: 'Autonomous persona agents and social simulations' }
    ];

    return `
      <section style="margin-bottom: 2.5rem;" aria-label="Agent Categories">
        <h3 class="ae-section-title">
          <i class="fa-solid fa-layer-group" style="color: var(--ae-indigo);"></i>
          Category Leaders
        </h3>
        <div class="ae-categories-grid">
          ${categories.map(cat => {
            const catAgents = this.state.agents
              .filter(a => a.category === cat.id)
              .sort((a, b) => this.getSortMetricVal(b) - this.getSortMetricVal(a))
              .slice(0, 5);

            return `
              <div class="ae-category-panel">
                <div class="ae-category-header">
                  <div class="ae-category-title-wrap">
                    <h3><i class="fa-solid ${cat.icon}" style="color: var(--ae-primary);"></i> ${cat.name}</h3>
                    <p>${cat.desc}</p>
                  </div>
                  <button class="ae-btn-view-all" data-filter-cat="${cat.id}">
                    View All (${this.state.agents.filter(a => a.category === cat.id).length})
                  </button>
                </div>
                <table class="ae-mini-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Agent</th>
                      <th>Type</th>
                      <th>Usage / Metric</th>
                      <th style="text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${catAgents.map((a, idx) => `
                      <tr>
                        <td style="font-weight: 700; color: var(--ae-text-muted);">${idx + 1}</td>
                        <td style="font-weight: 600;">
                          <a href="#" data-inspect="${a.id}" style="color: var(--ae-text-main); text-decoration: none;">
                            ${a.name}
                          </a>
                        </td>
                        <td><span class="ae-agent-type-badge">${a.agentType}</span></td>
                        <td>${this.formatMetricVal(a)}</td>
                        <td style="text-align: right;">
                          <button class="ae-btn-action" data-inspect="${a.id}" title="Inspect Details">
                            <i class="fa-solid fa-chevron-right"></i>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  renderGlobalRankingSection() {
    const filtered = this.getFilteredGlobalAgents();
    const totalPages = Math.ceil(filtered.length / this.state.pageSize) || 1;
    const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
    const pagedAgents = filtered.slice(startIndex, startIndex + this.state.pageSize);

    return `
      <section class="ae-global-section" aria-label="Global AI Agent Rankings">
        <h3 class="ae-section-title">
          <i class="fa-solid fa-globe" style="color: var(--ae-primary);"></i>
          Global Agent Rankings Table
        </h3>

        <!-- Controls Bar -->
        <div class="ae-controls-bar">
          <div class="ae-time-pills">
            <button class="ae-time-btn ${this.state.timeHorizon === 'today' ? 'active' : ''}" data-time-switch="today">Today</button>
            <button class="ae-time-btn ${this.state.timeHorizon === '7d' ? 'active' : ''}" data-time-switch="7d">7D</button>
            <button class="ae-time-btn ${this.state.timeHorizon === '30d' ? 'active' : ''}" data-time-switch="30d">30D</button>
            <button class="ae-time-btn ${this.state.timeHorizon === 'all' ? 'active' : ''}" data-time-switch="all">All Time</button>
          </div>

          <div class="ae-filter-search-group">
            <div class="ae-search-box">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" class="ae-search-input" id="ae-search-input" 
                     placeholder="Search agent, harness, model..." 
                     value="${this.escapeHtml(this.state.searchQuery)}" />
            </div>

            <select class="ae-select-filter" id="ae-category-filter">
              <option value="all" ${this.state.selectedCategory === 'all' ? 'selected' : ''}>All Categories</option>
              <option value="coding" ${this.state.selectedCategory === 'coding' ? 'selected' : ''}>Coding</option>
              <option value="productivity" ${this.state.selectedCategory === 'productivity' ? 'selected' : ''}>Productivity</option>
              <option value="creative" ${this.state.selectedCategory === 'creative' ? 'selected' : ''}>Creative</option>
              <option value="entertainment" ${this.state.selectedCategory === 'entertainment' ? 'selected' : ''}>Entertainment</option>
            </select>

            <select class="ae-select-filter" id="ae-license-filter">
              <option value="all" ${this.state.selectedLicense === 'all' ? 'selected' : ''}>All Licenses</option>
              <option value="open-source" ${this.state.selectedLicense === 'open-source' ? 'selected' : ''}>Open-Source</option>
              <option value="proprietary" ${this.state.selectedLicense === 'proprietary' ? 'selected' : ''}>Proprietary</option>
            </select>
          </div>
        </div>

        <!-- Master Table -->
        <div class="ae-table-responsive">
          <table class="ae-master-table">
            <thead>
              <tr>
                <th style="width: 50px;">Rank</th>
                <th>Agent &amp; Overview</th>
                <th>Category</th>
                <th>Type</th>
                <th>License</th>
                <th>Usage / Gateway Vol</th>
                <th>Growth</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pagedAgents.length ? pagedAgents.map((agent, i) => {
                const rankNumber = startIndex + i + 1;
                const initials = agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const isCompared = this.state.compareList.includes(agent.id);

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--ae-text-muted);">${rankNumber}</td>
                    <td>
                      <div class="ae-cell-agent">
                        <span class="ae-avatar-initials">${initials}</span>
                        <div>
                          <div class="ae-cell-title">${agent.name}</div>
                          <div class="ae-cell-sub">${agent.headline}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="ae-category-tag">${agent.category}</span></td>
                    <td><span class="ae-agent-type-badge">${agent.agentType}</span></td>
                    <td>
                      <span class="ae-license-badge ${agent.license === 'open-source' ? 'ae-license-oss' : 'ae-license-prop'}">
                        ${agent.license === 'open-source' ? 'OSS' : 'Proprietary'}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight: 600;">${this.formatMetricVal(agent)}</div>
                      <div style="font-size: 0.75rem; color: var(--ae-text-subtle);">
                        ${agent.usage?.tokensToday ? 'OpenRouter Gateway' : (agent.proxies?.source || 'Community Proxy')}
                      </div>
                    </td>
                    <td>
                      ${agent.usage?.growthRate7d ? `
                        <span class="ae-growth-pill">
                          +${agent.usage.growthRate7d}%
                        </span>
                      ` : '<span class="ae-score-nr">n/r</span>'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button class="ae-btn-action" data-inspect="${agent.id}" title="View Details">
                        <i class="fa-solid fa-circle-info"></i>
                      </button>
                      <button class="ae-btn-action ${isCompared ? 'active' : ''}" 
                              data-toggle-compare="${agent.id}" 
                              title="${isCompared ? 'Remove from compare' : 'Compare'}">
                        <i class="fa-solid fa-scale-balanced"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2rem; color: var(--ae-text-muted);">
                    No agents found matching your filter criteria.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div class="ae-pagination-bar">
          <div>
            Showing ${filtered.length ? startIndex + 1 : 0}–${Math.min(startIndex + this.state.pageSize, filtered.length)} of ${filtered.length} agents
          </div>
          <div class="ae-pagination-controls">
            <button class="ae-page-btn" id="ae-prev-page" ${this.state.currentPage <= 1 ? 'disabled' : ''}>
              &larr; Previous
            </button>
            <span style="padding: 0.35rem 0.6rem; font-weight: 600;">
              Page ${this.state.currentPage} of ${totalPages}
            </span>
            <button class="ae-page-btn" id="ae-next-page" ${this.state.currentPage >= totalPages ? 'disabled' : ''}>
              Next &rarr;
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // ==========================================================================
  // VIEW 2: EVALS & BENCHMARK MATRIX
  // ==========================================================================
  renderEvalsView() {
    return `
      <div class="ae-evals-container">
        <!-- 1. Benchmark Matrix Table with Best Score Highlight -->
        ${this.renderBenchmarkMatrixSection()}

        <!-- 2. Charts Grid (Scatter Cost vs Latency, Usage, Category Share, Growth) -->
        ${this.renderBenchmarkChartsSection()}
      </div>
    `;
  }

  renderBenchmarkMatrixSection() {
    // Collect agents with at least one eval benchmark
    const evalAgents = this.state.agents.filter(a => a.evals);

    // Compute best scores per benchmark for highlighting
    const bestScores = {
      sweBenchVerified: Math.max(...evalAgents.map(a => a.evals?.sweBenchVerified?.score || 0)),
      sweBenchLite: Math.max(...evalAgents.map(a => a.evals?.sweBenchLite?.score || 0)),
      terminalBench: Math.max(...evalAgents.map(a => a.evals?.terminalBench?.score || 0)),
      bfclV4: Math.max(...evalAgents.map(a => a.evals?.bfclV4?.score || 0)),
      aiderPolyglot: Math.max(...evalAgents.map(a => a.evals?.aiderPolyglot?.score || 0)),
      agentArenaElo: Math.max(...evalAgents.map(a => a.evals?.agentArenaElo?.score || 0))
    };

    return `
      <section class="ae-matrix-card" aria-label="Benchmark Evaluations Matrix">
        <div class="ae-matrix-header">
          <div class="ae-matrix-title-wrap">
            <h3>
              <i class="fa-solid fa-table-list" style="color: var(--ae-primary);"></i>
              Agent Benchmark Matrix
            </h3>
            <p>
              Direct empirical evaluation results across official software engineering, tool calling, and terminal reasoning benchmarks. Best score in each benchmark column is highlighted. Missing scores are strictly designated <code>n/r</code>.
            </p>
          </div>
          <div class="ae-matrix-tools">
            <button class="ae-btn-tool" id="ae-export-evals-csv">
              <i class="fa-solid fa-download"></i> Export Evals CSV
            </button>
          </div>
        </div>

        <div class="ae-table-responsive">
          <table class="ae-matrix-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th title="SWE-bench Verified (Princeton NLP) - 500 validated real GitHub issues">SWE-bench Verified (%)</th>
                <th title="SWE-bench Lite - Standard 300 Python issue resolution">SWE-bench Lite (%)</th>
                <th title="Terminal-Bench - Bash CLI automation & execution">Terminal-Bench (%)</th>
                <th title="BFCL V4 - Berkeley Function Calling Leaderboard">BFCL V4 Tool (%)</th>
                <th title="Aider Polyglot - Multi-language coding benchmark">Aider Polyglot (%)</th>
                <th title="LMSYS Agent Arena Elo Rating">Arena Elo</th>
                <th title="Average Cost per Resolved Task (USD)">Cost / Task ($)</th>
                <th title="Average Execution Latency per Task">Latency (s)</th>
              </tr>
            </thead>
            <tbody>
              ${evalAgents.map(agent => {
                const ev = agent.evals || {};
                return `
                  <tr>
                    <td>
                      <div style="font-weight: 600; color: var(--ae-text-main);">
                        ${agent.name}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--ae-text-muted);">
                        ${agent.harness}
                      </div>
                    </td>
                    <td>${this.formatScoreCell(ev.sweBenchVerified?.score, bestScores.sweBenchVerified, '%')}</td>
                    <td>${this.formatScoreCell(ev.sweBenchLite?.score, bestScores.sweBenchLite, '%')}</td>
                    <td>${this.formatScoreCell(ev.terminalBench?.score, bestScores.terminalBench, '%')}</td>
                    <td>${this.formatScoreCell(ev.bfclV4?.score, bestScores.bfclV4, '%')}</td>
                    <td>${this.formatScoreCell(ev.aiderPolyglot?.score, bestScores.aiderPolyglot, '%')}</td>
                    <td>${this.formatScoreCell(ev.agentArenaElo?.score, bestScores.agentArenaElo, '')}</td>
                    <td>${ev.costPerResolvedTask?.value ? `$${ev.costPerResolvedTask.value.toFixed(2)}` : '<span class="ae-score-nr">n/r</span>'}</td>
                    <td>${ev.latencyPerTaskSec?.value ? `${ev.latencyPerTaskSec.value}s` : '<span class="ae-score-nr">n/r</span>'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  formatScoreCell(score, bestScore, unit = '') {
    if (score === null || score === undefined) {
      return '<span class="ae-score-nr">n/r</span>';
    }
    const isBest = score === bestScore && score > 0;
    if (isBest) {
      return `
        <span class="ae-score-best" title="Best reported score in column">
          <i class="fa-solid fa-trophy"></i> ${score}${unit}
        </span>
      `;
    }
    return `<span class="ae-score-regular">${score}${unit}</span>`;
  }

  renderBenchmarkChartsSection() {
    return `
      <section class="ae-charts-grid" aria-label="Agent Evaluation & Telemetry Charts">
        <!-- Chart 1: Success Rate vs Cost Scatter -->
        <article class="ae-chart-card">
          <div class="ae-chart-header">
            <h4 class="ae-chart-title">
              <i class="fa-solid fa-chart-scatter" style="color: var(--ae-emerald);"></i>
              Success Rate vs Cost ($/Task)
            </h4>
            <button class="ae-btn-tool" data-toggle-fallback="chart-cost-scatter" title="Toggle Data Table">
              <i class="fa-solid fa-table"></i>
            </button>
          </div>
          <div id="chart-cost-scatter" class="ae-chart-viewport"></div>
          <div id="fallback-chart-cost-scatter" class="ae-table-fallback"></div>
        </article>

        <!-- Chart 2: Success Rate vs Latency Scatter -->
        <article class="ae-chart-card">
          <div class="ae-chart-header">
            <h4 class="ae-chart-title">
              <i class="fa-solid fa-stopwatch" style="color: var(--ae-amber);"></i>
              Success Rate vs Latency (Seconds/Task)
            </h4>
            <button class="ae-btn-tool" data-toggle-fallback="chart-latency-scatter" title="Toggle Data Table">
              <i class="fa-solid fa-table"></i>
            </button>
          </div>
          <div id="chart-latency-scatter" class="ae-chart-viewport"></div>
          <div id="fallback-chart-latency-scatter" class="ae-table-fallback"></div>
        </article>

        <!-- Chart 3: Usage Over Time (Line Chart) -->
        <article class="ae-chart-card ae-chart-card-full">
          <div class="ae-chart-header">
            <h4 class="ae-chart-title">
              <i class="fa-solid fa-chart-line" style="color: var(--ae-primary);"></i>
              Usage Over Time (Tokens Ingested / Gateway Volume)
            </h4>
            <button class="ae-btn-tool" data-toggle-fallback="chart-usage-time" title="Toggle Data Table">
              <i class="fa-solid fa-table"></i>
            </button>
          </div>
          <div id="chart-usage-time" class="ae-chart-viewport"></div>
          <div id="fallback-chart-usage-time" class="ae-table-fallback"></div>
        </article>

        <!-- Chart 4: Category Share (Stacked Bar) -->
        <article class="ae-chart-card">
          <div class="ae-chart-header">
            <h4 class="ae-chart-title">
              <i class="fa-solid fa-chart-pie" style="color: var(--ae-indigo);"></i>
              Category Traffic Share
            </h4>
            <button class="ae-btn-tool" data-toggle-fallback="chart-cat-share" title="Toggle Data Table">
              <i class="fa-solid fa-table"></i>
            </button>
          </div>
          <div id="chart-cat-share" class="ae-chart-viewport"></div>
          <div id="fallback-chart-cat-share" class="ae-table-fallback"></div>
        </article>

        <!-- Chart 5: Open-Source vs Proprietary Split -->
        <article class="ae-chart-card">
          <div class="ae-chart-header">
            <h4 class="ae-chart-title">
              <i class="fa-solid fa-code-branch" style="color: var(--ae-cyan);"></i>
              Open-Source vs Proprietary Split
            </h4>
            <button class="ae-btn-tool" data-toggle-fallback="chart-license-donut" title="Toggle Data Table">
              <i class="fa-solid fa-table"></i>
            </button>
          </div>
          <div id="chart-license-donut" class="ae-chart-viewport"></div>
          <div id="fallback-chart-license-donut" class="ae-table-fallback"></div>
        </article>
      </section>
    `;
  }

  // ==========================================================================
  // VIEW 3: HARNESS VS MODEL MATRIX VIEW
  // ==========================================================================
  renderHarnessView() {
    const matrix = this.state.harnessModelMatrix;

    return `
      <section class="ae-harness-card" aria-label="Harness versus Model Comparison">
        <div class="ae-matrix-header">
          <div class="ae-matrix-title-wrap">
            <h3>
              <i class="fa-solid fa-cubes" style="color: var(--ae-primary);"></i>
              Harness vs Model Cross-Comparison
            </h3>
            <p>
              Evaluating identical foundation models across different agent execution scaffolds (e.g. Claude 3.5 Sonnet on OpenHands vs Aider vs Cline), and isolating the impact of agent scaffolding versus underlying foundation model capability.
            </p>
          </div>
        </div>

        <div class="ae-table-responsive">
          <table class="ae-harness-table">
            <thead>
              <tr>
                <th>Foundation Model</th>
                <th>Provider</th>
                <th>Agent Scaffold / Harness</th>
                <th>SWE-bench Verified (%)</th>
                <th>Cost / Resolved Task ($)</th>
                <th>Provenance Source</th>
              </tr>
            </thead>
            <tbody>
              ${matrix.map(row => `
                <tr>
                  <td style="font-weight: 600; color: var(--ae-text-main);">${row.model}</td>
                  <td>${row.provider}</td>
                  <td><span class="ae-agent-type-badge">${row.harness}</span></td>
                  <td>
                    <span style="font-weight: 700; color: var(--ae-emerald);">
                      ${row.sweBenchVerified}%
                    </span>
                  </td>
                  <td>$${row.costPerTask.toFixed(2)}</td>
                  <td style="font-size: 0.8rem; color: var(--ae-text-muted);">${row.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ==========================================================================
  // COMPARE TRAY & MODAL
  // ==========================================================================
  renderCompareTray() {
    const count = this.state.compareList.length;
    const isVisible = count > 0;

    return `
      <aside class="ae-compare-tray ${isVisible ? 'visible' : ''}" aria-label="Agent Comparison Tray">
        <div class="ae-compare-tray-inner">
          <div class="ae-compare-chips">
            <span style="font-weight: 700; font-size: 0.9rem;">Compare (${count}/4):</span>
            ${this.state.compareList.map(id => {
              const agent = this.state.agents.find(a => a.id === id);
              return `
                <div class="ae-compare-chip">
                  <span>${agent ? agent.name : id}</span>
                  <i class="fa-solid fa-xmark ae-chip-remove" data-remove-compare="${id}" title="Remove"></i>
                </div>
              `;
            }).join('')}
          </div>
          <div class="ae-compare-actions">
            <button class="ae-btn-action" id="ae-clear-compare">Clear</button>
            <button class="ae-btn-compare-launch" id="ae-launch-compare" ${count < 2 ? 'disabled' : ''}>
              <i class="fa-solid fa-scale-balanced"></i> Compare Side-by-Side
            </button>
          </div>
        </div>
      </aside>
    `;
  }

  renderCompareModal() {
    if (!this.state.showCompareModal) return '';

    const comparedAgents = this.state.compareList
      .map(id => this.state.agents.find(a => a.id === id))
      .filter(Boolean);

    return `
      <div class="ae-modal-backdrop open" id="ae-compare-modal-backdrop">
        <div class="ae-modal-content">
          <button class="ae-modal-close" id="ae-close-compare-modal">&times;</button>
          <h3 style="font-family: var(--ae-font-display); margin-top: 0;">
            <i class="fa-solid fa-scale-balanced" style="color: var(--ae-primary);"></i>
            Side-by-Side Agent Comparison
          </h3>
          
          <div class="ae-table-responsive" style="margin-top: 1.5rem;">
            <table class="ae-master-table">
              <thead>
                <tr>
                  <th>Specification / Metric</th>
                  ${comparedAgents.map(a => `<th>${a.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 600;">Category</td>
                  ${comparedAgents.map(a => `<td><span class="ae-category-tag">${a.category}</span></td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Agent Type</td>
                  ${comparedAgents.map(a => `<td><span class="ae-agent-type-badge">${a.agentType}</span></td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">License</td>
                  ${comparedAgents.map(a => `<td>${a.license}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Execution Harness</td>
                  ${comparedAgents.map(a => `<td>${a.harness}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Default Model</td>
                  ${comparedAgents.map(a => `<td>${a.defaultModel}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">SWE-bench Verified (%)</td>
                  ${comparedAgents.map(a => `<td>${a.evals?.sweBenchVerified?.score ? `${a.evals.sweBenchVerified.score}%` : '<span class=\"ae-score-nr\">n/r</span>'}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Terminal-Bench (%)</td>
                  ${comparedAgents.map(a => `<td>${a.evals?.terminalBench?.score ? `${a.evals.terminalBench.score}%` : '<span class=\"ae-score-nr\">n/r</span>'}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">BFCL V4 Tool (%)</td>
                  ${comparedAgents.map(a => `<td>${a.evals?.bfclV4?.score ? `${a.evals.bfclV4.score}%` : '<span class=\"ae-score-nr\">n/r</span>'}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Cost per Task ($)</td>
                  ${comparedAgents.map(a => `<td>${a.evals?.costPerResolvedTask?.value ? `$${a.evals.costPerResolvedTask.value.toFixed(2)}` : '<span class=\"ae-score-nr\">n/r</span>'}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight: 600;">Weekly Growth</td>
                  ${comparedAgents.map(a => `<td>${a.usage?.growthRate7d ? `+${a.usage.growthRate7d}%` : '<span class=\"ae-score-nr\">n/r</span>'}</td>`).join('')}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderInspectModal() {
    if (!this.state.activeInspectId) return '';
    const agent = this.state.agents.find(a => a.id === this.state.activeInspectId);
    if (!agent) return '';

    const ev = agent.evals || {};
    const us = agent.usage || {};
    const pr = agent.proxies || {};

    return `
      <div class="ae-modal-backdrop open" id="ae-inspect-modal-backdrop">
        <div class="ae-modal-content">
          <button class="ae-modal-close" id="ae-close-inspect-modal">&times;</button>
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span class="ae-avatar-initials" style="width: 44px; height: 44px; font-size: 1.1rem;">
              ${agent.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3 style="font-family: var(--ae-font-display); margin: 0; font-size: 1.5rem;">${agent.name}</h3>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                <span class="ae-category-tag">${agent.category}</span>
                <span class="ae-agent-type-badge">${agent.agentType}</span>
                <span class="ae-license-badge ${agent.license === 'open-source' ? 'ae-license-oss' : 'ae-license-prop'}">
                  ${agent.license}
                </span>
              </div>
            </div>
          </div>

          <p style="color: var(--ae-text-muted); font-size: 0.95rem; line-height: 1.5; margin: 0.75rem 0 1.25rem 0;">
            ${agent.headline}
          </p>

          <div class="ae-dossier-grid">
            <!-- Architectural Specs -->
            <div class="ae-dossier-group">
              <h4><i class="fa-solid fa-microchip" style="color: var(--ae-primary);"></i> Architecture &amp; Scaffold</h4>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Execution Harness</span>
                <span class="ae-dossier-val">${agent.harness}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Default Model</span>
                <span class="ae-dossier-val">${agent.defaultModel}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Supported Models</span>
                <span class="ae-dossier-val">${(agent.supportedModels || []).join(', ')}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Official Link</span>
                <span class="ae-dossier-val">
                  <a href="${agent.url}" target="_blank" rel="noopener" style="color: var(--ae-primary);">
                    ${agent.url ? new URL(agent.url).hostname : 'n/r'}
                  </a>
                </span>
              </div>
            </div>

            <!-- Empirical Benchmark Evaluations -->
            <div class="ae-dossier-group">
              <h4><i class="fa-solid fa-chart-simple" style="color: var(--ae-emerald);"></i> Verified Evaluations</h4>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">SWE-bench Verified</span>
                <span class="ae-dossier-val">${ev.sweBenchVerified?.score ? `${ev.sweBenchVerified.score}%` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Terminal-Bench</span>
                <span class="ae-dossier-val">${ev.terminalBench?.score ? `${ev.terminalBench.score}%` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">BFCL V4 (Tool Calling)</span>
                <span class="ae-dossier-val">${ev.bfclV4?.score ? `${ev.bfclV4.score}%` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Arena Elo Rating</span>
                <span class="ae-dossier-val">${ev.agentArenaElo?.score || '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Cost per Task</span>
                <span class="ae-dossier-val">${ev.costPerResolvedTask?.value ? `$${ev.costPerResolvedTask.value.toFixed(2)}` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
            </div>

            <!-- Usage & Gateway Telemetry -->
            <div class="ae-dossier-group">
              <h4><i class="fa-solid fa-network-wired" style="color: var(--ae-indigo);"></i> Gateway Usage</h4>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Tokens (7D)</span>
                <span class="ae-dossier-val">${this.formatTokenVol(us.tokens7d)}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Requests (7D)</span>
                <span class="ae-dossier-val">${us.requests7d ? us.requests7d.toLocaleString() : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Weekly Growth</span>
                <span class="ae-dossier-val">${us.growthRate7d ? `+${us.growthRate7d}%` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Measurement Type</span>
                <span class="ae-dossier-val">${us.measurementType || 'vendor-reported'}</span>
              </div>
            </div>

            <!-- Public Proxy Metrics -->
            <div class="ae-dossier-group">
              <h4><i class="fa-solid fa-code-pull-request" style="color: var(--ae-amber);"></i> Public Proxies</h4>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">GitHub Stars</span>
                <span class="ae-dossier-val">${pr.githubStars ? pr.githubStars.toLocaleString() : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Marketplace Installs</span>
                <span class="ae-dossier-val">${pr.marketplaceInstalls ? pr.marketplaceInstalls.toLocaleString() : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">PyPI / NPM Stats</span>
                <span class="ae-dossier-val">${pr.pypiMonthlyDownloads ? `${pr.pypiMonthlyDownloads.toLocaleString()}/mo` : '<span class="ae-score-nr">n/r</span>'}</span>
              </div>
              <div class="ae-dossier-row">
                <span class="ae-dossier-label">Source Citation</span>
                <span class="ae-dossier-val">${pr.source || 'Public Registries'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // CHART RENDERING (Plotly.js)
  // ==========================================================================
  renderCharts() {
    if (!window.Plotly) {
      console.warn('Plotly not loaded; table fallbacks remain available.');
      return;
    }

    const isDark = document.body.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const paperBg = isDark ? '#0f172a' : '#ffffff';

    // 1. Scatter Chart: Success Rate vs Cost ($/Task)
    const costData = this.state.agents.filter(a => a.evals?.sweBenchVerified?.score && a.evals?.costPerResolvedTask?.value);
    if (document.getElementById('chart-cost-scatter')) {
      const trace = {
        x: costData.map(a => a.evals.costPerResolvedTask.value),
        y: costData.map(a => a.evals.sweBenchVerified.score),
        mode: 'markers+text',
        text: costData.map(a => a.name),
        textposition: 'top center',
        marker: {
          size: 14,
          color: '#0284c7',
          line: { color: '#0369a1', width: 2 }
        },
        type: 'scatter'
      };

      const layout = {
        title: { text: 'SWE-bench Verified (%) vs Cost per Resolved Task ($)', font: { color: textColor, size: 14 } },
        xaxis: { title: 'Cost per Resolved Task (USD)', color: textColor, gridcolor: gridColor, zerolinecolor: gridColor },
        yaxis: { title: 'SWE-bench Verified (%)', color: textColor, gridcolor: gridColor, zerolinecolor: gridColor },
        paper_bgcolor: paperBg,
        plot_bgcolor: paperBg,
        margin: { l: 50, r: 20, t: 40, b: 50 },
        font: { family: 'Inter, sans-serif' }
      };

      window.Plotly.newPlot('chart-cost-scatter', [trace], layout, { responsive: true, displayModeBar: false });
    }

    // 2. Scatter Chart: Success Rate vs Latency (Seconds/Task)
    const latencyData = this.state.agents.filter(a => a.evals?.sweBenchVerified?.score && a.evals?.latencyPerTaskSec?.value);
    if (document.getElementById('chart-latency-scatter')) {
      const trace = {
        x: latencyData.map(a => a.evals.latencyPerTaskSec.value),
        y: latencyData.map(a => a.evals.sweBenchVerified.score),
        mode: 'markers+text',
        text: latencyData.map(a => a.name),
        textposition: 'top center',
        marker: {
          size: 14,
          color: '#059669',
          line: { color: '#047857', width: 2 }
        },
        type: 'scatter'
      };

      const layout = {
        title: { text: 'SWE-bench Verified (%) vs Latency (Seconds)', font: { color: textColor, size: 14 } },
        xaxis: { title: 'Latency (seconds per task)', color: textColor, gridcolor: gridColor, zerolinecolor: gridColor },
        yaxis: { title: 'SWE-bench Verified (%)', color: textColor, gridcolor: gridColor, zerolinecolor: gridColor },
        paper_bgcolor: paperBg,
        plot_bgcolor: paperBg,
        margin: { l: 50, r: 20, t: 40, b: 50 },
        font: { family: 'Inter, sans-serif' }
      };

      window.Plotly.newPlot('chart-latency-scatter', [trace], layout, { responsive: true, displayModeBar: false });
    }

    // 3. Line Chart: Usage Over Time
    const timeData = this.state.agents.filter(a => a.timeSeries && a.timeSeries.length > 0);
    if (document.getElementById('chart-usage-time') && timeData.length > 0) {
      const traces = timeData.slice(0, 5).map(agent => ({
        x: agent.timeSeries.map(pt => pt.date),
        y: agent.timeSeries.map(pt => pt.tokens / 1000000), // in millions
        name: agent.name,
        type: 'scatter',
        mode: 'lines+markers'
      }));

      const layout = {
        title: { text: 'Daily Token Telemetry (Millions of Tokens)', font: { color: textColor, size: 14 } },
        xaxis: { title: 'Date', color: textColor, gridcolor: gridColor },
        yaxis: { title: 'Tokens (Millions)', color: textColor, gridcolor: gridColor },
        paper_bgcolor: paperBg,
        plot_bgcolor: paperBg,
        margin: { l: 50, r: 20, t: 40, b: 50 },
        font: { family: 'Inter, sans-serif' }
      };

      window.Plotly.newPlot('chart-usage-time', traces, layout, { responsive: true, displayModeBar: false });
    }

    // 4. Category Traffic Share
    if (document.getElementById('chart-cat-share')) {
      const categories = ['coding', 'productivity', 'creative', 'entertainment'];
      const catTotals = categories.map(cat => {
        return this.state.agents
          .filter(a => a.category === cat)
          .reduce((sum, a) => sum + (a.usage?.tokens7d || 0), 0);
      });

      const trace = {
        labels: ['Coding', 'Productivity', 'Creative', 'Entertainment'],
        values: catTotals,
        type: 'pie',
        hole: 0.45,
        marker: {
          colors: ['#0284c7', '#059669', '#6366f1', '#e11d48']
        }
      };

      const layout = {
        title: { text: 'Weekly Gateway Volume Share by Category', font: { color: textColor, size: 14 } },
        paper_bgcolor: paperBg,
        font: { family: 'Inter, sans-serif', color: textColor },
        margin: { l: 20, r: 20, t: 40, b: 20 }
      };

      window.Plotly.newPlot('chart-cat-share', [trace], layout, { responsive: true, displayModeBar: false });
    }

    // 5. Open-Source vs Proprietary Split
    if (document.getElementById('chart-license-donut')) {
      const ossCount = this.state.agents.filter(a => a.license === 'open-source').length;
      const propCount = this.state.agents.filter(a => a.license === 'proprietary').length;

      const trace = {
        labels: ['Open-Source', 'Proprietary'],
        values: [ossCount, propCount],
        type: 'pie',
        marker: {
          colors: ['#059669', '#64748b']
        }
      };

      const layout = {
        title: { text: 'Tracked Agent Catalog by License Type', font: { color: textColor, size: 14 } },
        paper_bgcolor: paperBg,
        font: { family: 'Inter, sans-serif', color: textColor },
        margin: { l: 20, r: 20, t: 40, b: 20 }
      };

      window.Plotly.newPlot('chart-license-donut', [trace], layout, { responsive: true, displayModeBar: false });
    }
  }

  // ==========================================================================
  // EVENT BINDINGS
  // ==========================================================================
  bindEvents() {
    // Tab switching
    document.querySelectorAll('[data-tab-switch]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.activeTab = e.currentTarget.getAttribute('data-tab-switch');
        this.syncUrlState();
        this.render();
      });
    });

    // Time horizon switching
    document.querySelectorAll('[data-time-switch]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.timeHorizon = e.currentTarget.getAttribute('data-time-switch');
        this.syncUrlState();
        this.render();
      });
    });

    // Category filter button in panel
    document.querySelectorAll('[data-filter-cat]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.state.selectedCategory = e.currentTarget.getAttribute('data-filter-cat');
        this.state.currentPage = 1;
        this.syncUrlState();
        this.render();
      });
    });

    // Search input
    const searchInput = document.getElementById('ae-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.state.currentPage = 1;
        this.syncUrlState();
        this.render();
      });
    }

    // Category dropdown
    const catSelect = document.getElementById('ae-category-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.state.selectedCategory = e.target.value;
        this.state.currentPage = 1;
        this.syncUrlState();
        this.render();
      });
    }

    // License dropdown
    const licSelect = document.getElementById('ae-license-filter');
    if (licSelect) {
      licSelect.addEventListener('change', (e) => {
        this.state.selectedLicense = e.target.value;
        this.state.currentPage = 1;
        this.syncUrlState();
        this.render();
      });
    }

    // Pagination
    document.getElementById('ae-prev-page')?.addEventListener('click', () => {
      if (this.state.currentPage > 1) {
        this.state.currentPage--;
        this.render();
      }
    });

    document.getElementById('ae-next-page')?.addEventListener('click', () => {
      const filtered = this.getFilteredGlobalAgents();
      const totalPages = Math.ceil(filtered.length / this.state.pageSize);
      if (this.state.currentPage < totalPages) {
        this.state.currentPage++;
        this.render();
      }
    });

    // Inspect Details Modal
    document.querySelectorAll('[data-inspect]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.getAttribute('data-inspect');
        this.state.activeInspectId = id;
        this.render();
      });
    });

    document.getElementById('ae-close-inspect-modal')?.addEventListener('click', () => {
      this.state.activeInspectId = null;
      this.render();
    });

    // Compare Toggle
    document.querySelectorAll('[data-toggle-compare]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-toggle-compare');
        if (this.state.compareList.includes(id)) {
          this.state.compareList = this.state.compareList.filter(item => item !== id);
        } else if (this.state.compareList.length < 4) {
          this.state.compareList.push(id);
        } else {
          alert('You can compare a maximum of 4 agents simultaneously.');
        }
        this.syncUrlState();
        this.render();
      });
    });

    // Remove single compare chip
    document.querySelectorAll('[data-remove-compare]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-remove-compare');
        this.state.compareList = this.state.compareList.filter(item => item !== id);
        this.syncUrlState();
        this.render();
      });
    });

    // Clear compare tray
    document.getElementById('ae-clear-compare')?.addEventListener('click', () => {
      this.state.compareList = [];
      this.syncUrlState();
      this.render();
    });

    // Launch side-by-side compare modal
    document.getElementById('ae-launch-compare')?.addEventListener('click', () => {
      this.state.showCompareModal = true;
      this.render();
    });

    document.getElementById('ae-close-compare-modal')?.addEventListener('click', () => {
      this.state.showCompareModal = false;
      this.render();
    });

    // Refresh button
    document.getElementById('ae-refresh-btn')?.addEventListener('click', () => {
      this.fetchLiveTelemetry();
    });

    // Export CSV buttons
    document.getElementById('ae-export-csv-btn')?.addEventListener('click', () => {
      this.exportRankingsToCsv();
    });

    document.getElementById('ae-export-evals-csv')?.addEventListener('click', () => {
      this.exportEvalsToCsv();
    });

    // Toggle chart fallback table
    document.querySelectorAll('[data-toggle-fallback]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chartId = e.currentTarget.getAttribute('data-toggle-fallback');
        const fallback = document.getElementById(`fallback-${chartId}`);
        if (fallback) {
          fallback.classList.toggle('visible');
          if (fallback.classList.contains('visible') && !fallback.innerHTML.trim()) {
            fallback.innerHTML = this.renderFallbackTableHtml(chartId);
          }
        }
      });
    });
  }

  // ==========================================================================
  // DATA FILTERING & SORTING
  // ==========================================================================
  getSortedAgentsByTime(timeHorizon) {
    const fieldMap = {
      today: 'tokensToday',
      '7d': 'tokens7d',
      '30d': 'tokens30d',
      all: 'tokensAll'
    };
    const field = fieldMap[timeHorizon] || 'tokens7d';

    return [...this.state.agents].sort((a, b) => {
      const valA = a.usage?.[field] || (a.proxies?.marketplaceInstalls || a.proxies?.githubStars || 0);
      const valB = b.usage?.[field] || (b.proxies?.marketplaceInstalls || b.proxies?.githubStars || 0);
      return valB - valA;
    });
  }

  getFilteredGlobalAgents() {
    let list = this.getSortedAgentsByTime(this.state.timeHorizon);

    if (this.state.selectedCategory !== 'all') {
      list = list.filter(a => a.category === this.state.selectedCategory);
    }

    if (this.state.selectedLicense !== 'all') {
      list = list.filter(a => a.license === this.state.selectedLicense);
    }

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) ||
        a.headline.toLowerCase().includes(q) ||
        (a.harness && a.harness.toLowerCase().includes(q)) ||
        (a.defaultModel && a.defaultModel.toLowerCase().includes(q))
      );
    }

    return list;
  }

  getSortMetricVal(agent) {
    return agent.usage?.tokens7d || agent.proxies?.marketplaceInstalls || agent.proxies?.githubStars || 0;
  }

  formatMetricVal(agent) {
    if (agent.usage?.tokens7d) {
      return this.formatTokenVol(agent.usage.tokens7d);
    }
    if (agent.proxies?.marketplaceInstalls) {
      return `${(agent.proxies.marketplaceInstalls / 1000).toFixed(0)}k installs`;
    }
    if (agent.proxies?.githubStars) {
      return `${(agent.proxies.githubStars / 1000).toFixed(1)}k stars`;
    }
    return '<span class="ae-score-nr">n/r</span>';
  }

  formatTokenVol(num) {
    if (!num) return '<span class="ae-score-nr">n/r</span>';
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B tokens`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M tokens`;
    return num.toLocaleString();
  }

  renderFallbackTableHtml(chartId) {
    if (chartId === 'chart-cost-scatter') {
      const data = this.state.agents.filter(a => a.evals?.sweBenchVerified?.score && a.evals?.costPerResolvedTask?.value);
      return `
        <table class="ae-mini-table">
          <thead><tr><th>Agent</th><th>SWE-bench Verified (%)</th><th>Cost/Task ($)</th></tr></thead>
          <tbody>
            ${data.map(a => `<tr><td>${a.name}</td><td>${a.evals.sweBenchVerified.score}%</td><td>$${a.evals.costPerResolvedTask.value.toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    return '<div style="padding: 1rem; color: var(--ae-text-muted);">Data table active.</div>';
  }

  // ==========================================================================
  // CSV EXPORT UTILITIES
  // ==========================================================================
  exportRankingsToCsv() {
    const headers = ['Rank', 'Name', 'Category', 'Type', 'License', 'Harness', 'Tokens7d', 'GrowthRate7d', 'Notice'];
    const rows = this.state.agents.map((a, i) => [
      i + 1,
      `"${a.name}"`,
      a.category,
      a.agentType,
      a.license,
      `"${a.harness}"`,
      a.usage?.tokens7d || 'n/r',
      a.usage?.growthRate7d ? `${a.usage.growthRate7d}%` : 'n/r',
      `"OpenRouter traffic only, not total market use"`
    ]);

    this.downloadCsv('snapfacts-agent-rankings.csv', [headers, ...rows]);
  }

  exportEvalsToCsv() {
    const headers = ['Agent', 'Harness', 'SWE-bench Verified (%)', 'SWE-bench Lite (%)', 'Terminal-Bench (%)', 'BFCL V4 (%)', 'Aider Polyglot (%)', 'Arena Elo', 'Cost / Task ($)', 'Citation'];
    const rows = this.state.agents.map(a => {
      const ev = a.evals || {};
      return [
        `"${a.name}"`,
        `"${a.harness}"`,
        ev.sweBenchVerified?.score || 'n/r',
        ev.sweBenchLite?.score || 'n/r',
        ev.terminalBench?.score || 'n/r',
        ev.bfclV4?.score || 'n/r',
        ev.aiderPolyglot?.score || 'n/r',
        ev.agentArenaElo?.score || 'n/r',
        ev.costPerResolvedTask?.value ? `$${ev.costPerResolvedTask.value.toFixed(2)}` : 'n/r',
        `"Epoch AI (CC-BY 4.0) / SWE-bench / BFCL"`
      ];
    });

    this.downloadCsv('snapfacts-agent-evals.csv', [headers, ...rows]);
  }

  downloadCsv(filename, rows) {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  // Fallback seed agents for resilience
  getEmbeddedFallbackAgents() {
    return [
      {
        id: 'cursor',
        name: 'Cursor',
        headline: 'AI-first code editor with deep codebase indexing',
        category: 'coding',
        agentType: 'ide',
        license: 'proprietary',
        harness: 'Cursor Composer',
        defaultModel: 'Claude 3.5 Sonnet',
        usage: { tokens7d: 2980000000, growthRate7d: 14.8 },
        evals: { sweBenchVerified: { score: 49.2 }, terminalBench: { score: 41.5 }, bfclV4: { score: 88.4 }, costPerResolvedTask: { value: 2.45 }, latencyPerTaskSec: { value: 78.5 } }
      },
      {
        id: 'aider',
        name: 'Aider',
        headline: 'Open-source CLI pair programmer with Git',
        category: 'coding',
        agentType: 'cli',
        license: 'open-source',
        harness: 'Aider CLI Harness',
        defaultModel: 'Claude 3.5 Sonnet',
        usage: { tokens7d: 2150000000, growthRate7d: 19.3 },
        evals: { sweBenchVerified: { score: 51.6 }, terminalBench: { score: 48.0 }, bfclV4: { score: 86.1 }, costPerResolvedTask: { value: 1.18 }, latencyPerTaskSec: { value: 42.1 } }
      }
    ];
  }

  getEmbeddedFallbackMatrix() {
    return [
      { model: 'Claude 3.5 Sonnet', provider: 'Anthropic', harness: 'OpenHands', sweBenchVerified: 53.0, costPerTask: 3.12, source: 'SWE-bench Verified' },
      { model: 'Claude 3.5 Sonnet', provider: 'Anthropic', harness: 'Aider CLI', sweBenchVerified: 51.6, costPerTask: 1.18, source: 'Aider Leaderboard' }
    ];
  }
}

// Module export & browser window binding
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentEvals };
}
if (typeof window !== 'undefined') {
  window.AgentEvals = AgentEvals;
}
