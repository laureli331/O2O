// Adapted from create-vite 9.3.3 template-react-ts/vite.config.ts.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react()], build: { manifest: true } })
