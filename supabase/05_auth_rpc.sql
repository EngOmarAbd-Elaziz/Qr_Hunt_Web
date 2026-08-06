-- supabase/05_auth_rpc.sql

-- register_player RPC
-- Called by an anonymous user to create their player profile
CREATE OR REPLACE FUNCTION register_player(p_name TEXT, p_code TEXT)
RETURNS json AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Ensure they don't already have a profile
    IF EXISTS (SELECT 1 FROM players WHERE id = v_uid) THEN
        RETURN json_build_object('success', false, 'message', 'Already registered');
    END IF;

    INSERT INTO players (id, player_code, display_name, status)
    VALUES (v_uid, p_code, p_name, 'ACTIVE');

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
