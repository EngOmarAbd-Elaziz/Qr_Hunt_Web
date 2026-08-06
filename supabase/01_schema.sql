-- supabase/01_schema.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums
CREATE TYPE player_status AS ENUM ('ACTIVE', 'WON');
CREATE TYPE word_status AS ENUM ('HIDDEN', 'SOLVED');
CREATE TYPE fragment_status AS ENUM ('AVAILABLE', 'LOCKED');

-- Create Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_code TEXT UNIQUE NOT NULL,
    display_name TEXT,
    status player_status DEFAULT 'ACTIVE' NOT NULL,
    winning_word_id UUID, -- Foreign key to words table, added later
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create Words Table
CREATE TABLE words (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word TEXT NOT NULL,
    length INTEGER NOT NULL,
    status word_status DEFAULT 'HIDDEN' NOT NULL,
    solved_by UUID REFERENCES players(id) ON DELETE SET NULL,
    solved_at TIMESTAMPTZ
);

-- Add foreign key back to players
ALTER TABLE players ADD CONSTRAINT fk_winning_word FOREIGN KEY (winning_word_id) REFERENCES words(id) ON DELETE SET NULL;

-- Create Fragments Table
CREATE TABLE fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_token TEXT UNIQUE NOT NULL,
    word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    letter TEXT NOT NULL,
    hint TEXT NOT NULL,
    status fragment_status DEFAULT 'AVAILABLE' NOT NULL,
    collected_by UUID REFERENCES players(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ,
    used_in_winning_word BOOLEAN DEFAULT FALSE NOT NULL
);

-- Create Player Fragments (Collection) Table
CREATE TABLE player_fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    fragment_id UUID NOT NULL REFERENCES fragments(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    used_in_word BOOLEAN DEFAULT FALSE NOT NULL,
    UNIQUE(player_id, fragment_id) -- A player can only have one instance of a specific physical fragment
);

-- Indexes for performance
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_fragments_public_token ON fragments(public_token);
CREATE INDEX idx_fragments_status ON fragments(status);
CREATE INDEX idx_player_fragments_player_id ON player_fragments(player_id);
