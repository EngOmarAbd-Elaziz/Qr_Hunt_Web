# QR Generation

Run `node scripts/generate-qrs.js`.
This script will read `data/words.csv`, generate 10-character cryptographically secure tokens, and output 96 SVGs/PNGs into the `qr-assets/` directory.

It also generates the `supabase/04_seed.sql` script required to initialize the words and fragments in the database.
