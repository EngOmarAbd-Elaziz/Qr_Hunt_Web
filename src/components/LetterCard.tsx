import { useDraggable } from '@dnd-kit/core';
import { getColorForWord } from '../lib/colors';

interface LetterCardProps {
  id: string;
  letter: string;
  word_id?: string;
  disabled?: boolean;
}

export function LetterCard({ id, letter, word_id, disabled }: LetterCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled
  });

  const wordColor = word_id ? getColorForWord(word_id) : 'rgba(255,255,255,0.2)';

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    borderColor: wordColor,
    boxShadow: isDragging ? `0 8px 24px ${wordColor}80` : `0 2px 10px ${wordColor}30`,
    borderTop: `4px solid ${wordColor}`
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`letter-card ${isDragging ? 'dragging' : ''}`}
      aria-disabled={disabled}
    >
      {letter}
    </div>
  );
}
