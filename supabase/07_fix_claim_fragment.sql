-- supabase/07_fix_claim_fragment.sql
-- Updates the claim_fragment RPC to natively handle rescans

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
    SELECT id, status, letter, hint, collected_by 
    INTO v_fragment_id, v_status, v_letter, v_hint, v_collected_by
    FROM fragments 
    WHERE public_token = p_token
    FOR UPDATE; -- Row-level lock

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
                'hint', v_hint
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

    RETURN json_build_object(
        'success', true,
        'already_owned', false,
        'fragment_id', v_fragment_id,
        'letter', v_letter,
        'hint', v_hint
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
