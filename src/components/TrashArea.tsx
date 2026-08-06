import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';

export function TrashArea() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'trash',
  });

  return (
    <div
      ref={setNodeRef}
      className={`trash-area ${isOver ? 'is-over' : ''}`}
      style={{
        marginTop: '24px',
        padding: '24px',
        border: `2px dashed ${isOver ? 'var(--accent-color)' : 'var(--card-border)'}`,
        borderRadius: '16px',
        background: isOver ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOver ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.2s ease',
      }}
    >
      <Trash2 size={32} style={{ marginBottom: '8px', color: isOver ? 'var(--accent-color)' : 'inherit' }} />
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '1px' }}>
        {isOver ? 'DROP TO DISCARD' : 'DRAG HERE TO DISCARD'}
      </span>
    </div>
  );
}
