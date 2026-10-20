// Piccolo server locale (facoltativo): node tools/serve.mjs  →  http://localhost:8080
// Di solito basta aprire index.html con un doppio clic; il server serve se il browser
// fa storie con i file locali o se vuoi aprirla dal telefono sulla stessa rete Wi-Fi.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const port = Number(process.env.PORT) || 8080;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404).end("Non trovato"); }
}).listen(port, () => console.log(`Editor su http://localhost:${port}  (Ctrl+C per fermare)`));
