import type { Metadata, Viewport } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'SunOdoo · Solar ERP platform',
    template: '%s · SunOdoo',
  },
  description:
    'One ERP platform for solar enquiries, surveys, quotes, advance payments, warehouse dispatch, technician work and warranty support.',
  applicationName: 'SunOdoo Solar ERP',
};

export const viewport: Viewport = {
  themeColor: '#0b1f33',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
