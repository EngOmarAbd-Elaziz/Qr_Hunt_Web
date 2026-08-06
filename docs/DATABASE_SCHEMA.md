# Database Schema

The game relies on 5 primary tables:

1. `players`: Stores user profiles. Anonymous, but tied to an internal UUID.
2. `words`: The hidden word pool. Contains the words, their lengths, and if they've been solved.
3. `fragments`: The physical QR cards. Each has a 10-character `public_token` that goes in the QR code.
4. `player_fragments`: The collection link. When a player scans a fragment, an entry is added here.
5. `admins`: A simple table storing the UUID of the authorized Game Master.

All heavy lifting is done via Postgres Functions (RPCs) like `claim_fragment` to prevent race conditions when 300 players scan codes simultaneously.
