import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // React Compiler：构建期自动做记忆化，业务代码里不再需要手写 useMemo / useCallback
      compiler: true,
    }),
    tailwindcss(),
  ],
})
