'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Spinner, Form } from 'react-bootstrap';
import { FaUsers } from 'react-icons/fa';
import { familyApi, authApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showInviteInfo, setShowInviteInfo] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', passwordConfirm: '' });
  const [inviteData, setInviteData] = useState<{
    email: string;
    family: { id: string; name: string };
  } | null>(null);

  useEffect(() => {
    const validateInvite = async () => {
      try {
        const data = await familyApi.validateInvite(token);
        setInviteData(data);
        setShowInviteInfo(true);
      } catch (err: any) {
        setError(err.message || 'Invito non valido o scaduto');
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [token]);

  // OAuth login handlers commentati per sviluppi futuri
  // const handleGoogleLogin = () => {
  //   sessionStorage.setItem('inviteToken', token);
  //   window.location.href = `${authApi.getGoogleLoginUrl()}?invite=${token}`;
  // };
  // const handleGithubLogin = () => {
  //   sessionStorage.setItem('inviteToken', token);
  //   window.location.href = `${authApi.getGithubLoginUrl()}?invite=${token}`;
  // };

  const handleLocalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;
    if (form.password !== form.passwordConfirm) {
      setLocalError('Le password non coincidono');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      await authApi.registerLocal({
        email: inviteData.email,
        password: form.password,
        name: form.name,
        inviteToken: token,
      });
      await refresh();
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err?.message || 'Registrazione fallita');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteData) return;
    setAcceptingInvite(true);
    setLocalError(null);
    try {
      await familyApi.acceptInvite(token);
      await refresh();
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err?.message || 'Impossibile accettare l’invito');
    } finally {
      setAcceptingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <Card className="login-card text-center">
          <Spinner animation="border" variant="success" />
          <p className="mt-3 text-muted">Verifica invito...</p>
        </Card>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="login-page">
        <Card className="login-card text-center">
          <StatusModal
            show={Boolean(error)}
            variant="danger"
            message={error || 'Invito non valido o scaduto'}
            onClose={() => setError('')}
          />
          <p className="text-muted mb-3">{error || 'Invito non valido o scaduto'}</p>
          <Button variant="primary" onClick={() => router.push('/login')}>
            Vai al Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="login-page">
      <Card className="login-card text-center">
        <div className="mb-4">
          <FaUsers size={48} className="text-success mb-3" />
          <h4>Sei stato invitato!</h4>
          <p className="text-muted">
            Unisciti alla famiglia <strong>{inviteData.family.name}</strong>
          </p>
        </div>

        <StatusModal
          show={showInviteInfo}
          variant="info"
          message={`Questo invito è per ${inviteData.email}. Assicurati di accedere con questo indirizzo email.`}
          onClose={() => setShowInviteInfo(false)}
        />

        <StatusModal
          show={Boolean(localError)}
          variant="danger"
          message={localError || ''}
          onClose={() => setLocalError(null)}
        />
        {user ? (
          user.email.toLowerCase() === inviteData.email.toLowerCase() ? (
            <div className="text-start">
              <Form.Group className="mb-3" controlId="inviteEmailLogged">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={inviteData.email} disabled />
              </Form.Group>
              <div className="d-grid gap-2">
                <Button variant="success" onClick={handleAcceptInvite} disabled={acceptingInvite}>
                  {acceptingInvite ? <Spinner size="sm" animation="border" /> : 'Accetta Invito'}
                </Button>
                <Button
                  variant="outline-danger"
                  className="btn-danger-soft"
                  onClick={async () => {
                    await refresh();
                    router.push(user?.activeFamilyId ? '/dashboard' : '/impostazioni');
                  }}
                >
                  Annulla
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-start">
              <p className="text-muted small">
                Sei autenticato come <strong>{user.email}</strong>, ma questo invito è per{' '}
                <strong>{inviteData.email}</strong>.
              </p>
              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  onClick={async () => {
                    await logout();
                    router.push(`/login?invite=${token}`);
                  }}
                >
                  Esci e Accedi con email corretta
                </Button>
              </div>
            </div>
          )
        ) : (
          <Form onSubmit={handleLocalRegister} className="text-start">
            <Form.Group className="mb-3" controlId="inviteEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={inviteData.email} disabled />
            </Form.Group>

            <Form.Group className="mb-3" controlId="inviteName">
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

            <Form.Group className="mb-3" controlId="invitePassword">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                className="placeholder-soft"
                placeholder="es: ••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="invitePasswordConfirm">
              <Form.Label>Conferma Password</Form.Label>
              <Form.Control
                type="password"
                className="placeholder-soft"
                placeholder="es: ••••••••"
                value={form.passwordConfirm}
                onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                required
              />
            </Form.Group>

            <div className="d-grid">
              <Button variant="success" type="submit" disabled={submitting}>
                Crea Account e Entra
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}
