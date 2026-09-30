# Phase 0: Starter

The app code taken from the original DevBoard `master` branch, with all
Docker, CI and Kubernetes files removed so every later phase is built from
scratch.

## Changes from the original app code

- **Fixed a dependency conflict.** The frontend had Vite 8 with
  `@vitejs/plugin-react` 4.x, which only supports up to Vite 7, so `npm ci`
  failed. The original repo hid this with `npm install --legacy-peer-deps` in
  its Dockerfile. I upgraded the plugin to 5.2, which supports Vite 8, so a
  plain `npm ci` works and the lockfile is honoured.
- **Removed the Docker-specific proxy** (`vite.preview.config.js` and the
  hard-coded `backend:8080` target). How the frontend finds the backend is a
  Phase 1 decision.

## Baseline

- Frontend: lint passes (1 warning), 25/25 tests pass, production build ~242 kB JS.
- Backend: 2 unit tests (`go test ./...`).
