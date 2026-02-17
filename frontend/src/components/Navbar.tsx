'use client';

import { Navbar as BsNavbar, Container, Nav, NavDropdown, Image } from 'react-bootstrap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { familyApi, notificationsApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FaBell } from 'react-icons/fa';

export default function Navbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, refresh } = useAuth();

  const activeFamily = user?.families?.find((family) => family.id === user.activeFamilyId);
  const homeHref = user?.activeFamilyId ? '/dashboard' : '/impostazioni';
  const activeFamilyRoleLabel =
    activeFamily?.role === 'admin'
      ? 'Amministratore'
      : activeFamily?.role === 'member'
        ? 'Membro'
        : null;

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'navbar'],
    queryFn: () => notificationsApi.list(15),
    enabled: Boolean(user),
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteReadMutation = useMutation({
    mutationFn: notificationsApi.deleteRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleSwitchFamily = async (familyId: string) => {
    if (!user || familyId === user.activeFamilyId) return;
    await familyApi.switchActive(familyId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('activeFamilyId', familyId);
    }
    queryClient.clear();
    await refresh();
    router.refresh();
  };

  return (
    <BsNavbar expand="lg" className="app-navbar shadow-sm">
      <Container fluid>
        <Link href={homeHref} passHref legacyBehavior>
          <BsNavbar.Brand className="d-flex align-items-center gap-2">
            <span style={{ fontSize: 18 }}>🍽️</span>
            Family Planner
          </BsNavbar.Brand>
        </Link>

        <BsNavbar.Toggle aria-controls="navbar-nav" />

        <BsNavbar.Collapse id="navbar-nav" className="justify-content-end">
          <Nav>
            {user?.families && user.families.length > 0 && (
              <NavDropdown
                title={`Famiglia: ${activeFamily?.name ?? user.families[0].name}${activeFamilyRoleLabel ? ` (${activeFamilyRoleLabel})` : ''}`}
                id="family-dropdown"
                align="end"
              >
                {user.families.map((family) => (
                  <NavDropdown.Item
                    key={family.id}
                    active={family.id === user.activeFamilyId}
                    onClick={() => handleSwitchFamily(family.id)}
                  >
                    {family.name} ({family.role === 'admin' ? 'Amministratore' : 'Membro'})
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            )}
            {user && (
              <NavDropdown
                className="notifications-dropdown"
                title={
                  <span className="position-relative d-inline-flex align-items-center">
                    <FaBell />
                    {(notificationsQuery.data?.unreadCount || 0) > 0 && (
                      <span
                        className="position-absolute badge rounded-pill bg-danger"
                        style={{ top: -10, right: -14, fontSize: 10 }}
                      >
                        {notificationsQuery.data!.unreadCount > 99 ? '99+' : notificationsQuery.data!.unreadCount}
                      </span>
                    )}
                  </span>
                }
                id="notifications-dropdown"
                align="end"
              >
                <div className="notifications-menu-header d-flex justify-content-between align-items-center">
                  <strong className="notifications-menu-title">Notifiche</strong>
                  <div className="notifications-menu-actions d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="notifications-readall-btn"
                      onClick={() => markAllReadMutation.mutate()}
                      disabled={markAllReadMutation.isPending || deleteReadMutation.isPending}
                    >
                      Segna tutte lette
                    </button>
                    <button
                      type="button"
                      className="notifications-readall-btn"
                      onClick={() => deleteReadMutation.mutate()}
                      disabled={markAllReadMutation.isPending || deleteReadMutation.isPending}
                    >
                      Elimina lette
                    </button>
                  </div>
                </div>
                <NavDropdown.Divider />
                {notificationsQuery.data?.items?.length ? (
                  notificationsQuery.data.items.map((notification) => (
                    <NavDropdown.Item
                      key={notification.id}
                      className={`notifications-item ${notification.isRead ? '' : 'notifications-item-unread'}`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markReadMutation.mutate(notification.id);
                        }
                      }}
                    >
                      <div className="fw-semibold notifications-item-title">{notification.title}</div>
                      <div className="small notifications-item-message">{notification.message}</div>
                    </NavDropdown.Item>
                  ))
                ) : (
                  <div className="px-3 py-2 notifications-empty small">Nessuna notifica</div>
                )}
              </NavDropdown>
            )}
            {user && (
              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2 user-dropdown-title">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        roundedCircle
                        width={28}
                        height={28}
                        alt={user.name}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                        style={{ width: 28, height: 28, fontSize: 12 }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="user-dropdown-name">{user.name}</span>
                  </span>
                }
                id="user-dropdown"
                align="end"
              >
                <Link href="/impostazioni" passHref legacyBehavior>
                  <NavDropdown.Item>Impostazioni</NavDropdown.Item>
                </Link>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout}>Esci</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
