# syntax=docker/dockerfile:1.7
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Vite inlines VITE_* vars into the bundle at build time, so they must be
# present here. Pass via --build-arg from deploy.sh.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
# BASE_PATH defaults to "/" in vite.config.ts, which is what we want when
# serving from the root of tqa.tylerrhinehart.com (GH Pages used /repo/).
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
# Drop the default site config; ours adds the SPA history fallback.
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine's default user is root for the master process, but worker
# processes drop to nginx (uid 101). Keep that behavior — readOnlyRootFilesystem
# is left off in the Deployment because nginx writes /var/cache/nginx and
# /var/run during startup.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
