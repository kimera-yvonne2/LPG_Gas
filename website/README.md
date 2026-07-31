# Lumora project website

This directory is a standalone React + Vite site for the project presentation. It does not import or share runtime code with `apps/frontend`.

## Cloudflare Pages deployment

Create a Cloudflare Pages project from this repository and configure:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `website/dist`

Cloudflare will build the standalone site and serve the images in `public/assets/`. The buttons that open Lumora already point to `https://guardiangass.yvonnekimera2.workers.dev/`.
