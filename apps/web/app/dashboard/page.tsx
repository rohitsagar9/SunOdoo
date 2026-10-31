'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeForRole, useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/States';

export default function DashboardIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, user, router]);

  return <LoadingState label="Opening your dashboard…" />;
}
