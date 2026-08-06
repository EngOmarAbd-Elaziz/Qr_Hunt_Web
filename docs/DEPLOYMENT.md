# Deployment Guide

The frontend is a completely static React app built with Vite. It does not require a Node.js server to run.

## GitHub Pages Deployment

1. Fork or push this repository to GitHub.
2. In your repository settings, go to **Pages**.
3. Set the source to **GitHub Actions**.
4. Use a standard Vite deployment workflow (`.github/workflows/deploy.yml`):
```yaml
name: Deploy static content to Pages

on:
  push:
    branches: ['main']

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
5. Set your repository secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Push to `main`.
