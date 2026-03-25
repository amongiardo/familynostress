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
