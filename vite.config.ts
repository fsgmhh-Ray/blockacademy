import { defineConfig } from 'vite';
import { proxyLLM, readBody, sendJSON } from './server/llmProxy.mjs';

/**
 * 开发期 LLM 代理中间件。生产环境由 server/index.mjs 提供同样的能力。
 */
function llmDevProxy() {
  return {
    name: 'blockacademy-llm-proxy',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const raw = await readBody(req);
        await proxyLLM(req, res, raw);
      });
      server.middlewares.use('/api/health', (_req, res) => sendJSON(res, 200, { ok: true }));
    },
  };
}

export default defineConfig({
  plugins: [llmDevProxy()],
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600, outDir: 'dist' },
});
