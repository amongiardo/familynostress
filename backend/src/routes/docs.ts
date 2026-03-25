import { NextFunction, Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { isLoggedIn } from '../middleware/auth';

const router = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FamilyNoStress API',
    version: '0.7.0',
    description: 'Documentazione iniziale delle API principali di FamilyNoStress.',
  },
  servers: [
    {
      url: 'https://api.familynostress.com',
      description: 'Production',
    },
  ],
  paths: {
    '/health': {
      get: {
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
        summary: 'Registrazione locale',
        responses: {
          '200': {
            description: 'Utente registrato',
          },
        },
      },
    },
    '/auth/local/login': {
      post: {
        summary: 'Login locale',
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
    '/api/family': {
      get: {
        summary: 'Famiglia attiva',
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
        summary: 'Elenco piatti',
        responses: {
          '200': {
            description: 'Lista piatti',
          },
        },
      },
    },
    '/api/meals': {
      get: {
        summary: 'Pasti per settimana',
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
    },
    '/api/shopping': {
      get: {
        summary: 'Lista spesa della settimana',
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
  },
};

function hasValidDocsCode(rawCode: unknown): boolean {
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    return false;
  }
  return rawCode === process.env.SWAGGER_ACCESS_CODE;
}

function docsGuard(req: Request, res: Response, next: NextFunction) {
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

router.use('/', isLoggedIn, docsGuard, swaggerUi.serve);
router.get('/', isLoggedIn, docsGuard, swaggerUi.setup(openApiSpec, { explorer: false }));
router.get('/openapi.json', isLoggedIn, docsGuard, (req, res) => {
  res.json(openApiSpec);
});

export default router;
