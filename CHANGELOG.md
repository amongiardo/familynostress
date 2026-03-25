# Changelog

## 0.8.0 - 2026-03-25
### Mobile auth, token API e release notes
- Aggiunto il flusso mobile `register + token` tramite `POST /auth/local/register-token`.
- Introdotti bearer token personali per client iOS e integrazioni esterne, con revoca e audit dedicato.
- Aggiunta la gestione token API nell'interfaccia `Impostazioni`.
- Aggiunta pagina pubblica `/changelog` con numero versione cliccabile dalla login.
- Aggiornata Swagger per distinguere chiaramente browser session, login bearer e token manuali.

## 0.7.0 - 2026-03-25
### Prima messa in produzione
- Deploy completo di `familynostress.com` e `api.familynostress.com`.
- Installazione Woodpecker CI su `ci.nagrimodo.com` con deploy automatico su push a `main`.
- Correzione login web con sessione cookie dietro reverse proxy HTTPS.
- Aggiunta Swagger protetta da codice per la documentazione API.

## 0.6.0 - 2026-02-17
### Collaborazione, backup e funzioni avanzate
- Aggiunte notifiche utente con campanella, badge unread e azioni rapide.
- Introdotta chat famiglia e chat privata con thread dinamici, chiusura box persistente e UX ottimizzata.
- Aggiunti backup export JSON, restore selettivo e reset selettivo per la famiglia attiva.
- Introdotta la pagina `/avanzate` con template settimanali, dispensa, costi, reminder intelligenti, ruoli granulari e audit log.
- Aggiunti audit log applicativi per azioni sensibili su pasti, spesa, template, dispensa e ruoli.

## 0.5.0 - 2026-02-13
### Multi-famiglia e ciclo di vita membri
- Refactor completo da modello mono-famiglia a membership multi-famiglia con famiglia attiva.
- Aggiunte API e UI per creare nuove famiglie, cambiare famiglia attiva e gestire più nuclei con lo stesso account.
- Introdotti storico famiglie, abbandono/rientro, soft delete famiglia e tracciamento creator/deleter.
- Rafforzata la UX in assenza di famiglia attiva con redirect, messaggi guidati e blocchi coerenti lato backend/frontend.
- Aggiunti autocomplete globale città e metadati geocodificati per una gestione più precisa del meteo famiglia.

## 0.4.0 - 2026-02-10
### Sicurezza, ruoli e robustezza frontend
- Introdotti ruoli utente (`admin`/`member`) e `authCode` a 5 caratteri per proteggere le azioni distruttive.
- Aggiornate le UI con ConfirmModal, StatusModal e pulsanti `Incolla` per i codici di conferma.
- Reso l'`authCode` personale per account, condiviso su tutte le famiglie dell'utente.
- Hardened il build frontend con font Nunito locali e fix `Suspense` sulla login.
- Formalizzato il versioning di progetto con file `VERSION`.

## 0.3.0 - 2026-02-09
### Pianificazione pasti avanzata e strumenti operativi
- Aggiunti slot pasto `primo/secondo/contorno` per pranzo e cena.
- Introdotta auto-programmazione più intelligente con anti-ripetizione e gestione categorie.
- Aggiunto `MealOut` per segnare pranzi/cene fuori casa.
- Introdotte pagina statistiche pasti, export PDF calendario e weekly ingredients box.
- Migliorati import/export CSV piatti, shopping flow e controlli rapidi dashboard/calendario.

## 0.2.0 - 2026-02-04
### Redesign UX e stabilizzazione calendario
- Redesign completo dell'interfaccia in stile v4 con gradienti, bubble cards e day strip.
- Migliorata la dashboard con week navigation, highlight di oggi, meteo e quick actions.
- Stabilizzato il calendario con fix sul range loading, caching, spinner di stato e parsing date.
- Migliorata la pagina impostazioni con riepiloghi più chiari e layout più solido.
- Rifinite modali, dropdown, badge categoria e componenti visuali principali.

## 0.1.0 - 2026-02-02
### Fondazioni del progetto
- Primo setup del progetto con frontend Next.js, backend Express e database PostgreSQL tramite Prisma.
- Implementate le basi di autenticazione, gestione famiglia, catalogo piatti, meal planning e lista spesa.
- Definita la struttura del repository e la separazione tra frontend, backend e migrazioni.
- Stabilito il flusso iniziale di sviluppo e documentazione tecnica del progetto.
