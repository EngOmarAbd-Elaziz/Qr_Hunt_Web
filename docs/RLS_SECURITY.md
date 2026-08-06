# RLS Security

Row Level Security is strict.
- `INSERT`, `UPDATE`, and `DELETE` are completely disabled on core tables.
- All modifications happen through `SECURITY DEFINER` RPC functions (e.g., `claim_fragment`).
- Players can only query `player_fragments` that belong to their own UUID.
- Players can read `words` (which are just lengths and IDs) to render empty slots.
