import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "app",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../dist/app",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "app/recipe-viewer.html"),
    },
  },
});
