'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { useAuth } from '@/lib/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !user.activeFamilyId && pathname !== '/impostazioni') {
      router.replace('/impostazioni');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  if (!user) {
    return null;
  }
  if (!user.activeFamilyId && pathname !== '/impostazioni') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  return (
    <div className="app-shell min-vh-100">
      <Navbar />
      <Container fluid>
        <Row>
          <Col md={2} className="p-0">
            <Sidebar />
          </Col>
          <Col md={10} className="py-4 content-area">
            {children}
          </Col>
        </Row>
      </Container>
    </div>
  );
}
