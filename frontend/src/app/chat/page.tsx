'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { chatApi, familyApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import StatusModal from '@/components/StatusModal';

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [familyContent, setFamilyContent] = useState('');
  const [isFamilyChatCollapsed, setIsFamilyChatCollapsed] = useState(false);
  const [manualThreadMemberIds, setManualThreadMemberIds] = useState<string[]>([]);
  const [hiddenThreadMemberIds, setHiddenThreadMemberIds] = useState<string[]>([]);
  const [privateDraftByMemberId, setPrivateDraftByMemberId] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const familyMessagesRef = useRef<HTMLDivElement | null>(null);
  const privateMessagesRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: familyApi.get,
    enabled: Boolean(user?.activeFamilyId),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: () => chatApi.listMessages(200),
    enabled: Boolean(user?.activeFamilyId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const sendFamilyMessageMutation = useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(text),
    onSuccess: () => {
      setFamilyContent('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sendPrivateMessageMutation = useMutation({
    mutationFn: ({ text, recipientId }: { text: string; recipientId: string }) =>
      chatApi.sendMessage(text, recipientId),
    onSuccess: (_, vars) => {
      setPrivateDraftByMemberId((prev) => ({
        ...prev,
        [vars.recipientId]: '',
      }));
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const sortedMessages = useMemo(
    () =>
      [...(messages ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  const familyMembers = useMemo(() => family?.users ?? [], [family]);
  const otherMembers = useMemo(
    () => familyMembers.filter((member) => member.id !== user?.id),
    [familyMembers, user?.id]
  );

  const familyChatMessages = useMemo(
    () => sortedMessages.filter((message) => !message.recipientUserId),
    [sortedMessages]
  );

  const privateMessages = useMemo(
    () => sortedMessages.filter((message) => Boolean(message.recipientUserId)),
    [sortedMessages]
  );

  const privateThreadMemberIdsFromMessages = useMemo(() => {
    const me = user?.id;
    if (!me) return [] as string[];

    const ids = new Set<string>();
    for (const message of privateMessages) {
      const senderId = message.senderUserId;
      const recipientId = message.recipientUserId;
      if (!senderId || !recipientId) continue;

      if (senderId === me && recipientId !== me) {
        ids.add(recipientId);
      } else if (recipientId === me && senderId !== me) {
        ids.add(senderId);
      }
    }

    return Array.from(ids);
  }, [privateMessages, user?.id]);

  const privateThreadMessagesByMemberId = useMemo(() => {
    const me = user?.id;
    const grouped: Record<string, typeof privateMessages> = {};

    if (!me) return grouped;

    for (const message of privateMessages) {
      const senderId = message.senderUserId;
      const recipientId = message.recipientUserId;
      if (!senderId || !recipientId) continue;

      let otherMemberId: string | null = null;
      if (senderId === me) {
        otherMemberId = recipientId;
      } else if (recipientId === me) {
        otherMemberId = senderId;
      }

      if (!otherMemberId) continue;
      if (!grouped[otherMemberId]) grouped[otherMemberId] = [];
      grouped[otherMemberId].push(message);
    }

    return grouped;
  }, [privateMessages, user?.id]);

  const threadMembersSet = useMemo(() => {
    const set = new Set(privateThreadMemberIdsFromMessages);
    for (const memberId of manualThreadMemberIds) {
      set.add(memberId);
    }
    return set;
  }, [manualThreadMemberIds, privateThreadMemberIdsFromMessages]);

  const visibleThreadMembersSet = useMemo(() => {
    const set = new Set(threadMembersSet);
    for (const hiddenId of hiddenThreadMemberIds) {
      set.delete(hiddenId);
    }
    return set;
  }, [hiddenThreadMemberIds, threadMembersSet]);

  const privateThreadMembers = useMemo(() => {
    const membersById = new Map(otherMembers.map((member) => [member.id, member]));
    const latestByMemberId = new Map<string, number>();

    for (const [memberId, threadMessages] of Object.entries(privateThreadMessagesByMemberId)) {
      const lastMessage = threadMessages[threadMessages.length - 1];
      latestByMemberId.set(memberId, new Date(lastMessage.createdAt).getTime());
    }

    return Array.from(visibleThreadMembersSet)
      .map((memberId) => membersById.get(memberId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .sort((a, b) => (latestByMemberId.get(b.id) ?? 0) - (latestByMemberId.get(a.id) ?? 0));
  }, [otherMembers, privateThreadMessagesByMemberId, visibleThreadMembersSet]);

  const privateThreadSignature = useMemo(
    () =>
      privateThreadMembers
        .map((member) => `${member.id}:${privateThreadMessagesByMemberId[member.id]?.length || 0}`)
        .join('|'),
    [privateThreadMembers, privateThreadMessagesByMemberId]
  );

  useEffect(() => {
    const validIds = new Set(otherMembers.map((member) => member.id));
    setManualThreadMemberIds((prev) => prev.filter((memberId) => validIds.has(memberId)));
    setHiddenThreadMemberIds((prev) => prev.filter((memberId) => validIds.has(memberId)));
  }, [otherMembers]);

  const hiddenStorageKey = useMemo(
    () => (user?.id && user?.activeFamilyId ? `chat:hidden-threads:${user.id}:${user.activeFamilyId}` : null),
    [user?.activeFamilyId, user?.id]
  );

  useEffect(() => {
    if (!hiddenStorageKey || typeof window === 'undefined') {
      setHiddenThreadMemberIds([]);
      return;
    }

    const raw = window.localStorage.getItem(hiddenStorageKey);
    if (!raw) {
      setHiddenThreadMemberIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHiddenThreadMemberIds(parsed.filter((entry) => typeof entry === 'string'));
      } else {
        setHiddenThreadMemberIds([]);
      }
    } catch {
      setHiddenThreadMemberIds([]);
    }
  }, [hiddenStorageKey]);

  useEffect(() => {
    if (!hiddenStorageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(hiddenStorageKey, JSON.stringify(hiddenThreadMemberIds));
  }, [hiddenStorageKey, hiddenThreadMemberIds]);

  useEffect(() => {
    const node = familyMessagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [familyChatMessages.length]);

  useEffect(() => {
    for (const member of privateThreadMembers) {
      const node = privateMessagesRefs.current[member.id];
      if (!node) continue;
      node.scrollTop = node.scrollHeight;
    }
  }, [privateThreadMembers, privateThreadSignature]);

  const submitFamilyMessage = () => {
    const trimmed = familyContent.trim();
    if (!trimmed || sendFamilyMessageMutation.isPending) return;
    sendFamilyMessageMutation.mutate(trimmed);
  };

  const openPrivateThread = (memberId: string) => {
    setHiddenThreadMemberIds((prev) => prev.filter((id) => id !== memberId));
    setManualThreadMemberIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
  };

  const closePrivateThread = (memberId: string) => {
    setHiddenThreadMemberIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
  };

  const submitPrivateMessage = (memberId: string) => {
    const trimmed = (privateDraftByMemberId[memberId] || '').trim();
    if (!trimmed || sendPrivateMessageMutation.isPending) return;

    sendPrivateMessageMutation.mutate({
      text: trimmed,
      recipientId: memberId,
    });
  };

  return (
    <DashboardLayout>
      <h2 className="page-title mb-4">
        Chat Famiglia{family?.name ? ` ${family.name}` : ''}
      </h2>

      <StatusModal
        show={Boolean(error)}
        variant="danger"
        message={error}
        onClose={() => setError('')}
      />

      <Card className="settings-card mb-4">
        <Card.Header>
          Membri della Famiglia{family?.name ? ` ${family.name}` : ''}
        </Card.Header>
        <Card.Body>
          {familyMembers.length ? (
            <div className="d-flex flex-column gap-2">
              {familyMembers.map((member) => (
                <div key={member.id} className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{member.id === user?.id ? 'Io' : member.name}</div>
                    <div className="small text-muted">{member.email}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg={member.role === 'admin' ? 'success' : 'secondary'}>
                      {member.role === 'admin' ? 'Amministratore' : 'Membro'}
                    </Badge>
                    {member.id !== user?.id && (() => {
                      const isThreadOpen = visibleThreadMembersSet.has(member.id);
                      return (
                        <Button
                          size="sm"
                          variant={isThreadOpen ? 'danger' : 'success'}
                          className={isThreadOpen ? 'btn-danger-soft' : 'btn-success-soft'}
                          onClick={() =>
                            isThreadOpen ? closePrivateThread(member.id) : openPrivateThread(member.id)
                          }
                        >
                          {isThreadOpen ? 'Chiudi chat privata' : 'Chat privata'}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted">Nessun membro disponibile.</div>
          )}
        </Card.Body>
      </Card>

      <Row className="g-4 mb-4">
        <Col xs={12}>
          <Card className="settings-card">
            <Card.Header className="d-flex justify-content-between align-items-center gap-2">
              <span>Chat Famiglia{family?.name ? ` ${family.name}` : ''}</span>
              <Button
                size="sm"
                variant={isFamilyChatCollapsed ? 'success' : 'danger'}
                className={isFamilyChatCollapsed ? 'btn-success-soft' : 'btn-danger-soft'}
                onClick={() => setIsFamilyChatCollapsed((prev) => !prev)}
              >
                {isFamilyChatCollapsed ? 'Ingrandisci' : 'Riduci'}
              </Button>
            </Card.Header>
            {!isFamilyChatCollapsed && (
            <Card.Body>
              <div ref={familyMessagesRef} style={{ height: '240px', overflowY: 'auto' }} className="mb-3">
                {isLoading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="success" />
                  </div>
                ) : familyChatMessages.length ? (
                  <div className="d-flex flex-column gap-2">
                    {familyChatMessages.map((message) => {
                      const isMine = message.senderUserId === user?.id;
                      const isSystem = message.messageType === 'system';

                      return (
                        <div
                          key={message.id}
                          className={`p-2 rounded ${
                            isSystem
                              ? 'bg-light text-muted'
                              : isMine
                                ? 'bg-success-subtle align-self-end'
                                : 'bg-white border'
                          }`}
                          style={{ maxWidth: isSystem ? '100%' : '85%' }}
                        >
                          {!isSystem && !isMine && (
                            <div className="small fw-semibold">{message.sender?.name || 'Utente'}</div>
                          )}
                          <div>{message.content}</div>
                          <div className="small text-muted mt-1">
                            {format(new Date(message.createdAt), 'd MMM yyyy HH:mm', { locale: it })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-muted">Nessun messaggio nella chat famiglia.</div>
                )}
              </div>

              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitFamilyMessage();
                }}
              >
                <Form.Group>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={familyContent}
                    onChange={(e) => setFamilyContent(e.target.value)}
                    placeholder={`Scrivi un messaggio alla famiglia${family?.name ? ` ${family.name}` : ''}...`}
                    maxLength={2000}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.altKey) {
                        e.preventDefault();
                        submitFamilyMessage();
                      }
                    }}
                  />
                </Form.Group>
                <div className="d-flex justify-content-end mt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={sendFamilyMessageMutation.isPending || !familyContent.trim()}
                  >
                    {sendFamilyMessageMutation.isPending ? <Spinner size="sm" animation="border" /> : 'Invia'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
            )}
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        {privateThreadMembers.map((member) => {
          const threadMessages = privateThreadMessagesByMemberId[member.id] || [];
          const draft = privateDraftByMemberId[member.id] || '';

          return (
            <Col key={member.id} xs={12} md={6} xl={4}>
              <Card className="settings-card h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span>{member.name}</span>
                    <Badge bg={member.role === 'admin' ? 'success' : 'secondary'}>
                      {member.role === 'admin' ? 'Amministratore' : 'Membro'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="btn-danger-soft"
                    onClick={() => closePrivateThread(member.id)}
                  >
                    Chiudi chat
                  </Button>
                </Card.Header>
                <Card.Body>
                  <div
                    ref={(node) => {
                      privateMessagesRefs.current[member.id] = node;
                    }}
                    style={{ height: '240px', overflowY: 'auto' }}
                    className="mb-3"
                  >
                    {isLoading ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" variant="success" />
                      </div>
                    ) : threadMessages.length ? (
                      <div className="d-flex flex-column gap-2">
                        {threadMessages.map((message) => {
                          const isMine = message.senderUserId === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`p-2 rounded ${isMine ? 'bg-success-subtle align-self-end' : 'bg-white border'}`}
                              style={{ maxWidth: '85%' }}
                            >
                              {!isMine && (
                                <div className="small fw-semibold">{message.sender?.name || 'Utente'}</div>
                              )}
                              <div>{message.content}</div>
                              <div className="small text-muted mt-1">
                                {format(new Date(message.createdAt), 'd MMM yyyy HH:mm', { locale: it })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-muted">Nessun messaggio privato con questo membro.</div>
                    )}
                  </div>

                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitPrivateMessage(member.id);
                    }}
                  >
                    <Form.Group>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={draft}
                        onChange={(e) =>
                          setPrivateDraftByMemberId((prev) => ({
                            ...prev,
                            [member.id]: e.target.value,
                          }))
                        }
                        placeholder={`Scrivi un messaggio privato a ${member.name}...`}
                        maxLength={2000}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.altKey) {
                            e.preventDefault();
                            submitPrivateMessage(member.id);
                          }
                        }}
                      />
                    </Form.Group>
                    <div className="d-flex justify-content-end mt-3">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={sendPrivateMessageMutation.isPending || !draft.trim()}
                      >
                        {sendPrivateMessageMutation.isPending ? (
                          <Spinner size="sm" animation="border" />
                        ) : (
                          'Invia'
                        )}
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    </DashboardLayout>
  );
}
