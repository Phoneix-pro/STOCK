import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
      base: "https://phoneix-pro.github.io/STOCK/",
    plugins: [react()],
})
