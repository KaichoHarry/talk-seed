import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const certPath = path.resolve(process.cwd(), "..", "certs", "dev-cert.pem");
const keyPath = path.resolve(process.cwd(), "..", "certs", "dev-key.pem");
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// certs/にmkcertで発行した証明書があればHTTPSで起動する。
// スマホのブラウザはhttps(またはlocalhost)でないとマイク(getUserMedia)を許可しないため。
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: hasCerts
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        }
      : undefined
  }
});
