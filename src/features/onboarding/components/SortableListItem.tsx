import { type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'

export type SortableListItemProps = {
  id: string
  children: ReactNode
}

export function SortableListItem({ id, children }: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 99 : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`onboarding-list-item ${isDragging ? 'onboarding-list-item--dragging' : ''}`}
    >
      <button
        type="button"
        className="onboarding-drag-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <DotsSixVertical size={20} weight="bold" aria-hidden />
      </button>
      {children}
    </div>
  )
}
