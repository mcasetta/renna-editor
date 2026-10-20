// Controlli rapidi della geometria e del PDF, senza browser.
// Uso: node test/core.test.mjs   (oppure: npm test)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const RC = require("../src/core.js");
const { jsPDF } = require("../vendor/jspdf.umd.min.js");

const pr = RC.defaultProject();
mkdirSync(new URL("../dist/test", import.meta.url), { recursive: true });

for (const k of RC.ORDER) {
  const st = pr.pieces[k];
  const D = RC.derive(st);
  assert.ok(D.ok, `${k}: la forma di partenza deve essere valida (${D.warn.join("; ")})`);
  assert.equal(D.warn.length, 0, `${k}: nessun avviso atteso, trovati: ${D.warn.join("; ")}`);
  assert.ok(D.LV > 50 && D.LV < 200, `${k}: lunghezza anello laterale plausibile (${D.LV})`);
  assert.ok(D.rings.length >= 5, `${k}: almeno 5 anelli trasversali`);
  for (const r of D.rings) {
    assert.ok(r.ut > 0 && r.ub > 0 && r.w > 0, `${k} ${r.n}: misure positive`);
  }
  const { doc, pages } = RC.makePdf(jsPDF, st);
  assert.ok(pages >= 3, `${k}: il PDF deve avere almeno 3 pagine`);
  writeFileSync(new URL(`../dist/test/${k}.pdf`, import.meta.url), Buffer.from(doc.output("arraybuffer")));
  console.log(`ok  ${k.padEnd(6)} filo ${(D.tot / 100).toFixed(1)} m · ${D.rings.length} anelli · PDF ${pages} pagine`);
}

// i salvataggi vecchi (solo corpo, coordinate x) devono ancora aprirsi
const old = { v: pr.pieces.corpo.v, yh: 45, top: [[19.5, 3.2], [40, 9.4], [67.2, 3.2]], rings: [24, { x: 45, a: 10 }], n: 2.3 };
const m = RC.migrate(JSON.parse(JSON.stringify(old)));
assert.ok(m && m.pieces.corpo && m.pieces.testa, "migrazione di un salvataggio vecchio");
assert.ok(RC.derive(m.pieces.corpo).ok, "il corpo migrato è valido");
console.log("ok  migrazione dei salvataggi vecchi");
console.log("\nTutto a posto. I PDF di prova sono in dist/test/");
