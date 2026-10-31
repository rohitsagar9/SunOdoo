'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';

const theme = createTheme({
  primaryColor: 'sun',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily:
    "'Segoe UI', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
  headings: {
    fontFamily:
      "'Segoe UI', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontWeight: '700',
  },
  colors: {
    sun: [
      '#fff9e6',
      '#fff1c2',
      '#ffe08a',
      '#ffcd4d',
      '#ffbc24',
      '#f5a800',
      '#d98f00',
      '#b37400',
      '#8a5900',
      '#5c3b00',
    ],
    ocean: [
      '#eef6ff',
      '#d7e9fb',
      '#aacff4',
      '#79b3eb',
      '#4f9be3',
      '#348bd9',
      '#2178c4',
      '#0f5f9f',
      '#084777',
      '#04304f',
    ],
    ink: [
      '#f4f7fa',
      '#e6edf4',
      '#cbd8e6',
      '#a8bdd3',
      '#7f9ab8',
      '#5e7d9d',
      '#456482',
      '#314d68',
      '#1f3852',
      '#0b1f33',
    ],
  },
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Card: {
      defaultProps: { radius: 'lg' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" zIndex={2200} />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
