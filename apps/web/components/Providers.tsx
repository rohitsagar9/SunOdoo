'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';

const theme = createTheme({
  primaryColor: 'sun',
  primaryShade: { light: 6, dark: 6 },
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
      '#F8F3FF',
      '#F3EAFC',
      '#EBDDFF',
      '#D7B9FB',
      '#C092FA',
      '#9B62F8',
      '#783CF6',
      '#6530DC',
      '#4D21AF',
      '#24143F',
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
      '#FCFAFF',
      '#F8F3FF',
      '#EDE5F7',
      '#EBDDFF',
      '#C092FA',
      '#786B8D',
      '#6530DC',
      '#4D21AF',
      '#311B54',
      '#24143F',
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

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    originalError.apply(console, args);
  };
}

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
