import { useEffect, useState } from 'react'
import type { Task, TaskStatus } from '@todo/db'
import { TaskCard, type TaskChanges } from '@/components/task-card'
import { STATUS_LABELS, TASK_STATUSES, groupByStatus } from '@/lib/status'

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
  onMove: (taskId: string, status: TaskStatus) => void
  onRemove: (taskId: string) => void
  onLeave: (taskId: string) => void
  onSave: (task: Task, changes: TaskChanges) => Promise<boolean>
}) {
  const columns = groupByStatus(tasks)
  const [over, setOver] = useState<TaskStatus | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // dragend does not fire on the card if it was dropped somewhere else or re-rendered, so
  // also reset when any drag ends.
  useEffect(() => {
    const stop = () => {
      setDragging(null)
      setOver(null)
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
            over === status ? 'border-primary bg-accent/60' : 'bg-muted/30'
          }`}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setOver(status)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setOver(null)
            const taskId = event.dataTransfer.getData('text/plain')
            if (taskId) onMove(taskId, status)
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
                onMove={(next) => onMove(task.id, next)}
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
