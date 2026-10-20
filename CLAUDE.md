# Claude Code - Istruzioni per il progetto

<!--
================================================================================
TEMPLATE CLAUDE.md
Copiare questo file nella root di ogni nuovo progetto e personalizzare
la SEZIONE SPECIFICA PROGETTO.

Per usare: dire a Claude "crea CLAUDE.md partendo dal template in /projects/utility/"
================================================================================
-->

## REGOLE IMPORTANTI PER CLAUDE

### Sincronizzazione Template
1. **Modifiche alla SEZIONE COMUNE**: quando l'utente chiede una modifica alla sezione comune,
   applicarla SIA al CLAUDE.md del progetto corrente SIA al template in:
   `C:\Users\matte\projects\utility\CLAUDE-TEMPLATE.md`

2. **Verifica coerenza a inizio sessione**: all'inizio di ogni nuova sessione, verificare che
   la SEZIONE COMUNE del CLAUDE.md del progetto sia allineata con il template.
   Se ci sono differenze, segnalarle all'utente (a meno che non indicato diversamente).

3. **Eccezioni**: se l'utente specifica che una modifica è solo per il progetto corrente,
   NON propagarla al template.

### Struttura Repository
Ogni progetto è organizzato in due cartelle che diventeranno due repository Git separati:
- `public/` — codice sorgente, pubblicato su repo **pubblico** GitHub
- `private/` — documentazione e file privati, pubblicato su repo **privato** GitHub

La cartella del progetto (workspace root) non è essa stessa un repo git.

4. **Leggere NOTE MANUALI.txt a inizio sessione**: se esiste `private/docs/NOTE MANUALI.txt`,
   leggerlo SEMPRE all'inizio di ogni nuova sessione. Contiene note inserite
   dall'utente tra una sessione e l'altra (lavori interrotti, bug segnalati, modifiche da fare).
   **IMPORTANTE**: questo file è SOLO LETTURA per Claude. Non modificarlo mai automaticamente.

5. **Leggere SESSIONI.txt a inizio sessione**: leggere l'ultima sessione in `private/docs/SESSIONI.txt`
   per capire da dove si era rimasti.

6. **Aggiornare SESSIONI.txt a fine sessione**: aggiungere un blocco sessione con:
   - Data e numero sessione
   - Obiettivo, attività svolte, decisioni prese, prossimi passi, file modificati.

7. **Aggiornare TODO.txt**: mantenere aggiornato durante la sessione (aggiungere item,
   marcare come [DONE] o [RISOLTO] quelli completati).

8. **Aggiornare ANALISI.txt**: quando si prendono decisioni architetturali o si chiariscono
   requisiti, documentarle in ANALISI.txt nella sezione appropriata.

---

################################################################################
#                                                                              #
#                            SEZIONE COMUNE                                    #
#                                                                              #
################################################################################

## Git Push su GitHub

Il repository usa SSH per l'autenticazione con GitHub:
- Remote: `git@github.com:mcasetta/<nome-repo>.git`
- Chiave SSH: `~/.ssh/id_ed25519` (ha una passphrase)

---

### Windows — Configurazione SSH (OpenSSH Agent)

Setup **una volta sola** (richiede PowerShell admin):
```powershell
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519   # chiede la passphrase una volta
```

