# Supabase Setup Guide

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** and run the files in the `supabase/` folder in order:
   - `01_schema.sql`
   - `02_rls.sql`
   - `03_rpc.sql`
   - `04_seed.sql`
   - `05_auth_rpc.sql`
3. Go to **Authentication > Providers** and ensure Anonymous Sign-Ins are enabled.
4. Go to **Authentication > Users** and create an admin user with an email and password.
5. Go to the **Table Editor**, open the `admins` table, and insert the UUID of the admin user you just created along with their email.
6. Go to **Database > Replication** and enable Realtime for the following tables:
   - `words`
   - `fragments`
   - `players`
7. Copy your Project URL and Anon Public Key from **Project Settings > API**.
8. Create a `.env` file in the root of the project with:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```
