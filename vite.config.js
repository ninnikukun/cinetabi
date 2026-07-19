import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 本番（Vercel）は api/*.js をサーバーレス関数としてそのまま実行する。
// ローカルの `npm run dev` は Vite だけなので、/api/cinemas を同じハンドラーに
// 中継する簡易ミドルウェアをここに用意する（vercel dev のログイン等は不要）。
function apiCinemasDevMiddleware() {
  return {
    name: "api-cinemas-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/cinemas")) return next();
        try {
          const query = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
          const mod = await server.ssrLoadModule("/api/cinemas.js");
          const vres = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(...args) { res.setHeader(...args); },
            json(obj) {
              res.statusCode = this.statusCode;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(obj));
            },
          };
          await mod.default({ query }, vres);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "dev_middleware_failed", message: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // サーバー側の /api ハンドラーが process.env.ORS_API_KEY などを読めるように、
  // VITE_ プレフィックスなしの .env の値もここで process.env に反映する。
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of Object.keys(env)) {
    if (!key.startsWith("VITE_") && process.env[key] === undefined) process.env[key] = env[key];
  }

  return {
    plugins: [react(), apiCinemasDevMiddleware()],
  };
});
