# Renna · editor dei pezzi

Editor per progettare una renna in fil di ferro (circa 1 m) e stampare le sagome
in scala 1:1 su fogli A4. Ogni pezzo (corpo, collo e testa, 4 zampe) è fatto "a croce":
un anello laterale, un anello frontale/orizzontale che lo incrocia, e degli anelli
trasversali intorno.

## Usarla sul tuo PC

Non serve installare né compilare niente: **fai doppio clic su `index.html`** e si apre
nel browser (Chrome, Edge, Firefox o Safari). Funziona anche senza internet; senza
connessione cambia solo il carattere dei testi.

- **Salva progetto** e **PDF** scaricano i file nella cartella Download del browser.
- Il lavoro si salva da solo nel browser, ma **separatamente** da quello su claude.ai:
  per passare da uno all'altro usa *Salva progetto* da una parte e *Apri progetto* dall'altra.
  Il file .json contiene anche i punti salvati.

## Strumenti per svilupparla

| Strumento | A cosa serve | Obbligatorio? |
|---|---|---|
| Un browser | Usare e provare l'app | Sì |
| [Node.js](https://nodejs.org) (versione LTS, 20 o più) | Test, server locale, creazione del file unico | Consigliato |
| [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) | Svilupparla con Claude | Sì, per come vuoi lavorare tu |
| Un editor di testo (es. VS Code) | Guardare e modificare il codice a mano | Facoltativo |
| Git | Tenere la storia delle versioni | Facoltativo, ma utile |

Non ci sono dipendenze da installare: `npm install` non serve.

## Comandi

Da un terminale aperto in questa cartella:

```
npm test         # controlla la geometria di tutti i pezzi e crea PDF di prova in dist/test/
npm start        # server locale su http://localhost:8080 (facoltativo)
npm run build    # crea dist/renna-editor.html, un unico file da ripubblicare su claude.ai
```

## Come è fatta

```
index.html            la pagina (struttura dei pannelli)
src/style.css         aspetto, colori chiari/scuri
src/core.js           geometria dei pezzi e generatore del PDF (nessuna interfaccia)
src/app.js            interfaccia: viste 2D trascinabili, vista 3D, pannelli, salvataggi
vendor/jspdf…js       libreria per creare i PDF (copia locale di jsPDF 2.5.1)
test/core.test.mjs    test senza browser
tools/build-single.mjs  crea la versione in un file unico
tools/serve.mjs       server locale minimo
CLAUDE.md             note tecniche per Claude Code
```

## Partire con Claude Code

1. Apri un terminale in questa cartella e scrivi `claude`.
2. Chiedi quello che vuoi, per esempio:
   *"aggiungi le corna come fili singoli piegati, con il loro schema nel PDF"*.
3. Claude Code legge da solo `CLAUDE.md`, dove è spiegato come è organizzato il codice.
4. Dopo ogni modifica: ricarica `index.html` nel browser e, se vuoi, `npm test`.

Consiglio: prima di iniziare fai `git init` e un primo commit, così puoi sempre tornare indietro.
