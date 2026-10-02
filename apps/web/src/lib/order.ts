import type { Task } from '@todo/db'

export type Placement = 'before' | 'after'

/** A position between two neighbours: halfway, or one step past the one that exists. */
export function positionBetween(previous: number | undefined, next: number | undefined) {
  if (previous === undefined && next === undefined) return 0
  if (previous === undefined) return (next as number) - 1
  if (next === undefined) return previous + 1
  return (previous + next) / 2
}

/**
 * Position for a card that is dropped into a column.
 * `column` is the column in order. With a `targetId` the card goes before or after that card;
 * without one (the empty part of the column, or the status select) it goes to the end.
 */
export function dropPosition(
  column: Task[],
  movingId: string,
  targetId: string | null,
  placement: Placement,
) {
  const others = column.filter((task) => task.id !== movingId)
  const index = targetId === null ? -1 : others.findIndex((task) => task.id === targetId)
  if (index === -1) return positionBetween(others.at(-1)?.position, undefined)

  return placement === 'before'
    ? positionBetween(others[index - 1]?.position, others[index].position)
    : positionBetween(others[index].position, others[index + 1]?.position)
}
