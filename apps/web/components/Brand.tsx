import { Sun } from 'lucide-react';
import { Group, Text, ThemeIcon } from '@mantine/core';
import Link from 'next/link';

export function Logo({
  light = false,
  href = '/',
  compact = false,
}: {
  light?: boolean;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          size={compact ? 34 : 40}
          radius="xl"
          variant="filled"
          color="sun"
          style={{ flexShrink: 0 }}
        >
          <Sun size={compact ? 18 : 22} strokeWidth={2.4} />
        </ThemeIcon>
        <div>
          <Text
            className="sunodoo-brand-title"
            fw={800}
            fz={compact ? 16 : 18}
            lh={1.1}
            style={{ letterSpacing: '-0.02em', color: light ? '#FFFFFF' : 'var(--sp-headings)' }}
          >
            SunOdoo
          </Text>
          {!compact && (
            <Text
              className="sunodoo-brand-sub"
              fz={9}
              fw={700}
              tt="uppercase"
              style={{
                letterSpacing: '0.18em',
                color: light ? 'rgba(255,255,255,.7)' : 'var(--sp-secondary)',
              }}
            >
              Solar ERP
            </Text>
          )}
        </div>
      </Group>
    </Link>
  );
}
