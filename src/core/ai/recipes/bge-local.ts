import type { Recipe } from '../types.ts';

/**
 * BGE-Local recipe — serves a local BGE model (e.g. bge-small-zh-v1.5)
 * via a custom FastAPI server at D:\bge-small-zh-v1.5\server.py.
 *
 * Start the server first:
 *   cd D:\bge-small-zh-v1.5 && python server.py
 *
 * Then init gbrain:
 *   gbrain init --model bge-local:bge-small-zh-v1.5 --embedding-dimensions 512
 */
export const bge_local: Recipe = {
  id: 'bge-local',
  name: 'BGE Local (中文 embedding)',
  tier: 'openai-compat',
  implementation: 'openai-compatible',
  base_url_default: 'http://localhost:8000/v1',

  auth_env: {
    required: [],       // 本地服务唔使 API key
    optional: ['BGE_BASE_URL'],
    setup_url: 'https://huggingface.co/BAAI/bge-small-zh-v1.5',
  },

  touchpoints: {
    embedding: {
      models: ['bge-small-zh-v1.5'],
      default_dims: 512,
      cost_per_1m_tokens_usd: 0,
      price_last_verified: '2026-05-20',
      no_batch_cap: true,   // 本地服务，容量取决于机器
    },
  },

  setup_hint:
    '1. 安装依赖: pip install fastapi uvicorn sentence-transformers numpy\n' +
    '2. 启动服务: cd D:\\bge-small-zh-v1.5 && python server.py\n' +
    '3. 验证: curl http://localhost:8000/health',
};
