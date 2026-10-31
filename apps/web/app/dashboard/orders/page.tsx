'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Group,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, safeValue, titleCase } from '@/lib/format';
import type { Order } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statusOptions = [
  { value: 'ALL', label: 'All orders' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'ADVANCE_PAID', label: 'Advance paid' },
  { value: 'READY_TO_DISPATCH', label: 'Ready to dispatch' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'INSTALLED', label: 'Installed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function OrdersPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR', 'WAREHOUSE', 'SUPPORT']}>
      <OrdersList />
    </RoleGate>
  );
}

function OrdersList() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('ALL');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('status');
    if (value && statusOptions.some((option) => option.value === value)) setStatus(value);
  }, []);

  const query = useQuery({
    queryKey: ['orders', debouncedSearch, status],
    queryFn: async () => {
      const response = await api.get<Order[]>('/orders', {
        params: {
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(status !== 'ALL' ? { status } : {}),
        },
      });
      return response.data;
    },
  });

  const orders = query.data ?? [];
  const summary = useMemo(() => {
    const open = orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status));
    return {
      count: orders.length,
      openValue: open.reduce((sum, order) => sum + order.total, 0),
      balance: open.reduce((sum, order) => sum + order.balanceDue, 0),
      completed: orders.filter((order) => order.status === 'COMPLETED').length,
    };
  }, [orders]);

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Orders"
        description="Every accepted quote becomes an order with a packing list, serial trail and installation job."
        actions={
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={15} />}
            onClick={() => query.refetch()}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard label="Orders shown" value={String(summary.count)} icon={Package} color="ocean" />
        <StatCard
          label="Open order value"
          value={formatINR(summary.openValue, true)}
          hint="Excludes completed and cancelled"
          icon={Wallet}
          color="sun"
        />
        <StatCard
          label="Balance to collect"
          value={formatINR(summary.balance, true)}
          hint="Across open orders"
          icon={Truck}
          color="orange"
        />
        <StatCard label="Completed" value={String(summary.completed)} icon={PackageCheck} color="teal" />
      </SimpleGrid>

      <Panel padding="md" className="sp-no-print">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap="sm">
            <TextInput
              placeholder="Search order, customer or phone…"
              leftSection={<Search size={15} />}
              value={search}
              onChange={(event) => setSearch(safeValue(event))}
              w={{ base: '100%', sm: 340 }}
            />
            <Select
              data={statusOptions}
              value={status}
              onChange={(value) => setStatus(value ?? 'ALL')}
              allowDeselect={false}
              w={{ base: '100%', sm: 190 }}
            />
          </Group>
          <Text fz="xs" c="dimmed">
            Warehouse staff pack the kit and scan inverter, battery and charge-controller serials before dispatch.
          </Text>
        </Group>
      </Panel>

      <Stack mt="md" gap="md">
        {query.isLoading && <LoadingState label="Loading orders…" />}
        {query.isError && (
          <Alert color="red" title="Could not load orders">
            {apiError(query.error)}
          </Alert>
        )}
        {!query.isLoading && !query.isError && orders.length === 0 && (
          <EmptyState
            title="No orders in this view"
            description="Orders appear when a customer accepts a quote. Try another status filter."
          />
        )}
        {orders.length > 0 && (
          <Panel padding={0}>
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="xs" miw={760}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>System</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th ta="right">Balance</Table.Th>
                    <Table.Th>Packing / scans</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th ta="right" style={{ whiteSpace: 'nowrap', width: '1%' }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orders.map((order) => {
                    const packed = order.kitItems?.filter((item) => item.packed).length ?? 0;
                    const total = order.kitItems?.length ?? 0;
                    const scans =
                      order.inventoryUnits?.filter((unit) =>
                        ['DISPATCHED', 'INSTALLED'].includes(unit.status),
                      ).length ?? 0;
                    const progress = total > 0 ? Math.round((packed / total) * 100) : 0;
                    return (
                      <Table.Tr key={order.id}>
                        <Table.Td>
                          <Text fz="sm" fw={700} component={Link} href={`/dashboard/orders/${order.id}`} className="sp-mono">
                            {order.orderNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {order.quote?.quoteNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="sm" fw={600}>
                            {order.customer.name}
                          </Text>
                          <Text fz={10} c="dimmed" className="sp-mono">
                            {order.customer.phone}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">
                            {order.quote?.capacityKw ?? '—'} kW · {titleCase(order.quote?.systemType)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700} className="sp-mono">
                            {formatINR(order.total)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text
                            fz="sm"
                            fw={700}
                            className="sp-mono"
                            c={order.balanceDue > 0 ? 'orange.7' : 'teal.7'}
                          >
                            {formatINR(order.balanceDue)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} mb={4} wrap="nowrap">
                            <Text fz={10} c="dimmed">
                              {packed}/{total} packed
                            </Text>
                            <Badge size="xs" variant="light" color="indigo">
                              {scans} scans
                            </Badge>
                          </Group>
                          <Progress value={progress} color={progress === 100 ? 'teal' : 'sun'} size="xs" />
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge status={order.status} />
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" c="dimmed">
                            {formatDate(order.createdAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap', width: '1%' }}>
                          <Button
                            component={Link}
                            href={`/dashboard/orders/${order.id}`}
                            size="compact-xs"
                            color="sun"
                            rightSection={<ArrowRight size={12} />}
                          >
                            Open
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Panel>
        )}
      </Stack>
    </>
  );
}
