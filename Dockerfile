# ---- build: SvelteKit static site (the Rust compiler is prebuilt WASM in static/wasm) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve: plain nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
