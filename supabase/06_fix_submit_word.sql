-- supabase/06_fix_submit_word.sql
-- Replace submit_word to match ANY word by letter sequence, not by word_id
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION submit_word(p_fragment_ids UUID[])
RETURNS json AS $$
DECLARE
    v_player_id UUID;
    v_attempt_word TEXT := '';
    v_frag RECORD;
    v_matched_word RECORD;
BEGIN
    v_player_id := auth.uid();
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Build the attempted word from the fragment IDs in order
    FOR i IN 1 .. array_length(p_fragment_ids, 1) LOOP
        SELECT letter, collected_by INTO v_frag
        FROM fragments WHERE id = p_fragment_ids[i];

        IF v_frag IS NULL THEN
            RAISE EXCEPTION 'Invalid fragment';
        END IF;

        IF v_frag.collected_by IS DISTINCT FROM v_player_id THEN
            RAISE EXCEPTION 'Fragment not owned by player';
        END IF;

        v_attempt_word := v_attempt_word || v_frag.letter;
    END LOOP;

    -- Try to find a HIDDEN word matching the attempt
    SELECT id, word, status INTO v_matched_word
    FROM words
    WHERE word = v_attempt_word
      AND status = 'HIDDEN'
    LIMIT 1
    FOR UPDATE;

    IF v_matched_word IS NULL THEN
        -- No matching hidden word found — return failure
        RETURN json_build_object('success', false, 'message', 'Incorrect word. Keep trying!');
    END IF;

    -- PLAYER WON!

    -- 1. Mark Word as SOLVED
    UPDATE words
    SET status = 'SOLVED', solved_by = v_player_id, solved_at = NOW()
    WHERE id = v_matched_word.id;

    -- 2. Mark Player as WON
    UPDATE players
    SET status = 'WON', winning_word_id = v_matched_word.id
    WHERE id = v_player_id;

    -- 3. Mark used fragments
    FOR i IN 1 .. array_length(p_fragment_ids, 1) LOOP
        UPDATE player_fragments SET used_in_word = TRUE
        WHERE player_id = v_player_id AND fragment_id = p_fragment_ids[i];

        UPDATE fragments SET used_in_winning_word = TRUE
        WHERE id = p_fragment_ids[i];
    END LOOP;

    RETURN json_build_object('success', true, 'message', 'Word solved successfully!', 'word', v_matched_word.word);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
