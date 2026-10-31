'use client';

import { useEffect } from 'react';
import { Box, Button, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error caught:', error);
  }, [error]);

  return (
    <Box mih="100vh" style={{ display: 'grid', placeItems: 'center', background: 'var(--sp-bg, #fcfafe)', padding: 24 }}>
      <Paper p="xl" radius="lg" withBorder maw={500} style={{ background: 'var(--sp-card, #fff)' }}>
        <Stack align="center" gap="md" ta="center">
          <ThemeIcon size={56} radius="xl" color="red" variant="light">
            <AlertCircle size={28} />
          </ThemeIcon>
          <div>
            <Title order={3}>Something went wrong</Title>
            <Text fz="sm" c="dimmed" mt={4}>
              {error?.message || 'An unexpected error occurred while loading this view.'}
            </Text>
          </div>
          <Group gap="sm" mt="sm">
            <Button
              variant="light"
              color="gray"
              component={Link}
              href="/dashboard"
              leftSection={<Home size={15} />}
            >
              Dashboard
            </Button>
            <Button
              color="sun"
              leftSection={<RefreshCw size={15} />}
              onClick={() => reset()}
            >
              Try again
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
