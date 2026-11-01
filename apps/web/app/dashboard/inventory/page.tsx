'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  PackagePlus,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  UploadCloud,
  Warehouse,
  X,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, safeValue, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { InventorySummaryRow, InventoryUnit, RestockRequest } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statuses = ['IN_STOCK', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'FAULTY', 'RETURNED'];

export default function InventoryPage() {
  return (
    <RoleGate roles={['WAREHOUSE', 'DIRECTOR', 'SALES']}>
      <InventoryWorkspace />
    </RoleGate>
  );
}

function InventoryWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'WAREHOUSE' || user?.role === 'DIRECTOR';

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockForm, setRestockForm] = useState({
    productId: '',
    quantity: 5 as number | string,
    unitCost: 0 as number | string,
    notes: '',
  });
  const [form, setForm] = useState({
    productId: '',
    quantity: 1 as number | string,
    serialNumber: '',
    warehouseLocation: 'Main warehouse',
  });
  const [scanFile, setScanFile] = useState<File | null>(null);

  const handleScanUpload = async (file: File | null) => {
    if (!file) return;
    setScanFile(file);
    try {
      let matchedSerial = '';
      if (file.name.toLowerCase().endsWith('.svg') || file.type.includes('svg')) {
        const text = await file.text();
        const m = text.match(/(SN-[A-Za-z0-9_-]+|[A-Z]{2,}-[A-Z0-9_-]{4,})/i);
        if (m && m[1]) matchedSerial = m[1];
      }
      if (!matchedSerial) {
        matchedSerial = file.name.replace(/\.[^/.]+$/, '');
      }

      setSearch(matchedSerial);
      setSubmittedSearch(matchedSerial);
      notifications.show({
        title: 'Barcode asset scanned',
        message: `Extracted serial ${matchedSerial} from ${file.name}`,
        color: 'teal',
      });
    } catch (err) {
      notifications.show({
        title: 'Barcode scan failed',
        message: apiError(err),
        color: 'red',
      });
    } finally {
      setScanFile(null);
    }
  };

  const summaryQuery = useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: async () => (await api.get<InventorySummaryRow[]>('/inventory/summary')).data,
  });

  const unitsQuery = useQuery({
    queryKey: ['inventory', 'units', statusFilter, submittedSearch],
    queryFn: async () =>
      (
        await api.get<InventoryUnit[]>('/inventory', {
          params: {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(submittedSearch ? { search: submittedSearch } : {}),
          },
        })
      ).data,
  });

  const summary = summaryQuery.data ?? [];
  const units = unitsQuery.data ?? [];

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, row) => ({
        skus: acc.skus + 1,
        inStock: acc.inStock + row.inStock,
        reserved: acc.reserved + row.reserved,
        dispatched: acc.dispatched + row.dispatched,
        installed: acc.installed + row.installed,
        faulty: acc.faulty + row.faulty,
        lowStock: acc.lowStock + (row.lowStock ? 1 : 0),
        stockValue: acc.stockValue + row.inStock * row.product.unitPrice,
      }),
      {
        skus: 0,
        inStock: 0,
        reserved: 0,
        dispatched: 0,
        installed: 0,
        faulty: 0,
        lowStock: 0,
        stockValue: 0,
      },
    );
  }, [summary]);

  const receiveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/inventory', {
          productId: form.productId,
          quantity: Number(form.quantity) || 1,
          serialNumber: form.serialNumber.trim() || undefined,
          warehouseLocation: form.warehouseLocation.trim() || undefined,
        })
      ).data as { created: number; serials: string[] },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setReceiveOpen(false);
      setForm({ productId: '', quantity: 1, serialNumber: '', warehouseLocation: 'Main warehouse' });
      notifications.show({
        title: 'Stock received',
        message: `${result.created} unit(s) added · ${result.serials.slice(0, 3).join(', ')}${result.serials.length > 3 ? '…' : ''}`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not receive stock', message: apiError(error), color: 'red' }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch(`/inventory/${id}/status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      notifications.show({ title: 'Unit status updated', message: 'Inventory saved.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update unit', message: apiError(error), color: 'red' }),
  });

  const restockRequestsQuery = useQuery({
    queryKey: ['inventory', 'restock-requests'],
    queryFn: async () => (await api.get<RestockRequest[]>('/inventory/restock-requests')).data,
  });
  const restockRequests = restockRequestsQuery.data ?? [];

  const createRestockMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/inventory/restock-requests', {
          productId: restockForm.productId,
          quantity: Number(restockForm.quantity) || 1,
          unitCost: Number(restockForm.unitCost) || 1,
          notes: restockForm.notes || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setRestockOpen(false);
      setRestockForm({ productId: '', quantity: 5, unitCost: 0, notes: '' });
      notifications.show({
        title: 'Restock request submitted',
        message: 'The request has been routed to the Director for price & expense approval.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not submit restock request', message: apiError(error), color: 'red' }),
  });

  const approveRestockMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/inventory/restock-requests/${id}/approve`)).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({
        title: 'Restock approved',
        message: `${res.quantityAdded} units generated in stock · ${formatINR(res.amountDeducted)} deducted from company funds.`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Approval failed', message: apiError(error), color: 'red' }),
  });

  const rejectRestockMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/inventory/restock-requests/${id}/reject`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      notifications.show({
        title: 'Restock rejected',
        message: 'The restock request was rejected.',
        color: 'gray',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Rejection failed', message: apiError(error), color: 'red' }),
  });

  const selectedProduct = summary.find((row) => row.product.id === form.productId);
  const selectedRestockProduct = summary.find((row) => row.product.id === restockForm.productId);

  return (
    <>
      <PageHeader
        eyebrow="Stock control"
        title="Inventory & serials"
        description="Every panel, inverter and battery is tracked by serial number from goods-in to warranty."
        actions={
          <>
            {canManage && (
              <>
                <Button
                  color="sun"
                  leftSection={<PackagePlus size={15} />}
                  onClick={() => setReceiveOpen(true)}
                >
                  Receive stock
                </Button>
                {user?.role !== 'DIRECTOR' && (
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<Send size={15} />}
                    onClick={() => setRestockOpen(true)}
                  >
                    Request restock
                  </Button>
                )}
              </>
            )}
            <Button
              variant="light"
              color="gray"
              leftSection={<RefreshCw size={15} />}
              loading={summaryQuery.isFetching || unitsQuery.isFetching}
              onClick={() => {
                summaryQuery.refetch();
                unitsQuery.refetch();
              }}
            >
              Refresh
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Units in stock"
          value={String(totals.inStock)}
          hint={`${totals.skus} stocked SKUs`}
          icon={Boxes}
          color="indigo"
          tone="filled"
        />
        <StatCard
          label="Stock value"
          value={formatINR(totals.stockValue, true)}
          hint="At current selling price"
          icon={Warehouse}
          color="sun"
        />
        <StatCard
          label="Installed units"
          value={String(totals.installed)}
          hint={`${totals.dispatched} dispatched, ${totals.reserved} reserved`}
          icon={ShieldCheck}
          color="teal"
        />
        <StatCard
          label="Low stock SKUs"
          value={String(totals.lowStock)}
          hint="Fewer than 2 units available"
          icon={AlertTriangle}
          color="red"
        />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md" mb="md" className="sp-soft-card">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs">
              <ScanLine size={18} color="#783cf6" />
              <Text fz="sm" fw={700}>
                Barcode & Serial scanner
              </Text>
              <Badge color="sun" variant="light" size="xs">
                SVG · PNG · PDF · JPG
              </Badge>
            </Group>
            <Text fz={11} c="dimmed" mt={2}>
              Scan with a handheld scanner or upload carton label (SVG, PNG, JPG) or challan PDF to inspect unit warranty & order history.
            </Text>
          </div>
          <Group gap="sm" wrap="wrap">
            <FileInput
              placeholder="Upload barcode SVG / PNG / PDF"
              accept="image/svg+xml,.svg,image/png,image/jpeg,image/webp,application/pdf"
              value={scanFile}
              onChange={handleScanUpload}
              leftSection={<UploadCloud size={14} />}
              size="xs"
              w={260}
            />
            <Button
              component={Link}
              href="/dashboard/barcodes"
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<Barcode size={14} />}
            >
              Browse labels
            </Button>
          </Group>
        </Group>
      </Paper>

      <Tabs defaultValue="summary" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="summary">Stock summary</Tabs.Tab>
          <Tabs.Tab value="serials">
            Serial register <Badge size="xs" ml={6}>{units.length}</Badge>
          </Tabs.Tab>
          <Tabs.Tab value="restock">
            Restock requests{' '}
            <Badge
              size="xs"
              ml={6}
              color={restockRequests.filter((r) => r.status === 'PENDING').length > 0 ? 'orange' : 'gray'}
            >
              {restockRequests.length}
            </Badge>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="summary">
          <Panel
            title="Stock by product"
            subtitle="Availability, reservations and warranty cover"
            action={<Boxes size={16} color="#64748b" />}
            padding={0}
          >
            {summaryQuery.isLoading ? (
              <LoadingState label="Loading stock levels…" />
            ) : summaryQuery.isError ? (
              <Alert color="red" title="Could not load stock">
                {apiError(summaryQuery.error)}
              </Alert>
            ) : summary.length === 0 ? (
              <EmptyState title="No active products" description="Add products to the catalogue first." />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover miw={880}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th ta="right">In stock</Table.Th>
                      <Table.Th ta="right">Reserved</Table.Th>
                      <Table.Th ta="right">Dispatched</Table.Th>
                      <Table.Th ta="right">Installed</Table.Th>
                      <Table.Th ta="right">Faulty</Table.Th>
                      <Table.Th ta="right">Unit price</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summary.map((row) => (
                      <Table.Tr key={row.product.id}>
                        <Table.Td>
                          <Text fz="sm" fw={600}>
                            {row.product.name}
                          </Text>
                          <Group gap={6} mt={2}>
                            <Text fz={10} c="dimmed" className="sp-mono">
                              {row.product.sku}
                            </Text>
                            {row.lowStock && (
                              <Badge size="xs" color="red" variant="light">
                                Reorder
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" c="dimmed">
                            {titleCase(row.product.category)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700} c={row.lowStock ? 'red' : undefined}>
                            {row.inStock}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm">{row.reserved}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm">{row.dispatched}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm">{row.installed}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" c={row.faulty > 0 ? 'red' : undefined}>
                            {row.faulty}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" className="sp-mono">
                            {formatINR(row.product.unitPrice)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel value="serials">
          <Panel
            title="Serial register"
            subtitle="Search a serial or filter by lifecycle status"
            action={<Search size={16} color="#64748b" />}
            padding={0}
          >
            <Group gap="sm" p="lg" pb="sm" wrap="wrap">
              <TextInput
                placeholder="Search serial number…"
                leftSection={<Search size={15} />}
                value={search}
                onChange={(event) => setSearch(safeValue(event))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setSubmittedSearch(search.trim());
                }}
                style={{ flex: 1, minWidth: 220 }}
              />
              <Select
                placeholder="All statuses"
                data={statuses.map((status) => ({ value: status, label: titleCase(status) }))}
                value={statusFilter}
                onChange={setStatusFilter}
                clearable
                w={170}
              />
              <Button color="sun" onClick={() => setSubmittedSearch(search.trim())}>
                Search
              </Button>
              {(submittedSearch || statusFilter) && (
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setSearch('');
                    setSubmittedSearch('');
                    setStatusFilter(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </Group>

            {unitsQuery.isLoading ? (
              <LoadingState label="Loading serials…" />
            ) : unitsQuery.isError ? (
              <Alert color="red" title="Could not load serials">
                {apiError(unitsQuery.error)}
              </Alert>
            ) : units.length === 0 ? (
              <EmptyState
                title="No serials match"
                description="Receive stock to create serial numbers, or clear the filters."
              />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover miw={960}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Serial</Table.Th>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>Order / customer</Table.Th>
                      <Table.Th>Warranty</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {units.map((unit) => (
                      <Table.Tr key={unit.id}>
                        <Table.Td>
                          <Text fz="xs" fw={700} className="sp-mono">
                            {unit.serialNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {formatDate(unit.createdAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">{unit.product.name}</Text>
                          <Text fz={10} c="dimmed" className="sp-mono">
                            {unit.product.sku}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">{unit.warehouseLocation ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          {unit.order ? (
                            <>
                              <Text fz="xs" fw={600} component={Link} href={`/dashboard/orders/${unit.order.id}`} className="sp-mono">
                                {unit.order.orderNumber}
                              </Text>
                              <Text fz={10} c="dimmed">
                                {unit.order.customer?.name ?? '—'}
                              </Text>
                            </>
                          ) : (
                            <Text fz="xs" c="dimmed">
                              Unassigned
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {unit.warrantyEnd ? (
                            <>
                              <StatusBadge
                                status={new Date(unit.warrantyEnd).getTime() > Date.now() ? 'IN_WARRANTY' : 'OUT_OF_WARRANTY'}
                                size="xs"
                              />
                              <Text fz={10} c="dimmed" mt={2}>
                                Ends {formatDate(unit.warrantyEnd)}
                              </Text>
                            </>
                          ) : (
                            <Text fz="xs" c="dimmed">
                              Starts on install
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {canManage ? (
                            <Select
                              size="xs"
                              data={statuses.map((status) => ({ value: status, label: titleCase(status) }))}
                              value={unit.status}
                              allowDeselect={false}
                              onChange={(status) =>
                                status && statusMutation.mutate({ id: unit.id, status })
                              }
                              w={150}
                            />
                          ) : (
                            <StatusBadge status={unit.status} size="xs" />
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Panel>
        </Tabs.Panel>

        <Tabs.Panel value="restock">
          <Panel
            title="Restock requests & Director approvals"
            subtitle="Warehouse submits stock requests; Director approves and company funds are deducted"
            action={<Boxes size={16} color="#64748b" />}
            padding={0}
          >
            {restockRequestsQuery.isLoading ? (
              <LoadingState label="Loading restock requests…" />
            ) : restockRequests.length === 0 ? (
              <EmptyState
                title="No restock requests"
                description={
                  user?.role === 'DIRECTOR'
                    ? 'No pending restock requests awaiting Director approval. Warehouse stock replenishment is up to date.'
                    : "Click 'Request restock' above when materials are low to send a procurement request to the Director."
                }
              />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover miw={800}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Item & Details</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Unit cost</Table.Th>
                      <Table.Th>Total cost</Table.Th>
                      <Table.Th>Requested by</Table.Th>
                      <Table.Th>Status</Table.Th>
                      {user?.role === 'DIRECTOR' && <Table.Th ta="right">Director action</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {restockRequests.map((req) => (
                      <Table.Tr key={req.id}>
                        <Table.Td>
                          <Text fz="xs" fw={600}>
                            {formatDate(req.createdAt)}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {formatDateTime(req.createdAt).split(' ')[1] || ''}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="sm" fw={600}>
                            {req.description}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="indigo">
                            {req.quantity} units
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" className="sp-mono">
                            {formatINR(req.unitCost)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text
                            fz="sm"
                            fw={700}
                            className="sp-mono"
                            c={req.status === 'APPROVED' ? 'red.7' : 'sun.7'}
                          >
                            {formatINR(req.totalCost)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" c="dimmed">
                            {req.requestedBy}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={
                              req.status === 'APPROVED' ? 'teal' : req.status === 'REJECTED' ? 'red' : 'orange'
                            }
                          >
                            {req.status}
                          </Badge>
                        </Table.Td>
                        {user?.role === 'DIRECTOR' && (
                          <Table.Td ta="right">
                            {req.status === 'PENDING' ? (
                              <Group gap="xs" justify="flex-end">
                                <Button
                                  size="compact-xs"
                                  color="teal"
                                  leftSection={<Check size={12} />}
                                  loading={approveRestockMutation.isPending}
                                  onClick={() => approveRestockMutation.mutate(req.id)}
                                >
                                  Approve & Deduct
                                </Button>
                                <Button
                                  size="compact-xs"
                                  color="red"
                                  variant="light"
                                  leftSection={<X size={12} />}
                                  loading={rejectRestockMutation.isPending}
                                  onClick={() => rejectRestockMutation.mutate(req.id)}
                                >
                                  Reject
                                </Button>
                              </Group>
                            ) : (
                              <Text fz="xs" c="dimmed">
                                Processed
                              </Text>
                            )}
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Panel>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive stock" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light" radius="md" icon={<CheckCircle2 size={16} />}>
            Choose a product and quantity. Leave the serial blank to auto-generate warehouse serials.
          </Alert>
          <Select
            label="Product"
            placeholder="Select a product"
            required
            searchable
            data={summary.map((row) => ({
              value: row.product.id,
              label: `${row.product.name} (${row.product.sku})`,
            }))}
            value={form.productId || null}
            onChange={(value) => setForm((current) => ({ ...current, productId: value ?? '' }))}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Quantity"
              min={1}
              max={100}
              value={form.quantity}
              onChange={(value) => setForm((current) => ({ ...current, quantity: value }))}
            />
            <TextInput
              label="Serial number"
              placeholder={Number(form.quantity) === 1 ? 'Optional — auto-generated' : 'Only for quantity 1'}
              disabled={Number(form.quantity) > 1}
              value={form.serialNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, serialNumber: safeValue(event) }))
              }
            />
          </SimpleGrid>
          <TextInput
            label="Warehouse location"
            placeholder="Main warehouse · Rack A3"
            value={form.warehouseLocation}
            onChange={(event) =>
              setForm((current) => ({ ...current, warehouseLocation: safeValue(event) }))
            }
          />
          {selectedProduct && (
            <Group gap="xl">
              <InlineStat label="Current stock" value={selectedProduct.inStock} />
              <InlineStat label="Unit price" value={formatINR(selectedProduct.product.unitPrice)} />
              <InlineStat label="Warranty" value={`${selectedProduct.product.warrantyMonths} mo`} />
            </Group>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setReceiveOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              leftSection={<PackagePlus size={15} />}
              disabled={!form.productId}
              loading={receiveMutation.isPending}
              onClick={() => receiveMutation.mutate()}
            >
              Receive {Number(form.quantity) || 1} unit(s)
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={restockOpen}
        onClose={() => setRestockOpen(false)}
        title="Request stock replenishment (routed to Director)"
        size="lg"
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" radius="md" icon={<Send size={16} />}>
            Warehouse requests go directly to the Director. If approved, the inventory procurement cost
            will be deducted from company finances and physical stock units will be created automatically.
          </Alert>
          <Select
            label="Product to restock"
            placeholder="Select a product"
            required
            searchable
            data={summary.map((row) => ({
              value: row.product.id,
              label: `${row.product.name} (${row.product.sku}) · In stock: ${row.inStock}`,
            }))}
            value={restockForm.productId || null}
            onChange={(value) => {
              const prod = summary.find((r) => r.product.id === value)?.product;
              setRestockForm((current) => ({
                ...current,
                productId: value ?? '',
                unitCost: prod ? prod.costPrice || Math.round(prod.unitPrice * 0.7) : current.unitCost,
              }));
            }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Quantity to order"
              min={1}
              max={500}
              required
              value={restockForm.quantity}
              onChange={(value) => setRestockForm((current) => ({ ...current, quantity: value }))}
            />
            <NumberInput
              label="Unit procurement cost (₹)"
              min={1}
              required
              value={restockForm.unitCost}
              onChange={(value) => setRestockForm((current) => ({ ...current, unitCost: value }))}
            />
          </SimpleGrid>
          <TextInput
            label="Procurement notes"
            placeholder="e.g. Supplier lead time 3 days, low buffer stock"
            value={restockForm.notes}
            onChange={(event) =>
              setRestockForm((current) => ({ ...current, notes: safeValue(event) }))
            }
          />
          {selectedRestockProduct && (
            <Paper p="sm" bg="sun.0" radius="md">
              <Group justify="space-between">
                <div>
                  <Text fz="xs" fw={700} c="sun.9">
                    Estimated total cost to deduct
                  </Text>
                  <Text fz={10} c="dimmed">
                    {restockForm.quantity} × {formatINR(Number(restockForm.unitCost) || 0)}
                  </Text>
                </div>
                <Text fz="lg" fw={800} className="sp-mono" c="sun.9">
                  {formatINR(
                    (Number(restockForm.quantity) || 0) * (Number(restockForm.unitCost) || 0),
                  )}
                </Text>
              </Group>
            </Paper>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRestockOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              leftSection={<Send size={15} />}
              disabled={
                !restockForm.productId ||
                !Number(restockForm.quantity) ||
                !Number(restockForm.unitCost)
              }
              loading={createRestockMutation.isPending}
              onClick={() => createRestockMutation.mutate()}
            >
              Send request to Director
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
