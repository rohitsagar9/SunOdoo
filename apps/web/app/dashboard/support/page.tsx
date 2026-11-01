'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Modal,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
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
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Headphones,
  LifeBuoy,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, safeValue, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { DashboardSupport, SupportHandoverItem, SupportLookup, Ticket } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function SupportPage() {
  return (
    <RoleGate roles={['SUPPORT', 'DIRECTOR', 'SALES', 'TECHNICIAN']}>
      <SupportDesk />
    </RoleGate>
  );
}

function SupportDesk() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSupportDesk = user?.role === 'SUPPORT' || user?.role === 'DIRECTOR';
  const canLookup = isSupportDesk || user?.role === 'SALES';
  const canCreate = isSupportDesk || user?.role === 'SALES';

  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<SupportHandoverItem | null>(null);
  const [handoverFilter, setHandoverFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [ticketForm, setTicketForm] = useState({
    phone: '',
    serialNumber: '',
    issue: '',
    faultCode: '',
    priority: 'MEDIUM',
  });

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'support'],
    enabled: isSupportDesk,
    queryFn: async () => (await api.get<DashboardSupport>('/dashboard/support')).data,
  });

  const filteredHandoverQueue = useMemo(() => {
    const queue = dashboardQuery.data?.handoverQueue ?? [];
    if (handoverFilter === 'PENDING') {
      return queue.filter((item) => item.status === 'PENDING');
    }
    return queue;
  }, [dashboardQuery.data?.handoverQueue, handoverFilter]);

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => (await api.get<Ticket[]>('/tickets')).data,
  });

  const lookupQuery = useQuery({
    queryKey: ['support', 'lookup', submitted],
    enabled: canLookup && submitted.length >= 2,
    queryFn: async () =>
      (await api.get<SupportLookup>('/support/lookup', { params: { q: submitted } })).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/tickets', {
          phone: ticketForm.phone.trim(),
          serialNumber: ticketForm.serialNumber.trim() || undefined,
          issue: ticketForm.issue.trim(),
          faultCode: ticketForm.faultCode.trim() || undefined,
          priority: ticketForm.priority,
        })
      ).data as Ticket,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewOpen(false);
      setTicketForm({ phone: '', serialNumber: '', issue: '', faultCode: '', priority: 'MEDIUM' });
      notifications.show({
        title: 'Ticket created',
        message: `${ticket.ticketNumber} · warranty ${titleCase(ticket.warrantyStatus)}.`,
        color: 'teal',
      });
      router.push(`/dashboard/support/${ticket.id}`);
    },
    onError: (error) =>
      notifications.show({ title: 'Could not create ticket', message: apiError(error), color: 'red' }),
  });

  const handoverMutation = useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post(`/dashboard/support/handover/${orderId}`)).data,
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'support'] });
      notifications.show({
        title: 'Support card & congrats sent!',
        message: data.message || 'Customer marked as MAINTENANCE.',
        color: 'teal',
      });
      setHandoverModalOpen(false);
      setSelectedHandover(null);
    },
    onError: (error) => {
      notifications.show({
        title: 'Handover failed',
        message: apiError(error),
        color: 'red',
      });
    },
  });

  const dashboard = dashboardQuery.data;
  const tickets = ticketsQuery.data ?? dashboard?.recentTickets ?? [];
  const openCount = dashboard?.kpis.open ?? tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const inProgressCount =
    dashboard?.kpis.inProgress ??
    tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
  const resolvedCount =
    dashboard?.kpis.resolved ?? tickets.filter((ticket) => ticket.status === 'RESOLVED').length;
  const warrantyExpiring = dashboard?.kpis.warrantyExpiring ?? 0;

  function openTicket(phone?: string, serialNumber?: string) {
    setTicketForm((current) => ({
      ...current,
      phone: phone ?? current.phone,
      serialNumber: serialNumber ?? current.serialNumber,
    }));
    setNewOpen(true);
  }

  return (
    <>
      <PageHeader
        eyebrow="Customer care"
        title="Support desk"
        description="Warranty lookup by phone, order or serial — then raise, assign and resolve tickets."
        actions={
          <>
            {canCreate && (
              <Button color="sun" leftSection={<Plus size={15} />} onClick={() => openTicket()}>
                New ticket
              </Button>
            )}
            <Button
              variant="light"
              color="gray"
              leftSection={<RefreshCw size={15} />}
              onClick={() => {
                ticketsQuery.refetch();
                dashboardQuery.refetch();
              }}
              loading={ticketsQuery.isFetching}
            >
              Refresh
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: isSupportDesk ? 6 : 4 }} spacing="md" mb="md">
        <StatCard
          label="Open tickets"
          value={String(openCount)}
          hint="Waiting for first response"
          icon={LifeBuoy}
          color="orange"
          tone="filled"
        />
        <StatCard
          label="In progress"
          value={String(inProgressCount)}
          hint="Crew assigned or parts ordered"
          icon={Wrench}
          color="ocean"
        />
        <StatCard
          label="Resolved"
          value={String(resolvedCount)}
          hint="Awaiting customer confirmation"
          icon={CheckCircle2}
          color="teal"
        />
        <StatCard
          label="Warranty expiring"
          value={String(warrantyExpiring)}
          hint="Within the next 30 days"
          icon={AlertTriangle}
          color="red"
        />
        {isSupportDesk && (
          <>
            <StatCard
              label="Pending Handover"
              value={String(dashboard?.kpis.pendingHandover ?? 0)}
              hint="Paid & completed orders"
              icon={Clock3}
              color="orange"
            />
            <StatCard
              label="In Maintenance"
              value={String(dashboard?.kpis.maintenanceActive ?? 0)}
              hint="Support card active"
              icon={ShieldCheck}
              color="teal"
            />
          </>
        )}
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            {canLookup && (
              <Panel
                title="Warranty & customer lookup"
                subtitle="Search by phone, name, serial number, order or ticket number"
                action={<Search size={16} color="#64748b" />}
              >
                <Group gap="sm" mb="md">
                  <TextInput
                    placeholder="9876543210 · SN-INV-3K-STK-0001 · SP-O-2026-0003"
                    leftSection={<Search size={15} />}
                    value={term}
                    onChange={(event) => setTerm(safeValue(event))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && term.trim().length >= 2) setSubmitted(term.trim());
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    color="sun"
                    disabled={term.trim().length < 2}
                    loading={lookupQuery.isFetching}
                    onClick={() => setSubmitted(term.trim())}
                  >
                    Search
                  </Button>
                </Group>

                {lookupQuery.isError && (
                  <Alert color="red" title="Lookup failed" radius="md">
                    {apiError(lookupQuery.error)}
                  </Alert>
                )}

                {lookupQuery.data && (
                  <Tabs defaultValue="customers">
                    <Tabs.List>
                      <Tabs.Tab value="customers">
                        Customers <Badge size="xs" ml={5}>{lookupQuery.data.customers.length}</Badge>
                      </Tabs.Tab>
                      <Tabs.Tab value="units">
                        Serials <Badge size="xs" ml={5}>{lookupQuery.data.units.length}</Badge>
                      </Tabs.Tab>
                      <Tabs.Tab value="orders">
                        Orders <Badge size="xs" ml={5}>{lookupQuery.data.orders.length}</Badge>
                      </Tabs.Tab>
                      <Tabs.Tab value="tickets">
                        Tickets <Badge size="xs" ml={5}>{lookupQuery.data.tickets.length}</Badge>
                      </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="customers" pt="md">
                      <ScrollArea h={340}>
                        <Stack gap="sm">
                          {lookupQuery.data.customers.map((customer) => (
                            <Box
                              key={customer.id}
                              p="sm"
                              style={{
                                border: '1px solid var(--sp-border)',
                                borderRadius: 10,
                                background: 'var(--sp-card-subtle)',
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap">
                                <div>
                                  <Text fz="sm" fw={700}>
                                    {customer.name}
                                  </Text>
                                  <Text fz={10} c="dimmed" className="sp-mono">
                                    {customer.phone} · {customer.city ?? customer.address}
                                  </Text>
                                </div>
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  color="sun"
                                  leftSection={<Plus size={12} />}
                                  onClick={() => openTicket(customer.phone)}
                                >
                                  Ticket
                                </Button>
                              </Group>
                              {customer.orders.length > 0 && (
                                <Stack gap={3} mt={6}>
                                  {customer.orders.map((order) => (
                                    <Group key={order.id} justify="space-between" wrap="nowrap">
                                      <Text fz={10} c="dimmed" className="sp-mono">
                                        {order.orderNumber} · {order.quote.capacityKw} kW ·{' '}
                                        {titleCase(order.status)}
                                      </Text>
                                      <Text fz={10} className="sp-mono">
                                        bal {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(order.balanceDue)}
                                      </Text>
                                    </Group>
                                  ))}
                                </Stack>
                              )}
                              {customer.tickets.length > 0 && (
                                <Text fz={10} c="dimmed" mt={4}>
                                  {customer.tickets.length} ticket(s):{' '}
                                  {customer.tickets.map((ticket) => ticket.ticketNumber).join(', ')}
                                </Text>
                              )}
                            </Box>
                          ))}
                          {lookupQuery.data.customers.length === 0 && (
                            <Text fz="sm" c="dimmed">
                              No customer matches “{lookupQuery.data.query}”.
                            </Text>
                          )}
                        </Stack>
                      </ScrollArea>
                    </Tabs.Panel>

                    <Tabs.Panel value="units" pt="md">
                      <ScrollArea h={340}>
                        <Table verticalSpacing="xs" horizontalSpacing="sm" miw={600}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Serial</Table.Th>
                              <Table.Th>Product</Table.Th>
                              <Table.Th>Customer</Table.Th>
                              <Table.Th>Warranty</Table.Th>
                              <Table.Th ta="right" />
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {lookupQuery.data.units.map((unit) => (
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
                                  <Text fz="xs">{unit.order?.customer.name ?? '—'}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <StatusBadge status={unit.warrantyStatus} size="xs" />
                                  <Text fz={10} c="dimmed">
                                    {unit.warrantyDaysLeft != null
                                      ? `${unit.warrantyDaysLeft} days left`
                                      : 'No warranty date'}
                                  </Text>
                                </Table.Td>
                                <Table.Td ta="right">
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    color="sun"
                                    onClick={() =>
                                      openTicket(unit.order?.customer.phone, unit.serialNumber)
                                    }
                                  >
                                    Raise
                                  </Button>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                            {lookupQuery.data.units.length === 0 && (
                              <Table.Tr>
                                <Table.Td colSpan={5}>
                                  <Text fz="xs" c="dimmed" ta="center" py="sm">
                                    No serial matches.
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            )}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </Tabs.Panel>

                    <Tabs.Panel value="orders" pt="md">
                      <Stack gap="sm">
                        {lookupQuery.data.orders.map((order) => (
                          <PaperRow
                            key={order.id}
                            title={order.orderNumber}
                            subtitle={`${order.customer.name} · ${order.quote?.capacityKw ?? '—'} kW`}
                            status={order.status}
                            href={`/dashboard/orders/${order.id}`}
                          />
                        ))}
                        {lookupQuery.data.orders.length === 0 && (
                          <Text fz="sm" c="dimmed">
                            No order matches.
                          </Text>
                        )}
                      </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="tickets" pt="md">
                      <Stack gap="sm">
                        {lookupQuery.data.tickets.map((ticket) => (
                          <PaperRow
                            key={ticket.id}
                            title={ticket.ticketNumber}
                            subtitle={`${ticket.customer.name} · ${ticket.issue}`}
                            status={ticket.status}
                            href={`/dashboard/support/${ticket.id}`}
                          />
                        ))}
                        {lookupQuery.data.tickets.length === 0 && (
                          <Text fz="sm" c="dimmed">
                            No ticket matches.
                          </Text>
                        )}
                      </Stack>
                    </Tabs.Panel>
                  </Tabs>
                )}
                {!lookupQuery.data && !lookupQuery.isFetching && (
                  <Alert color="blue" variant="light" radius="md" icon={<ShieldCheck size={16} />}>
                    Try a phone number from the demo seed, e.g. <b>9876543218</b> (Lakshmi, in
                    warranty) or serial <b>SN-INV-3K-STK-0002</b> (Ramesh, out of warranty).
                  </Alert>
                )}
              </Panel>
            )}

            {isSupportDesk && dashboard?.handoverQueue && dashboard.handoverQueue.length > 0 && (
              <Panel
                title="AMC & Support Handover"
                action={
                  <SegmentedControl
                    size="xs"
                    value={handoverFilter}
                    onChange={(v) => setHandoverFilter(v as 'PENDING' | 'ALL')}
                    data={[
                      { label: `Pending Handover (${dashboard.kpis.pendingHandover ?? 0})`, value: 'PENDING' },
                      { label: `All Completed (${dashboard.handoverQueue.length})`, value: 'ALL' },
                    ]}
                    color="sun"
                  />
                }
                padding={0}
              >
                <ScrollArea>
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={750}>
                    <Table.Thead style={{ background: 'var(--sp-card-subtle)', borderBottom: '1px solid var(--sp-border)' }}>
                      <Table.Tr>
                        <Table.Th style={{ width: '32%' }}>Customer & Order</Table.Th>
                        <Table.Th style={{ width: '22%' }}>System Specs</Table.Th>
                        <Table.Th style={{ width: '16%' }}>Installation</Table.Th>
                        <Table.Th style={{ width: '15%' }}>Handover Status</Table.Th>
                        <Table.Th style={{ width: '15%' }}>Action</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredHandoverQueue.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px' }}>
                            <Text fz="sm" c="dimmed">
                              ✓ All completed installations have been handed over. No pending handovers at this moment.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        filteredHandoverQueue.map((item) => (
                          <Table.Tr key={item.id} style={{ borderBottom: '1px solid var(--sp-border)' }}>
                            <Table.Td>
                              <Text fz="sm" fw={700} style={{ color: 'var(--sp-headings)' }}>
                                {item.customerName}
                              </Text>
                              <Text fz={10} c="dimmed" className="sp-mono">
                                {item.orderNumber} · {item.customerPhone}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="xs" fw={600}>
                                {item.systemSizeKw} kW {titleCase(item.systemType)}
                              </Text>
                              <Text fz={10} c={item.balanceDue && item.balanceDue > 0 ? 'orange.7' : 'teal.7'} fw={600}>
                                {formatINR(item.total)} · {item.balanceDue && item.balanceDue > 0 ? `Advance Paid (Balance: ${formatINR(item.balanceDue)})` : '100% Paid'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="xs">
                                {formatDate(item.installedAt || item.completedAt)}
                              </Text>
                              <Text fz={10} c="dimmed">
                                Tech: {item.technicianName}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {item.status === 'MAINTENANCE' ? (
                                <div>
                                  <Badge color="teal" variant="light" size="sm">
                                    MAINTENANCE ACTIVE
                                  </Badge>
                                  <Text fz={10} c="dimmed" mt={2}>
                                    Card {item.cardCode} sent
                                  </Text>
                                </div>
                              ) : (
                                <div>
                                  <Badge color="orange" variant="light" size="sm">
                                    PENDING
                                  </Badge>
                                  <Text fz={10} c="dimmed" mt={2}>
                                    Awaiting support card
                                  </Text>
                                </div>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={6} wrap="nowrap" align="center">
                                <Button
                                  size="compact-xs"
                                  variant="subtle"
                                  color="orange"
                                  leftSection={<Wrench size={12} />}
                                  title="Raise repair / service ticket"
                                  onClick={() => {
                                    const primarySerial = item.warrantyUnits?.[0]?.serialNumber || '';
                                    setTicketForm({
                                      phone: item.customerPhone,
                                      serialNumber: primarySerial,
                                      issue: `Post-installation service & repair for ${item.customerName} (${item.systemSizeKw} kW ${titleCase(item.systemType)} plant, Order ${item.orderNumber}): `,
                                      faultCode: '',
                                      priority: 'MEDIUM',
                                    });
                                    setNewOpen(true);
                                  }}
                                >
                                  Repair
                                </Button>
                                {item.status === 'PENDING' ? (
                                  <Button
                                    size="compact-xs"
                                    color="teal"
                                    leftSection={<Send size={12} />}
                                    onClick={() => {
                                      setSelectedHandover(item);
                                      setHandoverModalOpen(true);
                                    }}
                                  >
                                    Congrats & Card
                                  </Button>
                                ) : (
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    color="teal"
                                    leftSection={<ShieldCheck size={12} />}
                                    onClick={() => {
                                      setSelectedHandover(item);
                                      setHandoverModalOpen(true);
                                    }}
                                  >
                                    Support Card
                                  </Button>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Panel>
            )}

            <Panel
              title={isSupportDesk ? 'Recent tickets' : 'All tickets'}
              subtitle="Warranty status is set automatically from the serial"
              action={<LifeBuoy size={16} color="#64748b" />}
              padding={0}
            >
              {ticketsQuery.isLoading ? (
                <LoadingState label="Loading tickets…" />
              ) : ticketsQuery.isError ? (
                <Alert color="red" title="Could not load tickets">
                  {apiError(ticketsQuery.error)}
                </Alert>
              ) : tickets.length === 0 ? (
                <EmptyState title="No tickets" description="Customer issues raised from the portal appear here." />
              ) : (
                <ScrollArea>
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={820}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Ticket</Table.Th>
                        <Table.Th>Customer</Table.Th>
                        <Table.Th>Issue</Table.Th>
                        <Table.Th>Priority</Table.Th>
                        <Table.Th>Warranty</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Assigned</Table.Th>
                        <Table.Th ta="right" />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {tickets.map((ticket) => (
                        <Table.Tr key={ticket.id}>
                          <Table.Td>
                            <Text fz="sm" fw={700} component={Link} href={`/dashboard/support/${ticket.id}`} className="sp-mono">
                              {ticket.ticketNumber}
                            </Text>
                            <Text fz={10} c="dimmed">
                              {formatDate(ticket.createdAt)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fz="sm">{ticket.customer.name}</Text>
                            <Text fz={10} c="dimmed" className="sp-mono">
                              {ticket.customer.phone}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fz="xs" lineClamp={2} maw={220}>
                              {ticket.issue}
                            </Text>
                            {ticket.serialNumber && (
                              <Text fz={10} c="dimmed" className="sp-mono">
                                {ticket.serialNumber}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={ticket.priority} size="xs" />
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={ticket.warrantyStatus} size="xs" />
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={ticket.status} size="xs" />
                          </Table.Td>
                          <Table.Td>
                            <Text fz="xs">{ticket.assignedTo?.name ?? 'Unassigned'}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Button
                              component={Link}
                              href={`/dashboard/support/${ticket.id}`}
                              size="compact-xs"
                              color="sun"
                              rightSection={<ArrowRight size={12} />}
                            >
                              Open
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Panel>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {dashboard && (
              <Panel
                title="Warranty expiring soon"
                subtitle="Proactive renewal or AMC conversations"
                action={<AlertTriangle size={16} color="#dc2626" />}
              >
                <Stack gap="sm">
                  {dashboard.warrantyUnits.map((unit) => (
                    <Box
                      key={unit.id}
                      p="sm"
                      style={{
                        border: '1px solid var(--sp-border)',
                        borderRadius: 10,
                        background: 'var(--sp-card-subtle)',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="xs" fw={700} className="sp-mono" style={{ color: 'var(--sp-headings)' }}>
                            {unit.serialNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {unit.product.name} · {unit.order?.customer.name ?? '—'}
                          </Text>
                        </div>
                        <Badge size="xs" color={unit.daysLeft != null && unit.daysLeft <= 7 ? 'red' : 'orange'} variant="light">
                          {unit.daysLeft}d
                        </Badge>
                      </Group>
                      <Group justify="space-between" mt={4}>
                        <Text fz={10} c="dimmed">
                          Ends {formatDate(unit.warrantyEnd)}
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          onClick={() => openTicket(unit.order?.customer.phone, unit.serialNumber)}
                        >
                          Contact
                        </Button>
                      </Group>
                    </Box>
                  ))}
                  {dashboard.warrantyUnits.length === 0 && (
                    <Text fz="sm" c="dimmed">
                      No warranties expiring in the next 30 days.
                    </Text>
                  )}
                </Stack>
              </Panel>
            )}

            {dashboard && (
              <Panel title="Warranty mix" subtitle="All tickets by warranty status">
                <Stack gap="sm">
                  {dashboard.warrantyCounts.map((row) => {
                    const total = dashboard.warrantyCounts.reduce((sum, item) => sum + item.count, 0) || 1;
                    return (
                      <Box key={row.status}>
                        <Group justify="space-between" mb={4}>
                          <Text fz="xs" fw={600}>
                            {titleCase(row.status)}
                          </Text>
                          <Text fz="xs" c="dimmed">
                            {row.count}
                          </Text>
                        </Group>
                        <Progress
                          value={(row.count / total) * 100}
                          color={
                            row.status === 'IN_WARRANTY'
                              ? 'teal'
                              : row.status === 'OUT_OF_WARRANTY'
                                ? 'red'
                                : 'gray'
                          }
                          size="sm"
                        />
                      </Box>
                    );
                  })}
                  {dashboard.warrantyCounts.length === 0 && (
                    <Text fz="sm" c="dimmed">
                      No ticket history yet.
                    </Text>
                  )}
                </Stack>
              </Panel>
            )}

            <Panel title="Support playbook" subtitle="Fast, fair, documented">
              <Stack gap="sm">
                {[
                  ['Verify the serial first', 'Warranty status is automatic from the serial number.'],
                  ['Log every call', 'Ticket updates keep the customer portal and director view in sync.'],
                  ['Quote billable repairs', 'Labour and parts become an 18% GST invoice on resolve.'],
                  ['Confirm the fix', 'The customer closes the loop from the portal.'],
                ].map(([title, text]) => (
                  <Group key={title} gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon size={28} radius="md" color="grape" variant="light">
                      <CheckCircle2 size={14} />
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

            <Panel title="Urgent queue" subtitle="Highest priority first">
              <Stack gap="sm">
                {tickets
                  .filter((ticket) => ['URGENT', 'HIGH'].includes(ticket.priority))
                  .slice(0, 5)
                  .map((ticket) => (
                    <Group key={ticket.id} justify="space-between" wrap="nowrap">
                      <div>
                        <Text fz="xs" fw={600}>
                          {ticket.customer.name}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {ticket.ticketNumber} · {titleCase(ticket.priority)}
                        </Text>
                      </div>
                      <Siren size={14} color="#dc2626" />
                    </Group>
                  ))}
                {tickets.filter((ticket) => ['URGENT', 'HIGH'].includes(ticket.priority)).length === 0 && (
                  <Group gap="sm">
                    <Clock3 size={15} color="#94a3b8" />
                    <Text fz="sm" c="dimmed">
                      No high-priority tickets.
                    </Text>
                  </Group>
                )}
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={newOpen} onClose={() => setNewOpen(false)} title="Raise support ticket" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light" radius="md" icon={<Headphones size={16} />}>
            The customer must already exist (from an enquiry or order). Add the serial to
            auto-detect warranty.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Customer phone"
              placeholder="9876543210"
              required
              value={ticketForm.phone}
              onChange={(event) =>
                setTicketForm((current) => ({ ...current, phone: safeValue(event) }))
              }
            />
            <TextInput
              label="Serial number (optional)"
              placeholder="SN-INV-3K-STK-0001"
              value={ticketForm.serialNumber}
              onChange={(event) =>
                setTicketForm((current) => ({ ...current, serialNumber: safeValue(event) }))
              }
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Fault code"
              placeholder="E-03, Wi-Fi, no display…"
              value={ticketForm.faultCode}
              onChange={(event) =>
                setTicketForm((current) => ({ ...current, faultCode: safeValue(event) }))
              }
            />
            <Select
              label="Priority"
              data={['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => ({ value, label: titleCase(value) }))}
              value={ticketForm.priority}
              onChange={(value) =>
                setTicketForm((current) => ({ ...current, priority: value ?? 'MEDIUM' }))
              }
              allowDeselect={false}
            />
          </SimpleGrid>
          <Textarea
            label="What is the issue?"
            placeholder="Inverter trips at noon, battery not charging, monitoring offline…"
            minRows={4}
            required
            value={ticketForm.issue}
            onChange={(event) =>
              setTicketForm((current) => ({ ...current, issue: safeValue(event) }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              leftSection={<Plus size={15} />}
              disabled={ticketForm.phone.trim().length < 10 || ticketForm.issue.trim().length < 10}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create ticket
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={handoverModalOpen}
        onClose={() => {
          setHandoverModalOpen(false);
          setSelectedHandover(null);
        }}
        title={
          <Group gap="xs">
            <ShieldCheck size={20} color="#0f766e" />
            <Text fw={700}>SunOdoo Customer Welcome & Support Handover Card</Text>
          </Group>
        }
        size="lg"
      >
        {selectedHandover && (
          <Stack gap="md">
            <Box
              p="md"
              style={{
                borderRadius: 12,
                background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
              }}
            >
              <Group justify="space-between" align="flex-start" mb="xs">
                <div>
                  <Text fz={10} fw={700} style={{ letterSpacing: 1.5, opacity: 0.85, color: '#ffffff' }}>
                    SUNODOO SOLAR CARE · AMC CARD
                  </Text>
                  <Text fz="lg" fw={800} style={{ color: '#ffffff' }}>
                    {selectedHandover.customerName}
                  </Text>
                  <Text fz="xs" style={{ opacity: 0.9, color: '#ffffff' }}>
                    {selectedHandover.customerPhone} · {selectedHandover.customerCity || selectedHandover.customerAddress || 'Customer Site'}
                  </Text>
                </div>
                <Badge color="yellow" variant="filled" size="md">
                  {selectedHandover.status === 'MAINTENANCE' ? 'MAINTENANCE ACTIVE' : 'PENDING ACTIVATION'}
                </Badge>
              </Group>

              <Group justify="space-between" mt="md" pt="sm" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                <div>
                  <Text fz={10} style={{ opacity: 0.8, color: '#ffffff' }}>SYSTEM SPECIFICATION</Text>
                  <Text fz="xs" fw={700} style={{ color: '#ffffff' }}>
                    {selectedHandover.systemSizeKw} kW {titleCase(selectedHandover.systemType)}
                  </Text>
                </div>
                <div>
                  <Text fz={10} style={{ opacity: 0.8, color: '#ffffff' }}>ORDER REF</Text>
                  <Text fz="xs" fw={700} className="sp-mono" style={{ color: '#ffffff' }}>
                    {selectedHandover.orderNumber}
                  </Text>
                </div>
                <div>
                  <Text fz={10} style={{ opacity: 0.8, color: '#ffffff' }}>AMC CARD CODE</Text>
                  <Text fz="xs" fw={700} className="sp-mono" style={{ color: '#ffffff' }}>
                    {selectedHandover.cardCode}
                  </Text>
                </div>
              </Group>
            </Box>

            <Box
              p="sm"
              style={{
                borderRadius: 10,
                background: 'var(--sp-card)',
                border: '1px solid var(--sp-border)',
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon size={26} radius="md" color="sun" variant="light">
                    <FileText size={14} />
                  </ThemeIcon>
                  <Text fz="xs" fw={700} style={{ color: 'var(--sp-headings)' }}>
                    Customer Bill & Tax Invoice
                  </Text>
                </Group>
                <Badge color="teal" variant="light" size="xs">
                  100% PAID · SETTLED
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs" mb="xs">
                <Box p="xs" style={{ background: 'var(--sp-card-subtle)', borderRadius: 6, border: '1px solid var(--sp-border)' }}>
                  <Text fz={10} c="dimmed">Invoice Number</Text>
                  <Text fz="xs" fw={700} className="sp-mono">
                    {selectedHandover.invoice?.invoiceNumber || `INV-${selectedHandover.orderNumber}`}
                  </Text>
                </Box>
                <Box p="xs" style={{ background: 'var(--sp-card-subtle)', borderRadius: 6, border: '1px solid var(--sp-border)' }}>
                  <Text fz={10} c="dimmed">Total Billed Amount</Text>
                  <Text fz="xs" fw={700} className="sp-mono" c="teal.7">
                    {formatINR(selectedHandover.invoice?.total || selectedHandover.total)}
                  </Text>
                </Box>
                <Box p="xs" style={{ background: 'var(--sp-card-subtle)', borderRadius: 6, border: '1px solid var(--sp-border)' }}>
                  <Text fz={10} c="dimmed">Completion Date</Text>
                  <Text fz="xs">
                    {formatDate(selectedHandover.invoice?.createdAt || selectedHandover.completedAt || selectedHandover.installedAt)}
                  </Text>
                </Box>
              </SimpleGrid>

              <Group justify="flex-end">
                <Button
                  component={Link}
                  href={`/dashboard/orders/${selectedHandover.id}`}
                  size="compact-xs"
                  variant="subtle"
                  color="ocean"
                  rightSection={<ArrowRight size={12} />}
                >
                  View Order Details & Invoices
                </Button>
              </Group>
            </Box>

            <Box
              p="sm"
              style={{
                borderRadius: 10,
                background: 'var(--sp-card)',
                border: '1px solid var(--sp-border)',
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon size={26} radius="md" color="teal" variant="light">
                    <ShieldCheck size={14} />
                  </ThemeIcon>
                  <Text fz="xs" fw={700} style={{ color: 'var(--sp-headings)' }}>
                    Official Warranty Card & Covered Hardware Serials
                  </Text>
                </Group>
                <Badge size="xs" color="teal" variant="light">
                  {selectedHandover.warrantyUnits?.length ?? 0} components
                </Badge>
              </Group>

              <Stack gap={6}>
                {(selectedHandover.warrantyUnits ?? []).map((unit) => {
                  const expiry = unit.warrantyExpiresAt || unit.warrantyEnd;
                  return (
                    <Group
                      key={unit.id || unit.serialNumber}
                      justify="space-between"
                      p={6}
                      style={{
                        background: 'var(--sp-card-subtle)',
                        borderRadius: 6,
                        border: '1px solid var(--sp-border)',
                      }}
                    >
                      <div>
                        <Text fz="xs" fw={700} className="sp-mono">
                          {unit.serialNumber}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {unit.productName} · {unit.category ? titleCase(unit.category) : 'Solar Component'}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Badge size="xs" color="teal" variant="light">
                          {unit.warrantyMonths ? Math.round(unit.warrantyMonths / 12) : 10} Yr Warranty
                        </Badge>
                        {expiry && (
                          <Text fz={10} c="dimmed" mt={2}>
                            Valid till {formatDate(expiry)}
                          </Text>
                        )}
                      </div>
                    </Group>
                  );
                })}
                {(!selectedHandover.warrantyUnits || selectedHandover.warrantyUnits.length === 0) && (
                  <Text fz="xs" c="dimmed">
                    Solar array and central inverter covered under 25-yr / 10-yr manufacturer warranty.
                  </Text>
                )}
              </Stack>
            </Box>

            <Box
              p="sm"
              style={{
                borderRadius: 8,
                background: 'var(--sp-card-subtle)',
                border: '1px solid var(--sp-border)',
              }}
            >
              <Text fz="xs" fw={700} mb={4} style={{ color: 'var(--sp-headings)' }}>
                Customer Welcome & Congratulations Dispatch:
              </Text>
              <Text fz="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                “Dear <b>{selectedHandover.customerName}</b>, congratulations on the successful installation and 100% payment clearance of your <b>{selectedHandover.systemSizeKw} kW SunOdoo Solar System</b>! Your system is now officially covered under our Comprehensive Maintenance Program (AMC Card: <b>{selectedHandover.cardCode}</b>). Our support hotline <b>1800-SUNODOO</b> is available 24/7 for regular checkups, net-metering assistance, and priority warranty service.”
              </Text>
            </Box>

            <SimpleGrid cols={2} spacing="xs">
              <Box p="xs" style={{ border: '1px solid var(--sp-border)', borderRadius: 8 }}>
                <Text fz={10} c="dimmed">Warranty Coverage</Text>
                <Text fz="xs" fw={700} style={{ color: 'var(--sp-headings)' }}>25-Yr Panel / 10-Yr Inverter</Text>
              </Box>
              <Box p="xs" style={{ border: '1px solid var(--sp-border)', borderRadius: 8 }}>
                <Text fz={10} c="dimmed">Dedicated Support Helpline</Text>
                <Text fz="xs" fw={700} style={{ color: 'var(--sp-headings)' }}>1800-SUNODOO (+91 800-786-6366)</Text>
              </Box>
            </SimpleGrid>

            {selectedHandover.status === 'MAINTENANCE' ? (
              <Alert color="teal" variant="light" icon={<CheckCircle2 size={16} />}>
                Support card was issued and congrats sent on{' '}
                {formatDate(selectedHandover.congratsSentAt)} by{' '}
                {selectedHandover.sentBy || 'Support Team'}. Status is <b>MAINTENANCE ACTIVE</b>.
              </Alert>
            ) : (
              <Alert color="orange" variant="light" icon={<Clock3 size={16} />}>
                Installation is completed and payment is fully settled. Click below to dispatch
                the congratulatory greeting, generate the AMC support card, and mark the account as <b>MAINTENANCE</b>.
              </Alert>
            )}

            <Group justify="space-between" gap="sm" wrap="wrap">
              <Button
                variant="light"
                color="orange"
                leftSection={<Wrench size={14} />}
                onClick={() => {
                  const primarySerial = selectedHandover.warrantyUnits?.[0]?.serialNumber || '';
                  setTicketForm({
                    phone: selectedHandover.customerPhone,
                    serialNumber: primarySerial,
                    issue: `Service & repair visit for ${selectedHandover.customerName} (${selectedHandover.systemSizeKw} kW ${titleCase(selectedHandover.systemType)} plant, Order ${selectedHandover.orderNumber}): `,
                    faultCode: '',
                    priority: 'MEDIUM',
                  });
                  setHandoverModalOpen(false);
                  setNewOpen(true);
                }}
              >
                Create Repair Work Ticket
              </Button>

              <Group gap="sm">
                <Button
                  variant="default"
                  onClick={() => {
                    setHandoverModalOpen(false);
                    setSelectedHandover(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="light"
                  color="indigo"
                  leftSection={<Printer size={15} />}
                  onClick={() => window.print()}
                >
                  Download / Print Congrats PDF
                </Button>
                {selectedHandover.status === 'PENDING' && (
                  <Button
                    color="teal"
                    leftSection={<Send size={15} />}
                    loading={handoverMutation.isPending}
                    onClick={() => handoverMutation.mutate(selectedHandover.id)}
                  >
                    Send Congrats & Support Card
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

function PaperRow({
  title,
  subtitle,
  status,
  href,
}: {
  title: string;
  subtitle: string;
  status: string;
  href: string;
}) {
  return (
    <Box
      component={Link}
      href={href}
      p="sm"
      style={{ border: '1px solid var(--sp-border)', borderRadius: 10, background: 'var(--sp-card-subtle)' }}
      className="sp-hover-lift"
    >
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fz="sm" fw={700} className="sp-mono">
            {title}
          </Text>
          <Text fz={10} c="dimmed" lineClamp={1}>
            {subtitle}
          </Text>
        </div>
        <StatusBadge status={status} size="xs" />
      </Group>
    </Box>
  );
}
