'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Divider,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { Logo } from '@/components/Brand';
import { apiError } from '@/lib/api';
import { homeForRole, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import classes from './login.module.css';

const demoRoles: Array<{
  role: Role;
  label: string;
  email: string;
  icon: typeof TrendingUp;
  color: string;
}> = [
  { role: 'DIRECTOR', label: 'Director', email: 'director@sunpower.in', icon: TrendingUp, color: 'teal' },
  { role: 'SALES', label: 'Sales & Office', email: 'sales@sunpower.in', icon: Users, color: 'sun' },
  { role: 'TECHNICIAN', label: 'Technician', email: 'tech@sunpower.in', icon: Wrench, color: 'ocean' },
  { role: 'WAREHOUSE', label: 'Warehouse', email: 'warehouse@sunpower.in', icon: Warehouse, color: 'indigo' },
  { role: 'SUPPORT', label: 'Support', email: 'support@sunpower.in', icon: Headphones, color: 'grape' },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [quickEmail, setQuickEmail] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: 'director@sunpower.in', password: 'SunPower@123' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value) => (value.length >= 6 ? null : 'Password must be at least 6 characters'),
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, user, router]);

  const mutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (loggedIn) => {
      router.replace(homeForRole(loggedIn.role));
    },
  });

  function quickLogin(email: string) {
    setQuickEmail(email);
    form.setValues({ email, password: 'SunPower@123' });
    mutation.mutate({ email, password: 'SunPower@123' });
  }

  return (
    <main className={classes.page}>
      <aside className={classes.brandPanel}>
        <div className={classes.brandGlow} />
        <div className={classes.brandContent}>
          <Logo light />
          <div className={classes.brandCopy}>
            <Text className={classes.kicker}>The solar operations backbone</Text>
            <Title order={1} className={classes.brandTitle}>
              One login.
              <br />
              Every side of the job.
            </Title>
            <Text className={classes.brandText}>
              Enquiries, surveys, quotes, payments, serial numbers, installation sign-off and warranty
              claims — connected in one place.
            </Text>
            <Stack gap="md" mt={36}>
              {[
                ['Role-based dashboards', 'Director, sales, technician, warehouse and support.'],
                ['Money that adds up', 'Advance approvals, balance collection and job-level margin.'],
                ['Proof on every job', 'Photos, signatures, serial numbers and warranty dates.'],
              ].map(([title, text]) => (
                <Group key={title} gap="sm" align="flex-start" wrap="nowrap">
                  <ThemeIcon size={32} radius="md" color="sun" variant="light">
                    <ShieldCheck size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} fz="sm" c="white">
                      {title}
                    </Text>
                    <Text fz="xs" c="gray.4">
                      {text}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </div>
          <Group gap="xs" className={classes.brandFoot}>
            <LockKeyhole size={13} />
            <Text fz="xs" c="gray.5">
              JWT session · role-based access control
            </Text>
          </Group>
        </div>
      </aside>

      <section className={classes.formPanel}>
        <div className={classes.formWrap}>
          <Group justify="space-between" mb="xl">
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              leftSection={<ArrowLeft size={14} />}
              component={Link}
              href="/"
            >
              Back to website
            </Button>
            <Button variant="subtle" color="teal" size="compact-sm" component={Link} href="/portal">
              Customer portal
            </Button>
          </Group>

          <Text className={classes.kicker}>Staff access</Text>
          <Title order={2} className={classes.formTitle}>
            Sign in to your dashboard
          </Title>
          <Text c="dimmed" fz="sm" mb="xl">
            Use a demo account below or enter your SunPower email and password.
          </Text>

          {mutation.isError && (
            <Alert color="red" mb="md" title="Sign in failed" radius="md">
              {apiError(mutation.error)}
            </Alert>
          )}

          <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
            <Stack gap="md">
              <TextInput
                label="Work email"
                placeholder="you@sunpower.in"
                size="md"
                leftSection={<Users size={16} />}
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                size="md"
                leftSection={<LockKeyhole size={16} />}
                {...form.getInputProps('password')}
              />
              <Button
                type="submit"
                size="md"
                color="sun"
                loading={mutation.isPending}
                rightSection={<ArrowRight size={16} />}
              >
                Sign in
              </Button>
            </Stack>
          </form>

          <Divider my="xl" label="Or jump into a demo role" labelPosition="center" />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {demoRoles.map((role) => (
              <Paper
                key={role.role}
                withBorder
                p="sm"
                radius="md"
                className={classes.demoCard}
                onClick={() => quickLogin(role.email)}
                style={{ cursor: mutation.isPending ? 'wait' : 'pointer' }}
              >
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={34} radius="md" color={role.color} variant="light">
                    <role.icon size={16} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} fz="sm">
                      {role.label}
                    </Text>
                    <Text fz={10} c="dimmed" truncate>
                      {role.email}
                    </Text>
                  </div>
                </Group>
              </Paper>
            ))}
            <Paper withBorder p="sm" radius="md" className={classes.demoCard}>
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={34} radius="md" color="teal" variant="light">
                  <Headphones size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700} fz="sm">
                    Customer portal
                  </Text>
                  <Text fz={10} c="dimmed">
                    No login needed · phone lookup
                  </Text>
                </div>
              </Group>
            </Paper>
          </SimpleGrid>

          <Text fz="xs" c="dimmed" ta="center" mt="xl">
            Demo password for every role: <b>SunPower@123</b>
            {quickEmail && (
              <>
                <br />
                Signing in as {quickEmail}…
              </>
            )}
          </Text>
        </div>
      </section>
    </main>
  );
}
