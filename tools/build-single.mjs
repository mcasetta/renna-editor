// Crea dist/renna-editor.html: un unico file con CSS e JS incorporati,
// nel formato usato per pubblicarlo come artifact su claude.ai.
// Uso: node tools/build-single.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const index = read("index.html");
const pick = (re, what) => { const m = index.match(re); if (!m) throw new Error("Non trovo " + what + " in index.html"); return m[1]; };
const head = pick(/<head>([\s\S]*?)<\/head>/, "<head>")
  .replace(/<meta charset[^>]*>\s*/, "")
  .replace(/<meta name="viewport"[^>]*>\s*/, "")
  .replace(/<link rel="stylesheet" href="src\/style\.css">\s*/, "")
  .trim();
const body = pick(/<body>([\s\S]*?)<!-- libreria PDF/, "il corpo della pagina").trim();

const out = `${head}
<style>
${read("src/style.css")}
</style>
${body}

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
${read("src/core.js")}
</script>
<script>
${read("src/app.js")}
</script>
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/renna-editor.html"), out);
console.log("Creato dist/renna-editor.html (" + Math.round(out.length / 1024) + " KB)");
