import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts', 'src/**/*.{spec,test}.{ts,tsx}'],
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/*.{spec,test}.tsx', 'happy-dom'],
      ['tests/components/**/*.spec.tsx', 'happy-dom'],
    ],
    restoreMocks: true,
    clearMocks: true,
  },
})
