import { useEffect, useState } from 'react'
import type { Task, TaskStatus } from '@todo/db'
import { TaskCard, type TaskChanges } from '@/components/task-card'
import { dropPosition, type Placement } from '@/lib/order'
import { STATUS_LABELS, TASK_STATUSES, groupByStatus } from '@/lib/status'

type DropAt = { status: TaskStatus; targetId: string | null; placement: Placement }

export function KanbanBoard({
  tasks,
  userId,
  onMove,
  onRemove,
  onLeave,
  onSave,
}: {
  tasks: Task[]
  userId: string
  onMove: (taskId: string, status: TaskStatus, position: number) => void
  onRemove: (taskId: string) => void
  onLeave: (taskId: string) => void
  onSave: (task: Task, changes: TaskChanges) => Promise<boolean>
}) {
  const columns = groupByStatus(tasks)
  const [dropAt, setDropAt] = useState<DropAt | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // dragend does not fire on the card if it was dropped somewhere else or re-rendered, so
  // also reset when any drag ends.
  useEffect(() => {
    const stop = () => {
      setDragging(null)
      setDropAt(null)
    }
    // Mouse events are not sent during a drag, so one arriving means no drag is going on.
    const stopIfIdle = () => setDragging((current) => (current === null ? current : null))
    window.addEventListener('dragend', stop)
    window.addEventListener('drop', stop)
    window.addEventListener('pointermove', stopIfIdle)
    window.addEventListener('pointerdown', stopIfIdle)
    return () => {
      window.removeEventListener('dragend', stop)
      window.removeEventListener('drop', stop)
      window.removeEventListener('pointermove', stopIfIdle)
      window.removeEventListener('pointerdown', stopIfIdle)
    }
  }, [])

  return (
    <div className="grid items-start gap-4 md:grid-cols-3">
      {TASK_STATUSES.map((status) => (
        // Dragging is a pointer shortcut; every card also has a status select for keyboard and touch.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <section
          key={status}
          aria-labelledby={`column-${status}`}
          className={`grid min-h-40 content-start gap-2 rounded-2xl border p-3 transition-colors ${
            dropAt?.status === status ? 'border-primary bg-accent/60' : 'bg-muted/30'
          }`}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropAt(dropTarget(event, status))
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const at = dropTarget(event, status)
            setDropAt(null)
            const taskId = event.dataTransfer.getData('text/plain')
            if (taskId) {
              onMove(
                taskId,
                status,
                dropPosition(columns[status], taskId, at.targetId, at.placement),
              )
            }
          }}
        >
          <div className="mb-1 flex items-center gap-2 px-1">
            <h3 id={`column-${status}`} className="text-[13px] font-semibold">
              {STATUS_LABELS[status]}
            </h3>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-secondary-foreground">
              {columns[status].length}
            </span>
          </div>
          <ul className="grid gap-2">
            {columns[status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isOwner={task.userId === userId}
                onMove={(next) =>
                  onMove(task.id, next, dropPosition(columns[next], task.id, null, 'after'))
                }
                indicator={
                  dropAt?.targetId === task.id && dragging !== task.id
                    ? dropAt.placement
                    : undefined
                }
                onRemove={() => onRemove(task.id)}
                onLeave={() => onLeave(task.id)}
                onSave={(changes) => onSave(task, changes)}
                dragging={dragging === task.id}
                onDragStart={() => setDragging(task.id)}
                onDragEnd={() => setDragging(null)}
              />
            ))}
          </ul>
          {columns[status].every((task) => task.id === dragging) && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              ここにカードをドラッグ
            </p>
          )}
        </section>
      ))}
    </div>
  )
}

/** Where a dragged card would land: before or after the card under the pointer, else at the end. */
function dropTarget(event: React.DragEvent, status: TaskStatus): DropAt {
  const card = (event.target as HTMLElement).closest<HTMLElement>('li[data-task-id]')
  const rect = card?.getBoundingClientRect()
  if (!card || !rect) return { status, targetId: null, placement: 'after' }
  return {
    status,
    targetId: card.dataset.taskId ?? null,
    placement: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
  }
}
