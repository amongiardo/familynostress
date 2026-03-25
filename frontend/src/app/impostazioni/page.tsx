'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Form,
  Modal,
  ListGroup,
  Spinner,
  InputGroup,
  Image,
  Row,
  Col,
  Badge,
} from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaEnvelope, FaTrash, FaCopy, FaCheck, FaPaste, FaKey } from 'react-icons/fa';
import DashboardLayout from '@/components/DashboardLayout';
import { authApi, familyApi, weatherApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';
import ConfirmModal from '@/components/ConfirmModal';
import type { ApiAccessToken, CitySearchResult, CreatedApiAccessToken, Family } from '@/types';

export default function ImpostazioniPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const isAdmin = user?.role === 'admin';
  const hasActiveFamily = Boolean(user?.activeFamilyId);
  const [familyName, setFamilyName] = useState('');
  const [familyCity, setFamilyCity] = useState('');
  const [familyCityDebounced, setFamilyCityDebounced] = useState('');
  const [selectedFamilyCity, setSelectedFamilyCity] = useState<CitySearchResult | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyCity, setNewFamilyCity] = useState('');
  const [newFamilyCityDebounced, setNewFamilyCityDebounced] = useState('');
  const [selectedNewFamilyCity, setSelectedNewFamilyCity] = useState<CitySearchResult | null>(null);
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [copiedAuthCode, setCopiedAuthCode] = useState(false);
  const [copiedApiToken, setCopiedApiToken] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiTokenName, setApiTokenName] = useState('');
  const [apiTokenDays, setApiTokenDays] = useState('30');
  const [newApiToken, setNewApiToken] = useState<CreatedApiAccessToken | null>(null);
  const [pendingInviteDelete, setPendingInviteDelete] = useState<string | null>(null);
  const [pendingFamilyDelete, setPendingFamilyDelete] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [pendingLeaveFamily, setPendingLeaveFamily] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [pendingForgetFamily, setPendingForgetFamily] = useState<{ id: string; name: string } | null>(null);
  const [pendingApiTokenDelete, setPendingApiTokenDelete] = useState<ApiAccessToken | null>(null);
  const [targetFamilyId, setTargetFamilyId] = useState<string>('');
  const [leaveTargetFamilyId, setLeaveTargetFamilyId] = useState<string>('');
  const [deleteFamilyAuthCode, setDeleteFamilyAuthCode] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [backupAuthCode, setBackupAuthCode] = useState('');
  const [resetAuthCode, setResetAuthCode] = useState('');
  const [backupPayload, setBackupPayload] = useState<any | null>(null);
  const [backupFileName, setBackupFileName] = useState('');
  const [backupTargets, setBackupTargets] = useState<Record<string, boolean>>({
    planning: true,
    chats: true,
    dishes: true,
    shopping: true,
    invites: true,
    notifications: true,
  });
  const [resetTargets, setResetTargets] = useState<Record<string, boolean>>({
    planning: true,
    chats: false,
    dishes: false,
    shopping: false,
    invites: false,
    notifications: false,
  });

  const resetOptions: { key: string; label: string; hint: string }[] = [
    { key: 'planning', label: 'Pianificazione', hint: 'Meal plan e pasti fuori' },
    { key: 'chats', label: 'Chat', hint: 'Chat famiglia e private della famiglia attiva' },
    { key: 'dishes', label: 'Piatti', hint: 'Cancella i piatti di famiglia (e i meal plan collegati)' },
    { key: 'shopping', label: 'Lista Spesa', hint: 'Svuota tutte le liste spesa della famiglia' },
    { key: 'invites', label: 'Inviti', hint: 'Cancella tutti gli inviti pendenti/scaduti' },
    { key: 'notifications', label: 'Notifiche', hint: 'Cancella notifiche legate alla famiglia' },
  ];

  const { data: family, isLoading } = useQuery<Family>({
    queryKey: ['family'],
    queryFn: familyApi.get,
    enabled: hasActiveFamily,
  });

  useEffect(() => {
    if (family && !familyName) {
      setFamilyName(family.name);
    }
  }, [family, familyName]);

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: familyApi.getInvites,
    enabled: isAdmin && hasActiveFamily,
  });

  const { data: formerMembers, isLoading: formerMembersLoading } = useQuery({
    queryKey: ['family', 'former-members'],
    queryFn: familyApi.getFormerMembers,
    enabled: isAdmin && hasActiveFamily,
  });

  const { data: myFamilies, isLoading: familiesLoading } = useQuery({
    queryKey: ['family', 'mine'],
    queryFn: familyApi.mine,
  });

  const { data: apiTokens, isLoading: apiTokensLoading } = useQuery({
    queryKey: ['auth', 'api-tokens'],
    queryFn: async () => (await authApi.listApiTokens()).tokens,
    enabled: Boolean(user),
  });

  useEffect(() => {
    const timer = setTimeout(() => setFamilyCityDebounced(familyCity.trim()), 300);
    return () => clearTimeout(timer);
  }, [familyCity]);

  useEffect(() => {
    const timer = setTimeout(() => setNewFamilyCityDebounced(newFamilyCity.trim()), 300);
    return () => clearTimeout(timer);
  }, [newFamilyCity]);

  const { data: familyCitySearchResults } = useQuery({
    queryKey: ['weather', 'cities', familyCityDebounced, 'world'],
    queryFn: () => weatherApi.searchCities(familyCityDebounced, 'world'),
    enabled: familyCityDebounced.length >= 2,
  });

  const { data: newFamilyCitySearchResults } = useQuery({
    queryKey: ['weather', 'cities', newFamilyCityDebounced, 'world'],
    queryFn: () => weatherApi.searchCities(newFamilyCityDebounced, 'world'),
    enabled: newFamilyCityDebounced.length >= 2,
  });

  const updateFamilyMutation = useMutation({
    mutationFn: familyApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      setSuccess('Famiglia aggiornata');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const regenerateAuthCodeMutation = useMutation({
    mutationFn: familyApi.regenerateAuthCode,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      await refresh();
      setSuccess('Codice rigenerato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const exportBackupMutation = useMutation({
    mutationFn: familyApi.exportBackup,
    onSuccess: (data) => {
      const familyName = data?.family?.name || 'famiglia';
      const sanitizedName = String(familyName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'famiglia';
      const stamp = format(new Date(), 'yyyyMMdd-HHmm');
      const filename = `backup-${sanitizedName}-${stamp}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccess('Backup scaricato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: ({ backup, targets, authCode }: { backup: any; targets: string[]; authCode: string }) =>
      familyApi.restoreBackup(backup, targets, authCode),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['family'] });
      await queryClient.invalidateQueries({ queryKey: ['meals'] });
      await queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
      await queryClient.invalidateQueries({ queryKey: ['dishes'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping'] });
      await queryClient.invalidateQueries({ queryKey: ['invites'] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setShowBackupModal(false);
      setBackupAuthCode('');
      setBackupPayload(null);
      setBackupFileName('');
      setSuccess('Restore backup completato');
      setTimeout(() => setSuccess(''), 3000);
      console.log('Backup restore summary:', data?.summary);
    },
    onError: (err: Error) => setError(err.message),
  });

  const resetDataMutation = useMutation({
    mutationFn: ({ targets, authCode }: { targets: string[]; authCode: string }) =>
      familyApi.resetData(targets, authCode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family'] });
      await queryClient.invalidateQueries({ queryKey: ['meals'] });
      await queryClient.invalidateQueries({ queryKey: ['mealOuts'] });
      await queryClient.invalidateQueries({ queryKey: ['dishes'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping'] });
      await queryClient.invalidateQueries({ queryKey: ['invites'] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setShowResetModal(false);
      setResetAuthCode('');
      setSuccess('Reset completato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: familyApi.invite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      setInviteEmail('');
      setSuccess('Invito inviato con successo');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const createFamilyMutation = useMutation({
    mutationFn: familyApi.create,
    onSuccess: async (data) => {
      if (typeof window !== 'undefined') {
        if (data.activeFamilyId) {
          window.localStorage.setItem('activeFamilyId', data.activeFamilyId);
        } else {
          window.localStorage.removeItem('activeFamilyId');
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['family'] });
      await queryClient.invalidateQueries({ queryKey: ['family', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      await refresh();
      setNewFamilyName('');
      setNewFamilyCity('');
      setSelectedNewFamilyCity(null);
      setShowCreateFamilyModal(false);
      setSuccess('Nuova famiglia creata');
      setTimeout(() => setSuccess(''), 3000);
      router.refresh();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: ({ id, authCode }: { id: string; authCode: string }) =>
      familyApi.deleteInvite(id, authCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      familyApi.updateMemberRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      setSuccess('Ruolo aggiornato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const rejoinFormerMemberMutation = useMutation({
    mutationFn: (userId: string) => familyApi.rejoinFormerMember(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family'] });
      await queryClient.invalidateQueries({ queryKey: ['family', 'former-members'] });
      setSuccess('Membro riammesso in famiglia');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeFormerMemberMutation = useMutation({
    mutationFn: (userId: string) => familyApi.removeFormerMember(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family', 'former-members'] });
      await queryClient.invalidateQueries({ queryKey: ['family', 'mine'] });
      setSuccess('Membro segnato come eliminato definitivamente');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: ({ familyId, authCode, targetFamilyId }: { familyId: string; authCode: string; targetFamilyId?: string }) =>
      familyApi.deleteFamily(familyId, authCode, targetFamilyId),
    onSuccess: async (data) => {
      if (typeof window !== 'undefined') {
        if (data.activeFamilyId) {
          window.localStorage.setItem('activeFamilyId', data.activeFamilyId);
        } else {
          window.localStorage.removeItem('activeFamilyId');
        }
      }
      await refresh();
      queryClient.clear();
      setSuccess('Famiglia eliminata');
      setTimeout(() => setSuccess(''), 3000);
      router.replace('/impostazioni');
      router.refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const leaveFamilyMutation = useMutation({
    mutationFn: ({ familyId, targetFamilyId }: { familyId: string; targetFamilyId?: string }) =>
      familyApi.leaveFamily(familyId, targetFamilyId),
    onSuccess: async (data) => {
      if (typeof window !== 'undefined') {
        if (data.activeFamilyId) {
          window.localStorage.setItem('activeFamilyId', data.activeFamilyId);
        } else {
          window.localStorage.removeItem('activeFamilyId');
        }
      }
      await refresh();
      queryClient.clear();
      setSuccess('Hai abbandonato la famiglia');
      setTimeout(() => setSuccess(''), 3000);
      router.replace('/impostazioni');
      router.refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const rejoinFamilyMutation = useMutation({
    mutationFn: (familyId: string) => familyApi.rejoinFamily(familyId),
    onSuccess: async (data) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('activeFamilyId', data.activeFamilyId);
      }
      await refresh();
      queryClient.clear();
      setSuccess('Rientro in famiglia completato');
      setTimeout(() => setSuccess(''), 3000);
      router.replace('/impostazioni');
      router.refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  const forgetFamilyMutation = useMutation({
    mutationFn: (familyId: string) => familyApi.forgetFormerFamily(familyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family', 'mine'] });
      setSuccess('Famiglia segnata come eliminata');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const createApiTokenMutation = useMutation({
    mutationFn: authApi.createApiToken,
    onSuccess: async (data) => {
      setNewApiToken(data);
      setApiTokenName('');
      setApiTokenDays('30');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'api-tokens'] });
      setSuccess('Token API creato. Copialo ora: non sarà più visibile in chiaro.');
      setTimeout(() => setSuccess(''), 4000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeApiTokenMutation = useMutation({
    mutationFn: authApi.revokeApiToken,
    onSuccess: async () => {
      setPendingApiTokenDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'api-tokens'] });
      setSuccess('Token API revocato');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleUpdateFamilyName = () => {
    setError('');
    if (!isAdmin) {
      setError('Solo l’amministratore può modificare le impostazioni della famiglia');
      return;
    }
    if (!familyName.trim()) return;
    updateFamilyMutation.mutate({ name: familyName.trim() });
    setFamilyName('');
  };

  const handleUpdateFamilyCity = () => {
    setError('');
    if (!isAdmin) {
      setError('Solo l’amministratore può modificare le impostazioni della famiglia');
      return;
    }
    if (!familyCity.trim()) return;
    if (selectedFamilyCity) {
      updateFamilyMutation.mutate({
        city: selectedFamilyCity.name,
        citySelection: {
          name: selectedFamilyCity.name,
          displayName: selectedFamilyCity.displayName,
          country: selectedFamilyCity.country,
          timezone: selectedFamilyCity.timezone,
          latitude: selectedFamilyCity.latitude,
          longitude: selectedFamilyCity.longitude,
        },
      });
    } else {
      updateFamilyMutation.mutate({ city: familyCity.trim() });
    }
    setFamilyCity('');
    setSelectedFamilyCity(null);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isAdmin) {
      setError('Solo l’amministratore può invitare nuovi membri');
      return;
    }
    if (inviteEmail.trim()) {
      inviteMutation.mutate(inviteEmail.trim());
    }
  };

  const handleCopyInvite = async (inviteUrl: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(inviteId);
      setTimeout(() => setCopiedInvite(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyAuthCode = async () => {
    const code = user?.authCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedAuthCode(true);
      setTimeout(() => setCopiedAuthCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy auth code:', err);
    }
  };

  const handleCreateApiToken = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedName = apiTokenName.trim();
    if (!normalizedName) {
      setError('Inserisci un nome per il token API');
      return;
    }

    const expiresInDays = Number(apiTokenDays);
    if (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      setError('La durata deve essere compresa tra 1 e 365 giorni');
      return;
    }

    createApiTokenMutation.mutate({
      name: normalizedName,
      expiresInDays: Math.trunc(expiresInDays),
    });
  };

  const handleCopyNewApiToken = async () => {
    if (!newApiToken?.token) return;
    try {
      await navigator.clipboard.writeText(newApiToken.token);
      setCopiedApiToken(true);
      setTimeout(() => setCopiedApiToken(false), 2000);
    } catch (err) {
      console.error('Failed to copy api token:', err);
    }
  };

  const handleDeleteInvite = (id: string) => {
    setPendingInviteDelete(id);
  };

  const handlePasteDeleteFamilyAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setDeleteFamilyAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (err) {
      console.error('Failed to paste auth code:', err);
    }
  };

  const handlePasteBackupAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBackupAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (err) {
      console.error('Failed to paste auth code:', err);
    }
  };

  const handlePasteResetAuthCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setResetAuthCode((text || '').trim().toUpperCase().slice(0, 5));
    } catch (err) {
      console.error('Failed to paste auth code:', err);
    }
  };

  const selectedBackupTargets = Object.entries(backupTargets)
    .filter(([, checked]) => checked)
    .map(([key]) => key);
  const selectedResetTargets = Object.entries(resetTargets)
    .filter(([, checked]) => checked)
    .map(([key]) => key);

  const handleBackupFileSelected = async (file: File | null) => {
    if (!file) {
      setBackupPayload(null);
      setBackupFileName('');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Formato backup non valido');
      }
      setBackupPayload(parsed);
      setBackupFileName(file.name);
    } catch (err: any) {
      setBackupPayload(null);
      setBackupFileName('');
      setError(err?.message || 'File backup non valido');
    }
  };

  const renderCitySuggestions = (
    suggestions: CitySearchResult[] | undefined,
    onSelect: (city: CitySearchResult) => void
  ) => {
    if (!suggestions?.length) return null;
    return (
      <ListGroup className="mt-2">
        {suggestions.map((city) => {
          const key = `${city.name}-${city.latitude}-${city.longitude}-${city.timezone}`;
          return (
            <ListGroup.Item
              key={key}
              action
              as="button"
              type="button"
              onClick={() => onSelect(city)}
              className="py-2"
            >
              <div className="fw-medium">{city.displayName || city.name}</div>
              {city.timezone && <small className="text-muted">{city.timezone}</small>}
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    );
  };

  if (isLoading && hasActiveFamily) {
    return (
      <DashboardLayout>
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">Impostazioni</h2>
        <div className="d-flex align-items-center gap-2">
          {isAdmin && hasActiveFamily && (
            <>
              <Button variant="outline-primary" className="btn-primary-soft" onClick={() => setShowBackupModal(true)}>
                Backup
              </Button>
              <Button variant="outline-danger" className="btn-danger-soft" onClick={() => setShowResetModal(true)}>
                Reset
              </Button>
            </>
          )}
          <Button variant="primary" onClick={() => setShowCreateFamilyModal(true)}>
            Aggiungi Famiglia
          </Button>
        </div>
      </div>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />
      <StatusModal
        show={Boolean(success)}
        variant="success"
        message={success}
        onClose={() => setSuccess('')}
      />

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Riepilogo</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={3}>
                  <div className="fw-bold">Famiglia</div>
                  <div className="text-muted">{family?.name || '—'}</div>
                </Col>
                <Col md={3}>
                  <div className="fw-bold">Ruolo</div>
                  <div className="text-muted">
                    {family?.role ? (family.role === 'admin' ? 'Amministratore' : 'Membro') : '—'}
                  </div>
                </Col>
                <Col md={3}>
                  <div className="fw-bold">Città</div>
                  <div className="text-muted">{family?.cityDisplayName || family?.city || '—'}</div>
                </Col>
                <Col md={3}>
                  <div className="fw-bold">Membri</div>
                  {family?.users && family.users.length > 0 && (
                    <div className="mt-2">
                      {family.users.map((member) => (
                        <div key={member.id} className="text-muted small">
                          {member.id === user?.id ? 'Io' : member.name} ({member.role === 'admin' ? 'Amministratore' : 'Membro'})
                        </div>
                      ))}
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Profilo Utente</Card.Header>
            <Card.Body>
              <Row className="g-3 mb-3">
                <Col md={6}>
                  <div className="fw-bold">Nome</div>
                  <div className="text-muted">{user?.name || '—'}</div>
                </Col>
                <Col md={6}>
                  <div className="fw-bold">Email</div>
                  <div className="text-muted">{user?.email || '—'}</div>
                </Col>
              </Row>
              {isAdmin ? (
                <>
                  <Form.Label className="fw-bold">Codice di autenticazione utente</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={user?.authCode || ''}
                      disabled
                      placeholder="—"
                      className="auth-code-display-soft"
                    />
                    <Button
                      variant="outline-primary"
                      className="btn-primary-soft"
                      onClick={handleCopyAuthCode}
                      disabled={!user?.authCode}
                      title="Copia codice"
                    >
                      {copiedAuthCode ? <FaCheck /> : <FaCopy />}
                    </Button>
                    <Button
                      variant="outline-primary"
                      className="btn-primary-soft"
                      onClick={() => regenerateAuthCodeMutation.mutate()}
                      disabled={regenerateAuthCodeMutation.isPending}
                    >
                      {regenerateAuthCodeMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Rigenera'
                      )}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    È personale per account (stessa email), uguale su tutte le famiglie.
                  </Form.Text>
                </>
              ) : (
                <div className="text-muted">Codice di autenticazione visibile solo agli admin.</div>
              )}

              <hr className="my-4" />

              <div className="d-flex align-items-center gap-2 mb-2">
                <FaKey className="text-success" />
                <div className="fw-bold">Token API per app esterne</div>
              </div>
              <div className="text-muted small mb-3">
                Per browser e web app continui a usare la sessione con cookie. Questi token servono solo per client iOS o integrazioni esterne.
              </div>

              <Form onSubmit={handleCreateApiToken}>
                <Row className="g-2">
                  <Col md={7}>
                    <Form.Control
                      type="text"
                      value={apiTokenName}
                      onChange={(e) => setApiTokenName(e.target.value)}
                      className="placeholder-soft"
                      placeholder="es: ios-antonio-iphone"
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      type="number"
                      min={1}
                      max={365}
                      value={apiTokenDays}
                      onChange={(e) => setApiTokenDays(e.target.value)}
                    />
                  </Col>
                  <Col md={2} className="d-grid">
                    <Button type="submit" variant="primary" disabled={createApiTokenMutation.isPending}>
                      {createApiTokenMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Crea'}
                    </Button>
                  </Col>
                </Row>
                <Form.Text className="text-muted">
                  Inserisci un nome riconoscibile e una durata in giorni. Il token in chiaro viene mostrato una sola volta.
                </Form.Text>
              </Form>

              {newApiToken && (
                <div className="api-token-reveal mt-3">
                  <div className="fw-bold small mb-2">Nuovo token creato</div>
                  <InputGroup>
                    <Form.Control type="text" value={newApiToken.token} readOnly className="api-token-plain" />
                    <Button
                      variant="outline-primary"
                      className="btn-primary-soft"
                      onClick={handleCopyNewApiToken}
                      title="Copia token"
                    >
                      {copiedApiToken ? <FaCheck /> : <FaCopy />}
                    </Button>
                  </InputGroup>
                  <div className="small text-muted mt-2">
                    Scade il {format(parseISO(newApiToken.expiresAt), 'd MMM yyyy', { locale: it })}. Dopo la chiusura di questa schermata non sarà più recuperabile.
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col lg={6}>
          <Card className="mb-4">
            <Card.Header>Modifica Famiglia</Card.Header>
            <Card.Body>
              {!hasActiveFamily ? (
                <div className="text-muted">Seleziona una famiglia attiva per modificarne i dati.</div>
              ) : isAdmin ? (
                <Form onSubmit={(e) => e.preventDefault()}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome Famiglia</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className="placeholder-soft"
                      placeholder={family?.name ? `Attuale: ${family.name}` : 'es: Nome della famiglia'}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      disabled={updateFamilyMutation.isPending || !familyName.trim()}
                      onClick={handleUpdateFamilyName}
                    >
                      {updateFamilyMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Salva'
                      )}
                    </Button>
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Città per meteo</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      value={familyCity}
                      onChange={(e) => {
                        setFamilyCity(e.target.value);
                        setSelectedFamilyCity(null);
                      }}
                      className="placeholder-soft"
                      placeholder={
                        family?.cityDisplayName || family?.city
                          ? `Attuale: ${family?.cityDisplayName || family?.city}`
                          : 'Cerca città...'
                      }
                    />
                    <Button
                      type="button"
                      variant="primary"
                      disabled={updateFamilyMutation.isPending || !familyCity.trim()}
                      onClick={handleUpdateFamilyCity}
                    >
                      {updateFamilyMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Salva'
                      )}
                    </Button>
                  </InputGroup>
                  {renderCitySuggestions(familyCitySearchResults?.results, (city) => {
                    setFamilyCity(city.displayName || city.name);
                    setSelectedFamilyCity(city);
                  })}
                </Form.Group>
              </Form>
              ) : (
                <div className="text-muted">
                  Solo l’amministratore può modificare nome famiglia e città.
                </div>
              )}

            </Card.Body>
          </Card>

          <Card className="mb-4 settings-card">
            <Card.Header>Tutte le famiglie</Card.Header>
            {familiesLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : myFamilies?.families?.length ? (
              <ListGroup variant="flush" className="settings-list">
              {myFamilies.families.map((familyItem) => {
                  const isCurrent = familyItem.id === user?.activeFamilyId;
                  const isOnlyFamily = myFamilies.families.length === 1;
                  return (
                    <ListGroup.Item key={familyItem.id}>
                      <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <div>
                          <div className="fw-medium">
                            {familyItem.name}
                            {isCurrent && (
                              <Badge bg="secondary" className="ms-2">
                                Attiva
                              </Badge>
                            )}
                          </div>
                          <div className="small text-muted">
                            Membri: {familyItem.membersCount} • Ruolo: {familyItem.role === 'admin' ? 'Amministratore' : 'Membro'}
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          {familyItem.role === 'admin' ? (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="btn-danger-soft"
                              onClick={() => {
                                setPendingFamilyDelete({ id: familyItem.id, name: familyItem.name, isActive: isCurrent });
                                if (isCurrent && myFamilies?.families?.length) {
                                  const firstTarget = myFamilies.families.find((f) => f.id !== familyItem.id);
                                  setTargetFamilyId(firstTarget?.id || '');
                                } else {
                                  setTargetFamilyId('');
                                }
                                setDeleteFamilyAuthCode('');
                              }}
                              disabled={deleteFamilyMutation.isPending || isOnlyFamily}
                              title={isOnlyFamily ? 'Non puoi eliminare l\'unica famiglia' : undefined}
                            >
                              Elimina Famiglia
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="btn-danger-soft"
                              onClick={() => {
                                setPendingLeaveFamily({ id: familyItem.id, name: familyItem.name, isActive: isCurrent });
                                setLeaveTargetFamilyId('');
                              }}
                              disabled={leaveFamilyMutation.isPending || isOnlyFamily}
                              title={isOnlyFamily ? 'Non puoi abbandonare l\'unica famiglia' : undefined}
                            >
                              Abbandona
                            </Button>
                          )}
                        </div>
                      </div>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">Nessuna famiglia attiva</Card.Body>
            )}
          </Card>

          <Card className="mb-4 settings-card">
            <Card.Header>Famiglie di cui facevo parte</Card.Header>
            {familiesLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : myFamilies?.formerFamilies?.length ? (
              <ListGroup variant="flush" className="settings-list">
                {myFamilies.formerFamilies.map((familyItem) => (
                  <ListGroup.Item key={familyItem.id}>
                    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                      <div>
                        <div className="fw-medium">{familyItem.name}</div>
                        <div className="small text-muted">
                          Membri: {familyItem.membersCount} • Ruolo precedente: {familyItem.role === 'admin' ? 'Amministratore' : 'Membro'}
                        </div>
                        {(familyItem.creatorName || familyItem.creatorEmail) && (
                          <div className="small text-muted">
                            Creata da: {familyItem.creatorName || 'Utente'}{familyItem.creatorEmail ? ` (${familyItem.creatorEmail})` : ''}
                          </div>
                        )}
                        {familyItem.familyDeletedAt && (
                          <div className="small text-muted">
                            Famiglia eliminata
                            {familyItem.deletedByName || familyItem.deletedByEmail
                              ? ` da ${familyItem.deletedByName || 'utente'}${familyItem.deletedByEmail ? ` (${familyItem.deletedByEmail})` : ''}`
                              : ''}
                          </div>
                        )}
                        {familyItem.isEliminated && (
                          <Badge bg="danger" className="mt-1">
                            Eliminato
                          </Badge>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        {!familyItem.isEliminated && (
                          <>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="btn-primary-soft"
                              onClick={() => rejoinFamilyMutation.mutate(familyItem.id)}
                              disabled={rejoinFamilyMutation.isPending || !familyItem.canRejoin}
                            >
                              Rientra in Famiglia
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="btn-danger-soft"
                              onClick={() => setPendingForgetFamily({ id: familyItem.id, name: familyItem.name })}
                              disabled={forgetFamilyMutation.isPending}
                            >
                              Esci definitivamente
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">Nessuna famiglia nello storico</Card.Body>
            )}
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="mb-4 settings-card">
            <Card.Header>Token API Attivi</Card.Header>
            {apiTokensLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : apiTokens && apiTokens.length > 0 ? (
              <ListGroup variant="flush" className="settings-list">
                {apiTokens.map((token) => (
                  <ListGroup.Item key={token.id}>
                    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                      <div>
                        <div className="fw-medium">{token.name}</div>
                        <div className="small text-muted">
                          Creato il {format(parseISO(token.createdAt), 'd MMM yyyy', { locale: it })}
                          {token.lastUsedAt
                            ? ` • Ultimo uso ${format(parseISO(token.lastUsedAt), 'd MMM yyyy HH:mm', { locale: it })}`
                            : ' • Mai usato'}
                        </div>
                        {token.expiresAt && (
                          <div className="small text-muted">
                            Scade il {format(parseISO(token.expiresAt), 'd MMM yyyy', { locale: it })}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        className="btn-danger-soft"
                        onClick={() => setPendingApiTokenDelete(token)}
                        disabled={revokeApiTokenMutation.isPending}
                      >
                        Revoca
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">
                Nessun token API attivo. Creane uno dal profilo utente per collegare un’app iOS o un client esterno.
              </Card.Body>
            )}
          </Card>

          <Card className="mb-4 settings-card">
            <Card.Header>Membri della Famiglia</Card.Header>
            {family?.users?.length ? (
              <ListGroup variant="flush" className="settings-list">
                {family.users.map((member) => (
                <ListGroup.Item key={member.id} className="family-member-item">
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      roundedCircle
                      width={40}
                      height={40}
                      alt={member.name}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                      style={{ width: 40, height: 40 }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="family-member-details">
                    <div className="fw-medium">
                      {member.name}
                      {member.id === user?.id && (
                        <Badge bg="secondary" className="ms-2">
                          Tu
                        </Badge>
                      )}
                      <Badge bg={member.role === 'admin' ? 'success' : 'secondary'} className="ms-2">
                        {member.role === 'admin' ? 'Amministratore' : 'Membro'}
                      </Badge>
                    </div>
                    <small className="text-muted">{member.email}</small>
                  </div>

                  {isAdmin && member.id !== user?.id && (
                    <div className="ms-auto" style={{ minWidth: 170 }}>
                      <Form.Select
                        size="sm"
                        value={member.role}
                        disabled={updateMemberRoleMutation.isPending}
                        onChange={(e) => {
                          const nextRole = e.target.value as 'admin' | 'member';
                          if (nextRole !== member.role) {
                            updateMemberRoleMutation.mutate({ userId: member.id, role: nextRole });
                          }
                        }}
                      >
                        <option value="admin">Amministratore</option>
                        <option value="member">Membro</option>
                      </Form.Select>
                    </div>
                  )}
                </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">Nessuna famiglia attiva selezionata.</Card.Body>
            )}
          </Card>

          {hasActiveFamily && isAdmin && (
            <Card className="mb-4 settings-card">
              <Card.Header>Storico Membri che Hanno Abbandonato</Card.Header>
              {formerMembersLoading ? (
                <Card.Body className="text-center">
                  <Spinner size="sm" animation="border" variant="success" />
                </Card.Body>
              ) : formerMembers && formerMembers.length > 0 ? (
                <ListGroup variant="flush" className="settings-list">
                  {formerMembers.map((member) => (
                    <ListGroup.Item key={member.id}>
                      <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <div>
                          <div className="fw-medium">{member.name}</div>
                          <div className="small text-muted">
                            {member.email} • Ruolo precedente: {member.previousRole === 'admin' ? 'Amministratore' : 'Membro'}
                          </div>
                          {member.leftAt && (
                            <div className="small text-muted">
                              Uscito il {format(parseISO(member.leftAt), 'd MMM yyyy', { locale: it })}
                            </div>
                          )}
                          {member.status === 'removed' && (
                            <Badge bg="danger" className="mt-1">
                              Eliminato
                            </Badge>
                          )}
                        </div>
                        {member.status !== 'removed' && (
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="btn-primary-soft"
                              onClick={() => rejoinFormerMemberMutation.mutate(member.id)}
                              disabled={rejoinFormerMemberMutation.isPending || !member.canRejoin}
                            >
                              Fai Rientrare
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="btn-danger-soft"
                              onClick={() => removeFormerMemberMutation.mutate(member.id)}
                              disabled={removeFormerMemberMutation.isPending}
                            >
                              Rimuovi definitivamente
                            </Button>
                          </div>
                        )}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Card.Body className="text-muted">Nessun membro ha abbandonato questa famiglia.</Card.Body>
              )}
            </Card>
          )}

          {!hasActiveFamily ? (
            <Card className="mb-4">
              <Card.Header>Inviti</Card.Header>
              <Card.Body className="text-muted">
                Seleziona una famiglia attiva per gestire inviti e membri.
              </Card.Body>
            </Card>
          ) : !isAdmin ? (
            <Card className="mb-4">
              <Card.Header>Inviti</Card.Header>
              <Card.Body className="text-muted">
                Solo l’amministratore può invitare nuovi membri.
              </Card.Body>
            </Card>
          ) : (
          <Card className="mb-4">
            <Card.Header>Invita Membri</Card.Header>
            <Card.Body>
              <Form onSubmit={handleInvite}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaEnvelope />
                    </InputGroup.Text>
                    <Form.Control
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="placeholder-soft"
                      placeholder="es: email@esempio.com"
                      required
                    />
                    <Button type="submit" variant="primary" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Invita'
                      )}
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    L'invitato riceverà un link per unirsi alla famiglia
                  </Form.Text>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
          )}

          {isAdmin && (
            <Card className="settings-card">
            <Card.Header>Inviti Pendenti</Card.Header>
            {invitesLoading ? (
              <Card.Body className="text-center">
                <Spinner size="sm" animation="border" variant="success" />
              </Card.Body>
            ) : invites && invites.length > 0 ? (
              <ListGroup variant="flush" className="settings-list">
                {invites.map((invite) => (
                  <ListGroup.Item key={invite.id}>
                    <div className="invite-item">
                      <div className="invite-item-text">
                        <div className="fw-medium">{invite.email}</div>
                        <small className="text-muted">
                          Scade il{' '}
                          {format(parseISO(invite.expiresAt), 'd MMM yyyy', { locale: it })}
                        </small>
                      </div>
                      <div className="invite-item-actions">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1 btn-primary-soft"
                          onClick={() =>
                            handleCopyInvite(
                              invite.inviteUrl ??
                                `${window.location.origin}/invite/${invite.token ?? invite.id}`,
                              invite.id
                            )
                          }
                          title="Copia link"
                        >
                          {copiedInvite === invite.id ? <FaCheck /> : <FaCopy />}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="btn-danger-soft"
                          onClick={() => handleDeleteInvite(invite.id)}
                          title="Annulla invito"
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <Card.Body className="text-muted">Nessun invito pendente</Card.Body>
            )}
          </Card>
          )}
        </Col>
      </Row>

      <Modal
        show={showBackupModal}
        onHide={() => {
          if (exportBackupMutation.isPending || restoreBackupMutation.isPending) return;
          setShowBackupModal(false);
          setBackupAuthCode('');
          setBackupPayload(null);
          setBackupFileName('');
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Backup & Restore</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <div className="fw-bold mb-2">Backup</div>
            <div className="text-muted small mb-2">
              Esporta un file JSON completo della famiglia attiva (pianificazione, chat, piatti, spesa, inviti, notifiche).
            </div>
            <Button
              variant="outline-primary"
              className="btn-primary-soft"
              onClick={() => exportBackupMutation.mutate()}
              disabled={exportBackupMutation.isPending}
            >
              {exportBackupMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Scarica Backup'}
            </Button>
          </div>

          <hr />

          <div>
            <div className="fw-bold mb-2">Restore</div>
            <div className="text-muted small mb-2">
              Carica un backup JSON e scegli cosa ripristinare. Il restore sostituisce i dati attuali delle sezioni selezionate.
            </div>
            <Form.Group className="mb-3">
              <Form.Label>File backup</Form.Label>
              <Form.Control
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleBackupFileSelected((e.target as HTMLInputElement).files?.[0] || null)}
              />
              {backupFileName && (
                <Form.Text className="text-muted">File caricato: {backupFileName}</Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Sezioni da ripristinare</Form.Label>
              {resetOptions.map((opt) => (
                <Form.Check
                  key={`backup-${opt.key}`}
                  type="checkbox"
                  id={`backup-${opt.key}`}
                  label={`${opt.label} (${opt.hint})`}
                  checked={backupTargets[opt.key]}
                  onChange={(e) =>
                    setBackupTargets((prev) => ({
                      ...prev,
                      [opt.key]: e.target.checked,
                    }))
                  }
                  className="mb-1"
                />
              ))}
            </Form.Group>

            <Form.Group controlId="backupRestoreAuthCode">
              <Form.Label>Codice di autenticazione</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="es: A1B2C"
                  maxLength={5}
                  value={backupAuthCode}
                  onChange={(e) => setBackupAuthCode(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline-primary"
                  className="btn-primary-soft"
                  onClick={handlePasteBackupAuthCode}
                  title="Incolla codice"
                >
                  <FaPaste />
                </Button>
              </InputGroup>
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => {
              setShowBackupModal(false);
              setBackupAuthCode('');
              setBackupPayload(null);
              setBackupFileName('');
            }}
            disabled={restoreBackupMutation.isPending || exportBackupMutation.isPending}
          >
            Chiudi
          </Button>
          <Button
            variant="primary"
            disabled={
              restoreBackupMutation.isPending ||
              !backupPayload ||
              !selectedBackupTargets.length ||
              !/^[A-Z0-9]{5}$/.test(backupAuthCode.trim().toUpperCase())
            }
            onClick={() =>
              restoreBackupMutation.mutate({
                backup: backupPayload,
                targets: selectedBackupTargets,
                authCode: backupAuthCode.trim().toUpperCase(),
              })
            }
          >
            {restoreBackupMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Restore Backup'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showResetModal}
        onHide={() => {
          if (resetDataMutation.isPending) return;
          setShowResetModal(false);
          setResetAuthCode('');
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Reset Dati Famiglia</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted small mb-3">
            Consiglio: usa prima il backup. Il reset svuota in modo definitivo le sezioni selezionate.
          </div>
          <Form.Group className="mb-3">
            <Form.Label>Cosa vuoi svuotare</Form.Label>
            {resetOptions.map((opt) => (
              <Form.Check
                key={`reset-${opt.key}`}
                type="checkbox"
                id={`reset-${opt.key}`}
                label={`${opt.label} (${opt.hint})`}
                checked={resetTargets[opt.key]}
                onChange={(e) =>
                  setResetTargets((prev) => ({
                    ...prev,
                    [opt.key]: e.target.checked,
                  }))
                }
                className="mb-1"
              />
            ))}
          </Form.Group>

          <Form.Group controlId="resetFamilyDataAuthCode">
            <Form.Label>Codice di autenticazione</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="es: A1B2C"
                maxLength={5}
                value={resetAuthCode}
                onChange={(e) => setResetAuthCode(e.target.value)}
              />
              <Button
                type="button"
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={handlePasteResetAuthCode}
                title="Incolla codice"
              >
                <FaPaste />
              </Button>
            </InputGroup>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => {
              setShowResetModal(false);
              setResetAuthCode('');
            }}
            disabled={resetDataMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={
              resetDataMutation.isPending ||
              !selectedResetTargets.length ||
              !/^[A-Z0-9]{5}$/.test(resetAuthCode.trim().toUpperCase())
            }
            onClick={() =>
              resetDataMutation.mutate({
                targets: selectedResetTargets,
                authCode: resetAuthCode.trim().toUpperCase(),
              })
            }
          >
            {resetDataMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Esegui Reset'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingInviteDelete)}
        message="Annullare questo invito?"
        onCancel={() => setPendingInviteDelete(null)}
        requireAuthCode
        onConfirm={(authCode) => {
          if (pendingInviteDelete) {
            deleteInviteMutation.mutate({ id: pendingInviteDelete, authCode: authCode || '' });
          }
          setPendingInviteDelete(null);
        }}
      />

      <Modal
        show={Boolean(pendingFamilyDelete)}
        onHide={() => {
          if (deleteFamilyMutation.isPending) return;
          setPendingFamilyDelete(null);
          setTargetFamilyId('');
          setDeleteFamilyAuthCode('');
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Elimina Famiglia</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            Eliminare la famiglia &quot;{pendingFamilyDelete?.name}&quot; e tutti i suoi dati/membri?
          </div>
          {pendingFamilyDelete?.isActive && myFamilies?.families && myFamilies.families.length > 1 && (
            <Form.Group className="mb-3">
              <Form.Label>Su quale famiglia vuoi spostarti?</Form.Label>
              <Form.Select
                value={targetFamilyId}
                onChange={(e) => setTargetFamilyId(e.target.value)}
              >
                <option value="">Seleziona una famiglia...</option>
                {myFamilies.families
                  .filter((f) => f.id !== pendingFamilyDelete.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group controlId="deleteFamilyAuthCode">
            <Form.Label>Codice di autenticazione</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                inputMode="text"
                autoComplete="off"
                id="deleteFamilyAuthCodeInput"
                placeholder="es: A1B2C"
                maxLength={5}
                value={deleteFamilyAuthCode}
                onChange={(e) => setDeleteFamilyAuthCode(e.target.value)}
              />
              <Button
                type="button"
                variant="outline-primary"
                className="btn-primary-soft"
                onClick={handlePasteDeleteFamilyAuthCode}
                title="Incolla codice"
              >
                <FaPaste />
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Inserisci il codice a 5 caratteri per confermare.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => {
              setPendingFamilyDelete(null);
              setTargetFamilyId('');
              setDeleteFamilyAuthCode('');
            }}
            disabled={deleteFamilyMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={
              deleteFamilyMutation.isPending ||
              !/^[A-Z0-9]{5}$/.test(deleteFamilyAuthCode.trim().toUpperCase()) ||
              (pendingFamilyDelete?.isActive && myFamilies?.families && myFamilies.families.length > 1 && !targetFamilyId)
            }
            onClick={() => {
              const authCode = deleteFamilyAuthCode.trim().toUpperCase();
              if (pendingFamilyDelete && /^[A-Z0-9]{5}$/.test(authCode)) {
                deleteFamilyMutation.mutate({
                  familyId: pendingFamilyDelete.id,
                  authCode,
                  targetFamilyId: pendingFamilyDelete.isActive ? targetFamilyId : undefined,
                });
                setPendingFamilyDelete(null);
                setTargetFamilyId('');
                setDeleteFamilyAuthCode('');
              }
            }}
          >
            {deleteFamilyMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Elimina Famiglia'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={Boolean(pendingLeaveFamily)}
        onHide={() => {
          if (leaveFamilyMutation.isPending) return;
          setPendingLeaveFamily(null);
          setLeaveTargetFamilyId('');
        }}
        centered
        dialogClassName="app-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Abbandona Famiglia</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            Abbandonare la famiglia &quot;{pendingLeaveFamily?.name}&quot;?
          </div>
          {pendingLeaveFamily?.isActive && myFamilies?.families && myFamilies.families.length > 1 && (
            <Form.Group className="mb-2">
              <Form.Label>Seleziona la famiglia su cui vuoi passare</Form.Label>
              <Form.Select
                value={leaveTargetFamilyId}
                onChange={(e) => setLeaveTargetFamilyId(e.target.value)}
              >
                <option value="">Seleziona una famiglia...</option>
                {myFamilies.families
                  .filter((f) => f.id !== pendingLeaveFamily.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            className="btn-danger-soft"
            onClick={() => {
              setPendingLeaveFamily(null);
              setLeaveTargetFamilyId('');
            }}
            disabled={leaveFamilyMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            disabled={
              leaveFamilyMutation.isPending ||
              (pendingLeaveFamily?.isActive && myFamilies?.families && myFamilies.families.length > 1 && !leaveTargetFamilyId)
            }
            onClick={() => {
              if (!pendingLeaveFamily) return;
              leaveFamilyMutation.mutate({
                familyId: pendingLeaveFamily.id,
                targetFamilyId: pendingLeaveFamily.isActive ? leaveTargetFamilyId : undefined,
              });
              setPendingLeaveFamily(null);
              setLeaveTargetFamilyId('');
            }}
          >
            {leaveFamilyMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Abbandona'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={Boolean(pendingForgetFamily)}
        message={`Rimuovere definitivamente "${pendingForgetFamily?.name}" dallo storico?`}
        onCancel={() => setPendingForgetFamily(null)}
        confirmLabel="Rimuovi"
        onConfirm={() => {
          if (pendingForgetFamily) {
            forgetFamilyMutation.mutate(pendingForgetFamily.id);
          }
          setPendingForgetFamily(null);
        }}
      />

      <ConfirmModal
        show={Boolean(pendingApiTokenDelete)}
        message={
          pendingApiTokenDelete
            ? `Revocare il token API "${pendingApiTokenDelete.name}"? Smetterà subito di funzionare su tutte le app che lo usano.`
            : ''
        }
        onCancel={() => setPendingApiTokenDelete(null)}
        confirmLabel="Revoca"
        onConfirm={() => {
          if (pendingApiTokenDelete) {
            revokeApiTokenMutation.mutate(pendingApiTokenDelete.id);
          }
        }}
      />

      <Modal
        show={showCreateFamilyModal}
        onHide={() => {
          if (createFamilyMutation.isPending) return;
          setShowCreateFamilyModal(false);
          setNewFamilyCity('');
          setSelectedNewFamilyCity(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Aggiungi Famiglia</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (!newFamilyName.trim()) {
                setError('Inserisci il nome della nuova famiglia');
                return;
              }
              createFamilyMutation.mutate({
                name: newFamilyName.trim(),
                city: selectedNewFamilyCity?.name || newFamilyCity.trim() || undefined,
                citySelection: selectedNewFamilyCity
                  ? {
                      name: selectedNewFamilyCity.name,
                      displayName: selectedNewFamilyCity.displayName,
                      country: selectedNewFamilyCity.country,
                      timezone: selectedNewFamilyCity.timezone,
                      latitude: selectedNewFamilyCity.latitude,
                      longitude: selectedNewFamilyCity.longitude,
                    }
                  : undefined,
                switchToNewFamily: false,
              });
            }}
          >
            <Form.Group className="mb-3">
              <Form.Label>Nome Famiglia</Form.Label>
              <Form.Control
                type="text"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                className="placeholder-soft"
                placeholder="es: Famiglia Bianchi"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Città</Form.Label>
              <Form.Control
                type="text"
                value={newFamilyCity}
                onChange={(e) => {
                  setNewFamilyCity(e.target.value);
                  setSelectedNewFamilyCity(null);
                }}
                className="placeholder-soft"
                placeholder="Cerca città..."
              />
              {renderCitySuggestions(newFamilyCitySearchResults?.results, (city) => {
                setNewFamilyCity(city.displayName || city.name);
                setSelectedNewFamilyCity(city);
              })}
            </Form.Group>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button
                variant="outline-danger"
                className="btn-danger-soft"
                onClick={() => {
                  setShowCreateFamilyModal(false);
                  setNewFamilyCity('');
                  setSelectedNewFamilyCity(null);
                }}
                disabled={createFamilyMutation.isPending}
              >
                Annulla
              </Button>
              <Button type="submit" variant="primary" disabled={createFamilyMutation.isPending}>
                {createFamilyMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Crea Famiglia'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </DashboardLayout>
  );
}
