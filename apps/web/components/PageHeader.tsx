import { Group, Stack, Text, Title } from '@mantine/core';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" gap="md" wrap="wrap">
      <Stack gap={4}>
        {eyebrow && (
          <Text fz={11} fw={700} tt="uppercase" c="sun.7" style={{ letterSpacing: '0.12em' }}>
            {eyebrow}
          </Text>
        )}
        <Title order={2} fz={{ base: 24, sm: 30 }} style={{ letterSpacing: '-0.03em' }}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" fz="sm" maw={680}>
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}
