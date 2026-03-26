import express, { NextFunction, Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();
const formParser = express.urlencoded({ extended: false });

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FamilyNoStress API',
    version: '0.7.0',
    description:
      'Documentazione iniziale delle API principali di FamilyNoStress. Flusso consigliato per client iOS/mobile: registrazione o login utente, ottenimento Bearer token e uso del token sulle API protette.',
  },
  servers: [
    {
      url: 'https://api.familynostress.com',
      description: 'Production',
    },
  ],
  tags: [
    { name: 'system', description: 'Stato e diagnostica' },
    { name: 'auth', description: 'Autenticazione e sessione' },
    { name: 'family', description: 'Gestione famiglia attiva' },
    { name: 'dishes', description: 'Catalogo piatti' },
    { name: 'meals', description: 'Pianificazione pasti' },
    { name: 'shopping', description: 'Lista della spesa' },
    { name: 'advanced', description: 'Funzioni avanzate e configurazioni' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Backend operativo',
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Utente autenticato corrente',
        responses: {
          '200': {
            description: 'Utente autenticato',
          },
          '401': {
            description: 'Sessione assente o invalida',
          },
        },
      },
    },
    '/auth/local/register': {
      post: {
        tags: ['auth'],
        summary: 'Registrazione locale',
        description:
          'Crea un nuovo utente web/mobile. Dopo la registrazione il browser riceve una sessione cookie; un client mobile può poi ottenere un Bearer token tramite /auth/token/login.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', example: 'utente@example.com' },
                  password: { type: 'string', example: 'Password123!' },
                  name: { type: 'string', example: 'Mario' },
                  familyName: { type: 'string', example: 'Rossi' },
                  inviteToken: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Utente registrato',
          },
        },
      },
    },
    '/auth/local/register-token': {
      post: {
        tags: ['auth'],
        summary: 'Registrazione mobile con Bearer token immediato',
        description:
          'Crea un nuovo utente e restituisce subito un Bearer token. È il flusso più comodo per una app iOS che vuole essere indipendente dal browser fin dalla registrazione.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', example: 'utente@example.com' },
                  password: { type: 'string', example: 'Password123!' },
                  name: { type: 'string', example: 'Mario' },
                  familyName: { type: 'string', example: 'Rossi' },
                  inviteToken: { type: 'string', nullable: true },
                  tokenName: { type: 'string', example: 'ios-iphone-mario' },
                  expiresInDays: { type: 'integer', example: 30 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Utente creato e Bearer token emesso',
          },
        },
      },
    },
    '/auth/local/login': {
      post: {
        tags: ['auth'],
        summary: 'Login locale',
        description:
          'Login web classico con sessione server-side e cookie HttpOnly. Da usare per browser o web app.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'utente@example.com' },
                  password: { type: 'string', example: 'Password123!' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sessione autenticata',
          },
          '401': {
            description: 'Credenziali non valide',
          },
        },
      },
    },
    '/auth/token/login': {
      post: {
        tags: ['auth'],
        summary: 'Login per client esterni con Bearer token',
        description:
          'Flusso consigliato per app iOS o client non-browser. Valida email/password e restituisce un Bearer token personale con scadenza.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'utente@example.com' },
                  password: { type: 'string', example: 'Password123!' },
                  tokenName: { type: 'string', example: 'ios-antonio-iphone' },
                  expiresInDays: { type: 'integer', example: 30 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token Bearer emesso',
          },
        },
      },
    },
    '/auth/api-tokens': {
      get: {
        tags: ['auth'],
        summary: 'Elenco token API personali',
        description:
          'Mostra i token API manuali creati dall’utente per sviluppo, test, Postman, script o integrazioni tecniche.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista token attivi',
          },
        },
      },
      post: {
        tags: ['auth'],
        summary: 'Crea un nuovo token API personale',
        description:
          'Crea un token manuale persistente. Utile per sviluppo, test e integrazioni tecniche; non è necessario per il flusso utente standard di una app iOS.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '201': {
            description: 'Token creato',
          },
        },
      },
    },
    '/auth/api-tokens/{id}': {
      delete: {
        tags: ['auth'],
        summary: 'Revoca un token API personale',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Token revocato',
          },
          '404': {
            description: 'Token non trovato',
          },
        },
      },
    },
    '/api/family': {
      get: {
        tags: ['family'],
        summary: 'Famiglia attiva',
        description:
          'Con bearer token, se l’utente appartiene a più famiglie puoi specificare X-Family-Id per scegliere il contesto attivo della chiamata.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Dati famiglia attiva',
          },
          '403': {
            description: 'Nessuna famiglia attiva',
          },
        },
      },
    },
    '/api/dishes': {
      get: {
        tags: ['dishes'],
        summary: 'Elenco piatti',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'category',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['primo', 'secondo', 'contorno'],
            },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Lista piatti',
          },
        },
      },
      post: {
        tags: ['dishes'],
        summary: 'Crea un nuovo piatto',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Piatto creato',
          },
        },
      },
    },
    '/api/meals': {
      get: {
        tags: ['meals'],
        summary: 'Pasti per settimana',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'week',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              example: '2026-03-23',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Lista pasti',
          },
        },
      },
      post: {
        tags: ['meals'],
        summary: 'Crea una pianificazione pasto',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Pasto pianificato',
          },
        },
      },
    },
    '/api/shopping': {
      get: {
        tags: ['shopping'],
        summary: 'Lista spesa della settimana',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'week',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              example: '2026-03-23',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Lista spesa',
          },
        },
      },
    },
    '/api/advanced/overview': {
      get: {
        tags: ['advanced'],
        summary: 'Panoramica funzioni avanzate',
        responses: {
          '200': {
            description: 'Panoramica configurazioni avanzate',
          },
        },
      },
    },
  },
};

