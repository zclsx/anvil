import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'

const isWebOnly = process.env.ANVIL_WEB_ONLY === '1'

export default defineConfig({
  plugins: isWebOnly
    ? [tailwindcss(), react()]
    : [
        tailwindcss(),
        react(),
        electron([
          {
            entry: 'electron/main/index.ts',
            vite: {
              build: {
                outDir: 'dist-electron/main',
                rollupOptions: {
                  external: [
                    'electron',
                    '@anthropic-ai/claude-agent-sdk',
                    'electron-store',
                    'electron-updater',
                    'dotenv',
                    'better-sqlite3',
                    'zod',
                    'mammoth',
                    'exceljs',
                  ],
                },
              },
            },
          },
          {
            entry: 'electron/preload/index.ts',
            onstart(args) {
              args.reload()
            },
            vite: {
              build: {
                outDir: 'dist-electron/preload',
                lib: {
                  entry: 'electron/preload/index.ts',
                  formats: ['cjs'],
                  fileName: () => 'index.cjs',
                },
                rollupOptions: {
                  external: ['electron'],
                },
              },
            },
          },
        ]),
        renderer(),
      ],
  build: {
    outDir: 'dist',
  },
})
