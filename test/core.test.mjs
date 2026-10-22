// Controlli rapidi della geometria e del PDF, senza browser.
// Uso: node test/core.test.mjs   (oppure: npm test)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const RC = require("../src/core.js");
const { jsPDF } = require("../vendor/jspdf.umd.min.js");

const pr = RC.defaultProject();

// ogni anello trasversale deve stare dentro l'area della griglia; sui fogli multipli i tratti scoperti restano corti
function checkLayout(k, layout) {
  for (const it of layout) {
    if (it.kind === "anello") {
      const [x0, y0, x1, y1] = it.box, [a0, b0, a1, b1] = it.area;
      assert.ok(x0 >= a0 && y0 >= b0 && x1 <= a1 && y1 <= b1, `${k} ${it.name}: l'anello esce dal foglio (${it.box.map(v => v.toFixed(1))})`);
    } else {
      assert.ok(it.maxGap <= 1.0 + 1e-6, `${k} ${it.name}: tratto fuori dai fogli troppo lungo (${it.maxGap.toFixed(2)} cm)`);
    }
  }
}
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
  const { doc, pages, layout } = RC.makePdf(jsPDF, st);
  assert.ok(pages >= 3, `${k}: il PDF deve avere almeno 3 pagine`);
  checkLayout(k, layout);
  writeFileSync(new URL(`../dist/test/${k}.pdf`, import.meta.url), Buffer.from(doc.output("arraybuffer")));
  console.log(`ok  ${k.padEnd(6)} filo ${(D.tot / 100).toFixed(1)} m · ${D.rings.length} anelli · PDF ${pages} pagine`);
}

// i salvataggi vecchi (solo corpo, coordinate x) devono ancora aprirsi
const old = { v: pr.pieces.corpo.v, yh: 45, top: [[19.5, 3.2], [40, 9.4], [67.2, 3.2]], rings: [24, { x: 45, a: 10 }], n: 2.3 };
const m = RC.migrate(JSON.parse(JSON.stringify(old)));
assert.ok(m && m.pieces.corpo && m.pieces.testa, "migrazione di un salvataggio vecchio");
assert.ok(RC.derive(m.pieces.corpo).ok, "il corpo migrato è valido");
console.log("ok  migrazione dei salvataggi vecchi");

// sinistra/destra sono quelli della renna: z positivo = fianco sinistro
assert.ok(pr.pieces.AS.zoff > 0 && pr.pieces.PS.zoff > 0 && pr.pieces.AD.zoff < 0 && pr.pieces.PD.zoff < 0, "zampe sinistre a z positivo");
assert.equal(pr.lati, "animale", "il progetto di partenza ha i lati della renna");
// un progetto salvato prima (nomi scambiati) si apre con la stessa forma e i nomi giusti
const vecchio = JSON.parse(JSON.stringify(pr)); delete vecchio.lati; vecchio.cur = "AS";
["AS", "PS"].forEach(k => { const t = vecchio.pieces[k]; vecchio.pieces[k] = vecchio.pieces[RC.ORDER.find(q => q === (k === "AS" ? "AD" : "PD"))]; vecchio.pieces[k === "AS" ? "AD" : "PD"] = t; });
vecchio.pieces.AS.name = "Zampa anteriore sinistra"; vecchio.pieces.AD.name = "Zampa anteriore destra";
vecchio.pieces.PS.name = "Zampa posteriore sinistra"; vecchio.pieces.PD.name = "Zampa posteriore destra";
const zVecchio = vecchio.pieces.AD.zoff;
const mv = RC.migrate(vecchio);
assert.equal(mv.pieces.AS.zoff, zVecchio, "la vecchia «destra» a z positivo diventa la sinistra");
assert.equal(mv.pieces.AS.name, "Zampa anteriore sinistra", "nome della zampa corretto");
assert.deepEqual(mv.pieces.AS.v, pr.pieces.AS.v, "la forma non cambia");
assert.equal(mv.cur, "AD", "resta selezionata la stessa zampa");
assert.equal(JSON.stringify(RC.migrate(JSON.parse(JSON.stringify(mv)))), JSON.stringify(mv), "riaprirlo non scambia di nuovo");
console.log("ok  sinistra e destra dal punto di vista della renna");

// un singolo pezzo "collo e testa" va al suo posto, non al posto del corpo
const sola = RC.migrate(JSON.parse(JSON.stringify(pr.pieces.testa)));
assert.equal(sola.cur, "testa", "un pezzo testa singolo si apre come testa");
assert.equal(sola.pieces.corpo.type, "corpo", "il corpo resta un corpo");

// un anello vecchio non convertibile dà un avviso chiaro, e il resto del pezzo resta valido
const conBuco = JSON.parse(JSON.stringify(pr.pieces.corpo)); conBuco.rings.push({ s: 500, a: 0 });
const Db = RC.derive(conBuco);
assert.ok(Db.ok && Db.warn.some(w => w.includes("vecchio formato")), "avviso per l'anello non convertibile");
assert.ok(Db.rings.length === pr.pieces.corpo.rings.length, "gli altri anelli restano");
console.log("ok  pezzo singolo e anello non convertibile");

// corpo ingrandito: gli anelli più grandi di un foglio vanno su più fogli, senza uscire dal bordo
const grande = RC.defaultProject().pieces.corpo, K = 1.4;   // anelli ancora nel formato {s, a}
grande.v = grande.v.map(p => [p[0] * K, p[1] * K]); grande.axis = grande.axis.map(p => [p[0] * K, p[1] * K]);
grande.top = grande.top.map(p => [p[0] * K, p[1] * K]); grande.rings = grande.rings.map(r => ({ s: r.s * K, a: r.a }));
const G = RC.makePdf(jsPDF, grande);
checkLayout("corpo x1.4", G.layout);
const multi = G.layout.filter(it => it.name.startsWith("Anello trasversale"));
assert.ok(multi.length > 0, "nel corpo grande almeno un anello va su più fogli");
writeFileSync(new URL("../dist/test/corpo-grande.pdf", import.meta.url), Buffer.from(G.doc.output("arraybuffer")));
console.log(`ok  corpo x1.4: ${multi.length} anelli su più fogli · PDF ${G.pages} pagine`);
console.log("\nTutto a posto. I PDF di prova sono in dist/test/");
