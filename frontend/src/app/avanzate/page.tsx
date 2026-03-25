'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Row, Table } from 'react-bootstrap';
import { addDays, format, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { advancedApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

function toWeekStart(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export default function AvanzatePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rotationWindowDays, setRotationWindowDays] = useState(7);
  const [maxWeeklyDishRepeat, setMaxWeeklyDishRepeat] = useState(2);
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [eventModeTitle, setEventModeTitle] = useState('');
  const [eventModeStart, setEventModeStart] = useState('');
  const [eventModeEnd, setEventModeEnd] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateWeek, setTemplateWeek] = useState(toWeekStart(new Date()));
  const [applyWeek, setApplyWeek] = useState(toWeekStart(addDays(new Date(), 7)));
  const [pantryName, setPantryName] = useState('');
  const [pantryQty, setPantryQty] = useState('');
  const [pantryUnit, setPantryUnit] = useState('');
  const [pantryExpiresAt, setPantryExpiresAt] = useState('');
  const [costWeek, setCostWeek] = useState(toWeekStart(new Date()));

  const { data: overview } = useQuery({
    queryKey: ['advanced', 'overview'],
    queryFn: advancedApi.overview,
  });

  const { data: templates } = useQuery({
    queryKey: ['advanced', 'templates'],
    queryFn: advancedApi.listTemplates,
  });

  const { data: pantryItems } = useQuery({
    queryKey: ['advanced', 'pantry'],
    queryFn: advancedApi.pantryList,
  });

  const { data: pantrySuggestions } = useQuery({
    queryKey: ['advanced', 'pantry-suggestions'],
    queryFn: advancedApi.pantrySuggestions,
  });

  const { data: roleMembers } = useQuery({
    queryKey: ['advanced', 'roles'],
    queryFn: advancedApi.listRoles,
    enabled: isAdmin,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['advanced', 'audit'],
    queryFn: () => advancedApi.listAudit(60),
  });

  const { data: weeklyCosts } = useQuery({
    queryKey: ['advanced', 'costs', costWeek],
    queryFn: () => advancedApi.weeklyCosts(costWeek),
  });

  useEffect(() => {
    if (!overview?.family) return;
    setRotationWindowDays(overview.family.rotationWindowDays || 7);
    setMaxWeeklyDishRepeat(overview.family.maxWeeklyDishRepeat || 2);
    setEventModeEnabled(Boolean(overview.family.eventModeEnabled));
    setEventModeTitle(overview.family.eventModeTitle || '');
    setEventModeStart(overview.family.eventModeStart ? format(new Date(overview.family.eventModeStart), 'yyyy-MM-dd') : '');
    setEventModeEnd(overview.family.eventModeEnd ? format(new Date(overview.family.eventModeEnd), 'yyyy-MM-dd') : '');
  }, [overview]);

  const remindersMutation = useMutation({
    mutationFn: advancedApi.runReminders,
    onSuccess: (data) => {
      setMessage(`Promemoria generati: ${data.created}`);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const configMutation = useMutation({
    mutationFn: advancedApi.updateFamilyConfig,
    onSuccess: () => {
      setMessage('Configurazione rotazione aggiornata');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'overview'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const eventMutation = useMutation({
    mutationFn: advancedApi.updateEventMode,
    onSuccess: () => {
      setMessage('Modalità evento aggiornata');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['family'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createTemplateMutation = useMutation({
    mutationFn: advancedApi.createTemplate,
    onSuccess: () => {
      setMessage('Template creato');
      setTemplateName('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'templates'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: ({ templateId, overwrite }: { templateId: string; overwrite: boolean }) =>
      advancedApi.applyTemplate(templateId, { targetWeekStart: applyWeek, overwrite }),
    onSuccess: (data) => {
      setMessage(`Template applicato: ${data.created} slot`);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['advanced', 'audit'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: advancedApi.deleteTemplate,
    onSuccess: () => {
      setMessage('Template eliminato');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'templates'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createPantryMutation = useMutation({
    mutationFn: advancedApi.pantryCreate,
    onSuccess: () => {
      setMessage('Ingrediente dispensa aggiunto');
      setError('');
      setPantryName('');
      setPantryQty('');
      setPantryUnit('');
      setPantryExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'pantry'] });
      queryClient.invalidateQueries({ queryKey: ['advanced', 'pantry-suggestions'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deletePantryMutation = useMutation({
    mutationFn: advancedApi.pantryDelete,
    onSuccess: () => {
      setMessage('Ingrediente rimosso');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'pantry'] });
      queryClient.invalidateQueries({ queryKey: ['advanced', 'pantry-suggestions'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const buildShoppingMutation = useMutation({
    mutationFn: advancedApi.buildShoppingFromPlanning,
    onSuccess: (data) => {
      setMessage(`Lista spesa rigenerata (${data.items} ingredienti)`);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      canManagePlanning,
      canManageShopping,
      canModerateChat,
      isReadOnly,
    }: {
      userId: string;
      canManagePlanning: boolean;
      canManageShopping: boolean;
      canModerateChat: boolean;
      isReadOnly: boolean;
    }) => advancedApi.updateRolePermissions(userId, { canManagePlanning, canManageShopping, canModerateChat, isReadOnly }),
    onSuccess: () => {
      setMessage('Permessi aggiornati');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['advanced', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['family'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <DashboardLayout>
      <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h2 className="mb-1">Funzionalità Avanzate</h2>
          <small className="text-muted">Template, rotazione, dispensa, costi, ruoli avanzati, audit</small>
        </div>
        <Button
          className="btn-soft-primary"
          onClick={() => remindersMutation.mutate()}
          disabled={remindersMutation.isPending}
        >
          Esegui Promemoria Intelligenti
        </Button>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Rotazione Automatizzata</Card.Title>
              <Form.Group className="mb-2">
                <Form.Label>Finestra anti-ripetizione (giorni)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={30}
                  value={rotationWindowDays}
                  onChange={(e) => setRotationWindowDays(Number(e.target.value || 7))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Max ripetizioni settimanali stesso piatto</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={14}
                  value={maxWeeklyDishRepeat}
                  onChange={(e) => setMaxWeeklyDishRepeat(Number(e.target.value || 2))}
                />
              </Form.Group>
              <Button
                className="btn-soft-success"
                disabled={!isAdmin || configMutation.isPending}
                onClick={() => configMutation.mutate({ rotationWindowDays, maxWeeklyDishRepeat })}
              >
                Salva Rotazione
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Modalità Evento</Card.Title>
              <Form.Check
                type="switch"
                id="event-enabled"
                label="Attiva settimana speciale"
                checked={eventModeEnabled}
                onChange={(e) => setEventModeEnabled(e.target.checked)}
              />
              <Form.Group className="mt-2">
                <Form.Label>Titolo</Form.Label>
                <Form.Control value={eventModeTitle} onChange={(e) => setEventModeTitle(e.target.value)} />
              </Form.Group>
              <Row className="g-2 mt-1">
                <Col>
                  <Form.Control type="date" value={eventModeStart} onChange={(e) => setEventModeStart(e.target.value)} />
                </Col>
                <Col>
                  <Form.Control type="date" value={eventModeEnd} onChange={(e) => setEventModeEnd(e.target.value)} />
                </Col>
              </Row>
              <Button
                className="btn-soft-success mt-3"
                disabled={!isAdmin || eventMutation.isPending}
                onClick={() =>
                  eventMutation.mutate({
                    enabled: eventModeEnabled,
                    title: eventModeTitle,
                    start: eventModeStart,
                    end: eventModeEnd,
                  })
                }
              >
                Salva Evento
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Contatori Rapidi</Card.Title>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between">
                  Template <Badge bg="primary">{overview?.counters.templates ?? 0}</Badge>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  Dispensa <Badge bg="info">{overview?.counters.pantryItems ?? 0}</Badge>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  Inviti pendenti <Badge bg="warning">{overview?.counters.pendingInvites ?? 0}</Badge>
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Template Settimanali</Card.Title>
              <Row className="g-2 mb-3">
                <Col md={5}>
                  <Form.Control
                    placeholder="Nome template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </Col>
                <Col md={4}>
                  <Form.Control type="date" value={templateWeek} onChange={(e) => setTemplateWeek(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Button
                    className="btn-soft-success w-100"
                    disabled={!templateName.trim() || createTemplateMutation.isPending}
                    onClick={() => createTemplateMutation.mutate({ name: templateName.trim(), weekStart: templateWeek })}
                  >
                    Crea
                  </Button>
                </Col>
              </Row>

              <Form.Group className="mb-2">
                <Form.Label>Settimana destinazione</Form.Label>
                <Form.Control type="date" value={applyWeek} onChange={(e) => setApplyWeek(e.target.value)} />
              </Form.Group>

              <ListGroup variant="flush">
                {(templates || []).map((template) => (
                  <ListGroup.Item key={template.id} className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <div>
                      <strong>{template.name}</strong>
                      <div className="text-muted small">{template.items.length} slot salvati</div>
                    </div>
                    <div className="d-flex gap-2">
                      <Button size="sm" className="btn-soft-success" onClick={() => applyTemplateMutation.mutate({ templateId: template.id, overwrite: false })}>
                        Applica
                      </Button>
                      <Button size="sm" className="btn-soft-primary" onClick={() => applyTemplateMutation.mutate({ templateId: template.id, overwrite: true })}>
                        Sovrascrivi
                      </Button>
                      <Button size="sm" className="btn-soft-danger" onClick={() => deleteTemplateMutation.mutate(template.id)}>
                        Elimina
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Dispensa di Famiglia</Card.Title>
              <Row className="g-2 mb-3">
                <Col md={4}>
                  <Form.Control placeholder="Ingrediente" value={pantryName} onChange={(e) => setPantryName(e.target.value)} />
                </Col>
                <Col md={2}>
                  <Form.Control placeholder="Qtà" value={pantryQty} onChange={(e) => setPantryQty(e.target.value)} />
                </Col>
                <Col md={2}>
                  <Form.Control placeholder="Unità" value={pantryUnit} onChange={(e) => setPantryUnit(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Control type="date" value={pantryExpiresAt} onChange={(e) => setPantryExpiresAt(e.target.value)} />
                </Col>
                <Col md={1}>
                  <Button
                    className="btn-soft-success w-100"
                    disabled={!pantryName.trim() || createPantryMutation.isPending}
                    onClick={() =>
                      createPantryMutation.mutate({
                        name: pantryName.trim(),
                        quantity: pantryQty,
                        unit: pantryUnit,
                        expiresAt: pantryExpiresAt || undefined,
                      })
                    }
                  >
                    +
                  </Button>
                </Col>
              </Row>

              <ListGroup className="mb-3">
                {(pantryItems || []).map((item) => (
                  <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <strong>{item.name}</strong>{' '}
                      <span className="text-muted">
                        {item.quantity || ''} {item.unit || ''}
                      </span>
                      {item.expiresAt && (
                        <div className="small text-muted">Scade il {format(new Date(item.expiresAt), 'dd/MM/yyyy', { locale: it })}</div>
                      )}
                    </div>
                    <Button size="sm" className="btn-soft-danger" onClick={() => deletePantryMutation.mutate(item.id)}>
                      Rimuovi
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>

              <div>
                <strong>Suggeriti da ingredienti in scadenza</strong>
                <ListGroup className="mt-2">
                  {(pantrySuggestions || []).map((dish) => (
                    <ListGroup.Item key={dish.id} className="d-flex justify-content-between">
                      <span>{dish.name}</span>
                      <Badge bg="info">match {dish.matchCount}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Lista Spesa e Costi</Card.Title>
              <Row className="g-2 align-items-end mb-3">
                <Col md={6}>
                  <Form.Label>Settimana</Form.Label>
                  <Form.Control type="date" value={costWeek} onChange={(e) => setCostWeek(e.target.value)} />
                </Col>
                <Col md={6}>
                  <Button className="btn-soft-success w-100" onClick={() => buildShoppingMutation.mutate(costWeek)}>
                    Rigenera Spesa da Pianificazione
                  </Button>
                </Col>
              </Row>

              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>Settimana</th>
                    <th>Pasti</th>
                    <th>Costo stimato</th>
                  </tr>
                </thead>
                <tbody>
                  {(weeklyCosts || []).map((week) => (
                    <tr key={week.weekStart}>
                      <td>{week.weekStart}</td>
                      <td>{week.meals}</td>
                      <td>{week.estimatedCost.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="bubble-card h-100">
            <Card.Body>
              <Card.Title>Ruoli Avanzati</Card.Title>
              {!isAdmin ? (
                <Alert variant="warning" className="mb-0">Solo amministratore</Alert>
              ) : (
                <Table size="sm" responsive bordered>
                  <thead>
                    <tr>
                      <th>Membro</th>
                      <th>Ruolo</th>
                      <th>Pianif.</th>
                      <th>Spesa</th>
                      <th>Chat</th>
                      <th>ReadOnly</th>
                      <th>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(roleMembers || []).map((member) => (
                      <RoleRow key={member.userId} member={member} onSave={updateRoleMutation.mutate} disabled={member.role === 'admin'} />
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="bubble-card">
        <Card.Body>
          <Card.Title>Audit Timeline</Card.Title>
          <ListGroup>
            {(auditLogs || []).map((log) => (
              <ListGroup.Item key={log.id}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <strong>{log.action}</strong> · {log.entityType}
                    <div className="small text-muted">{log.user?.name || 'Sistema'} · {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: it })}</div>
                  </div>
                  <Badge bg="secondary">{log.entityId ? log.entityId.slice(0, 8) : '-'}</Badge>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
    </DashboardLayout>
  );
}

function RoleRow({
  member,
  onSave,
  disabled,
}: {
  member: {
    userId: string;
    name: string;
    email: string;
    role: 'admin' | 'member';
    canManagePlanning: boolean;
    canManageShopping: boolean;
    canModerateChat: boolean;
    isReadOnly: boolean;
  };
  onSave: (data: {
    userId: string;
    canManagePlanning: boolean;
    canManageShopping: boolean;
    canModerateChat: boolean;
    isReadOnly: boolean;
  }) => void;
  disabled: boolean;
}) {
  const [canManagePlanning, setCanManagePlanning] = useState(member.canManagePlanning);
  const [canManageShopping, setCanManageShopping] = useState(member.canManageShopping);
  const [canModerateChat, setCanModerateChat] = useState(member.canModerateChat);
  const [isReadOnly, setIsReadOnly] = useState(member.isReadOnly);

  return (
    <tr>
      <td>
        <div>{member.name}</div>
        <small className="text-muted">{member.email}</small>
      </td>
      <td>{member.role === 'admin' ? 'Amministratore' : 'Membro'}</td>
      <td>
        <Form.Check disabled={disabled} checked={canManagePlanning} onChange={(e) => setCanManagePlanning(e.target.checked)} />
      </td>
      <td>
        <Form.Check disabled={disabled} checked={canManageShopping} onChange={(e) => setCanManageShopping(e.target.checked)} />
      </td>
      <td>
        <Form.Check disabled={disabled} checked={canModerateChat} onChange={(e) => setCanModerateChat(e.target.checked)} />
      </td>
      <td>
        <Form.Check disabled={disabled} checked={isReadOnly} onChange={(e) => setIsReadOnly(e.target.checked)} />
      </td>
      <td>
        <Button
          size="sm"
          className="btn-soft-primary"
          disabled={disabled}
          onClick={() => onSave({ userId: member.userId, canManagePlanning, canManageShopping, canModerateChat, isReadOnly })}
        >
          Salva
        </Button>
      </td>
    </tr>
  );
}
