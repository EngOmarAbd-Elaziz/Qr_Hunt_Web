import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function AdminDashboard({ session }: { session: any }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [allFragments, setAllFragments] = useState<any[]>([]);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      checkAdminStatus();
    } else {
      setLoading(false);
    }
  }, [session]);

  const checkAdminStatus = async () => {
    // Check if the authenticated user explicitly exists in the admins table
    const { data, error } = await supabase.from('admins').select('id').eq('id', session.user.id).single();
    if (data && !error) {
      setIsAdmin(true);
      fetchStats();
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleResetGame = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_game');
      if (error) throw error;
      if (data.success) {
        localStorage.setItem('qr_hunt_reset_version', data.new_version);
        alert('Game has been successfully reset. All players have been cleared.');
        fetchStats();
      }
    } catch (err: any) {
      alert('Error resetting game: ' + err.message);
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  const fetchStats = async () => {
    const { count: totalPlayers } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: winners } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('status', 'WON');
    const { count: solvedWords } = await supabase.from('words').select('*', { count: 'exact', head: true }).eq('status', 'SOLVED');
    const { count: lockedFragments } = await supabase.from('fragments').select('*', { count: 'exact', head: true }).eq('status', 'LOCKED');

    setStats({
      totalPlayers,
      winners,
      solvedWords,
      lockedFragments
    });

    const { data: frags } = await supabase
      .from('fragments')
      .select('id, letter, public_token, status, used_in_winning_word, words(word)')
      .order('id');
    
    if (frags) setAllFragments(frags);
  };

  const handleReactivate = async (fragmentId: string) => {
    if (!confirm('Are you sure you want to reactivate this fragment so others can scan it?')) return;
    try {
      const { data, error } = await supabase.rpc('reactivate_fragment', {
        p_fragment_id: fragmentId
      });
      if (error) throw error;
      if (data.success) {
        alert('Reactivated successfully!');
        fetchStats();
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="glass-panel" style={{ padding: '32px', marginTop: '20vh' }}>
        <h2>Admin Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          <input 
            type="email" 
            className="glass-input" 
            placeholder="Admin Email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            className="glass-input" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="glass-button primary">Login</button>
        </form>
      </div>
    );
  }

  // Group fragments by word
  const groupedFrags: Record<string, any[]> = {};
  allFragments.forEach(f => {
    const w = (f.words as any)?.word || 'Unknown';
    if (!groupedFrags[w]) groupedFrags[w] = [];
    groupedFrags[w].push(f);
  });

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Admin Dashboard</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="glass-button accent reset-game-btn" 
            onClick={() => setShowResetModal(true)} 
          >
            !Reset Game!
          </button>
          <button className="glass-button" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Players</p>
          <h3>{stats?.totalPlayers || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Winners</p>
          <h3 style={{ color: 'var(--success-color)' }}>{stats?.winners || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Solved Words</p>
          <h3>{stats?.solvedWords || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Locked Fragments</p>
          <h3>{stats?.lockedFragments || 0}</h3>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Fragment Management</h3>
        <button className="glass-button accent" onClick={fetchStats}>Refresh Data</button>
      </div>

      {Object.entries(groupedFrags).map(([word, frags]) => {
        const isExpanded = expandedWord === word;

        return (
          <div key={word} className="glass-panel" style={{ padding: '0', marginBottom: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedWord(isExpanded ? null : word)}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>{word}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({frags.length} letters)</span>
              </div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {isExpanded ? '▲' : '▼'}
              </span>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {frags.map(f => (
                  <div key={f.id} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' 
                      }}>
                        {f.letter}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Token: {f.public_token}</div>
                        <div style={{ 
                          fontSize: '0.85rem', fontWeight: 'bold',
                          color: f.used_in_winning_word ? 'var(--success-color)' : (f.status === 'LOCKED' ? 'var(--accent-color)' : 'var(--text-primary)') 
                        }}>
                          {f.used_in_winning_word ? 'WON' : f.status}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      className="glass-button" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => handleReactivate(f.id)}
                      disabled={f.status === 'AVAILABLE' || f.used_in_winning_word}
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmationModal
        isOpen={showResetModal}
        title="⚠️ Reset Game Data?"
        body="Are you absolutely sure you want to reset the game? This will ERASE all players, collections, and audit logs. All words will be hidden and all physical QR codes will become available again. Active player sessions will be kicked out."
        confirmText="Yes, Reset Everything"
        onConfirm={handleResetGame}
        onCancel={() => setShowResetModal(false)}
        isProcessing={isResetting}
      />
    </div>
  );
}
