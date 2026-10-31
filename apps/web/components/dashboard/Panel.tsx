import { Group, Paper, Stack, Text } from '@mantine/core';

export function Panel({
  title,
  subtitle,
  action,
  children,
  padding = 'lg',
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  padding?: string | number;
  className?: string;
}) {
  return (
    <Paper p={padding} className={['sp-soft-card', className].filter(Boolean).join(' ')} h="100%">
      {(title || action) && (
        <Group justify="space-between" align="flex-start" mb="md" gap="sm" wrap="nowrap">
          <Stack gap={2}>
            {title && (
              <Text fw={700} fz="md" style={{ letterSpacing: '-0.01em' }}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text fz="xs" c="dimmed">
                {subtitle}
              </Text>
            )}
          </Stack>
          {action}
        </Group>
      )}
      {children}
    </Paper>
  );
}

export function InlineStat({
  label,
  value,
  hint,
  color = 'var(--sp-headings)',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: string;
}) {
  return (
    <Stack gap={2}>
      <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.1em' }}>
        {label}
      </Text>
      <Text fz={22} fw={800} lh={1.1} style={{ color, letterSpacing: '-0.02em' }}>
        {value}
      </Text>
      {hint && (
        <Text fz={11} c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}
