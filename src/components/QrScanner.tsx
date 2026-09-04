import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useScrollLock } from '../hooks/useScrollLock';

interface QrScannerProps {
  onScan: (token: string) => void;
  onClose: () => void;
}

type ScannerState = 'requesting' | 'scanning' | 'error';

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [state, setState] = useState<ScannerState>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  useScrollLock(true);

  useEffect(() => {
    startScanner();
    return () => { stopScanner(); };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const s = scannerRef.current.getState();
        if (s === 2 || s === 3) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setState('requesting');
    scannedRef.current = false;
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) throw new Error('No camera found on this device.');
      
      setState('scanning');

      const qr = new Html5Qrcode('qr-reader-container');
      scannerRef.current = qr;

      // Avoid Windows hardware errors by explicitly using the exact camera ID if there's only 1 camera (like most desktops)
      // Only use facingMode: 'environment' for mobile devices that typically have multiple cameras.
      const cameraConfig = devices.length > 1 ? { facingMode: 'environment' } : devices[0].id;

      await qr.start(
        cameraConfig,
        { fps: 15, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0, disableFlip: false },
        async (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          await stopScanner();
          let token = decodedText.trim();
          try {
            const url = new URL(decodedText);
            const parts = url.pathname.split('/').filter(Boolean);
            token = parts[parts.length - 1] || token;
          } catch { /* raw token */ }
          onScan(token);
        },
        () => { /* ignore per-frame errors */ }
      );

      try {
        const track = (qr as any)?.videoElement?.srcObject?.getVideoTracks?.()[0];
        if (track?.getCapabilities?.()?.torch) setTorchSupported(true);
      } catch { /* torch unsupported */ }

    } catch (err: any) {
      setState('error');
      if (err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission')) {
        setErrorMsg('Camera permission denied. Please allow camera access in your browser settings, then tap Retry.');
      } else if (err?.message?.includes('No camera')) {
        setErrorMsg('No camera found on this device. Use the manual input below.');
      } else {
        setErrorMsg(err?.message || 'Failed to open camera.');
      }
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const track = (scannerRef.current as any)?.videoElement?.srcObject?.getVideoTracks?.()[0];
      await track?.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch { /* ignore */ }
  };

  const handleManualSubmit = () => {
    const t = manualToken.trim();
    if (!t) return;
    stopScanner();
    onScan(t);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 8, 18, 0.97)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      paddingLeft: '20px',
      paddingRight: '20px',
    }}>

      {/* ── Header ── */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0 16px',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '1rem', letterSpacing: '3px', color: 'var(--text-primary)', fontWeight: 700 }}>
          📷 SCAN QR CODE
        </h2>
        <button
          onClick={() => { stopScanner(); onClose(); }}
          title="Close scanner"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: '38px', height: '38px',
            color: '#fff', fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Camera viewport ── */}
      <div style={{ width: '100%', maxWidth: '320px', position: 'relative', flexShrink: 0, margin: '0 auto' }}>

        {/* Loading spinner */}
        {state === 'requesting' && (
          <div style={{
            height: '320px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
            color: 'var(--text-secondary)',
          }}>
            <div style={{
              width: '44px', height: '44px',
              border: '3px solid var(--primary-color)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'qr-spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: '0.9rem' }}>Opening camera…</p>
          </div>
        )}

        {/* html5-qrcode video mount point */}
        <div
          id="qr-reader-container"
          style={{
            display: state === 'scanning' ? 'block' : 'none',
            borderRadius: '20px',
            overflow: 'hidden',
            width: '100%',
            background: '#000',
            aspectRatio: '1 / 1',
          }}
        />

        {/* Error card */}
        {state === 'error' && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📷</div>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '10px', fontSize: '1rem' }}>
              Camera Unavailable
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px', fontSize: '0.88rem' }}>
              {errorMsg}
            </p>
            <button className="glass-button accent" onClick={startScanner} style={{ width: '100%' }}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Torch ── */}
      {torchSupported && state === 'scanning' && (
        <div style={{ width: '100%', maxWidth: '320px', marginTop: '12px', flexShrink: 0, margin: '12px auto 0' }}>
          <button
            onClick={toggleTorch}
            style={{
              width: '100%',
              background: torchOn ? 'rgba(255,190,11,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${torchOn ? '#ffbe0b66' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '12px',
              padding: '11px',
              color: torchOn ? '#ffbe0b' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {torchOn ? '🔦 Flashlight ON' : '🔦 Flashlight OFF'}
          </button>
        </div>
      )}

      {/* ── Divider ── */}
      <div style={{
        width: '100%', maxWidth: '320px', margin: '20px auto 0',
        display: 'flex', alignItems: 'center', gap: '10px',
        color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '1.5px',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        OR ENTER TOKEN MANUALLY
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ── Manual token — ALWAYS VISIBLE ── */}
      <div style={{
        width: '100%', maxWidth: '320px', margin: '12px auto 0',
        display: 'flex', gap: '8px',
        flexShrink: 0,
        paddingBottom: '28px',
      }}>
        <input
          type="text"
          value={manualToken}
          onChange={e => setManualToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
          placeholder="Paste or type the QR token…"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '13px 14px',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            outline: 'none',
            minWidth: 0,
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
        />
        <button
          className="glass-button accent"
          onClick={handleManualSubmit}
          disabled={!manualToken.trim()}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Submit
        </button>
      </div>

      {/* Keyframes + html5-qrcode overrides */}
      <style>{`
        @keyframes qr-spin {
          to { transform: rotate(360deg); }
        }
        /* Fix mirror effect: remove horizontal flip */
        #qr-reader-container video {
          transform: none !important;
        }
        /* Hide html5-qrcode branding but keep layout intact */
        #qr-reader-container a { display: none !important; }
      `}</style>
    </div>
  );
}
