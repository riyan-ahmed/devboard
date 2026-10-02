# ---- Stage 1: build the static files ----

FROM node:22-alpine AS builder

WORKDIR /app

# Copy only the dependency files first, so npm ci stays cached when only code changes

COPY package.json package-lock.json ./

# npm ci installs exactly the versions in the lockfile (reproducible builds)

RUN npm ci

COPY . .

# Build the static site into /app/dist

RUN npm run build


# ---- Stage 2: serve them ----
FROM nginxinc/nginx-unprivileged:1.31-alpine

USER 0

RUN apk upgrade --no-cache pcre2

USER 101

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_URL=backend:8080

EXPOSE 8080


