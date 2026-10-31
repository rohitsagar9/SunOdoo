'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Package,
  QrCode,
  RefreshCw,
  ScanLine,
  Truck,
  Warehouse,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, systemLabel, titleCase } from '@/lib/format';
import type { DashboardWarehouse } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function WarehousePage() {
  return (
    <RoleGate roles={['WAREHOUSE', 'DIRECTOR']}>
      <WarehouseOverview />
    </RoleGate>
  );
}

function WarehouseOverview() {
  const query = useQuery({
    queryKey: ['dashboard', 'warehouse'],
    queryFn: async () => (await api.get<DashboardWarehouse>('/dashboard/warehouse')).data,
  });

  const data = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Dispatch control"
        description="Pack the kit, scan every serial and hand over a dispatch-ready order to the installation crew."
        actions={
          <>
            <Button
              component={Link}
              href="/dashboard/inventory"
              variant="light"
              color="indigo"
              leftSection={<Boxes size={15} />}
            >
              Inventory
            </Button>
            <Button
              component={Link}
              href="/dashboard/barcodes"
              variant="light"
              color="gray"
              leftSection={<QrCode size={15} />}
            >
              Barcodes
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<RefreshCw size={15} />}
              loading={query.isFetching}
              onClick={() => query.refetch()}
            >
              Refresh
            </Button>
          </>
        }
      />

      {query.isError && (
        <Alert color="red" title="Could not load the warehouse dashboard" mb="md" radius="md">
          {apiError(query.error)}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Ready to pack"
          value={String(data?.kpis.readyToPack ?? 0)}
          hint="Advance received, kit not packed"
          icon={Package}
          color="orange"
          tone="filled"
        />
        <StatCard
          label="Ready to dispatch"
          value={String(data?.kpis.readyToDispatch ?? 0)}
          hint="Packed and serial-scanned"
          icon={Truck}
          color="teal"
        />
        <StatCard
          label="Dispatched today"
          value={String(data?.kpis.dispatchedToday ?? 0)}
          hint="Handed to installation crew"
          icon={CheckCircle2}
          color="indigo"
        />
        <StatCard
          label="Low stock"
          value={String(data?.kpis.lowStock ?? 0)}
          hint="Fewer than 2 units in stock"
          icon={AlertTriangle}
          color="red"
        />
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Panel
            title="Packing & dispatch queue"
            subtitle="Oldest paid orders first"
            action={<Warehouse size={16} color="#64748b" />}
            padding={0}
          >
            {query.isLoading ? (
              <LoadingState label="Loading the queue…" />
            ) : !data || data.queue.length === 0 ? (
              <EmptyState
                title="Queue is clear"
                description="New orders appear here as soon as the office approves the advance payment."
              />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="md" horizontalSpacing="md" highlightOnHover miw={880}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>System</Table.Th>
                      <Table.Th>Packing</Table.Th>
                      <Table.Th>Serial scans</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th ta="right" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.queue.map((order) => {
                      const progress = order.progress;
                      const packPct = progress?.totalItems
                        ? (progress.packedItems / progress.totalItems) * 100
                        : 0;
                      const scanPct = progress?.requiredScans
                        ? Math.min((progress.scans / progress.requiredScans) * 100, 100)
                        : 100;
                      return (
                        <Table.Tr key={order.id}>
                          <Table.Td>
                            <Text fz="sm" fw={700} className="sp-mono" component={Link} href={`/dashboard/orders/${order.id}`}>
                              {order.orderNumber}
                            </Text>
                            <Text fz={10} c="dimmed">
                              {formatDate(order.createdAt)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fz="sm">{order.customer.name}</Text>
                            <Text fz={10} c="dimmed" className="sp-mono">
                              {order.customer.phone} · {order.customer.city ?? order.customer.address}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fz="xs" fw={600}>
                              {order.quote.capacityKw} kW · {systemLabel(order.quote.systemType)}
                            </Text>
                            <Text fz={10} c="dimmed">
                              {formatINR(order.total, true)}
                            </Text>
                          </Table.Td>
                          <Table.Td miw={130}>
                            <Group justify="space-between" mb={3} gap={4}>
                              <Text fz={10} c="dimmed">
                                {progress?.packedItems ?? 0}/{progress?.totalItems ?? 0} items
                              </Text>
                              <Text fz={10} fw={700}>
                                {Math.round(packPct)}%
                              </Text>
                            </Group>
                            <Progress value={packPct} color={packPct === 100 ? 'teal' : 'sun'} size="sm" />
                          </Table.Td>
                          <Table.Td miw={130}>
                            <Group justify="space-between" mb={3} gap={4}>
                              <Text fz={10} c="dimmed">
                                {progress?.scans ?? 0}/{progress?.requiredScans ?? 0} serials
                              </Text>
                              <Text fz={10} fw={700}>
                                {Math.round(scanPct)}%
                              </Text>
                            </Group>
                            <Progress value={scanPct} color={scanPct === 100 ? 'teal' : 'indigo'} size="sm" />
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={order.status} size="xs" />
                          </Table.Td>
                          <Table.Td ta="right">
                            <Button
                              component={Link}
                              href={`/dashboard/orders/${order.id}`}
                              size="compact-sm"
                              color="sun"
                              rightSection={<ArrowRight size={12} />}
                            >
                              Pack
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel
              title="Low stock alerts"
              subtitle="Replenish before the next dispatch"
              action={<AlertTriangle size={16} color="#dc2626" />}
            >
              <Stack gap="sm">
                {data?.lowStockProducts.map((product) => (
                  <Box
                    key={product.id}
                    p="sm"
                    style={{ border: '1px solid #fef2f2', borderRadius: 10, background: '#fffafa' }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text fz="xs" fw={700}>
                          {product.name}
                        </Text>
                        <Text fz={10} c="dimmed" className="sp-mono">
                          {product.sku}
                        </Text>
                      </div>
                      <Badge size="xs" color="red" variant="light">
                        Low
                      </Badge>
                    </Group>
                    <Text fz={10} c="dimmed" mt={4}>
                      {product.warrantyMonths} month warranty · {titleCase(product.category)}
                    </Text>
                  </Box>
                ))}
                {data && data.lowStockProducts.length === 0 && (
                  <Group gap="sm">
                    <CheckCircle2 size={15} color="#0f766e" />
                    <Text fz="sm" c="dimmed">
                      All stocked products have at least 2 units.
                    </Text>
                  </Group>
                )}
                <Button
                  component={Link}
                  href="/dashboard/inventory"
                  variant="light"
                  color="indigo"
                  leftSection={<Boxes size={15} />}
                  fullWidth
                >
                  Receive stock
                </Button>
              </Stack>
            </Panel>

            <Panel title="Dispatch checklist" subtitle="Every order, every time">
              <Stack gap="sm">
                {[
                  ['Pack against the BOM', 'Tick every kit line on the order card — no substitutions.'],
                  ['Scan serials', 'Panels, inverter, battery and controller serials are mandatory.'],
                  ['Check payments', 'Advance approved before packing; balance collected at handover.'],
                  ['Hand over the warranty', 'Warranty starts automatically when the crew completes installation.'],
                ].map(([title, text]) => (
                  <Group key={title} gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon size={28} radius="md" color="indigo" variant="light">
                      <ScanLine size={14} />
                    </ThemeIcon>
                    <div>
                      <Text fz="xs" fw={700}>
                        {title}
                      </Text>
                      <Text fz={10} c="dimmed">
                        {text}
                      </Text>
                    </div>
                  </Group>
                ))}
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
