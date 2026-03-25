'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Spinner, Container } from 'react-bootstrap';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(user.activeFamilyId ? '/dashboard' : '/impostazioni');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Spinner animation="border" variant="success" />
    </Container>
  );
}
