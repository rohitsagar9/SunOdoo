'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Grid,
  Group,
  Modal,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BellPlus,
  Boxes,
  Check,
  CheckCircle2,
  MessageSquare,
  Package,
  QrCode,
  RefreshCw,
  ScanLine,
  Send,
  Truck,
  Warehouse,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, systemLabel, titleCase } from '@/lib/format';
import type { DashboardWarehouse, Order } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { InventoryCostAlertCard } from '@/components/dashboard/InventoryCostAlertCard';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function WarehousePage() {
  return (
    <RoleGate roles={['WAREHOUSE', 'DIRECTOR']}>
      <WarehouseOverview />
    </RoleGate>
  );
}

function WarehouseOverview() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['dashboard', 'warehouse'],
    queryFn: async () => (await api.get<DashboardWarehouse>('/dashboard/warehouse')).data,
  });

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({
    orderId: '',
    orderNumber: '',
    customerName: '',
    category: 'PAYMENT_PENDING',
    message: 'Kit is packed and verified. Customer advance payment is pending approval before dispatch release.',
    urgent: true,
  });

  const categoryPresets: Record<string, string> = {
    PAYMENT_PENDING:
      'Kit is packed and verified. Customer advance payment is pending approval before dispatch release.',
    COST_RECONCILIATION:
      'Hardware kit was dispatched >24 hours ago. Please log the inventory procurement cost to reconcile order expenses.',
    STOCK_SHORTAGE:
      'Component shortage identified in warehouse for this system configuration. Restock request required.',
    DISPATCH_READY:
      'Kit packing and serial scanning complete. Order is ready for logistics handover and technician dispatch.',
    GENERAL: '',
  };

  const alertMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/dashboard/alerts', {
          orderId: alertForm.orderId || undefined,
          orderNumber: alertForm.orderNumber || undefined,
          customerName: alertForm.customerName || undefined,
          category: alertForm.category,
          message: alertForm.message.trim(),
          urgent: alertForm.urgent,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'warehouse'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] });
      setAlertOpen(false);
      notifications.show({
        title: 'Alert sent to Sales',
        message: 'The sales desk has been notified in real time.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not send alert', message: apiError(error), color: 'red' }),
  });

  const openAlertForOrder = (order: Order) => {
    setAlertForm({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      category: order.status === 'PENDING_PAYMENT' ? 'PAYMENT_PENDING' : 'DISPATCH_READY',
      message:
        order.status === 'PENDING_PAYMENT'
          ? `Kit packed for ${order.customer.name} (${order.orderNumber}). Advance payment approval required to release dispatch.`
          : `Kit and serials ready for ${order.customer.name} (${order.orderNumber}). Awaiting dispatch handover.`,
      urgent: order.status === 'PENDING_PAYMENT',
    });
    setAlertOpen(true);
  };

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
              color="orange"
              variant="light"
              leftSection={<BellPlus size={15} />}
              onClick={() => {
                setAlertForm({
                  orderId: '',
                  orderNumber: '',
                  customerName: '',
                  category: 'PAYMENT_PENDING',
                  message: categoryPresets.PAYMENT_PENDING,
                  urgent: true,
                });
                setAlertOpen(true);
              }}
            >
              Alert Sales
            </Button>
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

      <InventoryCostAlertCard alerts={data?.inventoryCostAlerts} />

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
                <Table verticalSpacing="sm" horizontalSpacing="xs" highlightOnHover miw={720}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>System</Table.Th>
                      <Table.Th>Packing</Table.Th>
                      <Table.Th>Serial scans</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th ta="right" style={{ whiteSpace: 'nowrap', width: '1%' }} />
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
                          <Table.Td ta="right" style={{ whiteSpace: 'nowrap', width: '1%' }}>
                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                color="orange"
                                leftSection={<BellPlus size={12} />}
                                onClick={() => openAlertForOrder(order)}
                              >
                                Alert Sales
                              </Button>
                              <Button
                                component={Link}
                                href={`/dashboard/orders/${order.id}`}
                                size="compact-sm"
                                color="sun"
                                rightSection={<ArrowRight size={12} />}
                              >
                                Pack
                              </Button>
                            </Group>
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

            {data?.warehouseAlerts && data.warehouseAlerts.length > 0 && (
              <Panel
                title="Alerts sent to Sales"
                subtitle="Recent warehouse requests & nudges"
                action={<MessageSquare size={16} color="#64748b" />}
              >
                <Stack gap="xs">
                  {data.warehouseAlerts.slice(0, 5).map((alert) => (
                    <Box
                      key={alert.id}
                      p="xs"
                      style={{
                        border: '1px solid var(--sp-border)',
                        borderRadius: 8,
                        background: 'var(--sp-card-subtle)',
                      }}
                    >
                      <Group justify="space-between" mb={2}>
                        <Badge size="xs" color={alert.urgent ? 'red' : 'orange'} variant="light">
                          {alert.urgent ? 'Urgent' : titleCase(alert.category)}
                        </Badge>
                        <Badge size="xs" color={alert.resolved ? 'teal' : 'gray'}>
                          {alert.resolved ? 'Resolved' : 'Pending Sales'}
                        </Badge>
                      </Group>
                      {alert.orderNumber && (
                        <Text fz="xs" fw={700}>
                          Order {alert.orderNumber}{' '}
                          {alert.customerName ? `· ${alert.customerName}` : ''}
                        </Text>
                      )}
                      <Text fz={11} c="dimmed">
                        {alert.message}
                      </Text>
                      <Text fz={9} c="dimmed" mt={2}>
                        {formatDate(alert.createdAt)}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Panel>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal
        opened={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Send Warehouse Alert to Sales Desk"
        size="md"
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" radius="md" icon={<Send size={16} />}>
            Warehouse alerts are surfaced immediately to the Sales and Office team on their dashboard.
          </Alert>

          {alertForm.orderNumber ? (
            <Box
              p="xs"
              style={{
                borderRadius: 6,
                background: 'var(--sp-card-subtle)',
                border: '1px solid var(--sp-border)',
              }}
            >
              <Text fz="xs" fw={700}>
                Linked Order: {alertForm.orderNumber}
              </Text>
              <Text fz={10} c="dimmed">
                Customer: {alertForm.customerName || 'N/A'}
              </Text>
            </Box>
          ) : (
            <Select
              label="Select order (optional)"
              placeholder="Attach to an order"
              searchable
              clearable
              data={
                data?.queue.map((o) => ({
                  value: o.id,
                  label: `${o.orderNumber} · ${o.customer.name} (${o.status})`,
                })) ?? []
              }
              value={alertForm.orderId || null}
              onChange={(value) => {
                const ord = data?.queue.find((o) => o.id === value);
                setAlertForm((curr) => ({
                  ...curr,
                  orderId: value ?? '',
                  orderNumber: ord?.orderNumber ?? '',
                  customerName: ord?.customer.name ?? '',
                }));
              }}
            />
          )}

          <Select
            label="Alert Category"
            required
            data={[
              { value: 'PAYMENT_PENDING', label: '💳 Customer Advance Payment Required' },
              { value: 'COST_RECONCILIATION', label: '📊 Reconcile Inventory Cost (>24h overdue)' },
              { value: 'STOCK_SHORTAGE', label: '⚠️ Component Shortage / Restock Needed' },
              { value: 'DISPATCH_READY', label: '🚚 Kit Packed & Ready for Handover' },
              { value: 'GENERAL', label: '💬 General Notice / Query' },
            ]}
            value={alertForm.category}
            onChange={(val) => {
              const cat = val || 'GENERAL';
              setAlertForm((curr) => ({
                ...curr,
                category: cat,
                message: categoryPresets[cat] || curr.message,
              }));
            }}
          />

          <Textarea
            label="Message for Sales"
            placeholder="Type your alert message here..."
            required
            minRows={3}
            value={alertForm.message}
            onChange={(e) => setAlertForm((curr) => ({ ...curr, message: e.target.value }))}
          />

          <Checkbox
            label="Mark as High Priority / Urgent"
            checked={alertForm.urgent}
            onChange={(e) => setAlertForm((curr) => ({ ...curr, urgent: e.currentTarget.checked }))}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setAlertOpen(false)}>
              Cancel
            </Button>
            <Button
              color="orange"
              leftSection={<Send size={14} />}
              loading={alertMutation.isPending}
              disabled={!alertForm.message.trim()}
              onClick={() => alertMutation.mutate()}
            >
              Send Alert to Sales
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
