import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("tests/browser"),
  plugins: [react(), { name: "fixture-client", resolveId(id, importer) { if (id === "./AuthProvider" && importer?.includes("/src/auth/")) return resolve("tests/browser/AuthProvider.tsx"); if (id === "./client" && importer?.includes("/src/supabase/")) return resolve("tests/browser/client.ts"); if (id === "virtual:pwa-register/react") return resolve("tests/browser/pwa.ts"); } }],
  resolve: { alias: [
    { find: /^\.\/AuthProvider$/, replacement: resolve("tests/browser/AuthProvider.tsx") },
    { find: /^\.\/client$/, replacement: resolve("tests/browser/client.ts") },
    { find: /^.*\/auth\/AuthProvider(?:\.tsx)?$/, replacement: resolve("tests/browser/AuthProvider.tsx") },
    { find: /^.*\/supabase\/client(?:\.ts)?$/, replacement: resolve("tests/browser/client.ts") },
  ] },
  server: { host: "127.0.0.1", port: 4174, strictPort: true, fs: { allow: [resolve(".")] } },
});
