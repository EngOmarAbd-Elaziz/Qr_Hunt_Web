-- supabase/00_reset.sql
-- WARNING: This will delete all game data, tables, and functions.

-- 1. Drop Functions
DROP FUNCTION IF EXISTS claim_fragment(TEXT);
DROP FUNCTION IF EXISTS submit_word(UUID, UUID[]);
DROP FUNCTION IF EXISTS submit_word(UUID[]); -- The new version
DROP FUNCTION IF EXISTS reactivate_fragment(UUID);
DROP FUNCTION IF EXISTS register_player(TEXT, TEXT);
DROP FUNCTION IF EXISTS is_admin();

-- 2. Drop Tables (CASCADE removes foreign key dependencies automatically)
DROP TABLE IF EXISTS player_fragments CASCADE;
DROP TABLE IF EXISTS fragments CASCADE;
DROP TABLE IF EXISTS words CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- 3. Drop Enums
DROP TYPE IF EXISTS player_status CASCADE;
DROP TYPE IF EXISTS word_status CASCADE;
DROP TYPE IF EXISTS fragment_status CASCADE;
