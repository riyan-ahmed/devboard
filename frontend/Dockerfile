# ---- Stage 1: build the static files ----
FROM node:22-alpine AS builder
WORKDIR /app
# which files describe the dependencies?
COPY package.json package-lock.json ./   
 # install exactly what's in the lockfile
RUN npm ci             
COPY . .
# produce dist/
RUN npm run build             

# ---- Stage 2: serve them ----
FROM nginxinc/nginx-unprivileged:1-alpine3.24
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=backend:8080
EXPOSE 8080


