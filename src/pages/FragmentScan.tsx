import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function FragmentScan() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Claiming fragment...');
  const [fragmentData, setFragmentData] = useState<any>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (token) claimFragment();
  }, [token]);

  const claimFragment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        localStorage.setItem('qr_pending_claim', token || '');
        navigate('/register');
        return;
      }

      // Check if player already owns this fragment (re-scan protection)
      // We now handle this securely inside the claim_fragment RPC itself!
      const { data, error } = await supabase.rpc('claim_fragment', {
        p_token: token
      });

      if (error) {
        if (error.message.includes('already been discovered')) {
          throw new Error('This fragment has already been discovered.');
        } else if (error.message.includes('Invalid fragment')) {
          throw new Error('This QR code is not part of the game.');
        } else if (error.message.includes('already won')) {
          throw new Error('You have already completed the hunt.');
        }
        throw error;
      }

      setStatus('success');
      setFragmentData({
        letter: data.letter,
        hint: data.hint,
        alreadyOwned: data.already_owned
      });

      // Auto redirect after 3 seconds
      setTimeout(() => navigate('/'), 3500);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'An error occurred while claiming.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-slide-up" style={{ textAlign: 'center', marginTop: '15vh' }}>
      {status === 'loading' && (
        <div className="glass-panel" style={{ padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔍</div>
          <h2>Scanning...</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Processing fragment</p>
        </div>
      )}

      {status === 'success' && (
        <div className="glass-panel" style={{
          padding: '40px',
          borderColor: 'var(--success-color)',
          boxShadow: '0 8px 32px var(--success-glow)'
        }}>
          <h2 style={{ color: 'var(--success-color)', marginBottom: '24px', fontSize: '1.4rem', letterSpacing: '2px' }}>
            {fragmentData?.alreadyOwned ? 'ALREADY COLLECTED' : 'FRAGMENT FOUND!'}
          </h2>
          <div className="letter-card" style={{
            margin: '0 auto 24px',
            width: '90px',
            height: '90px',
            fontSize: '3rem',
            boxShadow: '0 0 30px var(--success-glow)',
            borderColor: 'var(--success-color)'
          }}>
            {fragmentData?.letter}
          </div>
          {fragmentData?.hint && (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '20px' }}>
              Hint: "{fragmentData.hint}"
            </p>
          )}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Returning to game...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="glass-panel" style={{
          padding: '40px',
          borderColor: 'var(--accent-color)',
          boxShadow: '0 8px 32px var(--accent-glow)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>❌</div>
          <h2 style={{ color: 'var(--accent-color)', marginBottom: '16px' }}>SCAN FAILED</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{message}</p>
          <button
            className="glass-button"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