Dopo ogni riavvio del PC, l'agent riparte automaticamente ma la chiave va ricaricata:
```powershell
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

### Windows — Configurazione git (una volta sola)
Git for Windows ha un SSH interno che **non** parla con il Windows OpenSSH Agent.
Va configurato globalmente per usare l'SSH di sistema:
```powershell
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"
```

### Windows — Prima di usare Git push in Claude
Claude Code viene aperto dall'app desktop — basta che il servizio OpenSSH Agent sia running
e la chiave sia caricata (tramite bat o manualmente).
Se il push fallisce con "Permission denied", ricaricare la chiave (vedi sopra).

Claude non può caricare la chiave SSH da solo perché richiede input interattivo (passphrase).

---

### Linux/WSL — Configurazione SSH (keychain)

Il sistema usa `keychain` per mantenere la chiave SSH caricata tra le sessioni.
Setup in `~/.bashrc`:
```bash
eval $(keychain --eval --agents ssh id_ed25519 2>/dev/null)
```

### Linux/WSL — Prima di usare Git push in Claude
All'inizio di ogni sessione Claude, caricare l'ambiente keychain:
```bash
source ~/.keychain/$(hostname)-sh
```

Se il push fallisce con "Permission denied", verificare che keychain sia attivo:
```bash
eval $(keychain --eval --agents ssh id_ed25519)
```

---

### Per fare push
```powershell
git push origin <branch>
```

## Nuovo Repository

Per un nuovo repository GitHub, l'utente deve:
1. Creare il repo su GitHub
2. Configurare il remote SSH:
   ```bash
   git remote add origin git@github.com:mcasetta/<nome-repo>.git
   ```

Claude può fare push dopo aver caricato l'ambiente keychain (vedi sopra).

## Note Generali
- La chiave SSH ha una passphrase
- Keychain mantiene la chiave caricata tra le sessioni del terminale
- Se l'utente riavvia il PC, dovrà inserire la passphrase una volta al primo utilizzo

## File Utility Cross-Progetto
I file di utility condivisi tra progetti (guide, cheatsheet, reference, script) vanno in:
```
C:\Users\matte\projects\utility\
```
Vedere `utility/README.md` per l'elenco completo e le istruzioni d'uso.

### Script disponibili

**`genera_manuale.py`** — genera Manuale Utente (.docx + .txt) da sorgente con markup custom.
Ogni progetto ha un wrapper thin in `private/docs/manuale-utente/genera_manuale.py`.
Dettagli e formato sorgente: `utility/README.md`.

## Database e JPA

### Nuove colonne su tabelle esistenti (ddl-auto=update)
Non aggiungere MAI colonne `NOT NULL` senza un default a livello database, oppure senza una
strategia di migrazione. Con `ddl-auto=update`, H2 (e altri DB) non riesce ad aggiungere
colonne NOT NULL a tabelle con dati esistenti.

**Regola**: i nuovi campi devono essere **nullable** nel DB. Gestire i valori di default
nel mapper o nel service (fallback quando il valore è null). Per i boolean, usare il wrapper
`Boolean` (non il primitivo `boolean`) per permettere null dal DB.

## Convenzioni di Codice Generali

### Lingua
Usare **sempre inglese** per tutto il codice:
- Nomi classi, interfacce, enum
- Nomi metodi e funzioni
- Nomi variabili e parametri
- Commenti nel codice
- Messaggi di log
- Nomi costanti

## IDE e Editor

- **Backend (Java/Spring Boot)**: IntelliJ IDEA Community Edition
- **Frontend (Angular/TypeScript)**: VS Code

Guida avvio completa: `C:\Users\matte\projects\utility\avvio-progetti-spring-angular.txt`

## Script di Distribuzione (prepare-dist.bat)

Pattern collaudato per progetti Spring Boot + Angular su Windows.

### Struttura cartelle
```
private/
├── scripts/
│   ├── prepare-dist.bat   # script di build completo
│   └── prepare-dist.log   # log dell'ultima esecuzione
├── dist/
│   ├── start.bat          # launcher per l'utente finale (doppio click)
│   └── <app>.jar          # JAR prodotto dalla build
└── VERSION                # versione corrente (es. 1.0.0, 0.1.0d3)
public/
└── VERSION                # stessa versione (aggiornata dallo script)
```

### Cosa fa prepare-dist.bat
1. Verifica prerequisiti (Java, Maven, Node.js — cerca anche IntelliJ bundled Maven)
2. Chiede bump versione: major / minor / patch / dev (suffisso `dN`) / nessuno
3. Maven clean (step 1/4)
4. `call npm install --no-audit` + `call npm run build` (step 2/4)
5. Copia `dist/frontend/browser/` in `backend/src/main/resources/static/` (step 3/4)
6. Maven package -DskipTests (step 4/4)
7. Copia JAR in `private/dist/<app>.jar`

Partire dal template: `utility/prepare-dist-template.bat` (adattare le variabili in cima).
Riferimento funzionante: `contabilita/private/scripts/prepare-dist.bat`.

### Problemi noti risolti — cmd.exe batch Windows

1. **`call npm` obbligatorio**: `npm` su Windows è `npm.cmd` (un batch file). Senza `call`,
   il controllo NON torna al batch chiamante dopo npm → tutto ciò che segue non esegue.
   Usare SEMPRE `call npm install ...` e `call npm run build ...`.

2. **`!errorlevel!` non si espande dentro blocchi `else (...)`**: catturarlo FUORI dal blocco.
   Pattern corretto:
   ```bat
   ) else (
       call npm --prefix "%ROOT_DIR%\frontend" run build >> "%LOGFILE%" 2>&1
   )
   set FRONTEND_EXIT=!errorlevel!   ← FUORI dal blocco
   if !FRONTEND_EXIT! neq 0 ( ... )
   ```

3. **`pushd/cd` dentro `else (...)` con redirect `>>` non persiste il CWD**: usare
   `npm --prefix "<path>"` invece di `cd <dir> && npm`, per non dipendere dal CWD.

4. **`npm install` restituisce exit code 1 per audit vulnerabilità**: usare `--no-audit`
   per evitare falsi positivi sull'exit code.

5. **`goto` dentro blocchi parentesizzati annidati**: comportamento inaffidabile in cmd.exe.
   Preferire `exit /b 1` inline con la gestione errore, evitare goto dentro if/else annidati.

6. **Versione Java**: verificare che il JDK in PATH corrisponda alla versione nel pom.xml
   (`<java.version>`). Java in PATH è spesso diverso dal JDK usato da IntelliJ.

7. **`pause` non trattiene la finestra in certi contesti Windows**: se lo script viene
   lanciato con doppio click e va in errore, `pause` può non funzionare. Usare sempre:
   ```bat
   set /p "X=Premi INVIO per chiudere..." <con
   ```
   Il `<con` legge dal device console direttamente, funziona in tutti i contesti.

8. **`%VAR%` vs `!VAR!` inside blocchi `if (...)`**: con `setlocal enabledelayedexpansion`,
   `%VAR%` dentro un blocco parentesizzato si espande al momento del parsing (valore vecchio),
   NON dopo un `set /a` nella riga precedente. Usare `!VAR!` per leggere il valore aggiornato.
   Esempio (bug versione bump):
   ```bat
   set /a MINOR=%MINOR%+1
   set NEW_VERSION=%MAJOR%.%MINOR%.0   ← BUG: %MINOR% è il valore vecchio
   set NEW_VERSION=%MAJOR%.!MINOR!.0   ← CORRETTO
   ```

## Configurazione Proxy WSL2 (progetti Spring Boot + Angular)

Quando backend su Windows (IntelliJ) e frontend su WSL2 (VS Code), servono due configurazioni proxy:

**File da creare in `frontend/`:**
- `proxy.conf.json` → `localhost:8080` (backend WSL2)
- `proxy.conf.windows.json` → `<IP-Windows>:8080` (backend Windows)

**Script npm in `package.json`:**
```json
"start": "ng serve",
"start:win": "ng serve --proxy-config proxy.conf.windows.json"
```

**Uso:**
- `npm start` → backend su WSL2 (Claude avvia con Maven)
- `npm run start:win` → backend su Windows (utente avvia con IntelliJ)

**Trovare IP Windows da WSL2:**
```bash
ip route show | grep default | awk '{print $3}'
```

---

################################################################################
#                                                                              #
#                         SEZIONE SPECIFICA PROGETTO                           #
#                           (PERSONALIZZARE SOTTO)                             #
#                                                                              #
################################################################################

## Stato Progetto (LEGGERE ALL'INIZIO DI OGNI SESSIONE)

### Fase Corrente
Editor funzionante (6 pezzi: corpo, collo e testa, 4 zampe) portato da claude.ai a Claude Code.
Prossima fase: correzione dei punti fragili emersi nell'analisi iniziale (vedi `docs/TODO.txt`).

### Ultimo Aggiornamento
2026-10-20 — sessione 1

### Cosa è stato fatto
- Lettura del codice, `npm test` verde, primo commit git locale.
- CLAUDE.md adeguato al template di `utility/`.

### Prossimi Passi
Vedi `docs/TODO.txt`.

### Struttura Repository — ECCEZIONE AL TEMPLATE (solo per questo progetto)
Un **unico repository pubblico**, nella root del progetto (`renna-editor/` è il repo git).
Niente separazione `public/` / `private/`. Le regole 4–8 del template che parlano di
`private/docs/…` valgono qui per `docs/…`.
- Remote: `git@github.com:mcasetta/renna-editor.git`

### Struttura Cartelle
```
renna-editor/                      # repo git (pubblico)
├── CLAUDE.md
├── README.md
├── index.html                     # la pagina: si apre con doppio clic
├── src/
│   ├── style.css                  # aspetto, colori chiari/scuri
│   ├── core.js                    # geometria + generatore PDF (niente DOM, gira anche in Node)
│   └── app.js                     # interfaccia: viste 2D, 3D, pannelli, salvataggi
├── vendor/jspdf.umd.min.js        # jsPDF 2.5.1
├── test/core.test.mjs             # test senza browser
├── tools/                         # build-single.mjs, serve.mjs
├── dist/                          # generato (ignorato da git): PDF di prova, file unico
└── docs/
    ├── ANALISI.txt
    ├── SESSIONI.txt
    ├── TODO.txt
    └── NOTE MANUALI.txt           # SOLO LETTURA per Claude
