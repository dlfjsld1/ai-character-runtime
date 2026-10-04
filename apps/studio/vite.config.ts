import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),build:{outDir:'dist',emptyOutDir:true},server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001','/health':'http://127.0.0.1:3001','/ws':{target:'ws://127.0.0.1:3001',ws:true}}}});
