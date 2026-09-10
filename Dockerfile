# Stage 1: Base común para construir
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

# Stage 2: Construcción de assets
FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm run build --filter boltdocs --filter docs

# Stage 3: Producción ultra ligera (Servidor estático)
FROM alpine:3.19 AS prod
RUN apk add --no-cache npm && npm install -g serve
WORKDIR /app
COPY --from=build /app/docs/dist ./dist
RUN mkdir -p ./dist/docs && find ./dist -mindepth 1 -maxdepth 1 ! -name docs -exec cp -R {} ./dist/docs/ \;

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
