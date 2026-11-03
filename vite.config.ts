import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/stepcalc/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: false },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'StepCalc – Show my work',
        short_name: 'StepCalc',
        description: 'A calculator that shows its working, step by step.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    // Several property tests run thousands of cases; 5 s is too tight when the suite shares a busy CPU.
    testTimeout: 30_000,
  },
});