```

### File da Consultare
- `docs/ANALISI.txt` — analisi dettagliata e decisioni architetturali
- `docs/SESSIONI.txt` — log cronologico sessioni
- `docs/TODO.txt` — backlog e punti aperti
- `docs/NOTE MANUALI.txt` — note dell'utente (solo lettura)

---

## Avvio Applicazione
- Uso: **doppio clic su `index.html`** (nessuna installazione, funziona da `file://`).
- `npm test` – verifica tutti i pezzi di partenza e crea PDF di prova in `dist/test/` (aprili per controllare a occhio).
- `npm start` – server su http://localhost:8080 (facoltativo).
- `npm run build` – `dist/renna-editor.html`, file unico (CSS/JS incorporati, jsPDF da cdnjs) da ripubblicare come artifact su claude.ai.

---

## Convenzioni Specifiche Progetto

### Cos'è
App per progettare una renna in fil di ferro (circa 1 m) e stampare sagome 1:1 su A4.
L'utente piega il filo a mano sopra i fogli stampati: **precisione delle misure e chiarezza delle stampe contano più di tutto**.
Ogni pezzo è fatto "a croce": anello laterale + secondo anello (orizzontale per il corpo, frontale per zampe e testa)
disteso lungo un asse piegabile + anelli trasversali. Corna, orecchie e coda non ci sono ancora.

