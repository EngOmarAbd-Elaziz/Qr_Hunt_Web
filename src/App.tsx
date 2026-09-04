import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import GameDashboard from './pages/GameDashboard';
import { clearGameStorage } from './lib/reset';
import FragmentScan from './pages/FragmentScan';
import AdminDashboard from './pages/AdminDashboard';
import WinnerScreen from './pages/WinnerScreen';
import Registration from './pages/Registration';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import fcaiLogo from './assets/fcai-gdc-logo.png';

function GlobalResetHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkReset = async () => {
      const { data, error } = await supabase.rpc('get_reset_version');
      if (error || !data) return;

      const currentGlobalVersion = data;
      const localVersion = localStorage.getItem('qr_hunt_reset_version');

      if (localVersion && localVersion !== currentGlobalVersion) {
        await clearGameStorage();
        navigate('/register');
      }
    };

    checkReset();
  }, [location.pathname, navigate]);

  return null;
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
