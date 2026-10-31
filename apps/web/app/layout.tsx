import type { Metadata, Viewport } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'SunPower Solutions · Solar operations platform',
    template: '%s · SunPower Solutions',
  },
  description:
    'One platform for solar enquiries, surveys, quotes, payments, warehouse dispatch, installation sign-off and warranty support.',
  applicationName: 'SunPower Solutions',
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
