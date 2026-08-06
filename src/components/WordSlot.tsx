import { useDroppable } from '@dnd-kit/core';
import { LetterCard } from './LetterCard';

interface WordSlotProps {
  id: string;
  fragment: any; // { id, letter, word_id } or null
}

export function WordSlot({ id, fragment }: WordSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`word-slot ${isOver ? 'is-over' : ''}`}
    >
      {fragment ? (
        <LetterCard id={fragment.id} letter={fragment.letter} word_id={fragment.word_id} />
      ) : null}
    </div>
  );
}
