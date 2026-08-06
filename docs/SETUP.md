# Setup Guide

1. Clone the repository.
2. Run `npm install`
3. Generate the QRs and Seed Data: `npm run generate-qrs` (runs the script in `scripts/generate-qrs.js`).
4. Follow `SUPABASE_SETUP.md` to initialize the database and insert the seed data.
5. Copy `.env.example` to `.env` and fill in the Supabase details.
6. Run `npm run dev` to start locally.
