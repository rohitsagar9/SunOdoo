'use client';

import Link from 'next/link';
import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { ShieldAlert } from 'lucide-react';
import { homeForRole, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { LoadingState } from '@/components/States';

export function RoleGate({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Checking your access…" />;
  if (!user) return null;

  if (!roles.includes(user.role)) {
    return (
      <Center py={80}>
        <Paper className="sp-soft-card" p={40} maw={460}>
          <Stack align="center" gap="sm">
            <ThemeIcon size={56} radius="xl" color="red" variant="light">
              <ShieldAlert size={26} />
            </ThemeIcon>
            <Title order={3} ta="center">
              This area is outside your role
            </Title>
            <Text c="dimmed" fz="sm" ta="center">
              Your account is signed in as {user.role.toLowerCase().replaceAll('_', ' ')}. Ask a
              director if you need access to this screen.
            </Text>
            <Button component={Link} href={homeForRole(user.role)} color="sun" mt="sm">
              Back to my dashboard
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return <>{children}</>;
}
