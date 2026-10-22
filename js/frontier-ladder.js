/**
 * Frontier Model Ladder - Production Front-End Module
 * Real-time, interactive 4-grid visual dashboard for LLM comparison.
 * 
 * Site: https://www.snapfacts.in
 * Architecture: Vanilla ES6 Module, 0 external runtime dependencies, lightweight SVG + Canvas micro-charts.
 */

// ==========================================================================
// 1. DATA ADAPTER & FIELD MAPPING
// ==========================================================================

const DEFAULT_FIELD_MAP = {
  model_id: (r) => r.model_id || r.id || r.key || '',
  display_name: (r) => r.display_name || r.name || r.model_name || r.model || '',
  provider: (r) => r.provider || r.organization || r.org || 'Independent',
  release_date: (r) => r.release_date || r.date || 'n/r',
  license: (r) => (String(r.license || '').toLowerCase().includes('open') ? 'open-weights' : 'proprietary'),
  parameter_count: (r) => r.parameter_count || r.params || 'n/r',
  architecture_notes: (r) => r.architecture_notes || r.notes || r.arch || '',
  context_window: (r) => Number(r.context_window || r.context || 128000),
  max_output_tokens: (r) => (r.max_output_tokens ? Number(r.max_output_tokens) : 'n/r'),
  modalities: (r) => (Array.isArray(r.modalities) ? r.modalities : ['text']),
  tool_use: (r) => (r.tool_use !== undefined ? Boolean(r.tool_use) : true),
  knowledge_cutoff: (r) => r.knowledge_cutoff || r.cutoff || 'n/r',
  
  // Arena Ratings
  arena: {
    overall_elo: (r) => (r.arena?.overall_elo ? Number(r.arena.overall_elo) : Number(r.elo || 0)),
    ci_low: (r) => (r.arena?.ci_low ? Number(r.arena.ci_low) : Number(r.elo || 0) - 8),
    ci_high: (r) => (r.arena?.ci_high ? Number(r.arena.ci_high) : Number(r.elo || 0) + 8),
    rank: (r) => (r.arena?.rank ? Number(r.arena.rank) : Number(r.rank || 0)),
    rank_change: (r) => (r.arena?.rank_change !== undefined ? Number(r.arena.rank_change) : 0),
    votes: (r) => (r.arena?.votes ? Number(r.arena.votes) : 0),
    status_badge: (r) => r.arena?.status_badge || r.badge || '',
    category_elos: (r) => r.arena?.category_elos || {
      coding: r.codingElo || null,
      math: r.hardElo || null,
      hard_prompts: r.hardElo || null,
      creative: null,
      long_context: null,
      vision: null,
      instruction_following: null
    }
  },

  // Evals (GPQA, MMLU-Pro, HLE, AIME, LiveCodeBench, SWE-bench, ARC-AGI, MMMU)
  evals: (r) => r.evals || {},
  eval_meta: (r) => r.eval_meta || {},

  // Cost
  cost: {
    input_per_1M: (r) => (r.cost?.input_per_1M !== undefined ? Number(r.cost.input_per_1M) : 'n/r'),
    output_per_1M: (r) => (r.cost?.output_per_1M !== undefined ? Number(r.cost.output_per_1M) : 'n/r'),
    blended_per_1M: (r) => {
      if (r.cost?.blended_per_1M !== undefined) return Number(r.cost.blended_per_1M);
      if (r.cost?.input_per_1M !== undefined && r.cost?.output_per_1M !== undefined) {
        return Number((r.cost.input_per_1M * 0.75 + r.cost.output_per_1M * 0.25).toFixed(2));
      }
      return 'n/r';
    },
    currency: (r) => r.cost?.currency || 'USD'
  },

  // Speed
  speed: {
    ttft_ms: (r) => (r.speed?.ttft_ms !== undefined ? Number(r.speed.ttft_ms) : 'n/r'),
    tokens_per_sec: (r) => (r.speed?.tokens_per_sec !== undefined ? Number(r.speed.tokens_per_sec) : 'n/r')
  },

  history: (r) => r.history || []
};

class FrontierDataAdapter {
  constructor(fieldMap = DEFAULT_FIELD_MAP) {
    this.fieldMap = fieldMap;
    this.cachedData = null;
    this.lastEtag = null;
    this.lastModified = null;
    this.status = 'live'; // 'live' | 'stale' | 'offline'
    this.fetchedAt = null;
  }

  normalizeRecord(raw) {
    const fm = this.fieldMap;
    const model = {
      model_id: fm.model_id(raw),
      display_name: fm.display_name(raw),
      provider: fm.provider(raw),
      release_date: fm.release_date(raw),
      license: fm.license(raw),
      parameter_count: fm.parameter_count(raw),
      architecture_notes: fm.architecture_notes(raw),
      context_window: fm.context_window(raw),
      max_output_tokens: fm.max_output_tokens(raw),
      modalities: fm.modalities(raw),
      tool_use: fm.tool_use(raw),
      knowledge_cutoff: fm.knowledge_cutoff(raw),
      arena: {
        overall_elo: fm.arena.overall_elo(raw),
        ci_low: fm.arena.ci_low(raw),
        ci_high: fm.arena.ci_high(raw),
        rank: fm.arena.rank(raw),
        rank_change: fm.arena.rank_change(raw),
        votes: fm.arena.votes(raw),
        status_badge: fm.arena.status_badge(raw),
        category_elos: fm.arena.category_elos(raw)
      },
      evals: fm.evals(raw),
      eval_meta: fm.eval_meta(raw),
      cost: {
        input_per_1M: fm.cost.input_per_1M(raw),
        output_per_1M: fm.cost.output_per_1M(raw),
        blended_per_1M: fm.cost.blended_per_1M(raw),
        currency: fm.cost.currency(raw)
      },
      speed: {
        ttft_ms: fm.speed.ttft_ms(raw),
        tokens_per_sec: fm.speed.tokens_per_sec(raw)
      },
      history: fm.history(raw)
    };
    return model;
  }

