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
    <Link href={href}>
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
            fw={800}
            fz={compact ? 16 : 18}
            lh={1.1}
            c={light ? 'white' : 'ink.9'}
            style={{ letterSpacing: '-0.02em' }}
          >
            SunOdoo
          </Text>
          {!compact && (
            <Text
              fz={9}
              fw={700}
              tt="uppercase"
              style={{ letterSpacing: '0.18em', color: light ? 'rgba(255,255,255,.55)' : '#64748b' }}
            >
              Solar ERP
            </Text>
          )}
        </div>
      </Group>
    </Link>
  );
}
