# Note per Claude Code

App per progettare una renna in fil di ferro e stampare sagome 1:1. Interfaccia e testi in **italiano**.
L'utente piega il filo a mano sopra i fogli stampati: precisione delle misure e chiarezza delle stampe contano più di tutto.

## Vincoli
- Nessun passo di build per usarla: `index.html` deve funzionare aperto da `file://`.
  Quindi **script classici, niente ES modules** in `src/` e niente `"type": "module"` in package.json
  (i soli moduli sono i file `.mjs` in `tools/` e `test/`).
- Nessuna dipendenza npm. jsPDF è in `vendor/` (2.5.1, UMD → `window.jspdf.jsPDF`).
- `src/core.js` non tocca il DOM: è UMD, esporta `window.RennaCore` e `module.exports`, e gira anche in Node (lo usano i test).
- Testi nel PDF: font standard helvetica → solo caratteri Latin-1 (usa `-` invece di `·`, `°` per °).
- Unità: centimetri ovunque. Nel PDF `MM = 10` mm per cm; A4, margini `PM`, sovrapposizione fogli `OV` = 1 cm.

## Modello dati (progetto salvato in .json e in localStorage `renna-progetto-v2`)
```
{ name, cur, pieces: { corpo, testa, AS, AD, PS, PD }, snapshots? }
pezzo = {
  name, type: "corpo" | "zampa" | "testa",
  v:    [[x,y]...]   punti di controllo del profilo laterale (spline chiusa Catmull-Rom); x avanti→coda, y altezza da terra
  axis: [[x,y]...]   asse della croce (polilinea nel piano laterale); dove attraversa il profilo ci sono i 2 incroci
  top:  [[s,w]...]   metà del secondo anello: s = distanza lungo l'asse dal primo incrocio, w = mezza larghezza
  rings:[{p1,p2}]    anelli trasversali = 2 punti di contatto sul profilo; il centro è dove p1–p2 incrocia l'asse
  n:    esponente super-ellisse degli anelli (2 = ellisse, più alto = più squadrato)
  zoff: spostamento laterale (z) del piano del pezzo; zampe sinistre negative
}
```
Vecchi formati (`rings` con `{s,a}` o numeri, progetto con solo il corpo e `yh`) sono convertiti da `RC.migrate` / `derive`: mantieni la compatibilità.
I punti salvati sono in localStorage `renna-punti-v1` come `{id, name, t, data: JSON del progetto}`.

## Flusso
- `RC.derive(pezzo)` → tutto il calcolato: curve `V` (profilo) e `H` (secondo anello, coordinate s,z), incroci `c0/c1`,
  pieghe dell'asse `bends`, anelli con misure (`ut`, `ub`, `w`, `curve`, `L`), lunghezze, avvisi (`warn`), `ok`.
- `RC.makePdf(jsPDF, pezzo)` → PDF: riepilogo, anello laterale e secondo anello su più fogli (`planTiles`), pagine degli anelli impaginate a scaffali.
- `src/app.js`: classe `View` generica (fit, griglia, hit-test, drag con `points()` e `handles()`), viste `side` e `top`, vista 3D su canvas 2D con proiezione e ordinamento per profondità, pannello, undo (`hist`), punti salvati, salvataggio file.
- Salvataggio file: dentro claude.ai usa la capability `downloads` (`window.claude.use("downloads")`); in locale fa un normale download con `<a download>`.

## Comandi
- `npm test` – verifica tutti i pezzi di partenza e crea PDF di prova in `dist/test/` (aprili per controllare a occhio).
- `npm start` – server su http://localhost:8080.
- `npm run build` – `dist/renna-editor.html`, file unico (CSS/JS incorporati, jsPDF da cdnjs) da ripubblicare come artifact su claude.ai.

## Dopo una modifica
Esegui `npm test`; se cambi il PDF apri qualche file in `dist/test/` e controlla che la barra di controllo sia 5 cm e che le etichette non si sovrappongano.
