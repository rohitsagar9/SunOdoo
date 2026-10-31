'use client';

import { useState } from 'react';
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
  Headphones,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { DashboardSupport, SupportLookup, Ticket } from '@/lib/types';
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

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
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
                    onChange={(event) => setTerm(event.currentTarget.value)}
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
                            <Box key={customer.id} p="sm" style={{ border: '1px solid #eef2f7', borderRadius: 10 }}>
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
                      style={{ border: '1px solid #fef2f2', borderRadius: 10, background: '#fffafa' }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="xs" fw={700} className="sp-mono">
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
                setTicketForm((current) => ({ ...current, phone: event.currentTarget.value }))
              }
            />
            <TextInput
              label="Serial number (optional)"
              placeholder="SN-INV-3K-STK-0001"
              value={ticketForm.serialNumber}
              onChange={(event) =>
                setTicketForm((current) => ({ ...current, serialNumber: event.currentTarget.value }))
              }
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Fault code"
              placeholder="E-03, Wi-Fi, no display…"
              value={ticketForm.faultCode}
              onChange={(event) =>
                setTicketForm((current) => ({ ...current, faultCode: event.currentTarget.value }))
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
              setTicketForm((current) => ({ ...current, issue: event.currentTarget.value }))
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
      style={{ border: '1px solid #eef2f7', borderRadius: 10 }}
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
