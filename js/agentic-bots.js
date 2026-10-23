/**
 * Agentic AIBots: Production Systems, Autonomous Harnesses & Workflows
 * SnapFacts (snapfacts.in)
 * 
 * Production agentic bots from global companies and open-source projects,
 * showing how they rank and perform specifically on agentic workflow automation,
 * autonomy, governance, tool breadth, and production maturity.
 */

class AgenticBots {
  constructor(containerId = 'agentic-bots-container') {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    this.state = {
      bots: [],
      config: null,
      activeTab: 'rankings', // 'registry' | 'rankings' | 'performance' | 'capabilities' | 'adoption' | 'workflows'
      searchQuery: '',
      selectedCategory: 'all', // 'all' | 'enterprise' | 'coding' | 'personal_oss' | 'browser_computer' | 'workflow_service'
      selectedDeployment: 'all',
      selectedLicense: 'all',
      includePreviews: false, // Default GA only; preview bots only shown when checked
      sortField: 'readiness',
      sortDir: 'desc',
      weights: {
        reliability: 0.25,
        autonomy: 0.20,
        toolBreadth: 0.15,
        governance: 0.20,
        productionMaturity: 0.10,
        ecosystem: 0.10
      },
      compareList: [],
      capabilitiesSelected: ['salesforce-agentforce', 'claude-code', 'devin', 'microsoft-copilot-studio'],
      activeWorkflowId: 'healthcare',
      workflowViewMode: '3d', // '3d' | '2d'
      selectedNodeId: null,
      inspectBotId: null,
      showMethodologyModal: false,
      showCompareModal: false,
      status: 'cached',
      lastRefreshed: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.threeData = {
      renderer: null,
      scene: null,
      camera: null,
      animId: null,
      nodes3D: [],
      particles: [],
      isDragging: false,
      prevMouse: { x: 0, y: 0 },
      rotation: { x: 0.2, y: -0.3 }
    };

    this.init();
  }

  async init() {
    this.readUrlState();
    await this.loadData();
    this.render();
    this.bindEvents();

    if (this.state.activeTab === 'workflows' && this.state.workflowViewMode === '3d') {
      setTimeout(() => this.initThreeScene(), 60);
    }
  }

  readUrlState() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('abTab')) this.state.activeTab = params.get('abTab');
      if (params.get('abCat')) this.state.selectedCategory = params.get('abCat');
      if (params.get('abQ')) this.state.searchQuery = params.get('abQ');
      if (params.get('abPreviews') === 'true') this.state.includePreviews = true;
      if (params.get('abWf')) this.state.activeWorkflowId = params.get('abWf');
      if (params.get('abInspect')) this.state.inspectBotId = params.get('abInspect');
      if (params.get('abCompare')) {
        this.state.compareList = params.get('abCompare').split(',').slice(0, 4);
      }
    } catch (e) {
      console.warn('Could not parse URL state for AgenticBots:', e);
    }
  }

  syncUrlState() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('abTab', this.state.activeTab);
      if (this.state.selectedCategory !== 'all') url.searchParams.set('abCat', this.state.selectedCategory);
      else url.searchParams.delete('abCat');

      if (this.state.searchQuery) url.searchParams.set('abQ', this.state.searchQuery);
      else url.searchParams.delete('abQ');

      if (this.state.includePreviews) url.searchParams.set('abPreviews', 'true');
      else url.searchParams.delete('abPreviews');

      if (this.state.activeWorkflowId) url.searchParams.set('abWf', this.state.activeWorkflowId);
      if (this.state.inspectBotId) url.searchParams.set('abInspect', this.state.inspectBotId);
      else url.searchParams.delete('abInspect');

      if (this.state.compareList.length > 0) url.searchParams.set('abCompare', this.state.compareList.join(','));
      else url.searchParams.delete('abCompare');

      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // Ignore URL history errors
    }
  }

  async loadData() {
    try {
      const [confRes, cacheRes] = await Promise.all([
        fetch('./data/agentic_bots_config.json'),
        fetch('./data/agentic_bots_cache.json')
      ]);

      if (confRes.ok) this.state.config = await confRes.json();
      if (cacheRes.ok) {
        const cache = await cacheRes.json();
        this.state.bots = cache.bots || [];
        this.state.status = cache.status || 'live';
      }
    } catch (err) {
      console.warn('AgenticBots failed to fetch remote cache, falling back to bundled data:', err);
    }

    if (this.state.config && this.state.config.methodology && this.state.config.methodology.scoringFormula) {
      this.state.weights = { ...this.state.config.methodology.scoringFormula.defaultWeights };
    }
  }

  // Calculate Agentic Readiness Score with dynamic weights
  calculateARS(bot) {
    if (!bot || !bot.readinessMetrics) return 0;
    const w = this.state.weights;
    const m = bot.readinessMetrics;
    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;

    const raw = (
      (m.reliability || 70) * w.reliability +
      (m.autonomy || 70) * w.autonomy +
      (m.toolBreadth || 70) * w.toolBreadth +
      (m.governance || 70) * w.governance +
      (m.productionMaturity || 70) * w.productionMaturity +
      (m.ecosystem || 70) * w.ecosystem
    ) / totalWeight;

    return Math.round(raw * 10) / 10;
  }

  getFilteredBots() {
    return this.state.bots
      .filter(bot => {
        // Previews filter: if includePreviews is false, only show GA
        if (!this.state.includePreviews && bot.status !== 'ga') return false;

        // Category filter
        if (this.state.selectedCategory !== 'all' && bot.category !== this.state.selectedCategory) return false;

        // Deployment filter
        if (this.state.selectedDeployment !== 'all') {
          const dep = (bot.deployment || '').toLowerCase();
          if (this.state.selectedDeployment === 'saas' && !dep.includes('cloud') && !dep.includes('saas')) return false;
          if (this.state.selectedDeployment === 'self-hosted' && !dep.includes('self-hosted') && !dep.includes('docker') && !dep.includes('kubernetes')) return false;
          if (this.state.selectedDeployment === 'cli' && !dep.includes('cli') && !dep.includes('terminal')) return false;
        }

        // License filter
        if (this.state.selectedLicense !== 'all') {
          const lic = (bot.license || '').toLowerCase();
          const isOss = lic.includes('apache') || lic.includes('mit') || lic.includes('open');
          if (this.state.selectedLicense === 'oss' && !isOss) return false;
          if (this.state.selectedLicense === 'proprietary' && isOss) return false;
        }

        // Search query
        if (this.state.searchQuery) {
          const q = this.state.searchQuery.toLowerCase();
          const match = (
            bot.name.toLowerCase().includes(q) ||
            bot.company.toLowerCase().includes(q) ||
            (bot.description || '').toLowerCase().includes(q) ||
            (bot.harnessConfig || '').toLowerCase().includes(q) ||
            (bot.capabilities?.toolCount || '').toLowerCase().includes(q)
          );
          if (!match) return false;
        }

        return true;
      })
      .map(bot => ({ ...bot, arsScore: this.calculateARS(bot) }))
      .sort((a, b) => {
        if (this.state.sortField === 'readiness') {
          return this.state.sortDir === 'desc' ? b.arsScore - a.arsScore : a.arsScore - b.arsScore;
        }
        if (this.state.sortField === 'name') {
          return this.state.sortDir === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
        }
        if (this.state.sortField === 'autonomy') {
          const hA = a.autonomy?.longestTaskHorizonMinutes || 0;
          const hB = b.autonomy?.longestTaskHorizonMinutes || 0;
          return this.state.sortDir === 'desc' ? hB - hA : hA - hB;
        }
        return 0;
      });
  }

  // Main Render Routine
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="ab-shell">
        ${this.renderHeader()}
        ${this.renderTabsBar()}
        
        <div class="ab-view-content" id="ab-view-root">
          ${this.renderActiveView()}
        </div>

        ${this.renderCompareTray()}
        ${this.renderInspectModal()}
        ${this.renderMethodologyModal()}
      </div>
    `;

    this.attachViewSpecificHandlers();
  }

  renderHeader() {
    const isLive = this.state.status === 'live';
    return `
      <header class="ab-header">
        <div class="ab-header-top">
          <div class="ab-title-group">
            <h1 class="ab-title">
              <span>🦾</span> Agentic AIBots
              <span class="ab-title-badge">Production Systems</span>
            </h1>
            <p class="ab-subtitle">
              Verified production agentic bots and open-source frameworks evaluated on multi-step workflow automation, task horizon, enterprise governance, tool harnesses, and operational readiness.
            </p>
          </div>

          <div class="ab-header-controls">
            <span class="ab-status-pill">
              <span class="ab-pulse-dot" style="background: ${isLive ? 'var(--ab-emerald)' : 'var(--ab-amber)'};"></span>
              ${this.state.status.toUpperCase()} • ${this.state.lastRefreshed}
            </span>
            <button type="button" class="ab-btn-action" id="ab-btn-methodology" title="View Qualification Rules & Inclusion Standard">
              <i class="fa-solid fa-scale-balanced"></i> Inclusion Rules
            </button>
            <button type="button" class="ab-btn-action" id="ab-btn-export-csv" title="Download Verified Bots CSV">
              <i class="fa-solid fa-file-csv"></i> CSV
            </button>
          </div>
        </div>

        <div class="ab-cross-nav">
          <span class="ab-cross-nav-label">Cross-Board Intelligence:</span>
          <a class="ab-cross-pill" data-nav-target="all" href="#board=all" title="View Foundation Model Elo & Arena Benchmarks">
            <span>🌐</span> LLM Intelboard (Model Elo & Arena) →
          </a>
          <a class="ab-cross-pill" data-nav-target="agentevals" href="#board=agentevals" title="View OpenRouter Token Volume & SWE-bench Leaderboard">
            <span>🤖</span> AgentEvals (Usage Volume & Evals) →
          </a>
          <a class="ab-cross-pill" data-nav-target="hfboard" href="#board=hfboard" title="View Hugging Face Open-Weight Models & Hub Telemetry">
            <span>🤗</span> HFBoard (Hub Telemetry & Licenses) →
          </a>
        </div>
      </header>
    `;
  }

  renderTabsBar() {
    const tabs = [
      { id: 'rankings', label: '🏆 Rankings & Readiness', count: null },
      { id: 'registry', label: '📋 Registry', count: this.state.bots.length },
      { id: 'performance', label: '📊 Performance & Evals', count: null },
      { id: 'capabilities', label: '🎛️ Capabilities Matrix', count: null },
      { id: 'adoption', label: '📈 Adoption & Stars', count: null },
      { id: 'workflows', label: '🌐 3D Workflows', count: 'Interactive' }
    ];

    return `
      <nav class="ab-tabs-bar" aria-label="Agentic AIBots Navigation">
        ${tabs.map(t => `
          <button type="button" 
                  class="ab-tab-btn ${this.state.activeTab === t.id ? 'is-active' : ''}" 
                  data-ab-tab="${t.id}">
            ${t.label}
            ${t.count ? `<span class="ab-tab-count">${t.count}</span>` : ''}
          </button>
        `).join('')}
      </nav>
    `;
  }

  renderActiveView() {
    switch (this.state.activeTab) {
      case 'registry':
        return this.renderRegistryView();
      case 'rankings':
        return this.renderRankingsView();
      case 'performance':
        return this.renderPerformanceView();
      case 'capabilities':
        return this.renderCapabilitiesView();
      case 'adoption':
        return this.renderAdoptionView();
      case 'workflows':
        return this.renderWorkflowsView();
      default:
        return this.renderRankingsView();
    }
  }

  // --------------------------------------------------------------------------
  // VIEW 1: REGISTRY
  // --------------------------------------------------------------------------
  renderRegistryView() {
    const list = this.getFilteredBots();
    const categories = this.state.config?.categories || [];

    return `
      <div class="ab-registry-controls">
        <div class="ab-filter-group">
          <div class="ab-search-box">
            <i class="fa-solid fa-magnifying-glass ab-search-icon"></i>
            <input type="text" id="ab-registry-search" placeholder="Search bots, companies, tools..." value="${this.escapeHtml(this.state.searchQuery)}" />
          </div>

          <select class="ab-select-filter" id="ab-filter-category">
            <option value="all" ${this.state.selectedCategory === 'all' ? 'selected' : ''}>All Categories</option>
            ${categories.map(c => `
              <option value="${c.id}" ${this.state.selectedCategory === c.id ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>

          <select class="ab-select-filter" id="ab-filter-deployment">
            <option value="all" ${this.state.selectedDeployment === 'all' ? 'selected' : ''}>All Deployments</option>
            <option value="saas" ${this.state.selectedDeployment === 'saas' ? 'selected' : ''}>Cloud SaaS / VPC</option>
            <option value="self-hosted" ${this.state.selectedDeployment === 'self-hosted' ? 'selected' : ''}>Self-Hosted / Docker</option>
            <option value="cli" ${this.state.selectedDeployment === 'cli' ? 'selected' : ''}>Local CLI / Terminal</option>
          </select>

          <select class="ab-select-filter" id="ab-filter-license">
            <option value="all" ${this.state.selectedLicense === 'all' ? 'selected' : ''}>All Licenses</option>
            <option value="oss" ${this.state.selectedLicense === 'oss' ? 'selected' : ''}>Open-Source (MIT/Apache)</option>
            <option value="proprietary" ${this.state.selectedLicense === 'proprietary' ? 'selected' : ''}>Commercial / Enterprise</option>
          </select>
        </div>

        <div class="ab-filter-group">
          <label class="ab-toggle-previews">
            <input type="checkbox" id="ab-toggle-previews" ${this.state.includePreviews ? 'checked' : ''} />
            <span>Include Previews & Beta Bots</span>
          </label>
          <span style="font-size: 0.82rem; color: var(--ab-text-muted); margin-left: 0.5rem;">
            Showing <strong>${list.length}</strong> bots
          </span>
        </div>
      </div>

      <div class="ab-table-card">
        <div class="ab-table-responsive">
          <table class="ab-data-table">
            <thead>
              <tr>
                <th style="width: 50px;">Rank</th>
                <th>Bot / Provider</th>
                <th>Category</th>
                <th>Status</th>
                <th>Deployment</th>
                <th>Harness / MCP</th>
                <th>Governance</th>
                <th>ARS Score</th>
                <th style="text-align: right; width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 3rem; color: var(--ab-text-muted);">
                    No verified agentic bots match your current search and filters.
                  </td>
                </tr>
              ` : list.map((bot, idx) => {
                const isCompared = this.state.compareList.includes(bot.id);
                const govTierClass = bot.governance?.governanceTier?.includes('Tier 1') ? 'ab-tier-1' : bot.governance?.governanceTier?.includes('Tier 2') ? 'ab-tier-2' : 'ab-tier-3';
                return `
                  <tr>
                    <td>
                      <span style="font-family: var(--ab-font-display); font-weight: 700; color: var(--ab-text-muted);">
                        #${idx + 1}
                      </span>
                    </td>
                    <td>
                      <div class="ab-bot-meta-cell">
                        <div class="ab-bot-avatar">
                          ${bot.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div class="ab-bot-info-title">
                            ${this.escapeHtml(bot.name)}
                            ${bot.verified ? '<i class="fa-solid fa-circle-check ab-badge-verified" title="Official Verified Production Agent"></i>' : ''}
                          </div>
                          <div class="ab-bot-info-company">
                            ${this.escapeHtml(bot.company)} • ${this.escapeHtml(bot.license)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style="font-size: 0.82rem; font-weight: 500;">
                        ${this.escapeHtml(bot.type)}
                      </span>
                    </td>
                    <td>
                      <span class="ab-status-tag ${bot.status === 'ga' ? 'ab-status-ga' : 'ab-status-preview'}">
                        ${bot.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style="font-size: 0.82rem; color: var(--ab-text-muted);">
                        ${this.escapeHtml(bot.deployment)}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; line-height: 1.35;">
                        <strong style="color: var(--ab-text-main);">${this.escapeHtml(bot.capabilities?.mcpSupport || 'n/r')}</strong>
                        <div style="color: var(--ab-text-muted); font-size: 0.75rem;">${this.escapeHtml(bot.capabilities?.toolCount || 'Tools n/r')}</div>
                      </div>
                    </td>
                    <td>
                      <span class="ab-gov-tier ${govTierClass}">
                        ${this.escapeHtml(bot.governance?.governanceTier?.split(' ')[0] || 'Tier 2')}
                      </span>
                    </td>
                    <td>
                      <div class="ab-score-pill">
                        <span>${bot.arsScore}</span>
                        <div class="ab-score-bar-mini">
                          <div class="ab-score-fill" style="width: ${Math.min(100, bot.arsScore)}%;"></div>
                        </div>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <button type="button" class="ab-btn-action" data-inspect-bot="${bot.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;" title="View Technical Dossier">
                          Dossier
                        </button>
                        <button type="button" class="ab-btn-action ${isCompared ? 'ab-btn-primary' : ''}" data-compare-toggle="${bot.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;" title="Compare Bot">
                          <i class="fa-solid fa-scale-unbalanced"></i>
                        </button>
                      </div>
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

  // --------------------------------------------------------------------------
  // VIEW 2: RANKINGS & READINESS SCORE
  // --------------------------------------------------------------------------
  renderRankingsView() {
    const list = this.getFilteredBots();
    const top3 = list.slice(0, 3);
    const w = this.state.weights;

    return `
      <!-- Top 3 Hero Cards -->
      <div class="ab-hero-cards-grid">
        ${top3.map((bot, idx) => {
          const rank = idx + 1;
          return `
            <div class="ab-hero-card rank-${rank}">
              <div class="ab-hero-rank-badge">#${rank}</div>
              <div class="ab-hero-title-wrap">
                <div class="ab-hero-avatar">${bot.name.substring(0, 2).toUpperCase()}</div>
                <div>
                  <h3 class="ab-hero-name">${this.escapeHtml(bot.name)}</h3>
                  <span style="font-size: 0.8rem; color: var(--ab-text-muted); font-weight: 500;">
                    ${this.escapeHtml(bot.company)} • ${bot.type}
                  </span>
                </div>
              </div>

              <p class="ab-hero-desc">${this.escapeHtml(bot.description)}</p>

              <div class="ab-hero-stats-row">
                <div>
                  <div class="ab-stat-item-label">Readiness ARS</div>
                  <div class="ab-stat-item-val" style="color: var(--ab-primary);">${bot.arsScore}</div>
                </div>
                <div>
                  <div class="ab-stat-item-label">Task Horizon</div>
                  <div class="ab-stat-item-val">${bot.autonomy?.longestTaskHorizonMinutes || 'n/r'}m</div>
                </div>
                <div>
                  <div class="ab-stat-item-label">Intervention</div>
                  <div class="ab-stat-item-val" style="color: var(--ab-emerald);">${bot.autonomy?.humanInterventionRatePct || 'n/r'}%</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; font-size: 0.78rem;">
                <span class="ab-gov-tier ab-tier-1">${this.escapeHtml(bot.governance?.governanceTier || 'Tier 1')}</span>
                <button type="button" class="ab-btn-action" data-inspect-bot="${bot.id}" style="padding: 0.35rem 0.75rem;">
                  Full Specs →
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Interactive Agentic Readiness Score (ARS) Formula & Sliders -->
      <div class="ab-formula-card">
        <div class="ab-formula-header">
          <div>
            <h3 class="ab-formula-title">
              <i class="fa-solid fa-sliders" style="color: var(--ab-primary);"></i>
              Agentic Readiness Score (ARS) — Interactive Formula
            </h3>
            <span style="font-size: 0.85rem; color: var(--ab-text-muted);">
              Adjust weight dimensions below to dynamically recalculate overall bot readiness rankings.
            </span>
          </div>
          <button type="button" class="ab-btn-action" id="ab-btn-reset-weights">
            <i class="fa-solid fa-rotate-left"></i> Reset Defaults
          </button>
        </div>

        <div class="ab-formula-display" id="ab-formula-text">
          ARS = (Reliability × ${w.reliability.toFixed(2)}) + (Autonomy × ${w.autonomy.toFixed(2)}) + (Tool Breadth × ${w.toolBreadth.toFixed(2)}) + (Governance × ${w.governance.toFixed(2)}) + (Production Maturity × ${w.productionMaturity.toFixed(2)}) + (Ecosystem × ${w.ecosystem.toFixed(2)})
        </div>

        <div class="ab-sliders-grid">
          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Reliability (Pass^k)</span>
              <strong id="val-weight-reliability">${Math.round(w.reliability * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.reliability * 100)}" data-weight-dim="reliability" />
          </div>

          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Autonomy Horizon</span>
              <strong id="val-weight-autonomy">${Math.round(w.autonomy * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.autonomy * 100)}" data-weight-dim="autonomy" />
          </div>

          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Tool & MCP Breadth</span>
              <strong id="val-weight-toolBreadth">${Math.round(w.toolBreadth * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.toolBreadth * 100)}" data-weight-dim="toolBreadth" />
          </div>

          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Governance & Audit</span>
              <strong id="val-weight-governance">${Math.round(w.governance * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.governance * 100)}" data-weight-dim="governance" />
          </div>

          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Production Maturity</span>
              <strong id="val-weight-productionMaturity">${Math.round(w.productionMaturity * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.productionMaturity * 100)}" data-weight-dim="productionMaturity" />
          </div>

          <div class="ab-slider-item">
            <div class="ab-slider-label-row">
              <span>Ecosystem & Adoption</span>
              <strong id="val-weight-ecosystem">${Math.round(w.ecosystem * 100)}%</strong>
            </div>
            <input type="range" min="0" max="50" step="5" value="${Math.round(w.ecosystem * 100)}" data-weight-dim="ecosystem" />
          </div>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div class="ab-category-nav-pills">
        <button type="button" class="ab-cat-pill-btn ${this.state.selectedCategory === 'all' ? 'is-active' : ''}" data-cat-select="all">
          <i class="fa-solid fa-list-check"></i> All Categories (${list.length})
        </button>
        ${(this.state.config?.categories || []).map(cat => `
          <button type="button" class="ab-cat-pill-btn ${this.state.selectedCategory === cat.id ? 'is-active' : ''}" data-cat-select="${cat.id}">
            <i class="fa-solid ${cat.icon || 'fa-tag'}"></i> ${cat.name}
          </button>
        `).join('')}
      </div>

      <!-- Ranked Table View -->
      ${this.renderRegistryTableOnly(list)}
    `;
  }

  renderRegistryTableOnly(list) {
    return `
      <div class="ab-table-card">
        <div class="ab-table-responsive">
          <table class="ab-data-table">
            <thead>
              <tr>
                <th style="width: 50px;">Rank</th>
                <th>Bot / Provider</th>
                <th>Category</th>
                <th>Autonomy Horizon</th>
                <th>Intervention Rate</th>
                <th>MCP & Tools</th>
                <th>Governance Tier</th>
                <th>ARS Score</th>
                <th style="text-align: right; width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((bot, idx) => {
                const isCompared = this.state.compareList.includes(bot.id);
                return `
                  <tr>
                    <td>
                      <span style="font-family: var(--ab-font-display); font-weight: 700; color: ${idx < 3 ? 'var(--ab-primary)' : 'var(--ab-text-muted)'};">
                        #${idx + 1}
                      </span>
                    </td>
                    <td>
                      <div class="ab-bot-meta-cell">
                        <div class="ab-bot-avatar">${bot.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <div class="ab-bot-info-title">
                            ${this.escapeHtml(bot.name)}
                            ${bot.verified ? '<i class="fa-solid fa-circle-check ab-badge-verified"></i>' : ''}
                          </div>
                          <div class="ab-bot-info-company">${this.escapeHtml(bot.company)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style="font-size: 0.82rem;">${this.escapeHtml(bot.type)}</span></td>
                    <td><strong>${bot.autonomy?.longestTaskHorizonMinutes || 'n/r'} mins</strong></td>
                    <td><span style="color: var(--ab-emerald); font-weight: 600;">${bot.autonomy?.humanInterventionRatePct ? `${bot.autonomy.humanInterventionRatePct}%` : 'n/r'}</span></td>
                    <td><span style="font-size: 0.8rem; color: var(--ab-text-muted);">${this.escapeHtml(bot.capabilities?.toolCount || 'n/r')}</span></td>
                    <td><span class="ab-gov-tier ab-tier-1">${this.escapeHtml(bot.governance?.governanceTier?.split(' ')[0] || 'Tier 2')}</span></td>
                    <td>
                      <div class="ab-score-pill">
                        <span>${bot.arsScore}</span>
                        <div class="ab-score-bar-mini">
                          <div class="ab-score-fill" style="width: ${Math.min(100, bot.arsScore)}%;"></div>
                        </div>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <button type="button" class="ab-btn-action" data-inspect-bot="${bot.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">
                          Dossier
                        </button>
                        <button type="button" class="ab-btn-action ${isCompared ? 'ab-btn-primary' : ''}" data-compare-toggle="${bot.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">
                          <i class="fa-solid fa-scale-unbalanced"></i>
                        </button>
                      </div>
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

  // --------------------------------------------------------------------------
  // VIEW 3: PERFORMANCE & BENCHMARK HEATMAP
  // --------------------------------------------------------------------------
  renderPerformanceView() {
    const bots = this.getFilteredBots();

    return `
      <div class="ab-perf-grid">
        <!-- Benchmark Heatmap -->
        <div class="ab-chart-card">
          <div class="ab-chart-header">
            <h3 class="ab-chart-title">Agentic Benchmark Heatmap</h3>
            <p class="ab-chart-subtitle">
              Evaluated configurations across GAIA, WebArena, OSWorld, Tau-bench (retail/airline pass^1), and Terminal-Bench.
              Only verified direct bot/harness evaluations are recorded; unbenchmarked bots show <em>no direct eval</em>.
            </p>
          </div>

          <div class="ab-table-responsive">
            <table class="ab-heatmap-table">
              <thead>
                <tr>
                  <th style="min-width: 180px;">Agentic Bot</th>
                  <th>Harness Configuration</th>
                  <th>GAIA</th>
                  <th>WebArena</th>
                  <th>OSWorld</th>
                  <th>Tau-Bench (Retail)</th>
                  <th>Terminal-Bench</th>
                </tr>
              </thead>
              <tbody>
                ${bots.map(bot => {
                  const tc = bot.taskCompletion || {};
                  const gaiaVal = typeof tc.gaia === 'number' ? tc.gaia : null;
                  const webVal = typeof tc.webarena === 'number' ? tc.webarena : null;
                  const osVal = typeof tc.osworld === 'number' ? tc.osworld : null;
                  const tauVal = tc.tauBench?.retailPass1 || null;
                  const termVal = typeof tc.terminalBench === 'number' ? tc.terminalBench : null;

                  return `
                    <tr>
                      <td>
                        <strong>${this.escapeHtml(bot.name)}</strong>
                        <div style="font-size: 0.75rem; color: var(--ab-text-muted);">${bot.company}</div>
                      </td>
                      <td style="font-size: 0.78rem; text-align: left; max-width: 260px; color: var(--ab-text-muted);">
                        ${this.escapeHtml(bot.harnessConfig || 'Direct Vendor Harness')}
                      </td>
                      <td>${this.renderHeatmapCell(gaiaVal, 0, 70)}</td>
                      <td>${this.renderHeatmapCell(webVal, 0, 70)}</td>
                      <td>${this.renderHeatmapCell(osVal, 0, 60)}</td>
                      <td>${this.renderHeatmapCell(tauVal, 0, 90)}</td>
                      <td>${this.renderHeatmapCell(termVal, 0, 90)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Autonomy vs Governance Scatter Plot -->
        <div class="ab-chart-card">
          <div class="ab-chart-header">
            <h3 class="ab-chart-title">Autonomy Horizon vs. Enterprise Governance Tier</h3>
            <p class="ab-chart-subtitle">
              Scatter distribution mapping longest autonomous task duration (minutes) against comprehensive governance & sandboxing depth.
            </p>
          </div>

          <div class="ab-canvas-container" style="height: 380px;">
            <canvas id="ab-scatter-canvas" style="width: 100%; height: 100%;"></canvas>
          </div>

          <div class="ab-scatter-legend">
            <div class="ab-scatter-legend-item">
              <span class="ab-scatter-dot" style="background: var(--ab-primary);"></span>
              <span>Enterprise Mission-Critical (Tier 1)</span>
            </div>
            <div class="ab-scatter-legend-item">
              <span class="ab-scatter-dot" style="background: var(--ab-indigo);"></span>
              <span>Developer Standard (Tier 2)</span>
            </div>
            <div class="ab-scatter-legend-item">
              <span class="ab-scatter-dot" style="background: var(--ab-purple);"></span>
              <span>Developer Sandbox (Tier 3)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHeatmapCell(val, min, max) {
    if (val === null || val === undefined) {
      return `<span class="ab-heat-none">no direct eval</span>`;
    }
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const bg = `rgba(2, 132, 199, ${0.12 + ratio * 0.75})`;
    const color = ratio > 0.6 ? '#ffffff' : 'var(--ab-text-main)';
    return `<span class="ab-heat-val" style="background: ${bg}; color: ${color};">${val.toFixed(1)}%</span>`;
  }

  // --------------------------------------------------------------------------
  // VIEW 4: CAPABILITIES MATRIX & RADAR
  // --------------------------------------------------------------------------
  renderCapabilitiesView() {
    const selectedBots = this.state.capabilitiesSelected
      .map(id => this.state.bots.find(b => b.id === id))
      .filter(Boolean);

    return `
      <div class="ab-capabilities-layout">
        <!-- Bot Selector Chips -->
        <div class="ab-bot-selector-bar">
          <div class="ab-bot-selector-title">Select up to 4 Agentic Bots for Side-by-Side Architectural Comparison:</div>
          <div class="ab-bot-chips-wrap">
            ${this.state.bots.map(bot => {
              const isSel = this.state.capabilitiesSelected.includes(bot.id);
              return `
                <button type="button" class="ab-bot-chip ${isSel ? 'is-selected' : ''}" data-cap-toggle="${bot.id}">
                  <i class="fa-solid ${isSel ? 'fa-circle-check' : 'fa-circle-plus'}"></i>
                  ${this.escapeHtml(bot.name)}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 6-Axis Interactive Radar Comparison -->
        <div class="ab-chart-card">
          <div class="ab-chart-header">
            <h3 class="ab-chart-title">6-Dimension Architectural Radar</h3>
            <p class="ab-chart-subtitle">Comparing Autonomy, Reliability, Tool Breadth, Governance, Production Maturity, and Ecosystem.</p>
          </div>
          <div class="ab-radar-container">
            <canvas id="ab-radar-canvas" width="480" height="380" style="max-width: 100%; height: auto;"></canvas>
          </div>
        </div>

        <!-- Side-by-Side Detailed Matrix Table -->
        <div class="ab-table-card">
          <div class="ab-table-responsive">
            <table class="ab-data-table">
              <thead>
                <tr>
                  <th style="min-width: 180px;">Capability Metric</th>
                  ${selectedBots.map(bot => `
                    <th style="min-width: 220px;">
                      <strong>${this.escapeHtml(bot.name)}</strong>
                      <div style="font-size: 0.75rem; color: var(--ab-text-muted); font-weight: normal;">${bot.company}</div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Model & Execution Harness</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.harnessConfig || 'Proprietary')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Tools & Integrations</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;"><strong>${this.escapeHtml(b.capabilities?.toolCount || 'n/r')}</strong></td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Model Context Protocol (MCP)</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;"><span class="ab-node-badge agent">${this.escapeHtml(b.capabilities?.mcpSupport || 'n/r')}</span></td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Computer / Browser Use</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.capabilities?.browserComputerUse || 'API only')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Multi-Agent Pattern</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.capabilities?.multiAgentPattern || 'Sequential')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Memory Architecture</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.capabilities?.memory || 'Session only')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Supported Channels</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${(b.capabilities?.channels || []).join(', ')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Sandboxing & Isolation</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.governance?.sandboxing || 'Local process')}</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Human Approval Gates</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;"><span style="color: var(--ab-emerald); font-weight: 600;">${this.escapeHtml(b.governance?.approvalGates || 'None')}</span></td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Deployment & License</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.deployment)} (${this.escapeHtml(b.license)})</td>`).join('')}
                </tr>
                <tr>
                  <td><strong>Pricing Model</strong></td>
                  ${selectedBots.map(b => `<td style="font-size: 0.82rem;">${this.escapeHtml(b.pricing || 'Custom')}</td>`).join('')}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // VIEW 5: ADOPTION & STARS
  // --------------------------------------------------------------------------
  renderAdoptionView() {
    const ossBots = this.state.bots.filter(b => b.adoption?.githubStars).sort((a, b) => (b.adoption?.githubStars || 0) - (a.adoption?.githubStars || 0));
    const enterpriseBots = this.state.bots.filter(b => b.adoption?.vendorCustomerCount);

    return `
      <div class="ab-adoption-grid">
        <!-- Open-Source Developer Momentum -->
        <div class="ab-chart-card">
          <div class="ab-chart-header">
            <h3 class="ab-chart-title">Open-Source Framework Momentum</h3>
            <p class="ab-chart-subtitle">GitHub Stars, monthly package downloads, and release cadence for developer harnesses.</p>
          </div>

          <div class="ab-table-responsive">
            <table class="ab-data-table">
              <thead>
                <tr>
                  <th>Framework / Bot</th>
                  <th>GitHub Stars</th>
                  <th>Forks</th>
                  <th>Monthly Downloads</th>
                  <th>Release Cadence</th>
                </tr>
              </thead>
              <tbody>
                ${ossBots.map(b => `
                  <tr>
                    <td>
                      <strong>${this.escapeHtml(b.name)}</strong>
                      <div style="font-size: 0.75rem; color: var(--ab-text-muted);">${b.license}</div>
                    </td>
                    <td><strong>⭐ ${(b.adoption.githubStars || 0).toLocaleString()}</strong></td>
                    <td>${(b.adoption.githubForks || 0).toLocaleString()}</td>
                    <td>${b.adoption.monthlyDownloads ? `${(b.adoption.monthlyDownloads / 1000).toFixed(0)}k/mo` : 'n/r'}</td>
                    <td><span class="ab-status-tag ab-status-ga">${b.adoption.releaseCadence}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Enterprise Customer Adoption (Vendor-Reported) -->
        <div class="ab-chart-card">
          <div class="ab-chart-header">
            <h3 class="ab-chart-title">Enterprise Commercial Deployments</h3>
            <p class="ab-chart-subtitle">Vendor-reported organizational customer counts and enterprise release cycles.</p>
          </div>

          <div class="ab-table-responsive">
            <table class="ab-data-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Provider</th>
                  <th>Reported Deployments</th>
                  <th>Verification Status</th>
                </tr>
              </thead>
              <tbody>
                ${enterpriseBots.map(b => `
                  <tr>
                    <td><strong>${this.escapeHtml(b.name)}</strong></td>
                    <td>${this.escapeHtml(b.company)}</td>
                    <td><strong style="color: var(--ab-primary);">${this.escapeHtml(b.adoption.vendorCustomerCount)}</strong></td>
                    <td>
                      <span class="ab-status-tag" style="background: var(--ab-bg-subtle); color: var(--ab-text-muted);">
                        ${b.adoption.isVendorReported ? 'Vendor-Reported' : 'Independent Audit'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // VIEW 6: 3D WORKFLOWS (Three.js WebGL & 2D Fallback)
  // --------------------------------------------------------------------------
  renderWorkflowsView() {
    const workflows = this.state.config?.workflows3D || [];
    const activeWf = workflows.find(w => w.id === this.state.activeWorkflowId) || workflows[0] || {};
    const is3D = this.state.workflowViewMode === '3d';

    return `
      <div class="ab-workflows-container">
        <!-- Controls & Scene Selector -->
        <div class="ab-wf-controls-card">
          <div class="ab-wf-scene-selector">
            ${workflows.map(wf => `
              <button type="button" class="ab-scene-btn ${wf.id === this.state.activeWorkflowId ? 'is-active' : ''}" data-wf-select="${wf.id}">
                ${wf.id === 'healthcare' ? '🏥' : wf.id === 'retail' ? '🏬' : '🛒'} ${wf.title.split(':')[0]}
              </button>
            `).join('')}
          </div>

          <div class="ab-wf-view-toggle">
            <button type="button" class="ab-view-toggle-btn ${is3D ? 'is-active' : ''}" data-wf-mode="3d">
              <i class="fa-solid fa-cube"></i> 3D WebGL Scene
            </button>
            <button type="button" class="ab-view-toggle-btn ${!is3D ? 'is-active' : ''}" data-wf-mode="2d">
              <i class="fa-solid fa-diagram-project"></i> 2D Diagram View
            </button>
          </div>
        </div>

        <!-- 3D Viewport or 2D Diagram -->
        ${is3D ? `
          <div class="ab-3d-viewport" id="ab-3d-viewport">
            <canvas class="ab-3d-canvas" id="ab-3d-canvas"></canvas>
            
            <div class="ab-3d-overlay">
              <div class="ab-3d-overlay-title">${this.escapeHtml(activeWf.title)}</div>
              <p class="ab-3d-overlay-desc">
                Interactive spatial pipeline with animated data packets flowing across agent nodes and human gate checkpoints.
              </p>
            </div>

            <div class="ab-3d-instructions">
              <i class="fa-solid fa-arrows-up-down-left-right"></i> Drag to rotate • Scroll to zoom • Hover/Click nodes to inspect
            </div>
          </div>
        ` : `
          <div class="ab-2d-flow-card">
            <h3 style="font-family: var(--ab-font-display); margin-top: 0; margin-bottom: 1.5rem; font-size: 1.2rem;">
              ${this.escapeHtml(activeWf.title)} (2D Workflow Step-Chain)
            </h3>
            <div class="ab-2d-step-chain">
              ${(activeWf.nodes || []).map((node, i) => `
                <div class="ab-2d-step-node ${node.isGate ? 'is-gate' : ''}">
                  <span class="ab-node-badge ${node.isGate ? 'gate' : 'agent'}">
                    ${node.isGate ? '🛑 HUMAN GATE' : `STEP ${i + 1}`}
                  </span>
                  <h4 class="ab-node-title">${this.escapeHtml(node.label)}</h4>
                  <p class="ab-node-role">${this.escapeHtml(node.role)}</p>
                  <div style="font-size: 0.75rem; color: var(--ab-text-muted); margin-top: 0.25rem;">
                    <strong>Checkpoint:</strong> ${this.escapeHtml(node.checkpoint)}
                  </div>
                  <div class="ab-node-tools-list">
                    ${(node.tools || []).map(tool => `
                      <span class="ab-node-tool-tag">${this.escapeHtml(tool)}</span>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}

        <!-- Industry Statistics & Mandatory Disclaimer -->
        <div class="ab-wf-info-banner">
          <p class="ab-wf-stats-text">
            <i class="fa-solid fa-chart-line" style="color: var(--ab-primary); margin-right: 0.4rem;"></i>
            ${this.escapeHtml(activeWf.stats || '')}
          </p>
          <div class="ab-wf-stats-source">
            <strong>Source:</strong> ${this.escapeHtml(activeWf.statsSource || 'Industry Benchmark Report')}
          </div>
          <div class="ab-wf-disclaimer-note">
            ⚠️ ${this.escapeHtml(activeWf.disclaimer || 'Illustrative workflow, not a specific vendor\'s deployment.')}
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // THREE.JS 3D WORKFLOW ENGINE
  // --------------------------------------------------------------------------
  initThreeScene() {
    const canvas = document.getElementById('ab-3d-canvas');
    const viewport = document.getElementById('ab-3d-viewport');
    if (!canvas || !viewport || !window.THREE) return;

    if (this.threeData.animId) {
      cancelAnimationFrame(this.threeData.animId);
      this.threeData.animId = null;
    }

    const THREE = window.THREE;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x070a12, 0.015);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, 28);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x6366f1, 0.8);
    dirLight2.position.set(-10, -10, -10);
    scene.add(dirLight2);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(40, 20, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -3;
    scene.add(gridHelper);

    // Get Active Nodes
    const workflows = this.state.config?.workflows3D || [];
    const activeWf = workflows.find(w => w.id === this.state.activeWorkflowId) || workflows[0] || {};
    const nodes = activeWf.nodes || [];

    const nodeObjects = [];
    const nodeCount = nodes.length;
    const spacing = 5;
    const startX = -((nodeCount - 1) * spacing) / 2;

    const curvePoints = [];

    nodes.forEach((node, i) => {
      const x = startX + i * spacing;
      const y = Math.sin(i * 0.8) * 1.5;
      const z = (i % 2 === 0 ? 0.5 : -0.5);

      const pos = new THREE.Vector3(x, y, z);
      curvePoints.push(pos);

      // Node Geometry: Spheres for agents, Red Cubes for Human Gates
      const geo = node.isGate ? new THREE.BoxGeometry(2.2, 2.2, 2.2) : new THREE.SphereGeometry(1.4, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: node.isGate ? 0xe11d48 : 0x0284c7,
        roughness: 0.2,
        metalness: 0.7,
        emissive: node.isGate ? 0x881337 : 0x0369a1,
        emissiveIntensity: 0.4
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData = { nodeData: node };
      scene.add(mesh);
      nodeObjects.push(mesh);

      // Outer Glow Ring
      const ringGeo = new THREE.RingGeometry(1.8, 2.1, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: node.isGate ? 0xf43f5e : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      scene.add(ring);
    });

    // Connecting Curve Tube
    if (curvePoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.2, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);
    }

    // Animated Flying Data Packet Particles
    const particles = [];
    for (let p = 0; p < 8; p++) {
      const pGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      scene.add(pMesh);
      particles.push({ mesh: pMesh, progress: p / 8 });
    }

    this.threeData = {
      renderer,
      scene,
      camera,
      nodes3D: nodeObjects,
      particles,
      animId: null,
      isDragging: false,
      prevMouse: { x: 0, y: 0 },
      rotation: { x: 0.1, y: 0 }
    };

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      this.threeData.animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Slow idle orbit if not dragging
      if (!this.threeData.isDragging) {
        this.threeData.rotation.y += delta * 0.15;
      }

      scene.rotation.y = this.threeData.rotation.y;
      scene.rotation.x = this.threeData.rotation.x;

      // Pulse nodes
      nodeObjects.forEach((m, idx) => {
        m.rotation.y += delta * 0.5;
        const scale = 1 + Math.sin(time * 3 + idx) * 0.06;
        m.scale.set(scale, scale, scale);
      });

      // Animate flowing particles along curve
      if (curvePoints.length > 1) {
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        particles.forEach(p => {
          p.progress = (p.progress + delta * 0.25) % 1;
          const pt = curve.getPointAt(p.progress);
          p.mesh.position.copy(pt);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Mouse Controls (Drag to rotate, scroll to zoom)
    viewport.onmousedown = (e) => {
      this.threeData.isDragging = true;
      this.threeData.prevMouse = { x: e.clientX, y: e.clientY };
    };

    window.onmousemove = (e) => {
      if (!this.threeData.isDragging) return;
      const dx = e.clientX - this.threeData.prevMouse.x;
      const dy = e.clientY - this.threeData.prevMouse.y;
      this.threeData.rotation.y += dx * 0.008;
      this.threeData.rotation.x = Math.max(-0.5, Math.min(0.5, this.threeData.rotation.x + dy * 0.008));
      this.threeData.prevMouse = { x: e.clientX, y: e.clientY };
    };

    window.onmouseup = () => {
      this.threeData.isDragging = false;
    };

    viewport.onwheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(12, Math.min(45, camera.position.z + e.deltaY * 0.03));
    };

    window.onresize = () => {
      if (!viewport || !renderer || !camera) return;
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
  }

  // --------------------------------------------------------------------------
  // CANVASES (Scatter Plot & 6-Axis Radar)
  // --------------------------------------------------------------------------
  renderScatterCanvas() {
    const canvas = document.getElementById('ab-scatter-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const w = rect.width;
    const h = rect.height;
    const pad = 50;

    ctx.clearRect(0, 0, w, h);

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Autonomous Task Horizon (Minutes)', w / 2, h - 15);

    ctx.save();
    ctx.translate(15, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Governance & Security Depth (Score 0–100)', 0, 0);
    ctx.restore();

    // Quadrant Mid-Lines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.beginPath();
    ctx.moveTo(pad + (w - pad * 2) / 2, pad);
    ctx.lineTo(pad + (w - pad * 2) / 2, h - pad);
    ctx.moveTo(pad, pad + (h - pad * 2) / 2);
    ctx.lineTo(w - pad, pad + (h - pad * 2) / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Quadrant Watermarks
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
    ctx.font = 'bold 12px Space Grotesk, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('PRODUCTION LEADERS', w - pad - 10, pad + 20);
    ctx.textAlign = 'left';
    ctx.fillText('AUTONOMOUS PIONEERS', pad + 10, pad + 20);

    // Draw Points
    const maxHorizon = 240;
    const bots = this.getFilteredBots();

    bots.forEach(bot => {
      const minutes = bot.autonomy?.longestTaskHorizonMinutes || 30;
      const govScore = bot.readinessMetrics?.governance || 70;

      const cx = pad + (minutes / maxHorizon) * (w - pad * 2);
      const cy = (h - pad) - ((govScore - 50) / 50) * (h - pad * 2);

      const color = bot.governance?.governanceTier?.includes('Tier 1') ? '#0284c7' : bot.governance?.governanceTier?.includes('Tier 2') ? '#6366f1' : '#8b5cf6';

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'var(--ab-text-main)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(bot.name, cx + 8, cy + 3);
    });
  }

  renderRadarCanvas() {
    const canvas = document.getElementById('ab-radar-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 130;

    ctx.clearRect(0, 0, w, h);

    const axes = [
      'Autonomy',
      'Reliability',
      'Tool Breadth',
      'Governance',
      'Production',
      'Ecosystem'
    ];
    const totalAxes = axes.length;

    // Draw Spider Web Concentric Rings
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1;
    for (let level = 1; level <= 5; level++) {
      const r = (radius / 5) * level;
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw Spokes & Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < totalAxes; i++) {
      const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      const labelX = cx + Math.cos(angle) * (radius + 20);
      const labelY = cy + Math.sin(angle) * (radius + 20);
      ctx.fillText(axes[i], labelX, labelY);
    }

    // Selected Bots Data Polygons
    const colors = ['#0284c7', '#059669', '#f59e0b', '#8b5cf6'];
    const selectedBots = this.state.capabilitiesSelected
      .map(id => this.state.bots.find(b => b.id === id))
      .filter(Boolean);

    selectedBots.forEach((bot, bIdx) => {
      const m = bot.readinessMetrics || {};
      const vals = [
        m.autonomy || 70,
        m.reliability || 70,
        m.toolBreadth || 70,
        m.governance || 70,
        m.productionMaturity || 70,
        m.ecosystem || 70
      ];

      const stroke = colors[bIdx % colors.length];
      ctx.strokeStyle = stroke;
      ctx.fillStyle = stroke + '25';
      ctx.lineWidth = 2;

      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        const r = (vals[i] / 100) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    });
  }

  // --------------------------------------------------------------------------
  // MODALS & OVERLAYS
  // --------------------------------------------------------------------------
  renderCompareTray() {
    if (this.state.compareList.length === 0) return '';
    const comparedBots = this.state.compareList
      .map(id => this.state.bots.find(b => b.id === id))
      .filter(Boolean);

    return `
      <div class="ab-compare-tray">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--ab-text-muted);">COMPARING:</span>
        <div class="ab-tray-items">
          ${comparedBots.map(b => `
            <span class="ab-tray-pill">
              ${this.escapeHtml(b.name)}
              <button type="button" class="ab-tray-remove" data-remove-compare="${b.id}">&times;</button>
            </span>
          `).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <button type="button" class="ab-btn-action ab-btn-primary" id="ab-btn-trigger-compare">
            Compare Matrix (${comparedBots.length})
          </button>
          <button type="button" class="ab-btn-action" id="ab-btn-clear-compare">
            Clear
          </button>
        </div>
      </div>
    `;
  }

  renderInspectModal() {
    if (!this.state.inspectBotId) return '';
    const bot = this.state.bots.find(b => b.id === this.state.inspectBotId);
    if (!bot) return '';

    return `
      <div class="ab-modal-backdrop" id="ab-inspect-backdrop">
        <div class="ab-modal-shell" onclick="event.stopPropagation();">
          <button type="button" class="ab-modal-close-btn" id="ab-inspect-close">&times;</button>
          
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div class="ab-hero-avatar">${bot.name.substring(0, 2).toUpperCase()}</div>
            <div>
              <h2 style="font-family: var(--ab-font-display); margin: 0; font-size: 1.4rem;">
                ${this.escapeHtml(bot.name)}
                ${bot.verified ? '<i class="fa-solid fa-circle-check ab-badge-verified"></i>' : ''}
              </h2>
              <span style="font-size: 0.85rem; color: var(--ab-text-muted);">
                ${this.escapeHtml(bot.company)} • ${bot.type} • Status: ${bot.status.toUpperCase()}
              </span>
            </div>
          </div>

          <p style="font-size: 0.95rem; line-height: 1.5; color: var(--ab-text-main); margin-bottom: 1.5rem;">
            ${this.escapeHtml(bot.description)}
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: var(--ab-bg-subtle); padding: 1rem; border-radius: var(--ab-radius-md);">
              <div class="ab-stat-item-label">Readiness ARS Score</div>
              <div style="font-family: var(--ab-font-display); font-size: 1.5rem; font-weight: 800; color: var(--ab-primary);">
                ${this.calculateARS(bot)}
              </div>
            </div>
            <div style="background: var(--ab-bg-subtle); padding: 1rem; border-radius: var(--ab-radius-md);">
              <div class="ab-stat-item-label">Longest Task Horizon</div>
              <div style="font-family: var(--ab-font-display); font-size: 1.5rem; font-weight: 800;">
                ${bot.autonomy?.longestTaskHorizonMinutes || 'n/r'} mins
              </div>
            </div>
            <div style="background: var(--ab-bg-subtle); padding: 1rem; border-radius: var(--ab-radius-md);">
              <div class="ab-stat-item-label">Human Intervention Rate</div>
              <div style="font-family: var(--ab-font-display); font-size: 1.5rem; font-weight: 800; color: var(--ab-emerald);">
                ${bot.autonomy?.humanInterventionRatePct ? `${bot.autonomy.humanInterventionRatePct}%` : 'n/r'}
              </div>
            </div>
          </div>

          <div class="ab-table-responsive" style="margin-bottom: 1.5rem;">
            <table class="ab-data-table">
              <tbody>
                <tr>
                  <td style="width: 180px;"><strong>Harness & Model</strong></td>
                  <td>${this.escapeHtml(bot.harnessConfig || 'Direct Execution Harness')}</td>
                </tr>
                <tr>
                  <td><strong>Tools & Connectors</strong></td>
                  <td>${this.escapeHtml(bot.capabilities?.toolCount || 'n/r')}</td>
                </tr>
                <tr>
                  <td><strong>Model Context Protocol</strong></td>
                  <td>${this.escapeHtml(bot.capabilities?.mcpSupport || 'n/r')}</td>
                </tr>
                <tr>
                  <td><strong>Governance & Sandboxing</strong></td>
                  <td>${this.escapeHtml(bot.governance?.sandboxing || 'Local execution')} • ${this.escapeHtml(bot.governance?.permissions || 'Standard')}</td>
                </tr>
                <tr>
                  <td><strong>Security & Advisories</strong></td>
                  <td>${this.escapeHtml(bot.governance?.securityAdvisories || 'Clean')}</td>
                </tr>
                <tr>
                  <td><strong>Deployment & License</strong></td>
                  <td>${this.escapeHtml(bot.deployment)} (${this.escapeHtml(bot.license)})</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;">
            ${bot.sourceUrl ? `
              <a href="${bot.sourceUrl}" target="_blank" rel="noopener noreferrer" class="ab-btn-action ab-btn-primary">
                Official Source <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            ` : ''}
            ${bot.repoUrl ? `
              <a href="${bot.repoUrl}" target="_blank" rel="noopener noreferrer" class="ab-btn-action">
                GitHub Repo <i class="fa-brands fa-github"></i>
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderMethodologyModal() {
    if (!this.state.showMethodologyModal) return '';
    const m = this.state.config?.methodology || {};

    return `
      <div class="ab-modal-backdrop" id="ab-methodology-backdrop">
        <div class="ab-modal-shell" onclick="event.stopPropagation();">
          <button type="button" class="ab-modal-close-btn" id="ab-methodology-close">&times;</button>
          
          <h2 style="font-family: var(--ab-font-display); margin-top: 0; font-size: 1.4rem;">
            Agentic AIBots: Inclusion Rules & Evaluation Standard
          </h2>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--ab-primary); margin-bottom: 0.5rem;">What Qualifies for this Board:</h4>
            ${(m.qualificationRules || []).map(r => `
              <div style="margin-bottom: 0.85rem;">
                <strong style="color: var(--ab-text-main); font-size: 0.9rem;">• ${this.escapeHtml(r.title)}:</strong>
                <span style="font-size: 0.86rem; color: var(--ab-text-muted); display: block; margin-top: 0.2rem;">
                  ${this.escapeHtml(r.description)}
                </span>
              </div>
            `).join('')}
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--ab-primary); margin-bottom: 0.5rem;">Agentic Readiness Score (ARS) Definition:</h4>
            <p style="font-size: 0.86rem; color: var(--ab-text-muted); line-height: 1.5;">
              The ARS combines 6 normalized dimensions (0–100): Reliability (task completion & pass^k), Autonomy horizon, Tool & MCP breadth, Enterprise governance, Production maturity, and Ecosystem momentum.
            </p>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--ab-primary); margin-bottom: 0.5rem;">Data Sources & Attributions:</h4>
            <ul style="font-size: 0.84rem; color: var(--ab-text-muted); padding-left: 1.25rem;">
              ${(m.dataSources || []).map(ds => `
                <li style="margin-bottom: 0.4rem;">
                  <a href="${ds.url}" target="_blank" rel="noopener noreferrer" style="color: var(--ab-primary); font-weight: 600;">${this.escapeHtml(ds.name)}</a>: ${this.escapeHtml(ds.attribution)}
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // EVENT BINDINGS
  // --------------------------------------------------------------------------
  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      // Tab switcher
      const tabBtn = e.target.closest('[data-ab-tab]');
      if (tabBtn) {
        this.state.activeTab = tabBtn.dataset.abTab;
        this.syncUrlState();
        this.render();
        if (this.state.activeTab === 'workflows' && this.state.workflowViewMode === '3d') {
          setTimeout(() => this.initThreeScene(), 60);
        }
        return;
      }

      // Methodology modal trigger
      if (e.target.closest('#ab-btn-methodology')) {
        this.state.showMethodologyModal = true;
        this.render();
        return;
      }
      if (e.target.closest('#ab-methodology-close') || e.target.id === 'ab-methodology-backdrop') {
        this.state.showMethodologyModal = false;
        this.render();
        return;
      }

      // Inspect bot trigger
      const inspectBtn = e.target.closest('[data-inspect-bot]');
      if (inspectBtn) {
        this.state.inspectBotId = inspectBtn.dataset.inspectBot;
        this.syncUrlState();
        this.render();
        return;
      }
      if (e.target.closest('#ab-inspect-close') || e.target.id === 'ab-inspect-backdrop') {
        this.state.inspectBotId = null;
        this.syncUrlState();
        this.render();
        return;
      }

      // Compare toggle
      const compToggle = e.target.closest('[data-compare-toggle]');
      if (compToggle) {
        const botId = compToggle.dataset.compareToggle;
        if (this.state.compareList.includes(botId)) {
          this.state.compareList = this.state.compareList.filter(id => id !== botId);
        } else {
          if (this.state.compareList.length < 4) {
            this.state.compareList.push(botId);
          } else {
            alert('You can compare a maximum of 4 bots simultaneously.');
          }
        }
        this.syncUrlState();
        this.render();
        return;
      }

      // Remove from compare tray
      const removeComp = e.target.closest('[data-remove-compare]');
      if (removeComp) {
        const botId = removeComp.dataset.removeCompare;
        this.state.compareList = this.state.compareList.filter(id => id !== botId);
        this.syncUrlState();
        this.render();
        return;
      }

      // Clear compare
      if (e.target.closest('#ab-btn-clear-compare')) {
        this.state.compareList = [];
        this.syncUrlState();
        this.render();
        return;
      }

      // Trigger compare view
      if (e.target.closest('#ab-btn-trigger-compare')) {
        this.state.capabilitiesSelected = [...this.state.compareList];
        this.state.activeTab = 'capabilities';
        this.syncUrlState();
        this.render();
        return;
      }

      // Capabilities bot selector chips
      const capToggle = e.target.closest('[data-cap-toggle]');
      if (capToggle) {
        const botId = capToggle.dataset.capToggle;
        if (this.state.capabilitiesSelected.includes(botId)) {
          if (this.state.capabilitiesSelected.length > 1) {
            this.state.capabilitiesSelected = this.state.capabilitiesSelected.filter(id => id !== botId);
          }
        } else {
          if (this.state.capabilitiesSelected.length < 4) {
            this.state.capabilitiesSelected.push(botId);
          } else {
            this.state.capabilitiesSelected.shift();
            this.state.capabilitiesSelected.push(botId);
          }
        }
        this.render();
        return;
      }

      // Category filter pills in Rankings
      const catPill = e.target.closest('[data-cat-select]');
      if (catPill) {
        this.state.selectedCategory = catPill.dataset.catSelect;
        this.syncUrlState();
        this.render();
        return;
      }

      // Workflow scene selector
      const sceneBtn = e.target.closest('[data-wf-select]');
      if (sceneBtn) {
        this.state.activeWorkflowId = sceneBtn.dataset.wfSelect;
        this.syncUrlState();
        this.render();
        if (this.state.workflowViewMode === '3d') {
          setTimeout(() => this.initThreeScene(), 60);
        }
        return;
      }

      // Workflow view mode toggle (3D / 2D)
      const modeBtn = e.target.closest('[data-wf-mode]');
      if (modeBtn) {
        this.state.workflowViewMode = modeBtn.dataset.wfMode;
        this.render();
        if (this.state.workflowViewMode === '3d') {
          setTimeout(() => this.initThreeScene(), 60);
        }
        return;
      }

      // Reset weights button
      if (e.target.closest('#ab-btn-reset-weights')) {
        this.state.weights = {
          reliability: 0.25,
          autonomy: 0.20,
          toolBreadth: 0.15,
          governance: 0.20,
          productionMaturity: 0.10,
          ecosystem: 0.10
        };
        this.render();
        return;
      }

      // Export CSV
      if (e.target.closest('#ab-btn-export-csv')) {
        this.exportCSV();
        return;
      }

      // Cross-board jump links
      const crossLink = e.target.closest('[data-nav-target]');
      if (crossLink) {
        e.preventDefault();
        const target = crossLink.dataset.navTarget;
        if (window.setActiveCategory) {
          window.setActiveCategory(target);
        }
        return;
      }
    });

    // Search and Filter input handlers
    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'ab-registry-search') {
        this.state.searchQuery = e.target.value;
        this.syncUrlState();
        this.render();
        return;
      }

      // Dynamic weight sliders
      const slider = e.target.closest('[data-weight-dim]');
      if (slider) {
        const dim = slider.dataset.weightDim;
        const pct = parseInt(slider.value, 10);
        this.state.weights[dim] = pct / 100;

        const valSpan = document.getElementById(`val-weight-${dim}`);
        if (valSpan) valSpan.textContent = `${pct}%`;

        const formText = document.getElementById('ab-formula-text');
        const w = this.state.weights;
        if (formText) {
          formText.textContent = `ARS = (Reliability × ${w.reliability.toFixed(2)}) + (Autonomy × ${w.autonomy.toFixed(2)}) + (Tool Breadth × ${w.toolBreadth.toFixed(2)}) + (Governance × ${w.governance.toFixed(2)}) + (Production Maturity × ${w.productionMaturity.toFixed(2)}) + (Ecosystem × ${w.ecosystem.toFixed(2)})`;
        }

        // Re-render only table or update scores
        const tableRoot = this.container.querySelector('.ab-table-card');
        if (tableRoot && this.state.activeTab === 'rankings') {
          const list = this.getFilteredBots();
          tableRoot.outerHTML = this.renderRegistryTableOnly(list);
        }
      }
    });

    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'ab-filter-category') {
        this.state.selectedCategory = e.target.value;
        this.syncUrlState();
        this.render();
      }
      if (e.target.id === 'ab-filter-deployment') {
        this.state.selectedDeployment = e.target.value;
        this.syncUrlState();
        this.render();
      }
      if (e.target.id === 'ab-filter-license') {
        this.state.selectedLicense = e.target.value;
        this.syncUrlState();
        this.render();
      }
      if (e.target.id === 'ab-toggle-previews') {
        this.state.includePreviews = e.target.checked;
        this.syncUrlState();
        this.render();
      }
    });
  }

  attachViewSpecificHandlers() {
    if (this.state.activeTab === 'performance') {
      setTimeout(() => this.renderScatterCanvas(), 50);
    }
    if (this.state.activeTab === 'capabilities') {
      setTimeout(() => this.renderRadarCanvas(), 50);
    }
  }

  exportCSV() {
    const list = this.getFilteredBots();
    const headers = [
      'Rank', 'Name', 'Company', 'Category', 'Status', 'License', 'Deployment',
      'ARS_Score', 'LongestTaskHorizon_Mins', 'InterventionRate_Pct', 'MCP_Support',
      'Tools_Count', 'Governance_Tier', 'Source_URL'
    ];

    const rows = list.map((b, idx) => [
      idx + 1,
      `"${b.name}"`,
      `"${b.company}"`,
      `"${b.type}"`,
      b.status.toUpperCase(),
      `"${b.license}"`,
      `"${b.deployment}"`,
      b.arsScore,
      b.autonomy?.longestTaskHorizonMinutes || 'n/r',
      b.autonomy?.humanInterventionRatePct || 'n/r',
      `"${b.capabilities?.mcpSupport || 'n/r'}"`,
      `"${b.capabilities?.toolCount || 'n/r'}"`,
      `"${b.governance?.governanceTier || 'n/r'}"`,
      `"${b.sourceUrl || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapfacts_agentic_bots_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global Export
if (typeof window !== 'undefined') {
  window.AgenticBots = AgenticBots;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgenticBots };
}
