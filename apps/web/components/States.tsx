import { Center, Loader, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { Inbox } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Center py={80}>
      <Stack align="center" gap="sm">
        <Loader color="sun" />
        <Text c="dimmed" fz="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Paper p={40} className="sp-soft-card">
      <Stack align="center" gap="sm">
        <ThemeIcon size={52} radius="xl" variant="light" color="gray">
          <Inbox size={24} />
        </ThemeIcon>
        <Text fw={700}>{title}</Text>
        {description && (
          <Text c="dimmed" fz="sm" ta="center" maw={420}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Paper>
  );
}
