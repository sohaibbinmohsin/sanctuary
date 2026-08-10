import { useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import type { AnimalStatus } from '@/features/statuses/domain/statuses'
import { Button } from '@/shared/ui/Button'
import { SelectField } from '@/shared/ui/SelectField'

type SortableStatusListProps = {
  statuses: AnimalStatus[]
  onReorder: (orderedIds: string[]) => void
  onRename: (id: string, label: string) => void
  onLabelChange: (id: string, label: string) => void
  onInCareChange: (id: string, countsAsInCare: boolean) => void
  onHide: (status: AnimalStatus) => void
}

function SortableStatusRow({
  status,
  onRename,
  onLabelChange,
  onInCareChange,
  onHide,
}: {
  status: AnimalStatus
  onRename: (id: string, label: string) => void
  onLabelChange: (id: string, label: string) => void
  onInCareChange: (id: string, countsAsInCare: boolean) => void
  onHide: (status: AnimalStatus) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'list-item row sortable-row sortable-row--dragging'
          : 'list-item row sortable-row'
      }
    >
      <button
        type="button"
        className="sortable-handle"
        ref={setActivatorNodeRef}
        aria-label={`Drag to reorder ${status.label}`}
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={18} weight="bold" aria-hidden />
      </button>
      <input
        value={status.label ?? ''}
        onChange={(e) => onLabelChange(status.id, e.target.value)}
        onBlur={(e) => onRename(status.id, e.target.value)}
        aria-label="Status name"
        style={{ flex: 1, minWidth: '6rem' }}
      />
      <div style={{ minWidth: '8.5rem', flex: '0 0 auto' }}>
        <SelectField
          label="In care"
          hideLabel
          value={status.counts_as_in_care ? '1' : '0'}
          options={[
            { value: '1', label: 'In care' },
            { value: '0', label: 'Not in care' },
          ]}
          onChange={(value) => onInCareChange(status.id, value === '1')}
        />
      </div>
      <Button type="button" variant="danger-ghost" onClick={() => onHide(status)}>
        Hide
      </Button>
    </div>
  )
}

export function SortableStatusList({
  statuses,
  onReorder,
  onRename,
  onLabelChange,
  onInCareChange,
  onHide,
}: SortableStatusListProps) {
  const active = useMemo(
    () => statuses.filter((s) => !s.archived),
    [statuses],
  )
  const ids = useMemo(() => active.map((s) => s.id), [active])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event
    if (!over || dragActive.id === over.id) return
    const oldIndex = ids.indexOf(String(dragActive.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>
          {active.map((status) => (
            <SortableStatusRow
              key={status.id}
              status={status}
              onRename={onRename}
              onLabelChange={onLabelChange}
              onInCareChange={onInCareChange}
              onHide={onHide}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
