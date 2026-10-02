// Prints the Preview name for a branch: `node scripts/preview-name.ts <branch>`.
import { previewName } from '../apps/web/src/lib/preview-name.ts'

const branch = process.argv[2]
if (!branch) {
  console.error('usage: node scripts/preview-name.ts <branch>')
  process.exit(1)
}
console.log(previewName(branch))
