import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { LetterCard } from '../components/LetterCard';
import { WordSlot } from '../components/WordSlot';
import { TrashArea } from '../components/TrashArea';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { withCache, invalidateCache } from '../lib/cache';
import { playVictory, playError, playDiscard } from '../lib/sound';
import { vibrateVictory, vibrateError } from '../lib/haptics';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const BOARD_LENGTHS = [4, 5, 6];
const LEADERBOARD_POLL_MS = 5000;

export default function GameDashboard() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fragments, setFragments] = useState<any[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  // Maps "board-{length}-{index}" → fragment object
  const [placements, setPlacements] = useState<Record<string, any>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discardFragmentId, setDiscardFragmentId] = useState<string | null>(null);
  // Track which fragment is playing the discard animation
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const leaderboardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Leaderboard: fetch + poll every 5s ───────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    const solved = await withCache(
      'leaderboard_count',
      async () => {
        const { count } = await supabase
          .from('words')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'SOLVED');
        return count || 0;
      },
      LEADERBOARD_POLL_MS
    );
    setDiscoveredCount(solved);
  }, []);

  const startLeaderboardPolling = useCallback(() => {
    if (leaderboardIntervalRef.current) return; // already running
    leaderboardIntervalRef.current = setInterval(() => {
      invalidateCache('leaderboard_count');
      fetchLeaderboard();
    }, LEADERBOARD_POLL_MS);
  }, [fetchLeaderboard]);

  const stopLeaderboardPolling = useCallback(() => {
    if (leaderboardIntervalRef.current) {
      clearInterval(leaderboardIntervalRef.current);
      leaderboardIntervalRef.current = null;
    }
  }, []);

  // Pause/resume leaderboard polling based on connectivity
  useEffect(() => {
    if (isOnline && !loading) {
      startLeaderboardPolling();
    } else {
      stopLeaderboardPolling();
    }
    return stopLeaderboardPolling;
  }, [isOnline, loading, startLeaderboardPolling, stopLeaderboardPolling]);

  // ─── Supabase Realtime + Init ──────────────────────────────────────────────
  useEffect(() => {
    let playerIdRef: string | null = null;

    const init = async () => {
      playerIdRef = await checkPlayer();
      if (!playerIdRef) return;

      // Subscribe to words table — global announcements & board clears
      const wordSub = supabase.channel('public:words')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'words' }, payload => {
          const updatedWord = payload.new as any;
          if (updatedWord.status === 'SOLVED') {
            showToast('🏆 A HIDDEN WORD HAS BEEN DISCOVERED!');
            setDiscoveredCount(prev => prev + 1);

            // Clear the board of matching length → letters return to collection
            const len: number = updatedWord.length;
            setPlacements(prev => {
              const next = { ...prev };
              let changed = false;
              for (let i = 0; i < len; i++) {
                const key = `board-${len}-${i}`;
                if (next[key]) { delete next[key]; changed = true; }
              }
              return changed ? next : prev;
            });
          }
        })
        .subscribe();

      // Subscribe to this player's new fragments
      const fragSub = supabase.channel(`player-frags-${playerIdRef}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'player_fragments',
          filter: `player_id=eq.${playerIdRef}`
        }, async () => {
          const { data: fragData } = await supabase
            .from('player_fragments')
            .select('fragment_id, used_in_word, fragments(letter, hint, word_id)')
            .eq('player_id', playerIdRef as string);
          if (fragData) {
            setFragments(fragData.map((f: any) => ({
              id: f.fragment_id,
              letter: f.fragments?.letter || '?',
              hint: f.fragments?.hint || '',
              word_id: f.fragments?.word_id || '',
              used: f.used_in_word
            })));
          }
        })
        .subscribe();

      // Subscribe to player status changes → WON redirect
      const playerSub = supabase.channel(`player-status-${playerIdRef}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerIdRef}`
        }, payload => {
          const updated = payload.new as any;
          if (updated.status === 'WON') navigate('/winner');
        })
        .subscribe();

      return () => {
        wordSub.unsubscribe();
        fragSub.unsubscribe();
        playerSub.unsubscribe();
      };
    };

    const cleanup = init();
    return () => { cleanup.then(fn => fn && fn()); };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 8000);
  };

  const checkPlayer = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/register'); return null; }

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (playerError || !playerData) {
      localStorage.removeItem('qr_hunt_player_id');
      await supabase.auth.signOut();
      navigate('/register');
      return null;
    }

    if (playerData.status === 'WON') { navigate('/winner'); return null; }

    setPlayer(playerData);

    // Fetch collected fragments
    const { data: fragData } = await supabase
      .from('player_fragments')
      .select('fragment_id, used_in_word, fragments(letter, hint, word_id)')
      .eq('player_id', session.user.id);

    if (fragData) {
      setFragments(fragData.map((f: any) => ({
        id: f.fragment_id,
        letter: f.fragments?.letter || '?',
        hint: f.fragments?.hint || '',
        word_id: f.fragments?.word_id || '',
        used: f.used_in_word
      })));
    }

    await fetchLeaderboard();
    setLoading(false);
    return session.user.id;
  };

  // ─── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      // Dropped outside — revert from slot if it was placed
      setPlacements(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (next[key]?.id === active.id) delete next[key];
        });
        return next;
      });
      return;
    }

    const overId = over.id as string;

    if (overId === 'trash') {
      setDiscardFragmentId(active.id as string);
      setShowDiscardModal(true);
      return;
    }

    const fragment = fragments.find(f => f.id === active.id);
    if (fragment) {
      setPlacements(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (next[key]?.id === active.id) delete next[key];
        });
        next[overId] = fragment;
        return next;
      });
    }
  };

  // ─── Discard ───────────────────────────────────────────────────────────────
  const confirmDiscard = async () => {
    if (!discardFragmentId) return;
    setIsProcessing(true);

    // 1. Trigger animation + sound simultaneously
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setDiscardingId(discardFragmentId);
    playDiscard(); // sound fires at exactly the same time as animation

    // 2. Wait for animation to finish (300ms) before committing
    await new Promise(res => setTimeout(res, prefersReduced ? 0 : 310));

    try {
      const { data, error } = await supabase.rpc('discard_fragment', {
        p_fragment_id: discardFragmentId
      });

      if (error) throw error;

      if (data.success) {
        showToast('🗑️ Fragment discarded.');
        // Remove from placements if it was placed on a board slot
        setPlacements(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            if (next[key]?.id === discardFragmentId) delete next[key];
          });
          return next;
        });
        // Remove from fragments list
        setFragments(prev => prev.filter(f => f.id !== discardFragmentId));
      }
    } catch (err: any) {
      showToast('⚠️ ' + (err.message || 'Error discarding fragment'));
    } finally {
      setIsProcessing(false);
      setDiscardingId(null);
      setShowDiscardModal(false);
      setDiscardFragmentId(null);
    }
  };

  const cancelDiscard = () => {
    setShowDiscardModal(false);
    setDiscardFragmentId(null);
  };

  // ─── Submit Word ───────────────────────────────────────────────────────────
  const handleSubmitWord = async (boardLen: number) => {
    const placedFrags: string[] = [];
    for (let i = 0; i < boardLen; i++) {
      const frag = placements[`board-${boardLen}-${i}`];
      if (!frag) return;
      placedFrags.push(frag.id);
    }

    try {
      setIsProcessing(true);
      const { data, error } = await supabase.rpc('submit_word', {
        p_fragment_ids: placedFrags
      });

      if (error) throw error;

      if (data.success) {
        playVictory();
        vibrateVictory();
        navigate('/winner');
      } else {
        playError();
        vibrateError();
        showToast('❌ Not a valid word — keep trying!');
        setPlacements(prev => {
          const next = { ...prev };
          for (let i = 0; i < boardLen; i++) {
            delete next[`board-${boardLen}-${i}`];
          }
          return next;
        });
      }
    } catch (err: any) {
      showToast('⚠️ ' + (err.message || 'Error submitting word'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanClick = () => {
    if (isProcessing) return;
    const token = prompt('Enter QR Token (or use native camera to scan):');
    if (token) navigate(`/f/${token.trim()}`);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  const placedFragmentIds = Object.values(placements).map((f: any) => f.id);
  const unplacedFragments = fragments.filter(f => !f.used && !placedFragmentIds.includes(f.id));

  return (
    <div className="animate-slide-up">
      {toastMessage && (
        <div className="announcement-toast">{toastMessage}</div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner">
          📡 Connection Lost
          <p>Please check your internet connection.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* Player Info Header */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{player?.display_name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ID: {player?.player_code}</p>
        </div>
        <button
          className="glass-button accent"
          onClick={handleScanClick}
          disabled={isProcessing || !isOnline}
        >
          {isProcessing ? 'SCANNING...' : 'SCAN QR'}
        </button>
      </div>

      <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>

        {/* Collection */}
        <div style={{ marginBottom: '24px' }}>
          {/* Inventory Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <h3 className="fragment-counter">
              Fragments
              <span className="fragment-count-badge">{unplacedFragments.length}</span>
            </h3>
          </div>
          <div className="glass-panel" style={{ padding: '16px', minHeight: '100px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {unplacedFragments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', width: '100%', textAlign: 'center', marginTop: '20px' }}>
                Collection empty. Scan a QR code!
              </p>
            ) : (
              unplacedFragments.map(f => (
                <LetterCard
                  key={f.id}
                  id={f.id}
                  letter={f.letter}
                  word_id={f.word_id}
                  isDiscarding={discardingId === f.id}
                />
              ))
            )}
          </div>
          <TrashArea />
        </div>

        {/* Three Permanent Boards */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Hidden Words</h3>

          {BOARD_LENGTHS.map(len => {
            const isFull = Array.from({ length: len }).every((_, i) => placements[`board-${len}-${i}`]);

            return (
              <div key={len} className="glass-panel" style={{ padding: '16px', marginBottom: '12px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px', marginBottom: '12px' }}>
                  {len}-LETTER WORD
                </p>
                <div className="word-slot-container">
                  {Array.from({ length: len }).map((_, i) => {
                    const slotId = `board-${len}-${i}`;
                    return (
                      <WordSlot key={slotId} id={slotId} fragment={placements[slotId] || null} />
                    );
                  })}
                </div>
                {isFull && (
                  <button
                    className="glass-button primary animate-slide-up"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={() => handleSubmitWord(len)}
                    disabled={isProcessing || !isOnline}
                  >
                    {isProcessing ? 'Submitting...' : 'Check Word ✓'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </DndContext>

      {/* Discovered Words — locked cards, no length info */}
      {discoveredCount > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '2px' }}>
            DISCOVERED WORDS
          </h3>
          {Array.from({ length: discoveredCount }).map((_, i) => (
            <div key={i} className="glass-panel" style={{
              padding: '16px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              borderColor: 'rgba(255,215,0,0.2)',
              background: 'rgba(255,215,0,0.03)',
              opacity: 0.75
            }}>
              <span style={{ fontSize: '1.3rem' }}>🔒</span>
              <span style={{ fontWeight: '600', letterSpacing: '2px', fontSize: '0.9rem' }}>WORD DISCOVERED</span>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={showDiscardModal}
        title="Discard Letter?"
        body="Are you sure you want to discard this letter? This QR Code will become available again for everyone."
        onCancel={cancelDiscard}
        onConfirm={confirmDiscard}
        confirmText="Discard"
        isProcessing={isProcessing}
      />
    </div>
  );
}
