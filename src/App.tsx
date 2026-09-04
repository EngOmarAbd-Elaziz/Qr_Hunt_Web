import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import GameDashboard from './pages/GameDashboard';
import { clearGameStorage } from './lib/reset';
import FragmentScan from './pages/FragmentScan';
import AdminDashboard from './pages/AdminDashboard';
import WinnerScreen from './pages/WinnerScreen';
import Registration from './pages/Registration';
import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';
import fcaiLogo from './assets/fcai-gdc-logo.png';

function GlobalResetHandler() {
  const location = useLocation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false); // prevent double-trigger

  const triggerReset = () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    // Show 3-second countdown
    setCountdown(3);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // After 3 seconds, clear state and hard redirect
    setTimeout(async () => {
      await clearGameStorage();
      // Hard redirect instead of navigate() prevents any React state/unmount crashes
      window.location.href = `${import.meta.env.BASE_URL}register`;
    }, 3000);
  };

  useEffect(() => {
    // 1. On mount / route change: RPC fallback for returning/offline browsers
    const checkReset = async () => {
      const { data, error } = await supabase.rpc('get_reset_version');
      if (error || !data) return;
      const localVersion = localStorage.getItem('qr_hunt_reset_version');
      const isPlayer = !!localStorage.getItem('qr_hunt_player_id');
      if (localVersion && localVersion !== data && isPlayer) {
        triggerReset();
      }
    };
    checkReset();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 2. Broadcast channel — works in real-time across ALL connected browsers
    const channel = supabase
      .channel('game-reset-broadcast')
      .on('broadcast', { event: 'game_reset' }, () => {
        const isPlayer = !!localStorage.getItem('qr_hunt_player_id');
        // Only kick out actual registered players, not the admin
        if (isPlayer) {
          triggerReset();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (countdown === null) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 8, 18, 0.95)',
      backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '16px', color: '#fff',
      fontFamily: 'Outfit, sans-serif',
    }}>
      <div style={{ fontSize: '3rem' }}>🔄</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Game Reset</h2>
      <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
        The admin has reset the game.<br />Redirecting you in...
      </p>
      <div style={{
        fontSize: '4rem', fontWeight: 800,
        background: 'linear-gradient(135deg, #6366f1, #f43f5e)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>{countdown}</div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <GlobalResetHandler />
      {/* Global App Header spans full width */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-container">
            <img src={fcaiLogo} alt="FCAI GDC" className="community-logo" />
            <div className="logo-text" onDoubleClick={() => window.location.href = `${import.meta.env.BASE_URL}admin`}>FCAI GDC QR HUNT</div>
          </div>
        </div>
      </header>
      
      <div className="app-container">
        <main className="page-content">
          <Routes>
            <Route path="/" element={<GameDashboard />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/f/:token" element={<FragmentScan />} />
            <Route path="/winner" element={<WinnerScreen />} />
            <Route path="/admin" element={<AdminDashboard session={session} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
