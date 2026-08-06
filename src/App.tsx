import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameDashboard from './pages/GameDashboard';
import FragmentScan from './pages/FragmentScan';
import AdminDashboard from './pages/AdminDashboard';
import WinnerScreen from './pages/WinnerScreen';
import Registration from './pages/Registration';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

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
      <div className="app-container">
        {/* Global App Header could go here, or handled per-page */}
        <header className="app-header">
          <div className="logo-text" onDoubleClick={() => window.location.href = `${import.meta.env.BASE_URL}admin`}>QR HUNT</div>
        </header>

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
