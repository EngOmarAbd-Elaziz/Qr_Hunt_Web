-- supabase/11_reactivate_fix.sql
-- Fixes real-time notification when admin reactivates a fragment held by a player.

-- 1. Enable REPLICA IDENTITY FULL on player_fragments
--    This is required so that Supabase Realtime can evaluate row-level filters
--    (player_id=eq.X) on DELETE events. Without it, deleted rows have no column
--    data, so the filter silently drops the event and the player never gets notified.
ALTER TABLE player_fragments REPLICA IDENTITY FULL;

-- 2. Update reactivate_fragment to also return the affected player_id
--    so the frontend can broadcast a targeted notification to that player.
CREATE OR REPLACE FUNCTION reactivate_fragment(p_fragment_id UUID)
RETURNS json AS $$
DECLARE
    v_status fragment_status;
    v_used BOOLEAN;
    v_collected_by UUID;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT status, used_in_winning_word, collected_by
    INTO v_status, v_used, v_collected_by
    FROM fragments WHERE id = p_fragment_id;

    IF v_used THEN
        RAISE EXCEPTION 'Cannot reactivate a fragment used in a winning word.';
    END IF;

    IF v_status = 'AVAILABLE' THEN
        RAISE EXCEPTION 'Fragment is already available.';
    END IF;

    -- Delete from all player collections
    DELETE FROM player_fragments WHERE fragment_id = p_fragment_id;

    -- Set fragment to available
    UPDATE fragments 
    SET status = 'AVAILABLE', collected_by = NULL, collected_at = NULL
    WHERE id = p_fragment_id;

    -- Return affected_player_id so the frontend can send a targeted broadcast
    RETURN json_build_object(
        'success', true,
        'message', 'Fragment reactivated.',
        'affected_player_id', v_collected_by
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
