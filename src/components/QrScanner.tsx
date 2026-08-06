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
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false); // prevent double-fire

  // Lock body scroll while scanner is open
  useScrollLock(true);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // state 2 = SCANNING, state 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setState('requesting');
    scannedRef.current = false;

    try {
      // Check camera availability
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No camera found on this device.');
      }

      setState('scanning');

      const qr = new Html5Qrcode('qr-reader-container');
      scannerRef.current = qr;

      await qr.start(
        { facingMode: 'environment' }, // prefer rear camera
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        async (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;

          await stopScanner();

          // Extract token: the QR code may be a full URL or just a token
          let token = decodedText.trim();
          try {
            const url = new URL(decodedText);
            // Extract the last path segment as the token
            const parts = url.pathname.split('/').filter(Boolean);
            token = parts[parts.length - 1] || token;
          } catch {
            // not a URL — use the raw value
          }

          onScan(token);
        },
        () => {
          // qrCodeErrorCallback — normal for frames with no QR code, ignore
        }
      );

      // Check torch support after camera starts
      try {
        const track = (qr as any)?.videoElement
          ?.srcObject?.getVideoTracks?.()[0];
        const caps = track?.getCapabilities?.();
        if (caps?.torch) setTorchSupported(true);
      } catch {
        // torch not available
      }
    } catch (err: any) {
      setState('error');
      if (
        err?.message?.includes('NotAllowedError') ||
        err?.name === 'NotAllowedError' ||
        err?.message?.toLowerCase().includes('permission')
      ) {
        setErrorMsg('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err?.message?.includes('No camera')) {
        setErrorMsg('No camera found on this device.');
      } else {
        setErrorMsg(err?.message || 'Failed to open camera.');
      }
      setShowManual(true);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const track = (scannerRef.current as any)?.videoElement
        ?.srcObject?.getVideoTracks?.()[0];
      await track?.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {
      // ignore
    }
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
      backgroundColor: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '1.1rem', letterSpacing: '2px', color: 'var(--text-primary)' }}>
          SCAN QR CODE
        </h2>
        <button
          onClick={() => { stopScanner(); onClose(); }}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: '#fff',
            fontSize: '1.1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Camera viewport */}
      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {state === 'requesting' && (
          <div style={{
            height: '300px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: 'var(--text-secondary)',
          }}>
            <div style={{
              width: '48px', height: '48px',
              border: '3px solid var(--primary-color)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p>Opening camera…</p>
          </div>
        )}

        {/* QR reader container — always in DOM when not in error state so html5-qrcode can mount */}
        <div
          id="qr-reader-container"
          style={{
            display: state === 'scanning' ? 'block' : 'none',
            borderRadius: '16px',
            overflow: 'hidden',
            width: '100%',
          }}
        />

        {/* Scanning overlay frame */}
        {state === 'scanning' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Corner markers */}
            {['topLeft','topRight','bottomLeft','bottomRight'].map(corner => {
              const isTop = corner.startsWith('top');
              const isLeft = corner.endsWith('Left');
              return (
                <div key={corner} style={{
                  position: 'absolute',
                  width: '28px', height: '28px',
                  top: isTop ? '50%' : undefined,
                  bottom: !isTop ? '50%' : undefined,
                  left: isLeft ? '50%' : undefined,
                  right: !isLeft ? '50%' : undefined,
                  transform: `translate(${isLeft ? '-130px' : '102px'}, ${isTop ? '-130px' : '102px'})`,
                  borderTop: isTop ? '3px solid var(--primary-color)' : undefined,
                  borderBottom: !isTop ? '3px solid var(--primary-color)' : undefined,
                  borderLeft: isLeft ? '3px solid var(--primary-color)' : undefined,
                  borderRight: !isLeft ? '3px solid var(--primary-color)' : undefined,
                }} />
              );
            })}
            {/* Scan line */}
            <div style={{
              position: 'absolute',
              width: '260px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, var(--primary-color), transparent)',
              animation: 'scanLine 2s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="glass-panel" style={{
            padding: '32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📷</div>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '12px' }}>
              Camera Permission Required
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px', fontSize: '0.9rem' }}>
              {errorMsg}
            </p>
            <button
              className="glass-button accent"
              onClick={startScanner}
              style={{ width: '100%', marginBottom: '12px' }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        marginTop: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        {/* Torch toggle */}
        {torchSupported && state === 'scanning' && (
          <button
            onClick={toggleTorch}
            style={{
              background: torchOn ? 'rgba(255,190,11,0.2)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${torchOn ? '#ffbe0b' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: '24px',
              padding: '10px 24px',
              color: torchOn ? '#ffbe0b' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {torchOn ? '🔦 Flashlight ON' : '🔦 Flashlight OFF'}
          </button>
        )}

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          Can't scan?
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Manual entry toggle */}
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-color)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              textDecoration: 'underline',
              padding: '4px',
            }}
          >
            Enter Token Manually
          </button>
        ) : (
          <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Paste QR token here…"
              autoFocus
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            <button
              className="glass-button accent"
              onClick={handleManualSubmit}
              disabled={!manualToken.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              Submit
            </button>
          </div>
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes scanLine {
          0%, 100% { transform: translateY(-120px); opacity: 0.4; }
          50% { transform: translateY(120px); opacity: 1; }
        }
        /* Override html5-qrcode default UI styles */
        #qr-reader-container video {
          border-radius: 12px;
          width: 100% !important;
          object-fit: cover;
        }
        #qr-reader-container img { display: none !important; }
        #qr-reader-container > div:first-child { border: none !important; }
        #qr-reader__scan_region { border: none !important; }
        #qr-reader__dashboard { display: none !important; }
      `}</style>
    </div>
  );
}
