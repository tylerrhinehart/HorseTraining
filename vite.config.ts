import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves at https://<user>.github.io/<repo>/, so we need a
// non-root base when deploying there. Set BASE_PATH=/repo-name/ at build time.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-pdf": ["@react-pdf/renderer"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "TQA Horse Training Tracker",
        short_name: "TQA Tracker",
        description:
          "Daily evaluation tracker for horse training programs with progress charts and PDF reports.",
        theme_color: "#f3ece0",
        background_color: "#f3ece0",
        display: "standalone",
        // Match the existing start URL identity at both the root and GitHub Pages base.
        id: basePath,
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
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
