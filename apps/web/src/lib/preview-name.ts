import { createHash } from 'node:crypto'

const WORKER = 'kanban-web'
// A preview's address is `<name>-kanban-web.<subdomain>.workers.dev`; that first label may be at
// most 63 characters.
const MAX_NAME = 63 - WORKER.length - 1

/**
 * Turns a branch name into a Preview name: lowercase letters, digits and dashes, starting with a
 * letter, short enough for the address. A shortened name gets a hash so two long branches that
 * start the same do not share a Preview.
 */
export function previewName(branch: string) {
  let name = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z]/.test(name)) name = `b-${name}`.replace(/-+$/, '')
  if (name === 'b' || name === '') name = 'preview'

  if (name.length > MAX_NAME) {
    const hash = createHash('sha1').update(branch).digest('hex').slice(0, 6)
    name = `${name.slice(0, MAX_NAME - 7).replace(/-+$/, '')}-${hash}`
  }
  return name
}

export function previewUrl(name: string, subdomain = 'ut-code') {
  return `https://${name}-${WORKER}.${subdomain}.workers.dev`
}
