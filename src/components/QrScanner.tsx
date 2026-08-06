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

      await qr.start(
        { facingMode: 'environment' },
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
      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', flexShrink: 0 }}>

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
          }}
        />

        {/* Scan-frame overlay */}
        {state === 'scanning' && (
          <div style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {[
              { top: '50%', left: '50%', tx: '-120px', ty: '-120px', bt: true, bl: true },
              { top: '50%', right: '50%', tx: '92px',  ty: '-120px', bt: true, br: true },
              { bottom: '50%', left: '50%', tx: '-120px', ty: '92px', bb: true, bl: true },
              { bottom: '50%', right: '50%', tx: '92px',  ty: '92px', bb: true, br: true },
            ].map((c, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: '24px', height: '24px',
                top: c.top, bottom: c.bottom,
                left: c.left, right: c.right,
                transform: `translate(${c.tx}, ${c.ty})`,
                borderTop:    c.bt ? '3px solid var(--primary-color)' : undefined,
                borderBottom: c.bb ? '3px solid var(--primary-color)' : undefined,
                borderLeft:   c.bl ? '3px solid var(--primary-color)' : undefined,
                borderRight:  c.br ? '3px solid var(--primary-color)' : undefined,
                borderRadius: '2px',
              }} />
            ))}
            <div style={{
              position: 'absolute',
              width: '240px', height: '2px',
              background: 'linear-gradient(90deg, transparent, var(--primary-color), transparent)',
              boxShadow: '0 0 8px var(--primary-color)',
              animation: 'qr-scanline 2s ease-in-out infinite',
            }} />
          </div>
        )}

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
        <div style={{ width: '100%', maxWidth: '480px', marginTop: '12px', flexShrink: 0 }}>
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
        width: '100%', maxWidth: '480px',
        display: 'flex', alignItems: 'center', gap: '10px',
        margin: '20px 0 0',
        color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '1.5px',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        OR ENTER TOKEN MANUALLY
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ── Manual token — ALWAYS VISIBLE ── */}
      <div style={{
        width: '100%', maxWidth: '480px',
        display: 'flex', gap: '8px',
        marginTop: '12px',
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
        @keyframes qr-scanline {
          0%, 100% { transform: translateY(-108px); opacity: 0.35; }
          50%       { transform: translateY(108px);  opacity: 1;    }
        }
        #qr-reader-container video          { width: 100% !important; display: block; }
        #qr-reader-container img            { display: none !important; }
        #qr-reader-container > div         { border: none !important; box-shadow: none !important; }
        #qr-reader__scan_region            { border: none !important; }
        #qr-reader__dashboard              { display: none !important; }
        #qr-reader__header_message         { display: none !important; }
      `}</style>
    </div>
  );
}
