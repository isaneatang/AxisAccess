import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config for AxisPass.
 *
 * Nothing exotic: a plain React SPA. The contract ABI + bytecode are
 * regenerated into src/blockchain/artifact.js by the predev/prebuild
 * scripts, so dev and build always see fresh contract output.
 *
 * The chunkSizeWarningLimit is raised because Reown AppKit is a chunky
 * dependency. It is a warning, not an error, but a clean build output is
 * nicer to read, so we give Vite some breathing room.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
