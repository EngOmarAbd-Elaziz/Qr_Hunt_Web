import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerReset = async () => {
    // Show 2-second countdown
    setCountdown(2);
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

    // After 2 seconds, clear state and redirect
    setTimeout(async () => {
      await clearGameStorage();
      navigate('/register');
    }, 2000);
  };

  useEffect(() => {
    // 1. On mount / route change: check version via RPC
    const checkReset = async () => {
      const { data, error } = await supabase.rpc('get_reset_version');
      if (error || !data) return;
      const localVersion = localStorage.getItem('qr_hunt_reset_version');
      if (localVersion && localVersion !== data) {
        triggerReset();
      }
    };
    checkReset();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 2. Real-time subscription: fires immediately when admin resets
    const channel = supabase
      .channel('game-state-reset')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.1' },
        async (payload) => {
          const newVersion = (payload.new as any)?.reset_version;
          if (!newVersion) return;
          // Update local storage then redirect all players
          const localVersion = localStorage.getItem('qr_hunt_reset_version');
          // If the player had a version (i.e. is a registered player), kick them
          if (localVersion) {
            triggerReset();
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (countdown === null) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 8, 18, 0.92)',
      backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '16px', color: '#fff',
      fontFamily: 'Outfit, sans-serif',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{ fontSize: '3rem' }}>🔄</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Game Reset</h2>
      <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '260px' }}>
        The admin has reset the game. Redirecting you in...
      </p>
      <div style={{
        fontSize: '3rem', fontWeight: 800,
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
