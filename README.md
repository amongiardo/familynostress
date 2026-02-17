# Family Planner

Sistema di organizzazione familiare: pianificazione dei pasti, calendario e lista spesa, con suggerimenti intelligenti.

## Stack Tecnologico

- **Frontend:** Next.js 14 (React) con TypeScript
- **Backend:** Node.js + Express con TypeScript
- **Database:** PostgreSQL con Prisma ORM
- **Autenticazione:** OAuth 2.0 (Google, GitHub)
- **UI:** React Bootstrap + FullCalendar

## Struttura Progetto

```
family-meal-planner/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/       # App router pages
│   │   ├── components/# Reusable components
│   │   ├── lib/       # API client, context, utilities
│   │   └── types/     # TypeScript types
│   └── package.json
│
├── backend/           # Express API server
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic
│   │   ├── middleware/# Auth middleware
│   │   └── config/    # Passport config
│   ├── prisma/        # Database schema & migrations
│   └── package.json
│
└── README.md
```

## Prerequisiti

- Node.js 18+
- PostgreSQL 16 (consigliato) o 14+
- Account Google Cloud Console (per OAuth)
- Account GitHub Developer (per OAuth)

## Setup

### 1. Database

Crea un database PostgreSQL:

```sql
CREATE DATABASE family_meal_planner;
```

### 2. Backend

```bash
cd backend

# Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali

# Installa dipendenze
npm install

# Genera Prisma client e applica migrazioni
npm run db:generate
npm run db:migrate

# (Opzionale) Popola con dati di esempio
npm run db:seed

# Avvia in development
npm run dev
```

### 3. Frontend

```bash
cd frontend

# Copia e configura le variabili d'ambiente
cp .env.example .env.local

# Installa dipendenze
npm install

# Avvia in development
npm run dev
```

## Avvio rapido (script)

```bash
./scripts/dev_stack.sh
```

Per fermare tutto:

```bash
./scripts/dev_stack.sh --stop
```

## Aggiornamento locale (DB + backend)

Quando introduciamo nuove migrazioni/schema, usa questo script da terminale esterno:

```bash
./scripts/dev_stack.sh --update-start
```

Cosa fa:
- verifica/avvia PostgreSQL 16 locale
- applica migrazioni (`prisma migrate deploy`)
- rigenera Prisma Client (`prisma generate`)
- esegue build backend (`npm run build`)
- avvia lo stack dev

Opzione senza restart:

```bash
./scripts/dev_stack.sh --update
```

Storico modifiche DB: `backend/prisma/DB_CHANGES.md`

## Configurazione OAuth

### Google

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto
3. Abilita Google+ API
4. Crea credenziali OAuth 2.0
5. Aggiungi `http://localhost:3001/auth/google/callback` come redirect URI

### GitHub

1. Vai su [GitHub Developer Settings](https://github.com/settings/developers)
2. Crea una nuova OAuth App
3. Imposta Homepage URL: `http://localhost:3000`
4. Imposta Callback URL: `http://localhost:3001/auth/github/callback`

## Variabili d'Ambiente

### Backend (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/family_meal_planner"
SESSION_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
PORT=3001
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Funzionalità

### Calendario Pasti
- Vista settimanale e mensile
- Pianificazione pranzo e cena per ogni giorno
- Click per aggiungere/modificare pasti

### Gestione Piatti
- CRUD completo per i piatti
- Categorizzazione (primo, secondo, contorno)
- Lista ingredienti per ogni piatto
- Filtri e ricerca

### Sistema Suggerimenti
- Anti-ripetizione: evita piatti degli ultimi 7 giorni
- Bilanciamento settimanale: max 2 volte per piatto
- Priorità ai piatti meno utilizzati

### Lista della Spesa
- Generazione automatica dagli ingredienti dei pasti pianificati
- Checkbox per spuntare gli acquisti
- Vista per settimana

### Multi-famiglia
- Ogni famiglia ha i propri dati isolati
- Sistema di inviti via email
- Tutti i membri vedono gli stessi dati

## API Endpoints

### Auth
- `GET /auth/google` - Login con Google
- `GET /auth/github` - Login con GitHub
- `GET /auth/me` - Info utente corrente
- `POST /auth/logout` - Logout

### Family
- `GET /api/family` - Info famiglia
- `PUT /api/family` - Aggiorna famiglia
- `POST /api/family/invite` - Invita membro
- `GET /api/family/invites` - Lista inviti

### Dishes
- `GET /api/dishes` - Lista piatti
- `POST /api/dishes` - Crea piatto
- `PUT /api/dishes/:id` - Modifica piatto
- `DELETE /api/dishes/:id` - Elimina piatto

### Meals
- `GET /api/meals?week=YYYY-MM-DD` - Pasti della settimana
- `POST /api/meals` - Pianifica pasto
- `PUT /api/meals/:id` - Modifica pianificazione
- `DELETE /api/meals/:id` - Rimuovi pianificazione

### Suggestions
- `GET /api/suggestions?date=YYYY-MM-DD&meal=pranzo` - Suggerimenti
- `POST /api/suggestions/accept` - Accetta suggerimento

### Shopping
- `GET /api/shopping?week=YYYY-MM-DD` - Lista spesa
- `POST /api/shopping/regenerate` - Rigenera lista
- `PUT /api/shopping/:itemId/check` - Spunta ingrediente

## License

MIT
