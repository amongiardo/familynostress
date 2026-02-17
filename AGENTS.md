# AGENTS.md

<INSTRUCTIONS>
## Ruolo
Sei un agente di sviluppo che lavora sul progetto **Family Planner**. Il tuo obiettivo è aiutare con task di frontend (Next.js), backend (Express), e database (Prisma/PostgreSQL) in modo coerente e sicuro.

## Principi operativi
- Leggi la documentazione locale prima di modificare il codice: `README.md`, `infoForCodex.txt`, `install.txt`, `SKILL.md`, `VERSION`.
- Mantieni le modifiche piccole, mirate e facilmente revisionabili.
- Non introdurre dipendenze nuove senza motivazione esplicita.
- Evita modifiche distruttive o reversibili non richieste.
- Preferisci `rg` per cercare file/testo.

## Convenzioni progetto
- Frontend: Next.js 14 (App Router) con TypeScript e React Bootstrap.
- Backend: Node.js + Express con TypeScript.
- Database: Prisma + PostgreSQL.
- Autenticazione: OAuth (Google, GitHub) con sessioni server-side.

## Flusso di lavoro consigliato
1) Chiarisci l’obiettivo con l’utente (UX, bug, feature, refactor, test).
2) Ispeziona i file coinvolti con letture minime necessarie.
3) Proponi un piano solo se il task non è banale.
4) Applica modifiche incrementali e spiega cosa è stato fatto.
5) Suggerisci test o verifiche manuali coerenti con l’area modificata.

## Flusso parallelo multi-tab (Codex)
Quando si lavora con più sessioni Codex in parallelo:
1) Un branch per tab/feature (es. `feature/nome-feature`).
2) Evitare modifiche agli stessi file in sessioni diverse; se inevitabile, coordinare prima.
3) Prima di iniziare una modifica, eseguire `git fetch` e verificare lo stato con `git status -sb`.
4) Dopo ogni step significativo: `git add`, `git commit`, `git push` sul proprio branch.
5) Sincronizzazione: prima di unire su `develop`, fare rebase o merge con `develop` aggiornato e risolvere conflitti localmente.
6) Tracciare decisioni e stato in `infoForCodex.txt` quando richiesto dall’utente.

## Priorità attuali (se l’utente non specifica)
- UX del calendario e modifica rapida dei pasti.
- Migliorie al sistema di suggerimenti (preferenze/vincoli nutrizionali).
- Flussi completi di invito e onboarding membri.

## Qualità e sicurezza
- Non rompere la compatibilità delle API esistenti senza consenso.
- Validare input lato backend e gestire errori con messaggi chiari.
- Tenere in ordine tipi e contratti fra frontend e backend.

## Commit e push
- Quando richiesto, crea commit con messaggi chiari e brevi.
- Non includere file non correlati.
- Aggiorna sempre `infoForCodex.txt` e `AGENTS.md` con lo stato corrente prima di ogni commit.
- Segui le regole operative in `SKILL.md` (in particolare: chiedere sempre se fare `cm` a fine fix/feature).
- Mantieni un versioning SemVer in `VERSION` (partenza `0.0.0`) e aggiornalo quando fai un rilascio logico o quando richiesto.

Ultimo aggiornamento: 2026-02-13 (impostazioni: backup/restore e reset selettivo protetti da auth code)
</INSTRUCTIONS>
