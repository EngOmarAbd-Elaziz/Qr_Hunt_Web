import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Registration() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if player ID already exists in local storage
    const playerId = localStorage.getItem('qr_hunt_player_id');
    if (playerId) {
      navigate('/');
    }
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const playerCode = 'HUNT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      
      // Since players are unauthenticated in Supabase terms, we use the anon key.
      // But wait! RLS prevents inserts for anon users. We need an RPC to register a player
      // OR we just use Supabase anonymous sign-in, then insert into players.
      
      // Using Supabase anonymous sign-in for RLS
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      // Now we have a user ID. Call an RPC or directly insert if policy allows.
      // Actually, my RLS policy disabled INSERT for all. I need to create a `register_player` RPC.
      const { error } = await supabase.rpc('register_player', {
        p_name: name.trim(),
        p_code: playerCode
      });

      if (error) throw error;

      const { data: versionData } = await supabase.rpc('get_reset_version');
      if (versionData) {
        localStorage.setItem('qr_hunt_reset_version', versionData);
      }

      localStorage.setItem('qr_hunt_player_id', authData.user?.id || '');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      alert('Error registering: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '32px', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '8px' }}>Welcome to QR Hunt</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Enter your name to start the game.</p>
      
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input 
          type="text" 
          className="glass-input" 
          placeholder="Your Name" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          required
        />
        <button type="submit" className="glass-button primary" disabled={loading}>
          {loading ? 'Registering...' : 'Start Playing'}
        </button>
      </form>
    </div>
  );
}