### Come lavorare con l'utente
- Parlare in **italiano**; interfaccia e testi dei PDF restano in italiano.
- Spiegare le scelte in modo semplice e dire sempre **come provare** una modifica (di solito ricaricare `index.html`).
- **Commit dopo ogni modifica che funziona.**
- Prima di cambiamenti grossi: descrivere il piano e **aspettare l'ok**.
- I file di progetto `.json` salvati con versioni precedenti **devono continuare ad aprirsi**.
- Dopo ogni modifica che tocca il PDF: controllare i PDF di prova.

### Lingua del codice — eccezione alla sezione comune
Il codice esistente ha commenti e alcuni nomi in italiano. Per coerenza si mantiene lo stile del codice
circostante; non tradurre il codice esistente in inglese senza che l'utente lo chieda.

### Vincoli tecnici
- Nessun passo di build per usarla: `index.html` deve funzionare aperto da `file://`.
  Quindi **script classici, niente ES modules** in `src/` e niente `"type": "module"` in package.json
  (i soli moduli sono i file `.mjs` in `tools/` e `test/`).
- Nessuna dipendenza npm. jsPDF è in `vendor/` (2.5.1, UMD → `window.jspdf.jsPDF`).
- `src/core.js` non tocca il DOM: è UMD, esporta `window.RennaCore` e `module.exports`, e gira anche in Node (lo usano i test).
- Testi nel PDF: font standard helvetica → solo caratteri Latin-1 (usa `-` invece di `·`, `°` per °).
- Unità: centimetri ovunque. Nel PDF `MM = 10` mm per cm; A4, margini `PM`, sovrapposizione fogli `OV` = 1 cm.

### Modello dati (progetto salvato in .json e in localStorage `renna-progetto-v2`)
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

### Flusso
- `RC.derive(pezzo)` → tutto il calcolato: curve `V` (profilo) e `H` (secondo anello, coordinate s,z), incroci `c0/c1`,
  pieghe dell'asse `bends`, anelli con misure (`ut`, `ub`, `w`, `curve`, `L`), lunghezze, avvisi (`warn`), `ok`.
- `RC.makePdf(jsPDF, pezzo)` → PDF: riepilogo, anello laterale e secondo anello su più fogli (`planTiles`), pagine degli anelli impaginate a scaffali.
- `src/app.js`: classe `View` generica (fit, griglia, hit-test, drag con `points()` e `handles()`), viste `side` e `top`, vista 3D su canvas 2D con proiezione e ordinamento per profondità, pannello, undo (`hist`), punti salvati, salvataggio file.
- Salvataggio file: dentro claude.ai usa la capability `downloads` (`window.claude.use("downloads")`); in locale fa un normale download con `<a download>`.

### Dopo una modifica
Esegui `npm test`; se cambi il PDF apri qualche file in `dist/test/` e controlla che la barra di controllo sia 5 cm e che le etichette non si sovrappongano.
