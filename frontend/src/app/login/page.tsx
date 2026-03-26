'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Form } from 'react-bootstrap';
import { useAuth } from '@/lib/AuthContext';
import { authApi, familyApi } from '@/lib/api';
import StatusModal from '@/components/StatusModal';

function LoginPageContent() {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const error = searchParams.get('error');
  const inviteToken = searchParams.get('invite') || undefined;
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(inviteToken ? 'register' : 'login');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    familyName: '',
    password: '',
    passwordConfirm: '',
    authCode: '',
  });

  useEffect(() => {
    if (!loading && user) {
      router.push(user.activeFamilyId ? '/dashboard' : '/impostazioni');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const notice = window.sessionStorage.getItem('authNotice');
    if (notice) {
      setLocalError(notice);
      window.sessionStorage.removeItem('authNotice');
    }
  }, []);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    setLocalSuccess(null);
    try {
      let resultUserActiveFamilyId: string | undefined;
      if (mode === 'login') {
        const payload = await authApi.loginLocal({ email: form.email, password: form.password });
        resultUserActiveFamilyId = payload.user?.activeFamilyId;
        if (inviteToken) {
          await familyApi.acceptInvite(inviteToken);
          resultUserActiveFamilyId = undefined;
        }
      } else if (mode === 'register') {
        if (form.password !== form.passwordConfirm) {
          setLocalError('Le password non coincidono');
          return;
        }
        const payload = await authApi.registerLocal({
          email: form.email,
          password: form.password,
          name: form.name,
          familyName: inviteToken ? undefined : form.familyName,
          inviteToken,
        });
        resultUserActiveFamilyId = payload.user?.activeFamilyId;
      } else {
        if (form.password !== form.passwordConfirm) {
          setLocalError('Le password non coincidono');
          return;
        }
        await authApi.resetLocalPassword({
          email: form.email,
          authCode: form.authCode.trim().toUpperCase(),
          newPassword: form.password,
        });
        setLocalSuccess('Password aggiornata. Ora puoi accedere con la nuova password.');
        setMode('login');
        setForm((current) => ({
          ...current,
          password: '',
          passwordConfirm: '',
          authCode: '',
        }));
        return;
      }
      await refresh();
      if (inviteToken) {
        router.push('/dashboard');
      } else {
        router.push(resultUserActiveFamilyId ? '/dashboard' : '/impostazioni');
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Autenticazione fallita');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-card text-center">
        <h1 className="mb-2 login-title">Family Planner</h1>
        <p className="text-muted mb-4">Pianifica e organizza la tua famiglia</p>

        <StatusModal
          show={Boolean(error || localError)}
          variant="danger"
          message={
            error === 'no_family'
              ? 'Non fai più parte di nessuna famiglia. Registrati per crearne una nuova oppure attendi un nuovo invito.'
              : error
                ? 'Autenticazione fallita. Riprova.'
                : localError || ''
          }
          onClose={() => {
            if (error) {
              router.replace('/login');
            }
            setLocalError(null);
          }}
        />

        <StatusModal
          show={Boolean(localSuccess)}
          variant="success"
          message={localSuccess || ''}
          onClose={() => setLocalSuccess(null)}
        />

        <div className="my-4 text-muted" />

        <Form onSubmit={handleLocalSubmit} className="text-start">
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Form.Group>

          {mode === 'register' && (
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                type="text"
                className="placeholder-soft"
                placeholder="es: Il tuo nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Form.Group>
          )}

          {mode === 'register' && !inviteToken && (
            <Form.Group className="mb-3" controlId="familyName">
              <Form.Label>Nome Famiglia</Form.Label>
              <Form.Control
                type="text"
                className="placeholder-soft"
                placeholder="es: Rossi"
                value={form.familyName}
                onChange={(e) => setForm({ ...form, familyName: e.target.value })}
                required
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>{mode === 'forgot' ? 'Nuova Password' : 'Password'}</Form.Label>
            <Form.Control
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Form.Group>

          {mode === 'forgot' && (
            <Form.Group className="mb-3" controlId="authCode">
              <Form.Label>Codice di Recupero</Form.Label>
              <Form.Control
                type="text"
                value={form.authCode}
                onChange={(e) =>
                  setForm({ ...form, authCode: e.target.value.toUpperCase().slice(0, 5) })
                }
                placeholder="Codice personale a 5 caratteri"
                autoCapitalize="characters"
                required
              />
              <Form.Text className="text-muted">
                Usa il tuo codice personale visibile in Impostazioni &gt; Profilo Utente.
              </Form.Text>
            </Form.Group>
          )}

          {(mode === 'register' || mode === 'forgot') && (
            <Form.Group className="mb-3" controlId="passwordConfirm">
              <Form.Label>Conferma Password</Form.Label>
              <Form.Control
                type="password"
                value={form.passwordConfirm}
                onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                required
              />
            </Form.Group>
          )}

          <div className="d-grid">
            <Button variant="primary" type="submit" disabled={submitting}>
              {mode === 'login'
                ? 'Accedi con Email'
                : mode === 'register'
                  ? 'Crea Account'
                  : 'Aggiorna Password'}
            </Button>
          </div>

          <div className="mt-3 text-center small">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => setMode('register')}
                >
                  Non hai un account? Registrati
                </button>
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={() => setMode('forgot')}
                  >
                    Password dimenticata?
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => setMode('login')}
              >
                {mode === 'register' ? 'Hai già un account? Accedi' : 'Torna al login'}
              </button>
            )}
          </div>
        </Form>

        <p className="mt-4 text-muted small">
          Accedendo, accetti i nostri termini di servizio
        </p>
        <p className="text-muted small mb-0">
          <Link href="/changelog" className="version-link">
            Versione {appVersion}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
