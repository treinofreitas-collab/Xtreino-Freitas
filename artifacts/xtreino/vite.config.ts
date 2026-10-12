import { defineConfig } from "vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
