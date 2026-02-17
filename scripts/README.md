# Scripts

## Script principale

Usa sempre:

```bash
./scripts/dev_stack.sh
```

Modalita' interattiva:
- Se lo stack e' avviato: propone `Stop` oppure `Exit`.
- Se lo stack e' fermo: propone `Update + Start` oppure `Exit`.

Modalita' dirette:

```bash
./scripts/dev_stack.sh --start
./scripts/dev_stack.sh --stop
./scripts/dev_stack.sh --update
./scripts/dev_stack.sh --update-start
```

Nota su `--stop`:
- chiede se vuoi fermare solo app (default) oppure app + PostgreSQL.
- premendo invio senza scelta, ferma solo app.

## Cosa fa `dev_stack.sh`

- Gestisce l'intero ciclo dev (`start/stop/update`) in un solo script.
- Avvia backend e frontend in background e salva PID in `.dev_pids/`.
- Pulisce la cache Next (`frontend/.next`) in stop.
- Esegue update DB backend:
  - `prisma migrate deploy`
  - `prisma generate`
  - `npm run build` (backend)
- Controlla PostgreSQL e, se spento, chiede se avviarlo.
- Non stoppa PostgreSQL in `stop` per ridurre richieste sudo ripetute.
- In stop puoi comunque scegliere di fermare anche PostgreSQL quando serve.
- Integra installazione font Nunito locale:
  - se i file sono gia' presenti, salta
  - se mancano, scarica `@fontsource/nunito` e copia i `.woff2` richiesti.

## Altri script rimasti

- `check_db_all.sh`
  - utility manuale per provare avvio/stop PostgreSQL e listing database su installazioni locali.
- `reset_db_passwords.sh`
  - utility manuale per reset password utente `postgres` su installazioni PostgreSQL locali.

Questi due script sono di manutenzione DBA locale e normalmente non servono nel flusso quotidiano.
