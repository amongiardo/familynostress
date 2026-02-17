---
name: family-planner-workflow
description: Regole operative per Family Planner (cm=commit+push, update info, versioning).
---

# Family Planner Workflow

## Abbreviazione `cm`

`cm` = `commit + push`.

Alla fine di ogni feature/miglioria/fix (anche piccola), chiedere sempre all’utente:

Vuoi fare `cm` adesso?

Se la risposta e' no: non fare commit/push.

## Update obbligatori (prima di un eventuale commit)

1. Aggiornare `infoForCodex.txt`:
1. Aggiornare (se necessario) `AGENTS.md`.
1. Aggiornare `VERSION` (SemVer) se richiesto o se il cambiamento e' un rilascio logico.

## Versioning

La versione del progetto vive in `VERSION` e parte da `0.0.0`.

Regola consigliata:

- Fix: bump patch (es. `0.0.0` -> `0.0.1`)
- Feature compatibile: bump minor (es. `0.1.0`)
- Breaking change: bump major (es. `1.0.0`)

## Checklist `cm` (se l’utente dice si')

1. Verificare lo stato: `git status -sb`
1. Assicurarsi che i file staged siano solo quelli correlati
1. Di default non includere file untracked: usare `git add -u`
1. Se l’utente chiede esplicitamente di includere untracked: usare `git add -A` (oppure aggiungere i path specifici)
1. `git commit -m "..."` (messaggio breve e specifico)
1. `git push` sul branch corrente
