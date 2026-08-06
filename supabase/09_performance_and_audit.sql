-- supabase/09_performance_and_audit.sql

-- 1. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'SCAN', 'DISCARD', 'SUBMIT_WORD'
    fragment_id UUID REFERENCES fragments(id) ON DELETE SET NULL,
    word_id UUID REFERENCES words(id) ON DELETE SET NULL
);

-- RLS for audit_logs (Admin only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs" ON audit_logs FOR SELECT USING (is_admin());

-- 2. PERFORMANCE INDEXES
-- Note: idx_fragments_public_token and idx_fragments_status already exist in 01_schema.sql
-- We create new ones to speed up GameDashboard queries and general joins
CREATE INDEX IF NOT EXISTS idx_fragments_collected_by ON fragments(collected_by);
CREATE INDEX IF NOT EXISTS idx_fragments_word_id ON fragments(word_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_player_id ON audit_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);

-- 3. DISCARD FRAGMENT RPC
-- Allows a player to discard a fragment, returning it to the pool for others
CREATE OR REPLACE FUNCTION discard_fragment(p_fragment_id UUID)
RETURNS json AS $$
DECLARE
    v_player_id UUID;
    v_status fragment_status;
    v_collected_by UUID;
    v_used BOOLEAN;
BEGIN
    v_player_id := auth.uid();
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock the fragment row
    SELECT status, collected_by, used_in_winning_word 
    INTO v_status, v_collected_by, v_used
    FROM fragments 
    WHERE id = p_fragment_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Invalid fragment ID';
    END IF;

    IF v_collected_by != v_player_id THEN
        RAISE EXCEPTION 'You do not own this fragment';
    END IF;

    IF v_used THEN
        RAISE EXCEPTION 'Cannot discard a fragment used in a winning word';
    END IF;

    -- Delete from player's collection
    DELETE FROM player_fragments 
    WHERE player_id = v_player_id AND fragment_id = p_fragment_id;

    -- Set fragment to available again
    UPDATE fragments 
    SET status = 'AVAILABLE', collected_by = NULL, collected_at = NULL
    WHERE id = p_fragment_id;

    -- Log the discard action
    INSERT INTO audit_logs (player_id, action, fragment_id)
    VALUES (v_player_id, 'DISCARD', p_fragment_id);

    RETURN json_build_object('success', true, 'message', 'Fragment discarded.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. UPDATE EXISTING RPCS TO INCLUDE AUDIT LOGS

-- claim_fragment RPC (Updated with audit log)
CREATE OR REPLACE FUNCTION claim_fragment(p_token TEXT)
RETURNS json AS $$
DECLARE
    v_player_id UUID;
    v_fragment_id UUID;
    v_status fragment_status;
    v_collected_by UUID;
    v_player_status player_status;
    v_letter TEXT;
    v_hint TEXT;
    v_word_id UUID;
BEGIN
    -- Get current authenticated user
    v_player_id := auth.uid();
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if player is ACTIVE
    SELECT status INTO v_player_status FROM players WHERE id = v_player_id;
    IF v_player_status = 'WON' THEN
        RAISE EXCEPTION 'Player has already won. Cannot claim more fragments.';
    END IF;

    -- Lock the fragment row
    SELECT id, status, letter, hint, collected_by, word_id 
    INTO v_fragment_id, v_status, v_letter, v_hint, v_collected_by, v_word_id
    FROM fragments 
    WHERE public_token = p_token
    FOR UPDATE;

    IF v_fragment_id IS NULL THEN
        RAISE EXCEPTION 'Invalid fragment token';
    END IF;

    IF v_status = 'LOCKED' THEN
        IF v_collected_by = v_player_id THEN
            -- Player is just re-scanning a fragment they already own
            RETURN json_build_object(
                'success', true,
                'already_owned', true,
                'fragment_id', v_fragment_id,
                'letter', v_letter,
                'hint', v_hint,
                'word_id', v_word_id
            );
        ELSE
            RAISE EXCEPTION 'This fragment has already been discovered.';
        END IF;
    END IF;

    -- Claim the fragment
    UPDATE fragments 
    SET status = 'LOCKED', collected_by = v_player_id, collected_at = NOW()
    WHERE id = v_fragment_id;

    -- Add to player's collection
    INSERT INTO player_fragments (player_id, fragment_id, collected_at)
    VALUES (v_player_id, v_fragment_id, NOW());

    -- Audit Log
    INSERT INTO audit_logs (player_id, action, fragment_id)
    VALUES (v_player_id, 'SCAN', v_fragment_id);

    RETURN json_build_object(
        'success', true,
        'already_owned', false,
        'fragment_id', v_fragment_id,
        'letter', v_letter,
        'hint', v_hint,
        'word_id', v_word_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- submit_word RPC (Updated with audit log)
CREATE OR REPLACE FUNCTION submit_word(p_word_id UUID, p_fragment_ids UUID[])
RETURNS json AS $$
DECLARE
    v_player_id UUID;
    v_actual_word TEXT;
    v_word_status word_status;
    v_attempt_word TEXT := '';
    v_fragment RECORD;
BEGIN
    -- Get current user
    v_player_id := auth.uid();
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock the word to prevent concurrent solves
    SELECT word, status INTO v_actual_word, v_word_status
    FROM words
    WHERE id = p_word_id
    FOR UPDATE;

    IF v_actual_word IS NULL THEN
        RAISE EXCEPTION 'Invalid word ID';
    END IF;

    IF v_word_status = 'SOLVED' THEN
        RAISE EXCEPTION 'This hidden word has already been discovered.';
    END IF;

    -- Construct the attempted word from the provided fragment IDs
    FOR i IN 1 .. array_length(p_fragment_ids, 1) LOOP
        SELECT letter, collected_by INTO v_fragment
        FROM fragments WHERE id = p_fragment_ids[i];
        
        IF v_fragment.collected_by != v_player_id THEN
            RAISE EXCEPTION 'Fragment not owned by player';
        END IF;

        v_attempt_word := v_attempt_word || v_fragment.letter;
    END LOOP;

    -- Check if attempt matches actual word
    IF v_attempt_word = v_actual_word THEN
        -- PLAYER WON!
        
        -- 1. Mark Word as SOLVED
        UPDATE words SET status = 'SOLVED', solved_by = v_player_id, solved_at = NOW() WHERE id = p_word_id;
        
        -- 2. Mark Player as WON
        UPDATE players SET status = 'WON', winning_word_id = p_word_id WHERE id = v_player_id;
        
        -- 3. Mark the used fragments
        FOR i IN 1 .. array_length(p_fragment_ids, 1) LOOP
            UPDATE player_fragments SET used_in_word = TRUE WHERE player_id = v_player_id AND fragment_id = p_fragment_ids[i];
            UPDATE fragments SET used_in_winning_word = TRUE WHERE id = p_fragment_ids[i];
        END LOOP;

        -- Audit Log
        INSERT INTO audit_logs (player_id, action, word_id)
        VALUES (v_player_id, 'SUBMIT_WORD', p_word_id);

        RETURN json_build_object('success', true, 'message', 'Word solved successfully!');
    ELSE
        RETURN json_build_object('success', false, 'message', 'Incorrect word. Keep trying!');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
