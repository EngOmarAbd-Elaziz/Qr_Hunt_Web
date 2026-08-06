# Admin Guide

1. Double-click the "QR HUNT" logo in the header of the app to access the Admin Login page (or navigate to `/admin`).
2. Log in using the Supabase Authentication email/password you set up.
3. Once logged in, you will see a live dashboard of active players, total winners, and solved words.
4. **When a player wins**, they will show you a Winner Card with their Player ID and the word they solved.
5. Take their physical cards. The backend knows which ones they used for the winning word. You can use the Reactivate button (or the `reactivate_fragment` RPC) to put the unused physical cards back into the game pool.
