import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, appRoot, 'VITE_');
  if (command === 'build' && mode === 'production') {
    let api;
    try { api = new URL(env.VITE_API_BASE || ''); } catch { /* Report configuration below. */ }
    if (!api || api.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
      throw new Error('Bản production cần VITE_API_BASE là địa chỉ API HTTPS công khai. Không dùng localhost. Kiểm tra .env.production hoặc biến môi trường trước khi build.');
    }
  }
  return {
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  };
});
