import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves at https://<user>.github.io/<repo>/, so we need a
// non-root base when deploying there. Set BASE_PATH=/repo-name/ at build time.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  build: {
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/icon.svg"],
      manifest: {
        name: "Horse Training Tracker",
        short_name: "HorseTrain",
        description:
          "Daily evaluation tracker for horse training programs with progress charts and PDF reports.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "192x192 512x512 any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${basePath}index.html`,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