  async fetchModels(endpointUrl = 'data/frontier_models.json') {
    const headers = { 'Accept': 'application/json' };
    if (this.lastEtag) headers['If-None-Match'] = this.lastEtag;
    if (this.lastModified) headers['If-Modified-Since'] = this.lastModified;

    try {
      const response = await fetch(endpointUrl, { headers });

      if (response.status === 304 && this.cachedData) {
        this.status = 'live';
        this.fetchedAt = new Date();
        return { models: this.cachedData, status: this.status, modified: false };
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      this.lastEtag = response.headers.get('ETag');
      this.lastModified = response.headers.get('Last-Modified');
      
      const json = await response.json();
      const rawList = Array.isArray(json) ? json : json.models || [];
      const normalized = rawList.map((r) => this.normalizeRecord(r));

      // Sort by Arena Elo descending as base
      normalized.sort((a, b) => (b.arena.overall_elo || 0) - (a.arena.overall_elo || 0));

      this.cachedData = normalized;
      this.status = 'live';
      this.fetchedAt = new Date();

      // Persist fallback cache in localStorage
      try {
        localStorage.setItem('snapfacts_fml_cache', JSON.stringify({
          data: normalized,
          time: this.fetchedAt.toISOString()
        }));
      } catch (e) {}

      return { models: normalized, status: this.status, modified: true };
    } catch (err) {
      console.warn('warn: FrontierDataAdapter fetch error:', err);
      // Fallback to cached in memory or localStorage
      if (!this.cachedData) {
        try {
          const stored = localStorage.getItem('snapfacts_fml_cache');
          if (stored) {
            const parsed = JSON.parse(stored);
            this.cachedData = parsed.data;
            this.fetchedAt = new Date(parsed.time);
          }
        } catch (e) {}
        if (!this.cachedData && typeof DEFAULT_FRONTIER_MODELS_DATA !== 'undefined' && Array.isArray(DEFAULT_FRONTIER_MODELS_DATA)) {
          this.cachedData = DEFAULT_FRONTIER_MODELS_DATA.map((r) => this.normalizeRecord(r));
          this.fetchedAt = new Date();
        }
      }

      this.status = this.cachedData ? 'stale' : 'offline';
      return { models: this.cachedData || [], status: this.status, error: err.message };
    }
  }
}

const DEFAULT_FRONTIER_MODELS_DATA = [
  {
    model_id: "gpt-4o-2024-11-20",
    display_name: "GPT-4o (2024-11-20)",
    provider: "OpenAI",
    release_date: "2024-11-20",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Omni multimodal transformer with native audio/vision integration",
    context_window: 128000,
    max_output_tokens: 16384,
    modalities: ["text", "image", "audio"],
    tool_use: true,
    knowledge_cutoff: "2024-10",
    arena: {
      overall_elo: 1362,
      ci_low: 1354,
      ci_high: 1370,
      rank: 1,
      rank_change: 0,
      votes: 142850,
      status_badge: "LEADER",
      category_elos: { coding: 1352, math: 1340, hard_prompts: 1322, creative: 1368, long_context: 1335, vision: 1358, instruction_following: 1370 }
    },
    evals: { GPQA: 53.6, "MMLU-Pro": 72.8, HLE: 14.8, AIME: 26.7, LiveCodeBench: 40.5, "SWE-bench": 38.8, "ARC-AGI": 44.2, MMMU: 69.1 },
    cost: { input_per_1M: 2.50, output_per_1M: 10.00, blended_per_1M: 4.38, currency: "USD" },
    speed: { ttft_ms: 310, tokens_per_sec: 104 },
    history: [1342, 1348, 1354, 1358, 1362]
  },
  {
    model_id: "claude-3-5-sonnet-20241022",
    display_name: "Claude 3.5 Sonnet (New)",
    provider: "Anthropic",
    release_date: "2024-10-22",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Hybrid attention architecture optimized for agentic coding and reasoning",
    context_window: 200000,
    max_output_tokens: 8192,
    modalities: ["text", "image"],
    tool_use: true,
    knowledge_cutoff: "2024-04",
    arena: {
      overall_elo: 1358,
      ci_low: 1350,
      ci_high: 1366,
      rank: 2,
      rank_change: 1,
      votes: 118400,
      status_badge: "CODING #1",
      category_elos: { coding: 1378, math: 1332, hard_prompts: 1318, creative: 1355, long_context: 1350, vision: 1364, instruction_following: 1374 }
    },
    evals: { GPQA: 65.0, "MMLU-Pro": 78.0, HLE: 16.2, AIME: 32.0, LiveCodeBench: 46.2, "SWE-bench": 49.0, "ARC-AGI": 48.0, MMMU: 70.4 },
    cost: { input_per_1M: 3.00, output_per_1M: 15.00, blended_per_1M: 6.00, currency: "USD" },
    speed: { ttft_ms: 340, tokens_per_sec: 78 },
    history: [1330, 1340, 1349, 1355, 1358]
  },
  {
    model_id: "o1-2024-12-17",
    display_name: "o1 (High Reasoning)",
    provider: "OpenAI",
    release_date: "2024-12-17",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Inference-time chain-of-thought search optimization model",
    context_window: 200000,
    max_output_tokens: 100000,
    modalities: ["text", "image"],
    tool_use: true,
    knowledge_cutoff: "2024-10",
    arena: {
      overall_elo: 1355,
      ci_low: 1346,
      ci_high: 1364,
      rank: 3,
      rank_change: 0,
      votes: 84200,
      status_badge: "MATH #1",
      category_elos: { coding: 1365, math: 1395, hard_prompts: 1385, creative: 1310, long_context: 1340, vision: 1342, instruction_following: 1350 }
    },
    evals: { GPQA: 75.7, "MMLU-Pro": 82.4, HLE: 21.5, AIME: 83.3, LiveCodeBench: 58.0, "SWE-bench": 48.9, "ARC-AGI": 56.4, MMMU: 74.0 },
    cost: { input_per_1M: 15.00, output_per_1M: 60.00, blended_per_1M: 26.25, currency: "USD" },
    speed: { ttft_ms: 3200, tokens_per_sec: 42 },
    history: [1338, 1345, 1350, 1353, 1355]
  },
  {
    model_id: "gemini-1-5-pro-002",
    display_name: "Gemini 1.5 Pro (002)",
    provider: "Google DeepMind",
    release_date: "2024-09-24",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Sparse Mixture-of-Experts with 2M token audio/video/text context window",
    context_window: 2000000,
    max_output_tokens: 8192,
    modalities: ["text", "image", "audio", "video"],
    tool_use: true,
    knowledge_cutoff: "2024-05",
    arena: {
      overall_elo: 1348,
      ci_low: 1340,
      ci_high: 1356,
      rank: 4,
      rank_change: 0,
      votes: 96100,
      status_badge: "2M CONTEXT",
      category_elos: { coding: 1324, math: 1335, hard_prompts: 1302, creative: 1344, long_context: 1388, vision: 1362, instruction_following: 1352 }
    },
    evals: { GPQA: 58.5, "MMLU-Pro": 74.2, HLE: 15.0, AIME: 34.0, LiveCodeBench: 39.0, "SWE-bench": 36.8, "ARC-AGI": 42.0, MMMU: 72.1 },
    cost: { input_per_1M: 1.25, output_per_1M: 5.00, blended_per_1M: 2.19, currency: "USD" },
    speed: { ttft_ms: 420, tokens_per_sec: 92 },
    history: [1325, 1334, 1340, 1345, 1348]
  },
  {
    model_id: "llama-3-1-405b-instruct",
    display_name: "Llama 3.1 405B Instruct",
    provider: "Meta AI",
    release_date: "2024-07-23",
    license: "open-weights",
    parameter_count: "405B",
    architecture_notes: "Dense autoregressive decoder transformer trained on 15T+ tokens",
    context_window: 128000,
    max_output_tokens: 4096,
    modalities: ["text"],
    tool_use: true,
    knowledge_cutoff: "2023-12",
    arena: {
      overall_elo: 1288,
      ci_low: 1279,
      ci_high: 1297,
      rank: 5,
      rank_change: 0,
      votes: 73400,
      status_badge: "OPEN #1",
      category_elos: { coding: 1282, math: 1275, hard_prompts: 1248, creative: 1302, long_context: 1260, vision: null, instruction_following: 1308 }
    },
    evals: { GPQA: 51.1, "MMLU-Pro": 68.5, HLE: "n/r", AIME: 23.3, LiveCodeBench: 36.4, "SWE-bench": 34.0, "ARC-AGI": 38.5, MMMU: "n/r" },
    cost: { input_per_1M: 1.75, output_per_1M: 1.75, blended_per_1M: 1.75, currency: "USD" },
    speed: { ttft_ms: 680, tokens_per_sec: 58 },
    history: [1280, 1283, 1285, 1287, 1288]
  },
  {
    model_id: "qwen-2-5-72b-instruct",
    display_name: "Qwen 2.5 72B Instruct",
    provider: "Alibaba Cloud",
    release_date: "2024-09-19",
    license: "open-weights",
    parameter_count: "72.7B",
    architecture_notes: "Dense transformer with SwiGLU activations and YaRN context scaling",
    context_window: 128000,
    max_output_tokens: 8192,
    modalities: ["text"],
    tool_use: true,
    knowledge_cutoff: "2024-06",
    arena: {
      overall_elo: 1278,
      ci_low: 1269,
      ci_high: 1287,
      rank: 6,
      rank_change: 1,
      votes: 52100,
      status_badge: "VALUE #1",
      category_elos: { coding: 1298, math: 1290, hard_prompts: 1242, creative: 1280, long_context: 1265, vision: null, instruction_following: 1292 }
    },
    evals: { GPQA: 49.0, "MMLU-Pro": 67.2, HLE: "n/r", AIME: 28.0, LiveCodeBench: 35.8, "SWE-bench": 32.2, "ARC-AGI": 37.0, MMMU: "n/r" },
    cost: { input_per_1M: 0.35, output_per_1M: 0.40, blended_per_1M: 0.36, currency: "USD" },
    speed: { ttft_ms: 280, tokens_per_sec: 88 },
    history: [1260, 1268, 1272, 1275, 1278]
  },
  {
    model_id: "deepseek-v2-5",
    display_name: "DeepSeek-V2.5",
    provider: "DeepSeek",
    release_date: "2024-09-06",
    license: "open-weights",
    parameter_count: "236B (21B active)",
    architecture_notes: "Multi-head Latent Attention (MLA) and DeepSeekMoE architecture",
    context_window: 128000,
    max_output_tokens: 8192,
    modalities: ["text"],
    tool_use: true,
    knowledge_cutoff: "2024-03",
    arena: {
      overall_elo: 1274,
      ci_low: 1265,
      ci_high: 1283,
      rank: 7,
      rank_change: -1,
      votes: 49800,
      status_badge: "OPEN CODING",
      category_elos: { coding: 1312, math: 1268, hard_prompts: 1235, creative: 1262, long_context: 1255, vision: null, instruction_following: 1285 }
    },
    evals: { GPQA: 46.5, "MMLU-Pro": 65.0, HLE: "n/r", AIME: 22.0, LiveCodeBench: 38.2, "SWE-bench": 34.5, "ARC-AGI": 35.8, MMMU: "n/r" },
    cost: { input_per_1M: 0.14, output_per_1M: 0.28, blended_per_1M: 0.18, currency: "USD" },
    speed: { ttft_ms: 320, tokens_per_sec: 84 },
    history: [1270, 1272, 1274, 1276, 1274]
  },
  {
    model_id: "gemini-1-5-flash-002",
    display_name: "Gemini 1.5 Flash (002)",
    provider: "Google DeepMind",
    release_date: "2024-09-24",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Distilled multimodal transformer optimized for speed, low latency, and large context",
    context_window: 1000000,
    max_output_tokens: 8192,
    modalities: ["text", "image", "audio", "video"],
    tool_use: true,
    knowledge_cutoff: "2024-05",
    arena: {
      overall_elo: 1270,
      ci_low: 1262,
      ci_high: 1278,
      rank: 8,
      rank_change: 0,
      votes: 68400,
      status_badge: "FAST & CHEAP",
      category_elos: { coding: 1245, math: 1260, hard_prompts: 1218, creative: 1282, long_context: 1345, vision: 1310, instruction_following: 1278 }
    },
    evals: { GPQA: 44.8, "MMLU-Pro": 63.4, HLE: "n/r", AIME: 18.0, LiveCodeBench: 28.5, "SWE-bench": 26.0, "ARC-AGI": 32.4, MMMU: 64.2 },
    cost: { input_per_1M: 0.075, output_per_1M: 0.30, blended_per_1M: 0.13, currency: "USD" },
    speed: { ttft_ms: 140, tokens_per_sec: 168 },
    history: [1252, 1258, 1264, 1268, 1270]
  },
  {
    model_id: "claude-3-5-haiku-20241022",
    display_name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    release_date: "2024-11-04",
    license: "proprietary",
    parameter_count: "n/r",
    architecture_notes: "Compact high-efficiency transformer rivaling previous generation frontier models",
    context_window: 200000,
    max_output_tokens: 8192,
    modalities: ["text", "image"],
    tool_use: true,
    knowledge_cutoff: "2024-07",
    arena: {
      overall_elo: 1265,
      ci_low: 1257,
      ci_high: 1273,
      rank: 9,
      rank_change: 2,
      votes: 41200,
      status_badge: "NEW",
      category_elos: { coding: 1278, math: 1252, hard_prompts: 1225, creative: 1275, long_context: 1288, vision: 1295, instruction_following: 1290 }
    },
    evals: { GPQA: 48.2, "MMLU-Pro": 64.8, HLE: "n/r", AIME: 21.0, LiveCodeBench: 33.0, "SWE-bench": 30.5, "ARC-AGI": 34.0, MMMU: 63.8 },
    cost: { input_per_1M: 0.80, output_per_1M: 4.00, blended_per_1M: 1.60, currency: "USD" },
    speed: { ttft_ms: 190, tokens_per_sec: 142 },
    history: [1240, 1248, 1255, 1260, 1265]
  },
  {
    model_id: "mistral-large-2407",
    display_name: "Mistral Large 2 (2407)",
    provider: "Mistral AI",
    release_date: "2024-07-24",
    license: "proprietary",
    parameter_count: "123B",
    architecture_notes: "Dense 123B parameter multilingual model with native function calling",
    context_window: 128000,
    max_output_tokens: 4096,
    modalities: ["text"],
    tool_use: true,
    knowledge_cutoff: "2024-02",
    arena: {
      overall_elo: 1260,
      ci_low: 1252,
      ci_high: 1268,
      rank: 10,
      rank_change: -1,
      votes: 44300,
      status_badge: "ENTERPRISE",
      category_elos: { coding: 1260, math: 1248, hard_prompts: 1220, creative: 1255, long_context: 1240, vision: null, instruction_following: 1280 }
    },
    evals: { GPQA: 45.0, "MMLU-Pro": 62.5, HLE: "n/r", AIME: 19.5, LiveCodeBench: 31.0, "SWE-bench": 28.0, "ARC-AGI": 31.0, MMMU: "n/r" },
    cost: { input_per_1M: 2.00, output_per_1M: 6.00, blended_per_1M: 3.00, currency: "USD" },
    speed: { ttft_ms: 380, tokens_per_sec: 72 },
    history: [1255, 1258, 1262, 1261, 1260]
  }
];

// ==========================================================================
// 2. DECISION HELPER & USE-CASE PRESETS
// ==========================================================================

const USE_CASE_PRESETS = {
  coding: {
    label: 'Coding & Engineering',
    weights: { elo: 0.20, coding: 0.35, reasoning: 0.20, speed: 0.15, value: 0.10, context: 0.0 }
  },
  reasoning: {
    label: 'Deep Reasoning & Math',
    weights: { elo: 0.20, coding: 0.15, reasoning: 0.40, speed: 0.05, value: 0.10, context: 0.10 }
  },
  long_doc: {
    label: 'Long Documents & Books',
    weights: { elo: 0.15, coding: 0.10, reasoning: 0.15, speed: 0.10, value: 0.10, context: 0.40 }
  },
  multimodal: {
    label: 'Multimodal & Vision',
    weights: { elo: 0.25, coding: 0.15, reasoning: 0.15, speed: 0.10, value: 0.10, context: 0.25 }
  },
  budget: {
    label: 'High-Volume / Budget',
    weights: { elo: 0.15, coding: 0.10, reasoning: 0.10, speed: 0.20, value: 0.40, context: 0.05 }
  },
  low_latency: {
    label: 'Low Latency & Real-Time',
    weights: { elo: 0.15, coding: 0.10, reasoning: 0.10, speed: 0.45, value: 0.15, context: 0.05 }
  }
};

function computeCompositeScore(model, weights, modelsPool) {
  // Extract min/max from pool to normalize 0..1
  const getBounds = (getter) => {
    const vals = modelsPool.map(getter).filter((v) => typeof v === 'number' && !isNaN(v));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const eloBounds = getBounds((m) => m.arena.overall_elo);
  const codingBounds = getBounds((m) => m.arena.category_elos?.coding || m.arena.overall_elo);
  const mathBounds = getBounds((m) => m.evals?.AIME || m.evals?.GPQA || 0);
  const speedBounds = getBounds((m) => (typeof m.speed?.tokens_per_sec === 'number' ? m.speed.tokens_per_sec : 50));
  const ctxBounds = getBounds((m) => m.context_window);

  // For price, lower is better (inverted)
  const priceVals = modelsPool.map((m) => (typeof m.cost?.blended_per_1M === 'number' ? m.cost.blended_per_1M : 10));
  const minPrice = Math.min(...priceVals);
  const maxPrice = Math.max(...priceVals);

  const norm = (val, b) => {
    if (typeof val !== 'number' || isNaN(val) || b.max === b.min) return 0.5;
    return Math.max(0, Math.min(1, (val - b.min) / (b.max - b.min)));
  };

  const normInvert = (val, min, max) => {
    if (typeof val !== 'number' || isNaN(val) || max === min) return 0.5;
    return Math.max(0, Math.min(1, 1 - (val - min) / (max - min)));
  };

  const sElo = norm(model.arena.overall_elo, eloBounds);
  const sCoding = norm(model.arena.category_elos?.coding || model.arena.overall_elo, codingBounds);
  const sReason = norm(model.evals?.AIME || model.evals?.GPQA || 0, mathBounds);
  const sSpeed = norm(model.speed?.tokens_per_sec, speedBounds);
  const sCtx = norm(model.context_window, ctxBounds);
  const sVal = normInvert(model.cost?.blended_per_1M, minPrice, maxPrice);

  const composite = (
    sElo * (weights.elo || 0) +
    sCoding * (weights.coding || 0) +
    sReason * (weights.reasoning || 0) +
    sSpeed * (weights.speed || 0) +
    sVal * (weights.value || 0) +
    sCtx * (weights.context || 0)
  ) * 100;

  return Math.round(composite);
}

// ==========================================================================
// 3. MAIN FRONTIER MODEL LADDER CLASS
// ==========================================================================

class FrontierModelLadder {
  constructor(containerId = 'frontier-ladder', options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.options = {
      endpointUrl: options.endpointUrl || 'data/frontier_models.json',
      pollIntervalMs: options.pollIntervalMs || 120000,
      fieldMap: options.fieldMap || DEFAULT_FIELD_MAP,
      ...options
    };

    this.adapter = new FrontierDataAdapter(this.options.fieldMap);
    this.models = [];
    this.pinnedIds = new Set();
    this.hoveredId = null;

    // View States
    this.activeLadderTab = 'overall';
    this.evalProfileView = 'heatmap'; // 'heatmap' | 'radar'
    this.valueMetric = 'overall_elo';
    this.valueLogScale = true;
    this.budgetMax = null; // Max price slider ($/1M)
    this.specsSort = { column: 'context_window', dir: 'desc' };
    this.specsFilter = { openOnly: false, provider: 'all', minContext: 0 };
    this.decisionPreset = 'coding';
    this.decisionWeights = { ...USE_CASE_PRESETS.coding.weights };
    this.showWeightsDrawer = false;
    this.showMethodology = false;

    this.pollTimer = null;
    this.isDocumentVisible = true;
    this.boundHandleVisibility = this.handleVisibilityChange.bind(this);

    this.init();
  }

  async init() {
    if (!this.container) {
      console.warn('warn: FrontierModelLadder container element not found.');
      return;
    }

    this.renderSkeleton();
    this.readUrlState();

    document.addEventListener('visibilitychange', this.boundHandleVisibility);

    const result = await this.adapter.fetchModels(this.options.endpointUrl);
    this.models = result.models;
    this.render();
    this.startPolling();
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    document.removeEventListener('visibilitychange', this.boundHandleVisibility);
  }

  handleVisibilityChange() {
    this.isDocumentVisible = !document.hidden;
    if (this.isDocumentVisible) {
      // Re-poll immediately on focus if older than 60s
      const now = new Date();
      if (!this.adapter.fetchedAt || (now - this.adapter.fetchedAt) > 60000) {
        this.pollUpdate();
      }
    }
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.isDocumentVisible) {
        this.pollUpdate();
      }
    }, this.options.pollIntervalMs);
  }

  async pollUpdate() {
    const prevMap = new Map(this.models.map(m => [m.model_id, m.arena.overall_elo]));
    const result = await this.adapter.fetchModels(this.options.endpointUrl);
    this.models = result.models;
    
    // Check for updated ratings to trigger subtle pulse
    this.models.forEach(m => {
      const oldElo = prevMap.get(m.model_id);
      if (oldElo && oldElo !== m.arena.overall_elo) {
        m._justUpdated = true;
      }
    });

    this.render();
  }

  // URL State Serialization
  readUrlState() {
    try {
      const hash = window.location.hash;
      if (!hash.includes('ladder?')) return;
      const query = new URLSearchParams(hash.split('ladder?')[1]);
      if (query.has('tab')) this.activeLadderTab = query.get('tab');
      if (query.has('preset')) {
        const p = query.get('preset');
        if (USE_CASE_PRESETS[p]) {
          this.decisionPreset = p;
          this.decisionWeights = { ...USE_CASE_PRESETS[p].weights };
        }
      }
      if (query.has('models')) {
        query.get('models').split(',').forEach(id => this.pinnedIds.add(id));
      }
    } catch (e) {}
  }

  updateUrlState() {
    try {
      const params = new URLSearchParams();
      if (this.activeLadderTab !== 'overall') params.set('tab', this.activeLadderTab);
      if (this.decisionPreset !== 'coding') params.set('preset', this.decisionPreset);
      if (this.pinnedIds.size > 0) params.set('models', Array.from(this.pinnedIds).join(','));
      
      const paramStr = params.toString();
      const newHash = paramStr ? `#ladder?${paramStr}` : '#';
      history.replaceState(null, '', newHash);
    } catch (e) {}
  }

  // Cross-Grid Interaction Handlers
  setHoveredModel(modelId) {
    if (this.hoveredId === modelId) return;
    this.hoveredId = modelId;
    this.syncHoverElements();
  }

  syncHoverElements() {
    const id = this.hoveredId;
    this.container.querySelectorAll('[data-model-id]').forEach(el => {
      const match = el.getAttribute('data-model-id') === id;
      el.classList.toggle('is-hovered', Boolean(id && match));
    });
  }

  togglePinnedModel(modelId) {
    if (this.pinnedIds.has(modelId)) {
      this.pinnedIds.delete(modelId);
    } else {
      if (this.pinnedIds.size >= 4) {
        alert('You can pin up to 4 models simultaneously for deep comparison.');
        return;
      }
      this.pinnedIds.add(modelId);
    }
    this.updateUrlState();
    this.render();
  }

  clearPinnedModels() {
    this.pinnedIds.clear();
    this.updateUrlState();
    this.render();
  }

  // ==========================================================================
  // RENDER PIPELINE
  // ==========================================================================

  renderSkeleton() {
    this.container.innerHTML = `
      <section class="fml-module" aria-label="Frontier Model Ladder loading skeleton">
        <div class="fml-header" style="height: 120px; animation: fml-pulse 1.5s infinite;"></div>
        <div class="fml-quad-grid">
          <div class="fml-card" style="height: 480px; animation: fml-pulse 1.5s infinite;"></div>
          <div class="fml-card" style="height: 480px; animation: fml-pulse 1.5s infinite;"></div>
          <div class="fml-card" style="height: 480px; animation: fml-pulse 1.5s infinite;"></div>
          <div class="fml-card" style="height: 480px; animation: fml-pulse 1.5s infinite;"></div>
        </div>
      </section>
    `;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="fml-module" id="fml-root" aria-label="Frontier Model Ladder Interactive Matrix">
        ${this.renderHeader()}
        ${this.showWeightsDrawer ? this.renderWeightsDrawer() : ''}
        ${this.pinnedIds.size > 0 ? this.renderCompareTray() : ''}

        <div class="fml-quad-grid">
          ${this.renderGrid1Ladder()}
          ${this.renderGrid2EvalProfile()}
          ${this.renderGrid3Value()}
          ${this.renderGrid4SpecsSpeed()}
        </div>

        ${this.showMethodology ? this.renderMethodologyDrawer() : ''}
        <div class="fml-tooltip" id="fml-dynamic-tooltip" role="tooltip"></div>
      </section>
    `;

    this.attachEventListeners();
    this.drawInteractiveGraphics();
  }

  // --------------------------------------------------------------------------
  // Header & Controls
  // --------------------------------------------------------------------------
  renderHeader() {
    const status = this.adapter.status;
    const statusText = status === 'live' ? 'LIVE' : status === 'stale' ? 'CACHED / STALE' : 'OFFLINE';
    const timeStr = this.adapter.fetchedAt ? this.adapter.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

    return `
      <header class="fml-header">
        <div class="fml-header-top">
          <div class="fml-title-group">
            <h2 class="fml-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Frontier Model Ladder
            </h2>
            <span class="fml-badge-live ${status}" title="Real-time LMSYS Arena ETag polling status">
              <span class="fml-pulse-dot"></span>
              ${statusText} • ${timeStr}
            </span>
          </div>

          <div class="fml-header-actions">
            <button type="button" class="fml-btn-tool ${this.showWeightsDrawer ? 'active' : ''}" id="fml-btn-weights" title="Custom scoring formula sliders">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
              Decision Helper
            </button>
            <button type="button" class="fml-btn-tool" id="fml-btn-export-csv" title="Download model benchmark matrix as CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              CSV
            </button>
            <button type="button" class="fml-btn-tool" id="fml-btn-export-png" title="Download current dashboard view as PNG image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              PNG View
            </button>
            <button type="button" class="fml-btn-tool ${this.showMethodology ? 'active' : ''}" id="fml-btn-methodology" title="Researcher methodology and metric glossary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
              Methodology
            </button>
          </div>
        </div>

        <div class="fml-controls-bar">
          <div class="fml-presets-wrap">
            <span class="fml-preset-label">Use-Case Presets:</span>
            ${Object.entries(USE_CASE_PRESETS).map(([key, p]) => `
              <button type="button" class="fml-preset-pill ${this.decisionPreset === key ? 'active' : ''}" data-preset-key="${key}">
                ${p.label}
              </button>
            `).join('')}
          </div>

          <div style="font-size: 0.74rem; color: var(--fml-text-muted);">
            Pin up to 4 models to compare side-by-side across all 4 grids.
          </div>
        </div>
      </header>
    `;
  }

  renderWeightsDrawer() {
    const w = this.decisionWeights;
    return `
      <div class="fml-weights-drawer">
        <div class="fml-formula-banner">
          <strong>Decision Score Formula:</strong> (Elo × ${(w.elo * 100).toFixed(0)}%) + (Coding × ${(w.coding * 100).toFixed(0)}%) + (Reasoning × ${(w.reasoning * 100).toFixed(0)}%) + (Speed × ${(w.speed * 100).toFixed(0)}%) + (Value × ${(w.value * 100).toFixed(0)}%) + (Context × ${(w.context * 100).toFixed(0)}%)
        </div>
        <div class="fml-sliders-grid">
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Overall Elo</span> <span>${(w.elo * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.elo}" data-weight-key="elo" />
          </div>
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Coding Elo</span> <span>${(w.coding * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.coding}" data-weight-key="coding" />
          </div>
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Reasoning & Math</span> <span>${(w.reasoning * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.reasoning}" data-weight-key="reasoning" />
          </div>
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Generation Speed</span> <span>${(w.speed * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.speed}" data-weight-key="speed" />
          </div>
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Value (Low Price)</span> <span>${(w.value * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.value}" data-weight-key="value" />
          </div>
          <div class="fml-slider-item">
            <div class="fml-slider-label"><span>Context Window</span> <span>${(w.context * 100).toFixed(0)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value="${w.context}" data-weight-key="context" />
          </div>
        </div>
      </div>
    `;
  }

  renderCompareTray() {
    const pinnedModels = this.models.filter((m) => this.pinnedIds.has(m.model_id));
    return `
      <div class="fml-compare-tray">
        <div style="font-size: 0.78rem; font-weight: 700; color: #1e3a8a;">
          Pinned Models for Deep Comparison (${pinnedModels.length}/4):
        </div>
        <div class="fml-compare-chips">
          ${pinnedModels.map(m => `
            <span class="fml-compare-chip">
              ${m.display_name}
              <button type="button" data-unpin-id="${m.model_id}" title="Remove ${m.display_name} from comparison">&times;</button>
            </span>
          `).join('')}
          <button type="button" class="fml-btn-tool" id="fml-btn-clear-pinned" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">Clear All</button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // GRID 1 - LADDER (Who Leads)
  // --------------------------------------------------------------------------
  renderGrid1Ladder() {
    const tabs = [
      { key: 'overall', label: 'Overall Elo' },
      { key: 'coding', label: 'Coding' },
      { key: 'math', label: 'Math' },
      { key: 'hard_prompts', label: 'Hard Prompts' },
      { key: 'vision', label: 'Vision' },
      { key: 'long_context', label: 'Long Context' }
    ];

    // Get score for tab
    const getModelScore = (m) => {
      if (this.activeLadderTab === 'overall') return m.arena.overall_elo;
      return m.arena.category_elos?.[this.activeLadderTab] || null;
    };

    // Filter models that report this tab score
    const activeModels = [...this.models]
      .filter((m) => getModelScore(m) !== null)
      .sort((a, b) => (getModelScore(b) || 0) - (getModelScore(a) || 0));

    // Bounds for CI bar
    const allScores = activeModels.map(m => getModelScore(m));
    const minVal = Math.min(...activeModels.map(m => m.arena.ci_low || getModelScore(m) - 10)) - 10;
    const maxVal = Math.max(...activeModels.map(m => m.arena.ci_high || getModelScore(m) + 10)) + 10;
    const range = Math.max(maxVal - minVal, 1);

    return `
      <article class="fml-card" id="fml-grid-1" aria-labelledby="fml-grid-1-title">
        <div class="fml-card-header">
          <div class="fml-card-title-row">
            <h3 class="fml-card-title" id="fml-grid-1-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
              1. The Arena Ladder
            </h3>
            <span style="font-size: 0.72rem; color: var(--fml-text-muted);">95% Bootstrap CI Range</span>
          </div>
          <p class="fml-card-helper">
            Ranked LMSYS Arena Elo with confidence intervals. Statistical ties highlight overlapping bounds.
          </p>
          <div class="fml-tabs">
            ${tabs.map(t => `
              <button type="button" class="fml-tab-btn ${this.activeLadderTab === t.key ? 'active' : ''}" data-ladder-tab="${t.key}">
                ${t.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="fml-card-body">
          <div class="fml-ladder-list">
            ${activeModels.map((m, idx) => {
              const score = getModelScore(m);
              const ciLow = m.arena.ci_low || (score - 8);
              const ciHigh = m.arena.ci_high || (score + 8);

              // Check statistical tie with previous or next model
              const prev = activeModels[idx - 1];
              const next = activeModels[idx + 1];
              const isTie = (prev && (prev.arena.ci_low <= ciHigh && prev.arena.ci_high >= ciLow)) ||
                            (next && (next.arena.ci_low <= ciHigh && next.arena.ci_high >= ciLow));

              const leftPct = ((ciLow - minVal) / range) * 100;
              const widthPct = Math.max(((ciHigh - ciLow) / range) * 100, 3);
              const dotPct = ((score - minVal) / range) * 100;

              const delta = m.arena.rank_change || 0;
              const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
              const deltaIcon = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '—';
              const isPinned = this.pinnedIds.has(m.model_id);

              return `
                <div class="fml-ladder-row rank-${idx + 1} ${isPinned ? 'is-selected' : ''}" data-model-id="${m.model_id}" role="button" tabindex="0" title="Click to pin ${m.display_name} for comparison">
                  <div class="fml-ladder-rank">#${idx + 1}</div>
                  <div class="fml-ladder-info">
                    <span class="fml-ladder-name">${m.display_name}</span>
                    <div class="fml-ladder-meta">
                      <span>${m.provider}</span>
                      <span class="fml-rank-delta ${deltaClass}">${deltaIcon}</span>
                      ${isTie ? `<span class="fml-tie-badge" title="Statistical tie: Confidence interval overlaps neighbor">TIE</span>` : ''}
                    </div>
                  </div>
                  <div class="fml-ci-track" title="${m.display_name}: Elo ${score} (95% CI: ${ciLow} – ${ciHigh})">
                    <div class="fml-ci-whisker" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
                    <div class="fml-ci-dot" style="left: ${dotPct}%;"></div>
                  </div>
                  <div class="fml-ladder-score">${score}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------------------
  // GRID 2 - EVAL PROFILE (What It's Good At)
  // --------------------------------------------------------------------------
  renderGrid2EvalProfile() {
    const evalsList = ['GPQA', 'MMLU-Pro', 'HLE', 'AIME', 'LiveCodeBench', 'SWE-bench', 'ARC-AGI', 'MMMU'];
    
    // Choose display pool: if models are pinned, show pinned; otherwise show top 6
    const pool = this.pinnedIds.size > 0 
      ? this.models.filter(m => this.pinnedIds.has(m.model_id)) 
      : this.models.slice(0, 6);

    // Compute max for each eval to highlight best in column
    const evalMaxes = {};
    evalsList.forEach(evalName => {
      const vals = this.models.map(m => m.evals?.[evalName]).filter(v => typeof v === 'number');
      evalMaxes[evalName] = vals.length ? Math.max(...vals) : 0;
    });

    return `
      <article class="fml-card" id="fml-grid-2" aria-labelledby="fml-grid-2-title">
        <div class="fml-card-header">
          <div class="fml-card-title-row">
            <h3 class="fml-card-title" id="fml-grid-2-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              2. Benchmark Profile
            </h3>
            <div class="fml-card-toolbar">
              <button type="button" class="fml-btn-tool ${this.evalProfileView === 'heatmap' ? 'active' : ''}" data-eval-view="heatmap">Heatmap</button>
              <button type="button" class="fml-btn-tool ${this.evalProfileView === 'radar' ? 'active' : ''}" data-eval-view="radar">Radar</button>
            </div>
          </div>
          <p class="fml-card-helper">
            Independent evaluations across reasoning, coding, and general knowledge. Crown indicates best score.
          </p>
        </div>

        <div class="fml-card-body">
          ${this.evalProfileView === 'heatmap' ? this.renderEvalHeatmap(pool, evalsList, evalMaxes) : this.renderEvalRadar(pool)}
        </div>
      </article>
    `;
  }

  renderEvalHeatmap(pool, evalsList, evalMaxes) {
    return `
      <div style="overflow-x: auto;">
        <table class="fml-eval-heatmap" role="table">
          <thead>
            <tr>
              <th scope="col">Model</th>
              ${evalsList.map(e => `<th scope="col" title="${e} benchmark">${e}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${pool.map(m => {
              const isPinned = this.pinnedIds.has(m.model_id);
              return `
                <tr data-model-id="${m.model_id}" class="${isPinned ? 'is-selected' : ''}" role="row">
                  <td scope="row">
                    <span style="font-weight: 700; color: var(--fml-text-primary);">${m.display_name}</span>
                  </td>
                  ${evalsList.map(e => {
                    const score = m.evals?.[e];
                    const max = evalMaxes[e];
                    const isMax = typeof score === 'number' && score === max;

                    if (typeof score !== 'number') {
                      return `<td><span class="fml-nr" title="Not reported for ${m.display_name}">n/r</span></td>`;
                    }

                    // Normalized color intensity 0.15 to 0.95
                    const ratio = max > 0 ? (score / max) : 0;
                    const bgOpacity = (ratio * 0.45 + 0.05).toFixed(2);
                    const isVerified = m.eval_meta?.[e]?.verified_by;

                    return `
                      <td>
                        <span class="fml-heat-cell" style="background: rgba(2, 132, 199, ${bgOpacity});" title="${m.display_name} on ${e}: ${score}% ${isVerified ? `(${isVerified})` : ''}">
                          ${score}%
                          ${isMax ? `<span class="fml-crown" title="Top score in ${e}">★</span>` : ''}
                        </span>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderEvalRadar(pool) {
    const radarModels = pool.slice(0, 4);
    const colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6'];

    return `
      <div class="fml-radar-wrap">
        <svg class="fml-radar-svg" id="fml-radar-svg" viewBox="0 0 400 360" role="img" aria-label="Radar chart of LLM capabilities"></svg>
      </div>
      <div class="fml-radar-legend">
        ${radarModels.map((m, idx) => `
          <span class="fml-legend-item">
            <span class="fml-legend-dot" style="background: ${colors[idx % colors.length]};"></span>
            ${m.display_name}
          </span>
        `).join('')}
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // GRID 3 - VALUE (Pareto Frontier & Price Scatter Plot)
  // --------------------------------------------------------------------------
  renderGrid3Value() {
    return `
      <article class="fml-card" id="fml-grid-3" aria-labelledby="fml-grid-3-title">
        <div class="fml-card-header">
          <div class="fml-card-title-row">
            <h3 class="fml-card-title" id="fml-grid-3-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              3. The Value Frontier
            </h3>
            <div class="fml-card-toolbar">
              <button type="button" class="fml-btn-tool ${this.valueLogScale ? 'active' : ''}" id="fml-toggle-log-scale">
                ${this.valueLogScale ? 'Log Scale' : 'Linear Scale'}
              </button>
            </div>
          </div>
          <p class="fml-card-helper">
            Blended token cost ($/1M) vs quality. Dashed gold line traces the optimal Pareto efficiency frontier.
          </p>
        </div>

        <div class="fml-value-controls">
          <div class="fml-budget-slider-row">
            <label for="fml-budget-input" style="font-weight: 600; color: var(--fml-text-secondary);">Max Budget:</label>
            <input type="range" id="fml-budget-input" min="0.5" max="30" step="0.5" value="${this.budgetMax || 30}" style="width: 110px; accent-color: var(--fml-accent);" />
            <span id="fml-budget-label" style="font-weight: 700; color: var(--fml-accent);">${this.budgetMax ? `$${this.budgetMax.toFixed(2)}` : 'All ($30)'}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label for="fml-select-y-metric" style="font-weight: 600; color: var(--fml-text-secondary);">Quality Metric:</label>
            <select id="fml-select-y-metric" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--fml-border); font-size: 0.74rem;">
              <option value="overall_elo" ${this.valueMetric === 'overall_elo' ? 'selected' : ''}>Arena Overall Elo</option>
              <option value="coding" ${this.valueMetric === 'coding' ? 'selected' : ''}>Coding Elo</option>
              <option value="GPQA" ${this.valueMetric === 'GPQA' ? 'selected' : ''}>GPQA Reasoning</option>
              <option value="SWE-bench" ${this.valueMetric === 'SWE-bench' ? 'selected' : ''}>SWE-bench Verified</option>
            </select>
          </div>
        </div>

        <div class="fml-card-body" style="padding-top: 0.25rem;">
          <div class="fml-scatter-canvas-wrap">
            <svg class="fml-scatter-svg" id="fml-scatter-svg" viewBox="0 0 520 340" role="img" aria-label="Value scatter plot with Pareto frontier line"></svg>
          </div>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------------------
  // GRID 4 - SPECS & SPEED (Sortable Capability Matrix)
  // --------------------------------------------------------------------------
  renderGrid4SpecsSpeed() {
    let list = [...this.models];

    // Filter by open-weights
    if (this.specsFilter.openOnly) {
      list = list.filter(m => m.license === 'open-weights');
    }

    // Filter by min context
    if (this.specsFilter.minContext > 0) {
      list = list.filter(m => m.context_window >= this.specsFilter.minContext);
    }

    // Sort
    const col = this.specsSort.column;
    const dir = this.specsSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let va = a[col];
      let vb = b[col];
      if (col === 'tokens_per_sec') {
        va = a.speed?.tokens_per_sec || 0;
        vb = b.speed?.tokens_per_sec || 0;
      }
      if (col === 'composite') {
        va = computeCompositeScore(a, this.decisionWeights, this.models);
        vb = computeCompositeScore(b, this.decisionWeights, this.models);
      }
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return ((va || 0) - (vb || 0)) * dir;
    });

    const maxContext = 2000000;
    const maxSpeed = 180;

    return `
      <article class="fml-card" id="fml-grid-4" aria-labelledby="fml-grid-4-title">
        <div class="fml-card-header">
          <div class="fml-card-title-row">
            <h3 class="fml-card-title" id="fml-grid-4-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              4. Specs & Speed Matrix
            </h3>
            <div class="fml-card-toolbar">
              <label style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;">
                <input type="checkbox" id="fml-filter-open-only" ${this.specsFilter.openOnly ? 'checked' : ''} />
                Open Weights Only
              </label>
            </div>
          </div>
          <p class="fml-card-helper">
            Context windows, max output tokens, modalities, speed, and real-time decision fit score.
          </p>
        </div>

        <div class="fml-card-body" style="padding: 0;">
          <div class="fml-specs-table-wrap">
            <table class="fml-specs-table" role="table">
              <thead>
                <tr>
                  <th scope="col" data-sort-col="display_name" class="${this.specsSort.column === 'display_name' ? `sorted-${this.specsSort.dir}` : ''}">Model</th>
                  <th scope="col" data-sort-col="composite" class="${this.specsSort.column === 'composite' ? `sorted-${this.specsSort.dir}` : ''}" title="Decision fit based on active weights">Decision Fit</th>
                  <th scope="col" data-sort-col="context_window" class="${this.specsSort.column === 'context_window' ? `sorted-${this.specsSort.dir}` : ''}">Context Window</th>
                  <th scope="col" data-sort-col="tokens_per_sec" class="${this.specsSort.column === 'tokens_per_sec' ? `sorted-${this.specsSort.dir}` : ''}">Speed (tok/s)</th>
                  <th scope="col">Modalities</th>
                  <th scope="col">License</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(m => {
                  const fitScore = computeCompositeScore(m, this.decisionWeights, this.models);
                  const isPinned = this.pinnedIds.has(m.model_id);
                  const ctxK = m.context_window >= 1000000 ? `${(m.context_window / 1000000).toFixed(1)}M` : `${Math.round(m.context_window / 1000)}k`;
                  const ctxFill = Math.min(100, Math.max(10, (m.context_window / maxContext) * 100));
                  const speedVal = m.speed?.tokens_per_sec;
                  const speedFill = typeof speedVal === 'number' ? Math.min(100, (speedVal / maxSpeed) * 100) : 0;

                  return `
                    <tr class="fml-specs-row ${isPinned ? 'is-selected' : ''}" data-model-id="${m.model_id}" role="row">
                      <td style="font-weight: 700; color: var(--fml-text-primary);">
                        ${m.display_name}
                      </td>
                      <td>
                        <span style="font-weight: 700; color: var(--fml-accent); font-size: 0.82rem;">${fitScore}/100</span>
                      </td>
                      <td>
                        <span class="fml-mini-bar-track"><span class="fml-mini-bar-fill" style="width: ${ctxFill}%;"></span></span>
                        ${ctxK}
                      </td>
                      <td>
                        <span class="fml-mini-bar-track"><span class="fml-mini-bar-fill speed" style="width: ${speedFill}%;"></span></span>
                        ${typeof speedVal === 'number' ? `${speedVal} t/s` : '<span class="fml-nr">n/r</span>'}
                      </td>
                      <td>
                        <span class="fml-modality-icons">
                          <span class="${m.modalities.includes('text') ? 'active' : ''}" title="Text">T</span>
                          <span class="${m.modalities.includes('image') ? 'active' : ''}" title="Vision / Image">V</span>
                          <span class="${m.modalities.includes('audio') ? 'active' : ''}" title="Audio">A</span>
                        </span>
                      </td>
                      <td>
                        <span class="fml-license-tag ${m.license}">
                          ${m.license === 'open-weights' ? 'Open Weights' : 'Proprietary'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------------------------------
  // METHODOLOGY & GLOSSARY DRAWER
  // --------------------------------------------------------------------------
  renderMethodologyDrawer() {
    return `
      <div class="fml-methodology-drawer" id="fml-methodology-drawer">
        <h4>Researcher Methodology & Metric Definitions</h4>
        <p>The Frontier Model Ladder synthesizes open arena elo feeds and standardized evaluations to assist engineers and product teams in making evidence-based model selection decisions.</p>
        <div class="fml-glossary-grid">
          <div class="fml-glossary-item">
            <strong>LMSYS Chatbot Arena Elo:</strong>
            Bradley-Terry rating system computed over blind, randomized side-by-side human preference battles. 95% bootstrap confidence intervals illustrate statistical parity.
          </div>
          <div class="fml-glossary-item">
            <strong>Pareto Efficiency Frontier:</strong>
            Identifies non-dominated models where no competitor achieves equal or superior quality at a lower blended price per million tokens.
          </div>
          <div class="fml-glossary-item">
            <strong>GPQA & Humanity's Last Exam (HLE):</strong>
            High-difficulty reasoning benchmarks designed by academic subject experts with rigorous question verification to reduce training contamination.
          </div>
          <div class="fml-glossary-item">
            <strong>Transparent Decision Score:</strong>
            Configurable weighted multi-criteria decision index: (Elo × w₁) + (Coding × w₂) + (Math × w₃) + (Speed × w₄) + (Value × w₅) + (Context × w₆).
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // INTERACTIVE GRAPHICS DRAWING (CANVAS & SVG)
  // ==========================================================================
  drawInteractiveGraphics() {
    this.drawScatterPlot();
    if (this.evalProfileView === 'radar') {
      this.drawRadarChart();
    }
  }

  drawScatterPlot() {
    const svg = document.getElementById('fml-scatter-svg');
    if (!svg) return;

    const width = 520;
    const height = 340;
    const padding = { top: 30, right: 30, bottom: 45, left: 55 };

    // Get Y metric value
    const getYVal = (m) => {
      if (this.valueMetric === 'coding') return m.arena.category_elos?.coding || m.arena.overall_elo;
      if (this.valueMetric === 'GPQA') return m.evals?.GPQA || null;
      if (this.valueMetric === 'SWE-bench') return m.evals?.['SWE-bench'] || null;
      return m.arena.overall_elo;
    };

    const validModels = this.models.filter(m => {
      const y = getYVal(m);
      const x = m.cost?.blended_per_1M;
      return typeof y === 'number' && typeof x === 'number';
    });

    if (!validModels.length) return;

    // X scale (Price)
    const xVals = validModels.map(m => m.cost.blended_per_1M);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);

    // Y scale (Metric)
    const yVals = validModels.map(m => getYVal(m));
    const minY = Math.min(...yVals) - 10;
    const maxY = Math.max(...yVals) + 10;

    const scaleX = (val) => {
      if (this.valueLogScale) {
        const logMin = Math.log10(Math.max(minX, 0.05));
        const logMax = Math.log10(maxX);
        const logVal = Math.log10(Math.max(val, 0.05));
        return padding.left + ((logVal - logMin) / (logMax - logMin)) * (width - padding.left - padding.right);
      }
      return padding.left + ((val - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    };

    const scaleY = (val) => {
      return height - padding.bottom - ((val - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    };

    // Calculate Pareto Frontier (highest quality for lowest or equal cost)
    const sortedByPrice = [...validModels].sort((a, b) => a.cost.blended_per_1M - b.cost.blended_per_1M);
    const paretoPoints = [];
    let currentBestY = -Infinity;

    for (const m of sortedByPrice) {
      const y = getYVal(m);
      if (y > currentBestY) {
        paretoPoints.push({ x: scaleX(m.cost.blended_per_1M), y: scaleY(y), model: m });
        currentBestY = y;
      }
    }

    const providerColors = {
      'OpenAI': '#10b981',
      'Anthropic': '#f59e0b',
      'Google DeepMind': '#0284c7',
      'Meta AI': '#06b6d4',
      'Alibaba Cloud': '#ec4899',
      'DeepSeek': '#8b5cf6',
      'Mistral AI': '#f97316'
    };

    let markup = `
      <!-- Grid Lines -->
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#cbd5e1" stroke-width="1.5"/>
      
      <!-- Axis Labels -->
      <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">
        Blended Price per 1M Tokens ($USD${this.valueLogScale ? ' - Log Scale' : ''})
      </text>
      <text x="-${height / 2}" y="18" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b" transform="rotate(-90)">
        ${this.valueMetric.replace('_', ' ').toUpperCase()}
      </text>
    `;

    // Draw Pareto Line
    if (paretoPoints.length > 1) {
      const pathD = paretoPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      markup += `
        <path d="${pathD}" class="fml-pareto-line" />
        <text x="${paretoPoints[paretoPoints.length - 1].x}" y="${paretoPoints[paretoPoints.length - 1].y - 12}" class="fml-pareto-badge" text-anchor="end">
          Pareto Optimal Frontier ★
        </text>
      `;
    }

    // Draw Scatter Bubbles
    validModels.forEach(m => {
      const x = scaleX(m.cost.blended_per_1M);
      const y = scaleY(getYVal(m));
      const r = Math.min(18, Math.max(6, Math.round(Math.sqrt(m.context_window / 1000) * 0.45)));
      const color = providerColors[m.provider] || '#64748b';
      const isOpen = m.license === 'open-weights';
      const isDimmed = this.budgetMax && m.cost.blended_per_1M > this.budgetMax;
      const isPinned = this.pinnedIds.has(m.model_id);

      if (isOpen) {
        // Open weights = diamond / rotated square
        markup += `
          <rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="3" transform="rotate(45 ${x} ${y})" 
            fill="${color}" fill-opacity="${isDimmed ? '0.2' : '0.85'}" stroke="${isPinned ? '#0f172a' : '#ffffff'}" stroke-width="${isPinned ? '3' : '1.5'}"
            class="fml-scatter-point ${isDimmed ? 'dimmed' : ''}" data-model-id="${m.model_id}"
            title="${m.display_name} (${m.provider}): $${m.cost.blended_per_1M}/1M tokens, ${this.valueMetric}: ${getYVal(m)}">
          </rect>
        `;
      } else {
        // Proprietary = circle
        markup += `
          <circle cx="${x}" cy="${y}" r="${r}" 
            fill="${color}" fill-opacity="${isDimmed ? '0.2' : '0.85'}" stroke="${isPinned ? '#0f172a' : '#ffffff'}" stroke-width="${isPinned ? '3' : '1.5'}"
            class="fml-scatter-point ${isDimmed ? 'dimmed' : ''}" data-model-id="${m.model_id}"
            title="${m.display_name} (${m.provider}): $${m.cost.blended_per_1M}/1M tokens, ${this.valueMetric}: ${getYVal(m)}">
          </circle>
        `;
      }

      // Model label text
      markup += `
        <text x="${x}" y="${y - r - 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#334155" opacity="${isDimmed ? '0.25' : '1'}">
          ${m.display_name.split(' ')[0]}
        </text>
      `;
    });

    svg.innerHTML = markup;
  }

  drawRadarChart() {
    const svg = document.getElementById('fml-radar-svg');
    if (!svg) return;

    const pool = this.pinnedIds.size > 0 
      ? this.models.filter(m => this.pinnedIds.has(m.model_id)) 
      : this.models.slice(0, 3);

    const axes = [
      { key: 'coding', label: 'Coding' },
      { key: 'math', label: 'Math' },
      { key: 'hard_prompts', label: 'Hard Prompts' },
      { key: 'creative', label: 'Creative' },
      { key: 'long_context', label: 'Long Context' },
      { key: 'instruction_following', label: 'Instruction' }
    ];

    const cx = 200;
    const cy = 180;
    const rMax = 120;
    const totalAxes = axes.length;
    const angleSlice = (Math.PI * 2) / totalAxes;

    let markup = `
      <!-- Concentric Web Rings -->
      ${[0.25, 0.5, 0.75, 1].map(lvl => {
        const pts = axes.map((_, i) => {
          const a = angleSlice * i - Math.PI / 2;
          return `${cx + Math.cos(a) * rMax * lvl},${cy + Math.sin(a) * rMax * lvl}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="1.2"/>`;
      }).join('')}
    `;

    // Radial spokes and labels
    axes.forEach((ax, i) => {
      const a = angleSlice * i - Math.PI / 2;
      const x2 = cx + Math.cos(a) * rMax;
      const y2 = cy + Math.sin(a) * rMax;
      const lx = cx + Math.cos(a) * (rMax + 24);
      const ly = cy + Math.sin(a) * (rMax + 24);

      markup += `
        <line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" font-weight="700" fill="#475569" dominant-baseline="middle">
          ${ax.label}
        </text>
      `;
    });

    const colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6'];
    const minElo = 1200;
    const maxElo = 1400;

    pool.forEach((m, idx) => {
      const color = colors[idx % colors.length];
      const pts = axes.map((ax, i) => {
        const val = m.arena.category_elos?.[ax.key] || m.arena.overall_elo;
        const norm = Math.max(0.15, Math.min(1, (val - minElo) / (maxElo - minElo)));
        const a = angleSlice * i - Math.PI / 2;
        return `${cx + Math.cos(a) * rMax * norm},${cy + Math.sin(a) * rMax * norm}`;
      }).join(' ');

      markup += `
        <polygon points="${pts}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="2" class="fml-radar-poly" data-model-id="${m.model_id}"/>
      `;
    });

    svg.innerHTML = markup;
  }

  // ==========================================================================
  // EVENT LISTENERS & DOM DELEGATION
  // ==========================================================================
  attachEventListeners() {
    // Header actions
    const btnWeights = document.getElementById('fml-btn-weights');
    if (btnWeights) {
      btnWeights.onclick = () => {
        this.showWeightsDrawer = !this.showWeightsDrawer;
        this.render();
      };
    }

    const btnMethodology = document.getElementById('fml-btn-methodology');
    if (btnMethodology) {
      btnMethodology.onclick = () => {
        this.showMethodology = !this.showMethodology;
        this.render();
      };
    }

    const btnCsv = document.getElementById('fml-btn-export-csv');
    if (btnCsv) btnCsv.onclick = () => this.exportCSV();

    const btnPng = document.getElementById('fml-btn-export-png');
    if (btnPng) btnPng.onclick = () => this.exportPNG();

    const btnClearPinned = document.getElementById('fml-btn-clear-pinned');
    if (btnClearPinned) btnClearPinned.onclick = () => this.clearPinnedModels();

    // Use-Case Presets
    this.container.querySelectorAll('[data-preset-key]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-preset-key');
        if (USE_CASE_PRESETS[key]) {
          this.decisionPreset = key;
          this.decisionWeights = { ...USE_CASE_PRESETS[key].weights };
          this.updateUrlState();
          this.render();
        }
      };
    });

    // Weight sliders
    this.container.querySelectorAll('[data-weight-key]').forEach(input => {
      input.oninput = (e) => {
        const key = input.getAttribute('data-weight-key');
        this.decisionWeights[key] = parseFloat(e.target.value);
        this.render();
      };
    });

    // Unpin chip button
    this.container.querySelectorAll('[data-unpin-id]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.togglePinnedModel(btn.getAttribute('data-unpin-id'));
      };
    });

    // Grid 1 Tabs
    this.container.querySelectorAll('[data-ladder-tab]').forEach(tab => {
      tab.onclick = () => {
        this.activeLadderTab = tab.getAttribute('data-ladder-tab');
        this.updateUrlState();
        this.render();
      };
    });

    // Grid 2 View Switcher
    this.container.querySelectorAll('[data-eval-view]').forEach(btn => {
      btn.onclick = () => {
        this.evalProfileView = btn.getAttribute('data-eval-view');
        this.render();
      };
    });

    // Grid 3 Value Controls
    const btnLog = document.getElementById('fml-toggle-log-scale');
    if (btnLog) {
      btnLog.onclick = () => {
        this.valueLogScale = !this.valueLogScale;
        this.render();
      };
    }

    const selectY = document.getElementById('fml-select-y-metric');
    if (selectY) {
      selectY.onchange = (e) => {
        this.valueMetric = e.target.value;
        this.render();
      };
    }

    const sliderBudget = document.getElementById('fml-budget-input');
    if (sliderBudget) {
      sliderBudget.oninput = (e) => {
        this.budgetMax = parseFloat(e.target.value);
        const lbl = document.getElementById('fml-budget-label');
        if (lbl) lbl.textContent = `$${this.budgetMax.toFixed(2)}`;
        this.drawScatterPlot();
      };
    }

    // Grid 4 Controls
    const checkOpen = document.getElementById('fml-filter-open-only');
    if (checkOpen) {
      checkOpen.onchange = (e) => {
        this.specsFilter.openOnly = e.target.checked;
        this.render();
      };
    }

    this.container.querySelectorAll('[data-sort-col]').forEach(th => {
      th.onclick = () => {
        const col = th.getAttribute('data-sort-col');
        if (this.specsSort.column === col) {
          this.specsSort.dir = this.specsSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this.specsSort.column = col;
          this.specsSort.dir = 'desc';
        }
        this.render();
      };
    });

    // Global Model Hover & Selection Syncing
    this.container.querySelectorAll('[data-model-id]').forEach(el => {
      const mid = el.getAttribute('data-model-id');
      el.onmouseenter = () => this.setHoveredModel(mid);
      el.onmouseleave = () => this.setHoveredModel(null);
      el.onclick = (e) => {
        // Only trigger toggle if not clicking interactive child
        if (!e.target.closest('button, select, input, a')) {
          this.togglePinnedModel(mid);
        }
      };
    });
  }

  // ==========================================================================
  // EXPORT UTILITIES (CSV & PNG)
  // ==========================================================================
  exportCSV() {
    const headers = [
      'model_id', 'display_name', 'provider', 'license', 'overall_elo', 
      'coding_elo', 'math_elo', 'context_window', 'price_blended_1M', 'speed_tok_sec'
    ];

    const rows = this.models.map(m => [
      `"${m.model_id}"`,
      `"${m.display_name}"`,
      `"${m.provider}"`,
      `"${m.license}"`,
      m.arena.overall_elo,
      m.arena.category_elos?.coding || 'n/r',
      m.arena.category_elos?.math || 'n/r',
      m.context_window,
      m.cost.blended_per_1M,
      m.speed.tokens_per_sec
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapfacts-frontier-models-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportPNG() {
    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    // Clean white editorial background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1440, 900);

    // Header banner
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(40, 40, 1360, 4);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px "Space Grotesk", sans-serif';
    ctx.fillText('SNAPFACTS — Frontier Model Ladder', 40, 90);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillText(`Real-Time Arena Benchmark Intelligence • Generated ${new Date().toLocaleDateString()}`, 40, 120);

    // Draw Top 5 ranked models
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Top Frontier Models by Arena Elo:', 40, 180);

    let y = 220;
    this.models.slice(0, 8).forEach((m, idx) => {
      ctx.fillStyle = idx < 3 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(40, y - 24, 1360, 48);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(40, y - 24, 1360, 48);

      ctx.fillStyle = idx === 0 ? '#d97706' : '#0f172a';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.fillText(`#${idx + 1}  ${m.display_name}`, 60, y + 6);

      ctx.fillStyle = '#64748b';
      ctx.font = '15px Inter, sans-serif';
      ctx.fillText(`Provider: ${m.provider}   |   Context: ${m.context_window.toLocaleString()}   |   Blended: $${m.cost.blended_per_1M}/1M`, 450, y + 6);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 20px "Space Grotesk", sans-serif';
      ctx.fillText(`Elo ${m.arena.overall_elo}`, 1250, y + 6);

      y += 60;
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `frontier-ladder-snapshot-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }
}

if (typeof window !== 'undefined') {
  window.FrontierModelLadder = FrontierModelLadder;
  window.FrontierDataAdapter = FrontierDataAdapter;
  window.DEFAULT_FIELD_MAP = DEFAULT_FIELD_MAP;
  window.USE_CASE_PRESETS = USE_CASE_PRESETS;
}

