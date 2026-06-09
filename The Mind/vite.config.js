import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: './public', // Tells Vite your index.html is here
  build: {
    outDir: '../dist', // Places the final build back in the project root folder
    emptyOutDir: true,
  }
});
