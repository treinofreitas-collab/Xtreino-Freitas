import { defineConfig } from "vite";
import path from "path";

const rawPort = process.env.PORT ?? "4173";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}". Use a port between 1 and 65535.`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [],
  root: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "public/index.html"),
        admin: path.resolve(import.meta.dirname, "public/admin.html"),
        client: path.resolve(import.meta.dirname, "public/client.html"),
        evento: path.resolve(import.meta.dirname, "public/evento.html"),
        maintenance: path.resolve(import.meta.dirname, "public/maintenance.html"),
        passwordReset: path.resolve(import.meta.dirname, "public/password-reset.html"),
        sensibilidades: path.resolve(import.meta.dirname, "public/sensibilidades.html"),
        imagens: path.resolve(import.meta.dirname, "public/imagens.html"),
        planilhas: path.resolve(import.meta.dirname, "public/planilhas.html"),
        passeBooyah: path.resolve(import.meta.dirname, "public/passe-booyah.html"),
        camisa: path.resolve(import.meta.dirname, "public/camisa.html"),
        bonus: path.resolve(import.meta.dirname, "public/bonus.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:80",
        rewrite: (path) => path.replace(/^\/.netlify\/functions/, "/api"),
        changeOrigin: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
