import { supabase } from './supabase';
import { clearCache } from './cache';

export async function clearGameStorage() {
  // Clear known local storage keys for QR Hunt
  localStorage.removeItem('qr_hunt_player_id');
  localStorage.removeItem('qr_pending_claim');
  localStorage.removeItem('qr_hunt_reset_version');
  
  // Clear in-memory cache
  clearCache();

  // Sign out of the anonymous session
  await supabase.auth.signOut();
}
