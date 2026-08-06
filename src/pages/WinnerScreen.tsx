import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function WinnerScreen() {
  const navigate = useNavigate();
  const [player, setPlayer] = useState<any>(null);
  const [winningWord, setWinningWord] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWinner();
  }, []);

  const checkWinner = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/register');
      return;
    }

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!playerData) {
      // No player record — clear and redirect to register
      localStorage.removeItem('qr_hunt_player_id');
      await supabase.auth.signOut();
      navigate('/register');
      return;
    }

    if (playerData.status !== 'WON') {
      navigate('/');
      return;
    }

    setPlayer(playerData);

    // Fetch the winning word separately using the ID stored on the player
    if (playerData.winning_word_id) {
      const { data: wordData } = await supabase
        .from('words')
        .select('word')
        .eq('id', playerData.winning_word_id)
        .single();
      if (wordData) setWinningWord(wordData.word);
    }

    setLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 1000
    }}>
      <div className="glass-panel animate-slide-up" style={{
        padding: '40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.05))',
        borderColor: 'rgba(255,215,0,0.3)',
        boxShadow: '0 8px 32px rgba(255,215,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
        <h1 style={{ color: '#ffd700', fontSize: '2.5rem', marginBottom: '8px' }}>YOU WON!</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Congratulations, you discovered a hidden word.</p>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '32px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>PLAYER ID</p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>{player?.player_code}</h2>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>WORD</p>
          <h2 style={{ fontSize: '2rem', letterSpacing: '8px', color: '#ffd700' }}>
            {winningWord || '????'}
          </h2>
        </div>

        <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
          Show this screen and your physical QR cards to the Game Master to claim your prize.
        </p>
      </div>
    </div>
  );
}

