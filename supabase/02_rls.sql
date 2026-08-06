-- supabase/02_rls.sql

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_fragments ENABLE ROW LEVEL SECURITY;

-- Note: In Supabase, the Admin Dashboard is accessed via a specific authenticated user.
CREATE TABLE admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- Only the user can read their own admin status
CREATE POLICY "Admins can read own record" ON admins FOR SELECT USING (auth.uid() = id);

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM admins WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PLAYERS
-- Players can read their own data, or admins can read all
CREATE POLICY "Players can read own data" ON players FOR SELECT 
    USING (auth.uid() = id OR is_admin());

-- Nobody can insert/update/delete directly (only via RPC)

-- WORDS
-- Everyone can read words (the actual 'word' column is typically hidden from players, 
-- but RLS is row-level, not column-level. We handle column hiding via a view if strictly needed, 
-- but since the app logic is controlled, players can read all rows to get lengths and statuses.)
CREATE POLICY "Anyone can read words" ON words FOR SELECT 
    USING (true);

-- FRAGMENTS
-- Players can only read fragments they have collected, Admins can read all.
CREATE POLICY "Players can read collected fragments" ON fragments FOR SELECT 
    USING (collected_by = auth.uid() OR is_admin());

-- PLAYER_FRAGMENTS
-- Players can read their own collection, Admins can read all.
CREATE POLICY "Players can read own collection" ON player_fragments FOR SELECT 
    USING (player_id = auth.uid() OR is_admin());

-- ALLOW ADMINS FULL ACCESS (Useful for dashboard)
CREATE POLICY "Admins can update players" ON players FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can update words" ON words FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can update fragments" ON fragments FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete player_fragments" ON player_fragments FOR DELETE USING (is_admin());
