import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteTsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tailwindcss(), viteTsconfigPaths(), tanstackStart()],
  build: {
    // Workers treat every entry export as a handler or class, so keep shared chunk internals out of it.
    rollupOptions: { preserveEntrySignatures: 'strict' },
  },
})
