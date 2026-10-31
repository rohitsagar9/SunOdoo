import type { LucideIcon } from 'lucide-react';
import { Group, Paper, Text, ThemeIcon } from '@mantine/core';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color = 'sun',
  tone = 'light',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
  tone?: 'light' | 'filled';
}) {
  return (
    <Paper
      p="lg"
      className="sp-soft-card sp-hover-lift"
      h="100%"
      style={{
        background: 'var(--sp-card)',
        border: '1px solid var(--sp-border)',
        borderRadius: 12,
      }}
    >
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Text fz={11} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
          {label}
        </Text>
        <ThemeIcon
          size={38}
          radius="md"
          color={color}
          variant={tone === 'filled' ? 'filled' : 'light'}
        >
          <Icon size={19} strokeWidth={2} />
        </ThemeIcon>
      </Group>
      <Text fz={28} fw={800} lh={1.05} style={{ letterSpacing: '-0.03em', color: 'var(--sp-headings)' }}>
        {value}
      </Text>
      {hint && (
        <Text fz={12} c="dimmed" mt={6}>
          {hint}
        </Text>
      )}
    </Paper>
  );
}
