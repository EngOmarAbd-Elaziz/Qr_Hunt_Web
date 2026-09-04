-- supabase/10_reset_game.sql

-- 1. Create global game state table
CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY DEFAULT 1,
    reset_version UUID NOT NULL DEFAULT uuid_generate_v4(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Ensure there is exactly one row
INSERT INTO game_state (id, reset_version)
VALUES (1, uuid_generate_v4())
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read the reset version, but only admins to update
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- Required for Supabase Realtime to include column values in UPDATE payloads
ALTER TABLE game_state REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Anyone can read game state" ON game_state;
CREATE POLICY "Anyone can read game state" ON game_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update game state" ON game_state;
CREATE POLICY "Admins can update game state" ON game_state FOR UPDATE USING (is_admin());

-- 2. RPC to get the current reset version efficiently
CREATE OR REPLACE FUNCTION get_reset_version()
RETURNS UUID AS $$
DECLARE
    v_version UUID;
BEGIN
    SELECT reset_version INTO v_version FROM game_state WHERE id = 1;
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. The main atomic reset RPC
CREATE OR REPLACE FUNCTION reset_game()
RETURNS json AS $$
DECLARE
    v_new_version UUID;
BEGIN
    -- 1. Security Check
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can reset the game.';
    END IF;

    -- 2. Delete all player fragments
    DELETE FROM player_fragments WHERE true;

    -- 3. Delete all audit logs
    DELETE FROM audit_logs WHERE true;

    -- 4. Reset all fragments
    UPDATE fragments 
    SET 
        status = 'AVAILABLE',
        collected_by = NULL,
        collected_at = NULL,
        used_in_winning_word = FALSE
    WHERE true;

    -- 5. Reset all words
    UPDATE words
    SET
        status = 'HIDDEN',
        solved_by = NULL,
        solved_at = NULL
    WHERE true;

    -- 6. Delete all players
    -- Since player_fragments, audit_logs and words references have ON DELETE CASCADE/SET NULL, this is safe
    DELETE FROM players WHERE true;

    -- 7. Update global reset version
    v_new_version := uuid_generate_v4();
    UPDATE game_state 
    SET reset_version = v_new_version, updated_at = NOW() 
    WHERE id = 1;

    RETURN json_build_object(
        'success', true, 
        'message', 'Game has been successfully reset.',
        'new_version', v_new_version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
