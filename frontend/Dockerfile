# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# patches/ has to land before `npm ci`, because postinstall runs patch-package.
COPY package.json package-lock.json ./
COPY patches/ ./patches/
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