function hasValidDocsCode(rawCode: unknown): boolean {
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    return false;
  }
  return rawCode === process.env.SWAGGER_ACCESS_CODE;
}

function renderDocsUnlockPage(errorMessage?: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accesso Docs API</title>
  <style>
    :root {
      --bg: #f2ede4;
      --card: #fffaf2;
      --text: #223022;
      --muted: #667266;
      --accent: #2c7a51;
      --border: #d8cfbf;
      --danger: #b23b3b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: Georgia, "Times New Roman", serif;
      background: linear-gradient(180deg, var(--bg), #eae1d4);
      color: var(--text);
    }
    main {
      width: 100%;
      max-width: 460px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 16px 40px rgba(61, 47, 24, 0.12);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.9rem;
    }
    p {
      margin: 0 0 14px;
      color: var(--muted);
      line-height: 1.6;
    }
    label {
      display: block;
      margin: 18px 0 8px;
      font-weight: 700;
    }
    input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      font: inherit;
    }
    button {
      margin-top: 16px;
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 12px 16px;
      font: inherit;
      font-weight: 700;
      color: white;
      background: var(--accent);
      cursor: pointer;
    }
    .error {
      margin-top: 12px;
      color: var(--danger);
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <h1>Swagger API</h1>
    <p>Inserisci il codice di accesso configurato lato server per aprire la documentazione API.</p>
    <form method="post" action="/docs/unlock">
      <label for="code">Codice accesso</label>
      <input id="code" name="code" type="password" autocomplete="off" required />
      <button type="submit">Apri documentazione</button>
    </form>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}
  </main>
</body>
</html>`;
}

function docsAccessGuard(req: Request, res: Response, next: NextFunction) {
  const queryCode = typeof req.query.code === 'string' ? req.query.code : undefined;
  const headerCode = typeof req.headers['x-docs-code'] === 'string' ? req.headers['x-docs-code'] : undefined;
  const sessionCodeValidated = (req.session as any)?.swaggerDocsAuthorized === true;

  if (!process.env.SWAGGER_ACCESS_CODE) {
    return res.status(503).json({ error: 'Swagger access code not configured' });
  }

  if (sessionCodeValidated) {
    return next();
  }

  if (!hasValidDocsCode(queryCode) && !hasValidDocsCode(headerCode)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  (req.session as any).swaggerDocsAuthorized = true;
  return next();
}

function docsUnlockedGuard(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.swaggerDocsAuthorized === true) {
    return next();
  }
  return res.status(403).type('html').send(renderDocsUnlockPage());
}

router.get('/', (req, res, next) => {
  const hasTrailingSlash = req.originalUrl.split('?')[0].endsWith('/');
  if (!hasTrailingSlash) {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    return res.redirect(301, `${req.baseUrl}/${query}`);
  }

  if ((req.session as any)?.swaggerDocsAuthorized === true) {
    return next();
  }

  if (hasValidDocsCode(req.query.code) || hasValidDocsCode(req.headers['x-docs-code'])) {
    return docsAccessGuard(req, res, next);
  }

  return res.type('html').send(renderDocsUnlockPage());
}, swaggerUi.setup(openApiSpec, { explorer: false }));

router.post('/unlock', formParser, (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : undefined;
  if (!hasValidDocsCode(code)) {
    return res.status(403).type('html').send(renderDocsUnlockPage('Codice non valido'));
  }

  (req.session as any).swaggerDocsAuthorized = true;
  return res.redirect('/docs/');
});

router.get('/openapi.json', docsUnlockedGuard, (req, res) => {
  res.json(openApiSpec);
});

router.use('/', docsUnlockedGuard, swaggerUi.serve);

export default router;
