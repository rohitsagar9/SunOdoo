'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Clock, ReceiptText } from 'lucide-react';
import { formatDate, formatINR } from '@/lib/format';
import type { InventoryCostAlert } from '@/lib/types';

interface InventoryCostAlertCardProps {
  alerts?: InventoryCostAlert[];
}

export function InventoryCostAlertCard({ alerts }: InventoryCostAlertCardProps) {
  const [opened, setOpened] = useState(true);

  if (!alerts || alerts.length === 0) return null;

  const formatElapsed = (hours: number, dispatchAt?: string) => {
    if (!hours || hours <= 0) return 'Just over 24h ago';
    if (hours < 48) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    return dispatchAt ? formatDate(dispatchAt) : `${days}d ago`;
  };

  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      mb="md"
      style={{
        background: 'var(--sp-card)',
        borderColor: 'var(--sp-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size={32} radius="md" color="red" variant="light">
            <AlertTriangle size={16} />
          </ThemeIcon>
          <div>
            <Group gap="xs" align="center">
              <Text fz="sm" fw={700} style={{ color: 'var(--sp-headings)' }}>
                Inventory Cost Reconciliation Pending
              </Text>
              <Badge color="red" variant="light" size="xs">
                Overdue &gt;24h
              </Badge>
              <Badge color="gray" variant="light" size="xs">
                {alerts.length} {alerts.length === 1 ? 'order' : 'orders'}
              </Badge>
            </Group>
            <Text fz={11} c="dimmed">
              Hardware kits dispatched &gt;24 hrs ago. Procurement expenses must be recorded to close project margin.
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            rightSection={opened ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            onClick={() => setOpened((o) => !o)}
          >
            {opened ? 'Hide' : `Show orders (${alerts.length})`}
          </Button>
        </Group>
      </Group>

      {opened && (
        <ScrollArea.Autosize mah={220} mt="sm">
          <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr style={{ borderColor: 'var(--sp-border)' }}>
                <Table.Th fz={10} tt="uppercase" c="dimmed">
                  Order
                </Table.Th>
                <Table.Th fz={10} tt="uppercase" c="dimmed">
                  Customer
                </Table.Th>
                <Table.Th fz={10} tt="uppercase" c="dimmed">
                  Dispatched
                </Table.Th>
                <Table.Th fz={10} tt="uppercase" c="dimmed">
                  Order Value
                </Table.Th>
                <Table.Th fz={10} tt="uppercase" c="dimmed" ta="right">
                  Action
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {alerts.map((alert) => (
                <Table.Tr key={alert.orderId} style={{ borderColor: 'var(--sp-border)' }}>
                  <Table.Td>
                    <Text
                      component={Link}
                      href={`/dashboard/orders/${alert.orderId}`}
                      fz="xs"
                      fw={700}
                      className="sp-mono"
                      c="sun.7"
                    >
                      {alert.orderNumber}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="xs" fw={600} style={{ color: 'var(--sp-headings)' }}>
                      {alert.customerName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color="orange" variant="light">
                      {formatElapsed(alert.hoursSinceDispatch, alert.dispatchAt)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="xs" fw={700} className="sp-mono" style={{ color: 'var(--sp-headings)' }}>
                      {formatINR(alert.totalAmount, true)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button
                      component={Link}
                      href={`/dashboard/orders/${alert.orderId}`}
                      size="compact-xs"
                      color="sun"
                      variant="light"
                      rightSection={<ArrowRight size={12} />}
                    >
                      Reconcile
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}
    </Paper>
  );
}
