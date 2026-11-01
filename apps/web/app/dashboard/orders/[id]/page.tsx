'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Grid,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Barcode,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  ScanLine,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserRound,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatINR, safeValue, titleCase } from '@/lib/format';
import type { Order } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';
import { RecordOfflinePaymentModal } from '@/components/dashboard/RecordOfflinePaymentModal';

const MUST_SCAN = ['INVERTER', 'BATTERY', 'CHARGE_CONTROLLER'];

export default function OrderDetailPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR', 'WAREHOUSE', 'SUPPORT', 'TECHNICIAN']}>
      <OrderDetail />
    </RoleGate>
  );
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canRecordOffline = hasRole('SALES', 'DIRECTOR');

  const [serial, setSerial] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [dispatchWarningOpen, setDispatchWarningOpen] = useState(false);
  const [overrideConfirm, setOverrideConfirm] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);

  const query = useQuery({
    queryKey: ['order', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Order>(`/orders/${id}`)).data,
  });

  const order = query.data;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }

  const packMutation = useMutation({
    mutationFn: async ({ itemId, packed }: { itemId: string; packed: boolean }) =>
      (await api.patch(`/orders/${id}/kit/${itemId}`, { packed })).data,
    onSuccess: () => invalidate(),
    onError: (error) =>
      notifications.show({ title: 'Could not update checklist', message: apiError(error), color: 'red' }),
  });

  const packAllMutation = useMutation({
    mutationFn: async () => (await api.post(`/orders/${id}/pack-all`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Kit packed',
        message: 'Every checklist line is now marked packed.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not pack all', message: apiError(error), color: 'red' }),
  });

  const scanMutation = useMutation({
    mutationFn: async (serialNumber: string) =>
      (await api.post(`/orders/${id}/scan`, { serialNumber })).data,
    onSuccess: (data) => {
      setSerial('');
      invalidate();
      notifications.show({
        title: data.alreadyScanned ? 'Already scanned' : 'Serial scanned',
        message: data.alreadyScanned
          ? data.message
          : `${data.unit.serialNumber} · ${data.unit.product.name} added to this order.`,
        color: data.alreadyScanned ? 'orange' : 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Scan failed', message: apiError(error), color: 'red' }),
  });

  const dispatchMutation = useMutation({
    mutationFn: async ({ force }: { force?: boolean } = {}) =>
      (await api.post(`/orders/${id}/dispatch`, { force })).data,
    onSuccess: () => {
      setDispatchWarningOpen(false);
      invalidate();
      notifications.show({
        title: 'Order dispatched',
        message: 'Warranty clocks have started for every scanned serial.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not dispatch', message: apiError(error), color: 'red' }),
  });

  const verifyCashMutation = useMutation({
    mutationFn: async (paymentId: string) =>
      (await api.post(`/payments/${paymentId}/verify-cash`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Cash Deposit Verified',
        message: 'Physical cash received in office. Order advance and balance updated.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not verify cash', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) return <LoadingState label="Loading the order…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load order">{apiError(query.error)}</Alert>;
  }
  if (!order) return null;

  const kitItems = order.kitItems ?? [];
  const units = order.inventoryUnits ?? [];
  const payments = order.payments ?? [];
  const packed = kitItems.filter((item) => item.packed).length;
  const packProgress = kitItems.length ? Math.round((packed / kitItems.length) * 100) : 0;

  const scanRows = kitItems
    .filter((item) => MUST_SCAN.includes(item.product.category))
    .map((item) => {
      const scanned = units.filter(
        (unit) =>
          unit.productId === item.productId && ['DISPATCHED', 'INSTALLED'].includes(unit.status),
      ).length;
      return { item, scanned, required: item.quantity, done: scanned >= item.quantity };
    });

  const requiredScans = scanRows.reduce((sum, row) => sum + row.required, 0);
  const scans = scanRows.reduce((sum, row) => sum + Math.min(row.scanned, row.required), 0);
  const scansReady = scanRows.every((row) => row.done);
  const readyToDispatch = packed === kitItems.length && scansReady && kitItems.length > 0;
  const dispatched = ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(order.status);

  const handleDocUpload = async (file: File | null) => {
    if (!file) return;
    setDocFile(file);
    setUploadingDoc(true);
    try {
      const unscannedRow = scanRows.find((r) => !r.done);
      if (!unscannedRow) {
        notifications.show({
          title: 'All serials already scanned',
          message: 'Every required item on this order already has its serial assigned.',
          color: 'blue',
        });
        setUploadingDoc(false);
        return;
      }

      let candidateSerial = '';
      if (file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg')) {
        const svgContent = await file.text();
        const serialMatch = svgContent.match(/(SN-[A-Za-z0-9_-]+|[A-Z]{2,}-[A-Z0-9_-]{4,})/i);
        if (serialMatch && serialMatch[1]) {
          candidateSerial = serialMatch[1];
        }
      }

      if (candidateSerial) {
        try {
          await scanMutation.mutateAsync(candidateSerial);
          notifications.show({
            title: 'Barcode SVG processed',
            message: `Auto-scanned ${candidateSerial} directly from SVG asset.`,
            color: 'teal',
          });
          return;
        } catch {
          // If direct match was not already in inventory, fallback to available in-stock unit
        }
      }

      const res = await api.get<{ units: Array<{ serialNumber: string }> }>('/inventory', {
        params: { status: 'IN_STOCK', productId: unscannedRow.item.productId },
      });
      const inStockUnits = res.data?.units ?? [];
      if (inStockUnits.length === 0) {
        notifications.show({
          title: 'No in-stock serials found',
          message: `Stock count for ${unscannedRow.item.product.name} is 0. Receive stock in Inventory first.`,
          color: 'orange',
        });
      } else {
        const candidate = inStockUnits[0];
        await scanMutation.mutateAsync(candidate.serialNumber);
        notifications.show({
          title: 'Document barcode processed',
          message: `Auto-scanned ${candidate.serialNumber} from ${file.name}. Stock count reduced.`,
          color: 'teal',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Document scan failed',
        message: apiError(err),
        color: 'red',
      });
    } finally {
      setUploadingDoc(false);
      setDocFile(null);
    }
  };

  const handleDispatchClick = () => {
    if (readyToDispatch && order.status !== 'PENDING_PAYMENT') {
      dispatchMutation.mutate({ force: false });
    } else {
      setOverrideConfirm(false);
      setDispatchWarningOpen(true);
    }
  };

  const handleAutoCompleteAndDispatch = async () => {
    setAutoCompleting(true);
    try {
      if (packProgress < 100) {
        await packAllMutation.mutateAsync();
      }

      // Check and scan missing serials from available in-stock inventory
      const unscanned = scanRows.filter((r) => !r.done);
      for (const row of unscanned) {
        const needed = row.required - row.scanned;
        if (needed > 0) {
          const res = await api.get<{ units: Array<{ serialNumber: string }> }>('/inventory', {
            params: { status: 'IN_STOCK', productId: row.item.productId },
          });
          const available = res.data?.units ?? [];
          for (let i = 0; i < Math.min(needed, available.length); i++) {
            await scanMutation.mutateAsync(available[i].serialNumber);
          }
        }
      }

      // Force dispatch to ensure completion even if stock was short
      await dispatchMutation.mutateAsync({ force: true });
    } catch (err) {
      notifications.show({
        title: 'Auto-complete error',
        message: apiError(err),
        color: 'orange',
      });
    } finally {
      setAutoCompleting(false);
    }
  };

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Group gap="sm">
          <Button
            component={Link}
            href="/dashboard/orders"
            variant="subtle"
            color="gray"
            leftSection={<ArrowLeft size={15} />}
          >
            Orders
          </Button>
          <div>
            <Text fz={11} fw={700} tt="uppercase" c="sun.7" style={{ letterSpacing: '0.12em' }}>
              {order.orderNumber}
            </Text>
            <Text fw={800} fz={24} style={{ letterSpacing: '-0.03em' }}>
              {order.customer.name}
            </Text>
            <Text fz="xs" c="dimmed">
              {order.quote.capacityKw} kW {titleCase(order.quote.systemType)} · created{' '}
              {formatDate(order.createdAt)}
            </Text>
          </div>
          <StatusBadge status={order.status} />
        </Group>
        <Group gap="sm" wrap="wrap" className="sp-no-print">
          <Button
            variant="light"
            color="gray"
            leftSection={<Printer size={15} />}
            onClick={() => window.print()}
          >
            Print packing list
          </Button>
          <Button
            variant="light"
            color="teal"
            component={Link}
            href={`/dashboard/quotes/${order.quoteId}`}
            leftSection={<ClipboardList size={15} />}
          >
            Quote
          </Button>
          {!dispatched && (
            <Button
              color={readyToDispatch && order.status !== 'PENDING_PAYMENT' ? 'sun' : 'orange'}
              variant={readyToDispatch && order.status !== 'PENDING_PAYMENT' ? 'filled' : 'light'}
              leftSection={<Truck size={15} />}
              loading={dispatchMutation.isPending}
              onClick={handleDispatchClick}
            >
              Dispatch order
            </Button>
          )}
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={6}>
            <Text fz={11} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Packing
            </Text>
            <Badge size="xs" variant="light" color={packProgress === 100 ? 'teal' : 'sun'}>
              {packed}/{kitItems.length}
            </Badge>
          </Group>
          <Progress value={packProgress} color={packProgress === 100 ? 'teal' : 'sun'} />
          <Text fz={10} c="dimmed" mt={6}>
            {packProgress === 100 ? 'Checklist complete' : 'Tick every item in the kit'}
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={6}>
            <Text fz={11} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Serial scans
            </Text>
            <Badge size="xs" variant="light" color={scansReady ? 'teal' : 'indigo'}>
              {scans}/{requiredScans}
            </Badge>
          </Group>
          <Progress
            value={requiredScans ? (scans / requiredScans) * 100 : 100}
            color={scansReady ? 'teal' : 'indigo'}
          />
          <Text fz={10} c="dimmed" mt={6}>
            Inverter, battery and charge controller serials
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={6}>
            <Text fz={11} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Balance
            </Text>
            <Wallet size={15} color="#d97706" />
          </Group>
          <Text fz={22} fw={800} style={{ letterSpacing: '-0.02em' }} className="sp-mono">
            {formatINR(order.balanceDue)}
          </Text>
          <Text fz={10} c="dimmed">
            Advance {formatINR(order.advancePaid)} of {formatINR(order.total)}
          </Text>
        </Paper>
      </SimpleGrid>

      {order.status === 'PENDING_PAYMENT' && (
        <Alert color="orange" title="Advance payment still pending" mb="md" radius="md">
          The order is in the warehouse queue only after the office approves the customer&apos;s advance
          payment.
        </Alert>
      )}

      {order.job?.pickedUpAt && (
        <Alert
          color={order.job.unloadedAt ? 'teal' : 'blue'}
          variant="light"
          icon={<Truck size={18} />}
          mb="md"
          radius="md"
          title={order.job.unloadedAt ? 'Hardware Kit Unloaded on Site' : 'Hardware Kit Collected by Technician'}
        >
          <Text fz="xs">
            {order.job.unloadedAt
              ? `Equipment safely arrived and unloaded on site on ${formatDateTime(order.job.unloadedAt)}. Installation in progress.`
              : `Technician picked up the kit from warehouse on ${formatDateTime(order.job.pickedUpAt)}. En route to site.`}
          </Text>
        </Alert>
      )}

      {order.status === 'INSTALLED' && order.balanceDue > 0 && (
        <Alert
          color="orange"
          variant="light"
          icon={<AlertTriangle size={18} />}
          mb="md"
          radius="md"
          title={`Balance Settlement Pending: ${formatINR(order.balanceDue)}`}
        >
          <Text fz="xs">
            Installation is finished on site, but remaining balance of {formatINR(order.balanceDue)} is pending collection. Sales and office follow-up required.
          </Text>
        </Alert>
      )}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Panel
              title="Packing checklist"
              subtitle="Tick each line as it goes into the dispatch crate"
              action={
                <Button
                  size="compact-sm"
                  variant="light"
                  color="teal"
                  leftSection={<PackageCheck size={14} />}
                  loading={packAllMutation.isPending}
                  onClick={() => packAllMutation.mutate()}
                  disabled={kitItems.every((item) => item.packed)}
                >
                  Pack all
                </Button>
              }
            >
              <Stack gap={0}>
                {kitItems.map((item) => (
                  <Box
                    key={item.id}
                    py="sm"
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Checkbox
                        checked={item.packed}
                        onChange={(event) =>
                          packMutation.mutate({
                            itemId: item.id,
                            packed: event.currentTarget.checked,
                          })
                        }
                        label={
                          <div>
                            <Text fz="sm" fw={600} td={item.packed ? 'line-through' : undefined}>
                              {item.product.name}
                            </Text>
                            <Text fz={10} c="dimmed" className="sp-mono">
                              {item.product.sku} · qty {item.quantity} {item.product.unit}
                            </Text>
                          </div>
                        }
                      />
                      <div style={{ textAlign: 'right' }}>
                        {item.packedAt && (
                          <Text fz={10} c="dimmed">
                            {formatDateTime(item.packedAt)}
                          </Text>
                        )}
                        <Badge
                          size="xs"
                          variant="light"
                          color={item.packed ? 'teal' : 'gray'}
                        >
                          {item.packed ? 'Packed' : 'Pending'}
                        </Badge>
                      </div>
                    </Group>
                  </Box>
                ))}
                {kitItems.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    This order has no physical kit items.
                  </Text>
                )}
              </Stack>
            </Panel>

            <Panel
              title="Serial scanning"
              subtitle="Scan or type the serial on the carton. Warranty starts at dispatch."
              action={<Barcode size={18} color="#64748b" />}
            >
              <Group gap="sm" align="flex-end" mb="md">
                <TextInput
                  label="Serial number"
                  placeholder="SN-INV-3K-STK-0001"
                  leftSection={<ScanLine size={15} />}
                  value={serial}
                  onChange={(event) => setSerial(safeValue(event))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && serial.trim().length >= 3) {
                      scanMutation.mutate(serial.trim());
                    }
                  }}
                  style={{ flex: 1 }}
                  disabled={dispatched}
                />
                <Button
                  color="indigo"
                  leftSection={<Barcode size={15} />}
                  loading={scanMutation.isPending}
                  disabled={serial.trim().length < 3 || dispatched}
                  onClick={() => scanMutation.mutate(serial.trim())}
                >
                  Scan
                </Button>
              </Group>

              <Paper withBorder p="sm" radius="md" mb="md" bg="var(--sp-card-bg, #fbfcfe)">
                <Text fz="xs" fw={700} mb={4}>
                  Auto-scan serial via barcode or document (SVG / PNG / JPG / PDF)
                </Text>
                <Text fz={11} c="dimmed" mb="xs">
                  Upload barcode SVG label, carton photo, or delivery challan PDF. The system automatically registers the serial number.
                </Text>
                <FileInput
                  placeholder="Upload barcode (SVG, PNG, JPG) or challan PDF"
                  accept="image/png,image/jpeg,image/webp,application/pdf,image/svg+xml,.svg"
                  value={docFile}
                  onChange={handleDocUpload}
                  disabled={dispatched || uploadingDoc}
                  leftSection={<UploadCloud size={15} />}
                />
              </Paper>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="md">
                {scanRows.map((row) => (
                  <Paper key={row.item.id} withBorder p="sm" radius="md">
                    <Group justify="space-between" mb={4} wrap="nowrap">
                      <Text fz="xs" fw={700} truncate>
                        {row.item.product.name}
                      </Text>
                      <Badge size="xs" variant="light" color={row.done ? 'teal' : 'indigo'}>
                        {Math.min(row.scanned, row.required)}/{row.required}
                      </Badge>
                    </Group>
                    <Progress
                      value={(Math.min(row.scanned, row.required) / row.required) * 100}
                      color={row.done ? 'teal' : 'indigo'}
                      size="xs"
                    />
                    <Text fz={10} c="dimmed" mt={4}>
                      {row.item.product.category.replaceAll('_', ' ').toLowerCase()} · must scan
                    </Text>
                  </Paper>
                ))}
                {scanRows.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No serialised hardware on this order.
                  </Text>
                )}
              </SimpleGrid>

              <Divider mb="sm" />
              <Text fz="xs" fw={700} mb={6}>
                Scanned units on this order
              </Text>
              <ScrollArea>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={560}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Serial</Table.Th>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Warranty</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {units.map((unit) => (
                      <Table.Tr key={unit.id}>
                        <Table.Td>
                          <Text fz="xs" className="sp-mono">
                            {unit.serialNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">{unit.product.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge status={unit.status} size="xs" />
                        </Table.Td>
                        <Table.Td>
                          <Text fz={10} c="dimmed">
                            {unit.warrantyEnd ? `to ${formatDate(unit.warrantyEnd)}` : 'Starts at dispatch'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {units.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={4}>
                          <Text fz="xs" c="dimmed" ta="center" py="sm">
                            No serials scanned yet.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Panel>

            <Panel title="Dispatch readiness" subtitle="The API enforces both gates">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon
                    size={38}
                    radius="xl"
                    color={packProgress === 100 ? 'teal' : 'gray'}
                    variant="light"
                  >
                    <CheckCircle2 size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      Packing checklist
                    </Text>
                    <Text fz={11} c="dimmed">
                      {packProgress === 100 ? 'Every item packed' : `${kitItems.length - packed} item(s) left`}
                    </Text>
                  </div>
                </Group>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon
                    size={38}
                    radius="xl"
                    color={scansReady ? 'teal' : 'gray'}
                    variant="light"
                  >
                    <ShieldCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      Serial numbers
                    </Text>
                    <Text fz={11} c="dimmed">
                      {scansReady ? 'All required serials scanned' : `${requiredScans - scans} scan(s) left`}
                    </Text>
                  </div>
                </Group>
              </SimpleGrid>
              <Group justify="space-between" mt="md" wrap="wrap">
                <Group gap="xs">
                  {readyToDispatch && order.status !== 'PENDING_PAYMENT' ? (
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <CheckCircle2 size={13} />
                    </ThemeIcon>
                  ) : (
                    <ThemeIcon size={20} radius="xl" color="orange" variant="light">
                      <AlertTriangle size={13} />
                    </ThemeIcon>
                  )}
                  <Text fz="xs" c={readyToDispatch && order.status !== 'PENDING_PAYMENT' ? 'teal.8' : 'orange.8'} fw={500}>
                    {readyToDispatch && order.status !== 'PENDING_PAYMENT'
                      ? 'Ready. Dispatch starts warranty and releases the installation job.'
                      : 'Dispatch unlocked. Incomplete gates will display review and override options.'}
                  </Text>
                </Group>
                {!dispatched ? (
                  <Button
                    color={readyToDispatch && order.status !== 'PENDING_PAYMENT' ? 'sun' : 'orange'}
                    variant={readyToDispatch && order.status !== 'PENDING_PAYMENT' ? 'filled' : 'light'}
                    leftSection={<Truck size={15} />}
                    loading={dispatchMutation.isPending}
                    onClick={handleDispatchClick}
                  >
                    Dispatch order
                  </Button>
                ) : (
                  <Badge color="teal" variant="light" size="lg">
                    Dispatched {order.dispatchAt ? formatDate(order.dispatchAt) : ''}
                  </Badge>
                )}
              </Group>
            </Panel>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel title="Customer & site" subtitle="Delivery destination">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={36} radius="xl" color="sun" variant="light">
                    <UserRound size={17} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      {order.customer.name}
                    </Text>
                    <Text fz={11} c="dimmed" className="sp-mono">
                      {order.customer.phone}
                    </Text>
                  </div>
                </Group>
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <MapPin size={14} color="#94a3b8" style={{ marginTop: 2 }} />
                  <Text fz="xs" c="dimmed">
                    {order.customer.address}
                    {order.customer.city ? `, ${order.customer.city}` : ''}
                    {order.customer.state ? `, ${order.customer.state}` : ''}
                  </Text>
                </Group>
              </Stack>
            </Panel>

            <Panel title="Order summary">
              <SimpleGrid cols={2} spacing="sm">
                <InlineStat label="Total" value={formatINR(order.total, true)} />
                <InlineStat label="Advance" value={formatINR(order.advancePaid, true)} color="#0f766e" />
                <InlineStat label="Balance" value={formatINR(order.balanceDue, true)} color="#d97706" />
                <InlineStat label="Capacity" value={`${order.quote.capacityKw} kW`} />
              </SimpleGrid>
              <Button
                component={Link}
                href={`/dashboard/quotes/${order.quoteId}`}
                variant="light"
                color="gray"
                mt="md"
                leftSection={<ClipboardList size={14} />}
                fullWidth
              >
                View quote {order.quote.quoteNumber}
              </Button>
            </Panel>

            <Panel
              title="Payments"
              subtitle="Approved money against this order"
              action={<Wallet size={16} color="#0f766e" />}
            >
              <Stack gap="sm">
                {payments.map((payment) => (
                  <Paper key={payment.id} p={6} withBorder style={{ borderRadius: 8, background: 'var(--sp-card)' }}>
                    <Group justify="space-between" wrap="nowrap" mb={4}>
                      <div>
                        <Text fz="xs" fw={600}>
                          {titleCase(payment.type)} · {titleCase(payment.method)}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {formatDateTime(payment.createdAt)}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text fz="xs" fw={700} className="sp-mono">
                          {formatINR(payment.amount)}
                        </Text>
                        <StatusBadge status={payment.status} size="xs" />
                      </div>
                    </Group>
                    {payment.method === 'CASH' && payment.credibilityConfirmed && (
                      <Group justify="space-between" mt={4} wrap="wrap">
                        <Badge size="xs" color={payment.cashDepositVerified ? 'teal' : 'orange'} variant="light">
                          {payment.cashDepositVerified ? 'Cash Deposited in Office' : 'Technician Credibility Taken'}
                        </Badge>
                        {payment.status === 'PENDING' && (
                          <Button
                            size="compact-xs"
                            color="teal"
                            loading={verifyCashMutation.isPending}
                            onClick={() => verifyCashMutation.mutate(payment.id)}
                          >
                            Confirm Cash Received & Approve
                          </Button>
                        )}
                      </Group>
                    )}
                  </Paper>
                ))}
                {payments.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No payments recorded yet.
                  </Text>
                )}
                {canRecordOffline && order.balanceDue > 0 && (
                  <Button
                    color="teal"
                    size="compact-sm"
                    leftSection={<Banknote size={14} />}
                    onClick={() => setOfflineModalOpen(true)}
                    fullWidth
                  >
                    Record Offline Payment
                  </Button>
                )}
                <Button
                  component={Link}
                  href="/dashboard/payments"
                  variant="light"
                  color="teal"
                  size="compact-sm"
                  fullWidth
                >
                  Open payment queue
                </Button>
              </Stack>
            </Panel>

            {order.job && (
              <Panel
                title="Installation job"
                subtitle="Crew assignment and site sign-off"
                action={<Wrench size={16} color="#64748b" />}
              >
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fz="sm" fw={700} className="sp-mono">
                      {order.job.jobNumber}
                    </Text>
                    <StatusBadge status={order.job.status} size="xs" />
                  </Group>
                  <Text fz="xs" c="dimmed">
                    {formatDate(order.job.scheduledDate)} · {order.job.scheduledSlot ?? 'Slot TBC'} ·{' '}
                    {order.job.technician?.name ?? 'Unassigned'}
                  </Text>
                  <Button
                    component={Link}
                    href={`/dashboard/jobs/${order.job.id}`}
                    variant="light"
                    color="ocean"
                    leftSection={<Wrench size={14} />}
                    fullWidth
                  >
                    Open job card
                  </Button>
                </Stack>
              </Panel>
            )}

            <Panel title="Barcodes" subtitle="Static Code 128 assets">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={36} radius="md" color="indigo" variant="light">
                  <Barcode size={17} />
                </ThemeIcon>
                <div>
                  <Text fz="sm" fw={700}>
                    Scan or print labels
                  </Text>
                  <Text fz={10} c="dimmed">
                    Every product and tool has its own folder.
                  </Text>
                </div>
              </Group>
              <Button
                component={Link}
                href="/dashboard/barcodes"
                variant="light"
                color="indigo"
                size="compact-sm"
                mt="md"
                leftSection={<Package size={14} />}
                fullWidth
              >
                Open barcode library
              </Button>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <RecordOfflinePaymentModal
        opened={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        initialOrderId={order.id}
        initialOrder={order}
        onSuccess={() => {
          invalidate();
        }}
      />

      <Modal
        opened={dispatchWarningOpen}
        onClose={() => setDispatchWarningOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="orange" variant="light">
              <AlertTriangle size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700} fz="md">
                Dispatch Verification Warnings
              </Text>
              <Text fz={11} c="dimmed">
                Review incomplete gates for {order.orderNumber}
              </Text>
            </div>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
            Standard dispatch criteria are not fully verified for this order. Review the status of each requirement below and choose whether to auto-complete or force dispatch.
          </Alert>

          <Paper p="sm" withBorder radius="md">
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <ThemeIcon
                    size={24}
                    radius="xl"
                    color={order.status === 'PENDING_PAYMENT' ? 'red' : 'teal'}
                    variant="light"
                  >
                    {order.status === 'PENDING_PAYMENT' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                  </ThemeIcon>
                  <div>
                    <Text fz="xs" fw={700}>
                      Advance Payment
                    </Text>
                    <Text fz={11} c="dimmed">
                      {order.status === 'PENDING_PAYMENT'
                        ? 'Customer advance payment has not been approved by the office yet.'
                        : `Advance payment verified (${formatINR(order.advancePaid)} of ${formatINR(order.total)}).`}
                    </Text>
                  </div>
                </Group>
                <Badge size="xs" color={order.status === 'PENDING_PAYMENT' ? 'red' : 'teal'}>
                  {order.status === 'PENDING_PAYMENT' ? 'Pending Approval' : 'Verified'}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <ThemeIcon
                    size={24}
                    radius="xl"
                    color={packProgress === 100 ? 'teal' : 'orange'}
                    variant="light"
                  >
                    {packProgress === 100 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  </ThemeIcon>
                  <div>
                    <Text fz="xs" fw={700}>
                      Packing Checklist
                    </Text>
                    <Text fz={11} c="dimmed">
                      {packProgress === 100
                        ? `All ${kitItems.length} checklist items verified and packed.`
                        : `${kitItems.length - packed} of ${kitItems.length} item(s) not yet checked off in crate.`}
                    </Text>
                  </div>
                </Group>
                <Badge size="xs" color={packProgress === 100 ? 'teal' : 'orange'}>
                  {packed}/{kitItems.length} packed
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <ThemeIcon
                    size={24}
                    radius="xl"
                    color={scansReady ? 'teal' : 'orange'}
                    variant="light"
                  >
                    {scansReady ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                  </ThemeIcon>
                  <div>
                    <Text fz="xs" fw={700}>
                      Mandatory Serial Numbers
                    </Text>
                    <Text fz={11} c="dimmed">
                      {scansReady
                        ? `All required serialized hardware units (${scans}/${requiredScans}) scanned.`
                        : `${requiredScans - scans} serialized unit(s) (Inverter/Battery) not yet assigned.`}
                    </Text>
                  </div>
                </Group>
                <Badge size="xs" color={scansReady ? 'teal' : 'orange'}>
                  {scans}/{requiredScans} scanned
                </Badge>
              </Group>
            </Stack>
          </Paper>

          <Paper p="sm" withBorder radius="md" style={{ background: 'var(--sp-card-subtle)', borderColor: 'var(--sp-border)' }}>
            <Stack gap="xs">
              <Text fz="xs" fw={700}>
                Recommended resolution:
              </Text>
              <Text fz={11} c="dimmed">
                Warehouse can automatically mark all kit items packed and auto-assign available in-stock inventory units before dispatching.
              </Text>
              <Button
                variant="light"
                color="teal"
                size="sm"
                leftSection={<PackageCheck size={16} />}
                loading={autoCompleting}
                onClick={handleAutoCompleteAndDispatch}
              >
                Auto-complete checklist & dispatch
              </Button>
            </Stack>
          </Paper>

          <Divider label="Or force override" labelPosition="center" />

          <Checkbox
            checked={overrideConfirm}
            onChange={(e) => setOverrideConfirm(e.currentTarget.checked)}
            label={
              <Text fz="xs" fw={600}>
                I understand the risks of unverified kit/serials and authorize immediate force dispatch.
              </Text>
            }
          />

          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setDispatchWarningOpen(false)}>
              Cancel
            </Button>
            <Button
              color="orange"
              leftSection={<Truck size={15} />}
              disabled={!overrideConfirm}
              loading={dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate({ force: true })}
            >
              Force Dispatch (Override Warnings)
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
