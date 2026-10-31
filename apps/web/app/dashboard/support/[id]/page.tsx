'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  IndianRupee,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, safeValue, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { AuthUser, Ticket } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statusOptions = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((value) => ({
  value,
  label: titleCase(value),
}));
const priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => ({
  value,
  label: titleCase(value),
}));
const methodOptions = ['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE'].map((value) => ({
  value,
  label: titleCase(value),
}));

export default function TicketDetailPage() {
  return (
    <RoleGate roles={['SUPPORT', 'DIRECTOR', 'SALES', 'TECHNICIAN']}>
      <TicketDetail />
    </RoleGate>
  );
}

function TicketDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'UPI', reference: '' });
  const [work, setWork] = useState({
    status: 'OPEN',
    priority: 'MEDIUM',
    assignedToId: '',
    laborCharge: '0',
    partsCharge: '0',
    resolution: '',
  });

  const canEdit = user?.role === 'SUPPORT' || user?.role === 'DIRECTOR';
  const canRecordPayment = user?.role === 'SALES' || user?.role === 'DIRECTOR';

  const query = useQuery({
    queryKey: ['ticket', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Ticket>(`/tickets/${id}`)).data,
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    enabled: canEdit,
    queryFn: async () => (await api.get<AuthUser[]>('/auth/users')).data,
  });

  const ticket = query.data;

  useEffect(() => {
    if (!ticket) return;
    setWork({
      status: ticket.status,
      priority: ticket.priority,
      assignedToId: ticket.assignedToId ?? '',
      laborCharge: String(ticket.laborCharge ?? 0),
      partsCharge: String(ticket.partsCharge ?? 0),
      resolution: ticket.resolution ?? '',
    });
  }, [ticket?.id, ticket?.updatedAt]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  }

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.patch(`/tickets/${id}`, payload)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({ title: 'Ticket updated', message: 'Saved.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update ticket', message: apiError(error), color: 'red' }),
  });

  const noteMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/tickets/${id}/updates`, { message: note.trim() })).data,
    onSuccess: () => {
      invalidate();
      setNote('');
      notifications.show({ title: 'Update posted', message: 'The customer portal sees this note.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not post update', message: apiError(error), color: 'red' }),
  });

  const paymentMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/payments', {
          ticketId: id,
          amount: payment.amount,
          method: payment.method,
          type: 'FULL',
          reference: payment.reference || undefined,
          notes: `Repair payment for ${ticket?.ticketNumber}`,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      setPayOpen(false);
      notifications.show({
        title: 'Repair payment recorded',
        message: 'It is now in the office payment queue for approval.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not record payment', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) return <LoadingState label="Loading the ticket…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load ticket">{apiError(query.error)}</Alert>;
  }
  if (!ticket) return null;

  const updates = ticket.updates ?? [];
  const invoices = ticket.invoices ?? [];
  const payments = ticket.payments ?? [];
  const staff = (usersQuery.data ?? []).filter((person) =>
    ['SUPPORT', 'TECHNICIAN', 'DIRECTOR'].includes(person.role),
  );
  const invoice = invoices[0];
  const totalCharge = Number(work.laborCharge || 0) + Number(work.partsCharge || 0);

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Group gap="sm">
          <Button
            component={Link}
            href="/dashboard/support"
            variant="subtle"
            color="gray"
            leftSection={<ArrowLeft size={15} />}
          >
            Support desk
          </Button>
          <div>
            <Text fz={11} fw={700} tt="uppercase" c="grape.7" style={{ letterSpacing: '0.12em' }}>
              {ticket.ticketNumber}
            </Text>
            <Text fw={800} fz={24} style={{ letterSpacing: '-0.03em' }}>
              {ticket.customer.name}
            </Text>
            <Text fz="xs" c="dimmed">
              Raised {formatDateTime(ticket.createdAt)} · {titleCase(ticket.priority)} priority
            </Text>
          </div>
          <StatusBadge status={ticket.status} />
          <StatusBadge status={ticket.warrantyStatus} />
        </Group>
        <Group gap="sm" wrap="wrap">
          <Button
            component="a"
            href={`tel:${ticket.customer.phone}`}
            variant="light"
            color="teal"
            leftSection={<Phone size={15} />}
          >
            Call customer
          </Button>
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={15} />}
            onClick={() => query.refetch()}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Warranty
            </Text>
            <ShieldCheck size={15} color={ticket.warrantyStatus === 'IN_WARRANTY' ? '#0f766e' : '#dc2626'} />
          </Group>
          <Text fz={20} fw={800}>
            {titleCase(ticket.warrantyStatus)}
          </Text>
          <Text fz={10} c="dimmed">
            {ticket.warrantyEnd ? `Ends ${formatDate(ticket.warrantyEnd)}` : 'No serial linked'}
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Billable
            </Text>
            <IndianRupee size={15} color="#d97706" />
          </Group>
          <Text fz={20} fw={800}>
            {ticket.billable ? formatINR(ticket.totalCharge) : 'In warranty'}
          </Text>
          <Text fz={10} c="dimmed">
            {ticket.billable ? `${formatINR(ticket.laborCharge)} labour + ${formatINR(ticket.partsCharge)} parts` : 'No charge to customer'}
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Assigned
            </Text>
            <Wrench size={15} color="#64748b" />
          </Group>
          <Text fz={20} fw={800} lineClamp={1}>
            {ticket.assignedTo?.name ?? 'Unassigned'}
          </Text>
          <Text fz={10} c="dimmed">
            {ticket.product?.name ?? 'No product linked'}
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Updates
            </Text>
            <MessageSquare size={15} color="#64748b" />
          </Group>
          <Text fz={20} fw={800} className="sp-mono">
            {updates.length}
          </Text>
          <Text fz={10} c="dimmed">
            {ticket.customerConfirmedAt ? 'Customer confirmed' : 'Awaiting confirmation'}
          </Text>
        </Paper>
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Panel title="Reported issue" subtitle="What the customer described">
              <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {ticket.issue}
              </Text>
              <Divider my="md" />
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                <InlineStat label="Fault code" value={ticket.faultCode ?? '—'} />
                <InlineStat label="Serial" value={ticket.serialNumber ?? '—'} />
                <InlineStat
                  label="Product"
                  value={ticket.product?.name ?? '—'}
                />
              </SimpleGrid>
              {ticket.order && (
                <Button
                  component={Link}
                  href={`/dashboard/orders/${ticket.order.id}`}
                  variant="light"
                  color="sun"
                  mt="md"
                  leftSection={<ArrowRight size={14} />}
                >
                  Order {ticket.order.orderNumber}
                </Button>
              )}
            </Panel>

            {canEdit && (
              <Panel
                title="Repair workflow"
                subtitle="Assign, price and resolve. Charges create an 18% GST invoice."
                action={<Wrench size={16} color="#64748b" />}
              >
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Select
                      label="Status"
                      data={statusOptions}
                      value={work.status}
                      onChange={(value) => setWork((current) => ({ ...current, status: value ?? 'OPEN' }))}
                      allowDeselect={false}
                    />
                    <Select
                      label="Priority"
                      data={priorityOptions}
                      value={work.priority}
                      onChange={(value) =>
                        setWork((current) => ({ ...current, priority: value ?? 'MEDIUM' }))
                      }
                      allowDeselect={false}
                    />
                    <Select
                      label="Assign to"
                      placeholder="Support or technician"
                      data={staff.map((person) => ({
                        value: person.id,
                        label: `${person.name} · ${titleCase(person.role)}`,
                      }))}
                      value={work.assignedToId || null}
                      onChange={(value) =>
                        setWork((current) => ({ ...current, assignedToId: value ?? '' }))
                      }
                      clearable
                      searchable
                    />
                    <NumberInput
                      label="Labour charge (₹)"
                      min={0}
                      value={work.laborCharge}
                      onChange={(value) =>
                        setWork((current) => ({ ...current, laborCharge: String(value) }))
                      }
                    />
                    <NumberInput
                      label="Parts charge (₹)"
                      min={0}
                      value={work.partsCharge}
                      onChange={(value) =>
                        setWork((current) => ({ ...current, partsCharge: String(value) }))
                      }
                    />
                    <div>
                      <Text fz="sm" fw={500} mb={6}>
                        Total charge
                      </Text>
                      <Text fz="lg" fw={800} className="sp-mono" c={totalCharge > 0 ? 'orange.7' : 'teal.7'}>
                        {totalCharge > 0 ? formatINR(totalCharge) : 'Free (warranty)'}
                      </Text>
                    </div>
                  </SimpleGrid>
                  <Textarea
                    label="Resolution notes"
                    placeholder="What was replaced, tested and handed over?"
                    minRows={3}
                    value={work.resolution}
                    onChange={(event) =>
                      setWork((current) => ({ ...current, resolution: safeValue(event) }))
                    }
                  />
                  <Group justify="space-between" wrap="wrap">
                    <Button
                      variant="light"
                      color="gray"
                      onClick={() =>
                        updateMutation.mutate({
                          status: work.status,
                          priority: work.priority,
                          assignedToId: work.assignedToId || null,
                          laborCharge: work.laborCharge,
                          partsCharge: work.partsCharge,
                          resolution: work.resolution || undefined,
                        })
                      }
                      loading={updateMutation.isPending}
                    >
                      Save changes
                    </Button>
                    <Group gap="sm">
                      {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                        <Button
                          color="teal"
                          leftSection={<CheckCircle2 size={15} />}
                          loading={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              status: 'RESOLVED',
                              priority: work.priority,
                              assignedToId: work.assignedToId || null,
                              laborCharge: work.laborCharge,
                              partsCharge: work.partsCharge,
                              resolution: work.resolution || undefined,
                              message: 'Repair completed and tested. Customer confirmation pending.',
                            })
                          }
                        >
                          Mark resolved
                        </Button>
                      )}
                      {ticket.status === 'RESOLVED' && (
                        <Button
                          variant="light"
                          color="gray"
                          leftSection={<XCircle size={15} />}
                          loading={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ status: 'CLOSED' })}
                        >
                          Close ticket
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Stack>
              </Panel>
            )}

            <Panel title="Conversation" subtitle="Visible in the customer portal" action={<Headphones size={16} color="#64748b" />}>
              <ScrollArea h={300} mb="md">
                <Timeline active={updates.length} bulletSize={24} lineWidth={2}>
                  {updates.map((update) => (
                    <Timeline.Item
                      key={update.id}
                      title={
                        <Group gap={6} wrap="nowrap">
                          <Text fz="xs" fw={700}>
                            {update.author?.name ?? 'Customer portal'}
                          </Text>
                          {update.statusTo && (
                            <Badge size="xs" variant="light" color="gray">
                              {titleCase(update.statusTo)}
                            </Badge>
                          )}
                        </Group>
                      }
                      bullet={<MessageSquare size={11} />}
                    >
                      <Text fz="xs" c="dimmed">
                        {update.message}
                      </Text>
                      <Text fz={10} c="dimmed" mt={2}>
                        {formatDateTime(update.createdAt)}
                      </Text>
                    </Timeline.Item>
                  ))}
                  {updates.length === 0 && (
                    <Timeline.Item title="No updates yet" bullet={<Clock3 size={11} />}>
                      <Text fz="xs" c="dimmed">
                        Add the first note below.
                      </Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </ScrollArea>
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Textarea
                  placeholder="Call summary, parts ordered, next visit…"
                  minRows={2}
                  value={note}
                  onChange={(event) => setNote(safeValue(event))}
                  style={{ flex: 1, minWidth: 240 }}
                />
                <Button
                  color="sun"
                  leftSection={<Plus size={15} />}
                  disabled={note.trim().length < 2}
                  loading={noteMutation.isPending}
                  onClick={() => noteMutation.mutate()}
                >
                  Post update
                </Button>
              </Group>
            </Panel>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel title="Customer" subtitle="Contact and site">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={36} radius="xl" color="sun" variant="light">
                    <UserRound size={17} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      {ticket.customer.name}
                    </Text>
                    <Text fz={11} c="dimmed" className="sp-mono">
                      {ticket.customer.phone}
                    </Text>
                  </div>
                </Group>
                <Text fz="xs" c="dimmed">
                  {ticket.customer.address}
                  {ticket.customer.city ? `, ${ticket.customer.city}` : ''}
                </Text>
                {ticket.order && (
                  <Group justify="space-between">
                    <Text fz="xs" c="dimmed">
                      Order
                    </Text>
                    <Text fz="xs" fw={600} className="sp-mono">
                      {ticket.order.orderNumber}
                    </Text>
                  </Group>
                )}
              </Stack>
            </Panel>

            <Panel title="Charges & invoice" subtitle="Repair billing">
              <SimpleGrid cols={2} spacing="sm">
                <InlineStat label="Labour" value={formatINR(ticket.laborCharge)} />
                <InlineStat label="Parts" value={formatINR(ticket.partsCharge)} />
                <InlineStat label="Total" value={formatINR(ticket.totalCharge)} color="#d97706" />
                <InlineStat label="Billable" value={ticket.billable ? 'Yes' : 'No'} />
              </SimpleGrid>
              {invoice && (
                <>
                  <Divider my="md" />
                  <Group justify="space-between" mb={4}>
                    <Text fz="xs" fw={700} className="sp-mono">
                      {invoice.invoiceNumber}
                    </Text>
                    <StatusBadge status={invoice.status} size="xs" />
                  </Group>
                  <Group justify="space-between">
                    <Text fz="xs" c="dimmed">
                      Invoice total
                    </Text>
                    <Text fz="sm" fw={800} className="sp-mono">
                      {formatINR(invoice.total)}
                    </Text>
                  </Group>
                  {canRecordPayment && invoice.status !== 'PAID' && (
                    <Button
                      color="sun"
                      leftSection={<Wallet size={15} />}
                      mt="md"
                      fullWidth
                      onClick={() => {
                        setPayment({
                          amount: String(invoice.total),
                          method: 'UPI',
                          reference: '',
                        });
                        setPayOpen(true);
                      }}
                    >
                      Record repair payment
                    </Button>
                  )}
                </>
              )}
              {!invoice && (
                <Text fz="xs" c="dimmed" mt="sm">
                  An invoice is created automatically when a billable ticket is resolved.
                </Text>
              )}
            </Panel>

            <Panel title="Payments" subtitle="Office-approved collections">
              <Stack gap="sm">
                {payments.map((item) => (
                  <Group key={item.id} justify="space-between" wrap="nowrap">
                    <div>
                      <Text fz="xs" fw={600}>
                        {titleCase(item.method)} · {titleCase(item.type)}
                      </Text>
                      <Text fz={10} c="dimmed">
                        {formatDateTime(item.createdAt)}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text fz="xs" fw={700} className="sp-mono">
                        {formatINR(item.amount)}
                      </Text>
                      <StatusBadge status={item.status} size="xs" />
                    </div>
                  </Group>
                ))}
                {payments.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No payments recorded for this repair.
                  </Text>
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

            <Panel title="Warranty trail">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fz="xs" c="dimmed">
                    Status
                  </Text>
                  <StatusBadge status={ticket.warrantyStatus} size="xs" />
                </Group>
                <Group justify="space-between">
                  <Text fz="xs" c="dimmed">
                    Serial
                  </Text>
                  <Text fz="xs" className="sp-mono">
                    {ticket.serialNumber ?? '—'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text fz="xs" c="dimmed">
                    Warranty ends
                  </Text>
                  <Text fz="xs">{formatDate(ticket.warrantyEnd)}</Text>
                </Group>
                {ticket.customerConfirmedAt && (
                  <Alert color="teal" variant="light" radius="md" icon={<CheckCircle2 size={16} />}>
                    Customer confirmed the repair on {formatDate(ticket.customerConfirmedAt)}.
                  </Alert>
                )}
                {ticket.closedAt && (
                  <Text fz={10} c="dimmed">
                    Closed {formatDateTime(ticket.closedAt)}
                  </Text>
                )}
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={payOpen} onClose={() => setPayOpen(false)} title="Record repair payment" size="md">
        <Stack gap="md">
          <Alert color="orange" variant="light" radius="md">
            The payment is submitted as PENDING. Sales or a director approves it in the payment
            queue, which marks the invoice paid.
          </Alert>
          <NumberInput
            label="Amount (₹)"
            min={1}
            value={payment.amount}
            onChange={(value) => setPayment((current) => ({ ...current, amount: String(value) }))}
          />
          <Select
            label="Method"
            data={methodOptions}
            value={payment.method}
            onChange={(value) => setPayment((current) => ({ ...current, method: value ?? 'UPI' }))}
            allowDeselect={false}
          />
          <TextInput
            label="Reference"
            placeholder="UTR / cheque number"
            value={payment.reference}
            onChange={(event) =>
              setPayment((current) => ({ ...current, reference: safeValue(event) }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              disabled={!payment.amount || Number(payment.amount) <= 0}
              loading={paymentMutation.isPending}
              onClick={() => paymentMutation.mutate()}
            >
              Submit payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
