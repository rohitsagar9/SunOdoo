'use client';

import { Box, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { formatINR } from '@/lib/format';

export function RevenueChart({
  data,
}: {
  data: Array<{ label: string; revenue: number; expenses: number; profit: number }>;
}) {
  const max = Math.max(...data.flatMap((month) => [month.revenue, month.expenses]), 1);
  const chartHeight = 150;

  return (
    <Stack gap="md">
      <Group gap="lg">
        <Group gap={6}>
          <Box w={10} h={10} bg="sun.5" style={{ borderRadius: 3 }} />
          <Text fz="xs" c="dimmed">
            Revenue
          </Text>
        </Group>
        <Group gap={6}>
          <Box w={10} h={10} bg="ink.3" style={{ borderRadius: 3 }} />
          <Text fz="xs" c="dimmed">
            Expenses
          </Text>
        </Group>
      </Group>
      <Group align="flex-end" justify="space-between" gap="xs" h={chartHeight + 34}>
        {data.map((month) => {
          const revenueHeight = Math.max(2, (month.revenue / max) * chartHeight);
          const expenseHeight = Math.max(2, (month.expenses / max) * chartHeight);
          return (
            <Stack key={month.label} align="center" gap={6} style={{ flex: 1 }}>
              <Group align="flex-end" gap={3} h={chartHeight}>
                <Tooltip label={`Revenue ${formatINR(month.revenue)}`} withArrow>
                  <Box
                    w={{ base: 12, sm: 18 }}
                    h={revenueHeight}
                    bg="sun.5"
                    style={{ borderRadius: '4px 4px 0 0' }}
                  />
                </Tooltip>
                <Tooltip label={`Expenses ${formatINR(month.expenses)}`} withArrow>
                  <Box
                    w={{ base: 12, sm: 18 }}
                    h={expenseHeight}
                    bg="ink.3"
                    style={{ borderRadius: '4px 4px 0 0' }}
                  />
                </Tooltip>
              </Group>
              <Text fz={11} c="dimmed" fw={600}>
                {month.label}
              </Text>
            </Stack>
          );
        })}
      </Group>
    </Stack>
  );
}

export function FunnelBars({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const max = Math.max(...data.map((row) => row.count), 1);
  const label = (status: string) =>
    status
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <Stack gap="sm">
      {data.map((row) => (
        <Box key={row.status}>
          <Group justify="space-between" mb={4}>
            <Text fz="xs" fw={600}>
              {label(row.status)}
            </Text>
            <Text fz="xs" c="dimmed">
              {row.count}
            </Text>
          </Group>
          <Box bg="gray.1" h={8} style={{ borderRadius: 999 }}>
            <Box
              h={8}
              w={`${Math.max(4, (row.count / max) * 100)}%`}
              bg={row.status === 'WON' ? 'teal.5' : row.status === 'LOST' ? 'red.4' : 'sun.5'}
              style={{ borderRadius: 999 }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
