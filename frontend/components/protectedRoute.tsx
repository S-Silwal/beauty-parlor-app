// src/components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (requiredRole && user && user.role !== requiredRole && user.role !== 'ADMIN') {
      router.push('/unauthorized');
    }
  }, [user, loading, router, requiredRole]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <>{children}</>;
}