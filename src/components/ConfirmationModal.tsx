import { createPortal } from 'react-dom';
import { useScrollLock } from '../hooks/useScrollLock';

// ConfirmationModal
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  body,
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false
}: ConfirmationModalProps) {
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div className="glass-panel animate-slide-up" style={{
        padding: '32px',
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.5' }}>
          {body}
        </p>
        
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button 
            className="glass-button" 
            onClick={onCancel} 
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            {cancelText}
          </button>
          <button 
            className="glass-button accent" 
            onClick={onConfirm} 
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            {isProcessing ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
