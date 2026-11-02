import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[react()],resolve:{dedupe:['react','react-dom']},server:{fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}}});
