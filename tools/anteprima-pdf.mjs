// Salva una pagina di un PDF come immagine PNG, per controllarla senza stamparla.
// Usa Chrome (o Edge) in modalità invisibile e pdf.js da cdnjs: serve internet.
// Uso: node tools/anteprima-pdf.mjs dist/test/corpo.pdf 1 [uscita.png] [larghezza in pixel]
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [pdf, pageArg = "1", outArg, widthArg = "1000"] = process.argv.slice(2);
if (!pdf) { console.error("Uso: node tools/anteprima-pdf.mjs <file.pdf> <pagina> [uscita.png] [larghezza]"); process.exit(1); }
const page = parseInt(pageArg, 10), width = parseInt(widthArg, 10);
const out = resolve(outArg || pdf.replace(/\.pdf$/i, `-p${page}.png`));

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
];
const browser = browsers.find(existsSync);
if (!browser) { console.error("Non trovo Chrome o Edge."); process.exit(1); }

// pagina A4: verticale 210x297, orizzontale 297x210 – la finestra si adatta dopo una prima lettura
const data = readFileSync(pdf).toString("base64");
const html = (w, h) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style>
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"></script>
<script>
(async () => {
  const bytes = Uint8Array.from(atob("${data}"), c => c.charCodeAt(0));
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pg = await doc.getPage(${page});
  const v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: ${w} / v0.width });
  const c = document.getElementById("c"); c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  document.title = "pronto " + doc.numPages + " " + v0.width + " " + v0.height;
})();
</script>`;

const dir = mkdtempSync(join(tmpdir(), "anteprima-"));
try {
  // provo prima in verticale; se la pagina è orizzontale rifaccio con la finestra giusta
  for (const land of [false, true]) {
    const w = land ? Math.round(width * 297 / 210) : width, h = Math.round(w * (land ? 210 / 297 : 297 / 210));
    const file = join(dir, "p.html"); writeFileSync(file, html(w, h));
    const dump = execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=15000",
      `--user-data-dir=${join(dir, "prof")}`, "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", maxBuffer: 1e8 });
    const m = dump.match(/<title>pronto (\d+) ([\d.]+) ([\d.]+)<\/title>/);
    if (!m) throw new Error("La pagina non si è caricata (internet? numero di pagina?)");
    const isLand = +m[2] > +m[3];
    if (isLand !== land) continue;
    execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=15000",
      `--user-data-dir=${join(dir, "prof")}`, `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(file).href], { stdio: "ignore" });
    console.log(`Pagina ${page} di ${m[1]} salvata in ${out}`);
    break;
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
