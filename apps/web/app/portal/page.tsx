'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Wrench,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, systemLabel, titleCase } from '@/lib/format';
import type { PublicTrack } from '@/lib/types';
import { Logo } from '@/components/Brand';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function CustomerPortalPage() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ serialNumber: '', issue: '', faultCode: '' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = (params.get('phone') ?? '').replace(/\D/g, '').slice(0, 10);
    if (initial.length >= 10) {
      setPhone(initial);
      setSubmitted(initial);
    }
  }, []);

  const trackQuery = useQuery({
    queryKey: ['public-track', submitted],
    enabled: submitted.length >= 10,
    queryFn: async () => (await api.get<PublicTrack>(`/public/track/${submitted}`)).data,
    retry: false,
  });

  const customer = trackQuery.data;

  const ticketMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ ticketNumber: string; warrantyStatus: string; message: string }>(
          '/public/tickets',
          {
            phone: submitted,
            serialNumber: ticketForm.serialNumber.trim() || undefined,
            issue: ticketForm.issue.trim(),
            faultCode: ticketForm.faultCode.trim() || undefined,
          },
        )
      ).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['public-track', submitted] });
      setTicketOpen(false);
      setTicketForm({ serialNumber: '', issue: '', faultCode: '' });
      notifications.show({
        title: `Ticket ${result.ticketNumber} raised`,
        message: result.message,
        color: result.warrantyStatus === 'IN_WARRANTY' ? 'teal' : 'orange',
        autoClose: 8000,
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not raise the ticket', message: apiError(error), color: 'red' }),
  });

  const confirmMutation = useMutation({
    mutationFn: async (ticketNumber: string) =>
      (
        await api.post(`/public/tickets/${ticketNumber}/confirm`, { phone: submitted })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-track', submitted] });
      notifications.show({
        title: 'Thanks for confirming',
        message: 'Your ticket is closed. We are glad the system is working.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not confirm repair', message: apiError(error), color: 'red' }),
  });

  function lookup(event?: React.FormEvent) {
    event?.preventDefault();
    const value = phone.replace(/\D/g, '').slice(0, 10);
    if (value.length < 10) return;
    setPhone(value);
    setSubmitted(value);
  }

  const hasResult = Boolean(customer);
  const activeOrders = customer?.orders.filter((order) => order.status !== 'CANCELLED') ?? [];
  const openTickets = customer?.tickets.filter((ticket) => ticket.status !== 'CLOSED') ?? [];

  return (
    <Box mih="100vh" style={{ background: 'var(--sp-bg)' }}>
      <Box className="sp-sun-gradient" pb={64} pt="lg">
        <Container size={1040}>
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Logo href="/" light />
            <Group gap="md">
              <ThemeToggle />
              <Button
                component="a"
                href="tel:+919876543210"
                variant="white"
                color="dark"
                size="compact-sm"
                leftSection={<Phone size={14} />}
              >
                Call support
              </Button>
              <Button component="a" href="/" variant="subtle" color="gray.1" size="compact-sm">
                Main website
              </Button>
            </Group>
          </Group>

          <Stack gap={8} mt={40} maw={720}>
            <Badge color="sun" variant="filled" radius="sm" w="fit-content">
              Customer portal
            </Badge>
            <Title order={1} c="white" fz={{ base: 30, sm: 42 }} style={{ letterSpacing: '-0.03em' }}>
              Track your solar project.
            </Title>
            <Text c="gray.3" fz="sm">
              Enter the mobile number registered with SunPower to see your order, payment balance,
              installation schedule and warranty tickets.
            </Text>
          </Stack>

          <Paper p="md" radius="lg" mt="lg" maw={560} component="form" onSubmit={lookup}>
            <Group gap="sm" wrap="nowrap">
              <TextInput
                placeholder="10-digit mobile number"
                leftSection={<Smartphone size={16} />}
                value={phone}
                onChange={(event) => {
                  const raw = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                  setPhone(String(raw).replace(/\D/g, '').slice(0, 10));
                }}
                style={{ flex: 1 }}
                size="md"
                aria-label="Registered mobile number"
              />
              <Button
                type="submit"
                color="sun"
                size="md"
                leftSection={<Search size={16} />}
                loading={trackQuery.isFetching}
                disabled={phone.replace(/\D/g, '').length < 10}
              >
                Track
              </Button>
            </Group>
            <Text fz={10} c="dimmed" mt={8}>
              Demo: try 9876543218 (Lakshmi) or 9876543220 (Arjun). Your data is only shown for the
              number you verify.
            </Text>
          </Paper>
        </Container>
      </Box>

      <Container size={1040} mt={-36} pb={64}>
        {!submitted && (
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper p="xl" radius="lg" className="sp-soft-card">
                <Group gap="sm" mb="md">
                  <ThemeIcon size={44} radius="xl" color="sun" variant="light">
                    <Sun size={22} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800} fz="lg">
                      Everything in one place
                    </Text>
                    <Text fz="xs" c="dimmed">
                      No app, no password — just your registered mobile number.
                    </Text>
                  </div>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {[
                    [FileText, 'Quote & order', 'See the itemised BOM, totals and order status.'],
                    [CheckCircle2, 'Payments', 'Check approved payments and the live balance.'],
                    [Wrench, 'Installation', 'See the scheduled date and completion status.'],
                    [ShieldCheck, 'Warranty', 'Every serial and warranty end date in one trail.'],
                  ].map(([Icon, title, text]) => {
                    const Component = Icon as typeof FileText;
                    return (
                      <Group key={String(title)} gap="sm" align="flex-start" wrap="nowrap">
                        <ThemeIcon size={32} radius="md" color="teal" variant="light">
                          <Component size={16} />
                        </ThemeIcon>
                        <div>
                          <Text fz="sm" fw={700}>
                            {String(title)}
                          </Text>
                          <Text fz={11} c="dimmed">
                            {String(text)}
                          </Text>
                        </div>
                      </Group>
                    );
                  })}
                </SimpleGrid>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper p="xl" radius="lg" className="sp-soft-card" h="100%">
                <Stack gap="sm">
                  <ThemeIcon size={44} radius="xl" color="indigo" variant="light">
                    <Headphones size={22} />
                  </ThemeIcon>
                  <Text fw={800} fz="lg">
                    Need help now?
                  </Text>
                  <Text fz="sm" c="dimmed">
                    Call our support desk on weekdays 9am–7pm, or raise a ticket once you have
                    looked up your account.
                  </Text>
                  <Button component="a" href="tel:+919876543210" color="sun" leftSection={<Phone size={15} />}>
                    +91 98765 43210
                  </Button>
                  <Button
                    component="a"
                    href="mailto:support@sunpower.in"
                    variant="light"
                    color="gray"
                    leftSection={<Mail size={15} />}
                  >
                    support@sunpower.in
                  </Button>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        )}

        {submitted && trackQuery.isLoading && <LoadingState label="Looking up your account…" />}

        {submitted && trackQuery.isError && (
          <Paper p="xl" radius="lg" className="sp-soft-card">
            <Stack align="center" gap="sm">
              <ThemeIcon size={54} radius="xl" color="orange" variant="light">
                <Search size={24} />
              </ThemeIcon>
              <Text fw={800} fz="lg">
                No account found for {submitted}
              </Text>
              <Text fz="sm" c="dimmed" ta="center" maw={460}>
                Check the number or call us and we will link your enquiry. If you just submitted a
                website form, our sales team may still be creating your file.
              </Text>
              <Group>
                <Button variant="light" color="gray" onClick={() => setSubmitted('')}>
                  Try another number
                </Button>
                <Button component="a" href="tel:+919876543210" color="sun" leftSection={<Phone size={15} />}>
                  Call support
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {hasResult && customer && (
          <Stack gap="lg">
            <Paper p="lg" radius="lg" className="sp-soft-card">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Group gap="md" wrap="nowrap">
                  <ThemeIcon size={54} radius="xl" color="sun" variant="light">
                    <Sun size={26} />
                  </ThemeIcon>
                  <div>
                    <Text className="sp-kicker">Welcome back</Text>
                    <Text fw={800} fz="xl" lh={1.15}>
                      {customer.name}
                    </Text>
                    <Group gap={6} mt={2}>
                      <MapPin size={13} color="#64748b" />
                      <Text fz="xs" c="dimmed">
                        {customer.address}
                      </Text>
                    </Group>
                  </div>
                </Group>
                <Group gap="sm">
                  <Badge variant="light" color="teal">
                    {activeOrders.length} active order(s)
                  </Badge>
                  <Badge variant="light" color={openTickets.length ? 'orange' : 'gray'}>
                    {openTickets.length} open ticket(s)
                  </Badge>
                  <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setSubmitted('')}>
                    Switch number
                  </Button>
                </Group>
              </Group>
            </Paper>

            <Grid gap="lg">
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Stack gap="lg">
                  <Paper p={0} radius="lg" className="sp-soft-card" style={{ overflow: 'hidden' }}>
                    <Group justify="space-between" p="lg" pb="sm">
                      <div>
                        <Text fw={700}>Your orders</Text>
                        <Text fz="xs" c="dimmed">
                          Live status, balance and installation date
                        </Text>
                      </div>
                      <FileText size={18} color="#64748b" />
                    </Group>
                    {activeOrders.length === 0 ? (
                      <Box p="lg">
                        <EmptyState
                          title="No orders yet"
                          description="Once you accept a quote, your order appears here with payment and installation updates."
                        />
                      </Box>
                    ) : (
                      <Stack gap={0}>
                        {activeOrders.map((order) => (
                          <Box key={order.orderNumber} p="lg" style={{ borderTop: '1px solid #eef2f7' }}>
                            <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                              <div>
                                <Group gap="sm">
                                  <Text fw={800} className="sp-mono">
                                    {order.orderNumber}
                                  </Text>
                                  <StatusBadge status={order.status} size="xs" />
                                </Group>
                                <Text fz="sm" mt={4}>
                                  {order.quote.capacityKw} kW {systemLabel(order.quote.systemType)} system
                                </Text>
                                <Text fz={10} c="dimmed">
                                  Ordered {formatDate(order.createdAt)}
                                  {order.job
                                    ? ` · Installation ${titleCase(order.job.status)} on ${formatDate(order.job.scheduledDate)}`
                                    : ' · Installation date to be scheduled'}
                                </Text>
                              </div>
                              <Stack gap={2} align="flex-end">
                                <Text fz={10} c="dimmed" tt="uppercase" fw={700}>
                                  Balance due
                                </Text>
                                <Text fw={800} fz="lg" className="sp-mono">
                                  {formatINR(order.balanceDue)}
                                </Text>
                                <Text fz={10} c="dimmed">
                                  of {formatINR(order.total)}
                                </Text>
                              </Stack>
                            </Group>
                            <Group gap="sm" mt="md">
                              <Button
                                component="a"
                                href={`/q/${order.quote.publicToken}`}
                                size="compact-sm"
                                color="sun"
                                rightSection={<ArrowRight size={13} />}
                              >
                                View quote & pay
                              </Button>
                              {order.balanceDue > 0 && (
                                <Badge variant="light" color="orange" leftSection={<Clock3 size={11} />}>
                                  Payment pending
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Paper>

                  <Paper p={0} radius="lg" className="sp-soft-card" style={{ overflow: 'hidden' }}>
                    <Group justify="space-between" p="lg" pb="sm">
                      <div>
                        <Text fw={700}>Support tickets</Text>
                        <Text fz="xs" c="dimmed">
                          Warranty status is detected from your serial number
                        </Text>
                      </div>
                      <Button
                        size="compact-sm"
                        color="sun"
                        leftSection={<LifeBuoy size={14} />}
                        onClick={() => setTicketOpen(true)}
                      >
                        Raise ticket
                      </Button>
                    </Group>
                    {customer.tickets.length === 0 ? (
                      <Box p="lg">
                        <EmptyState
                          title="No tickets"
                          description="If your inverter trips or monitoring goes offline, raise a ticket and we will call you."
                          action={
                            <Button color="sun" leftSection={<LifeBuoy size={15} />} onClick={() => setTicketOpen(true)}>
                              Raise a ticket
                            </Button>
                          }
                        />
                      </Box>
                    ) : (
                      <ScrollArea>
                        <Table verticalSpacing="sm" horizontalSpacing="md" miw={720}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Ticket</Table.Th>
                              <Table.Th>Issue</Table.Th>
                              <Table.Th>Warranty</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th ta="right" />
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {customer.tickets.map((ticket) => (
                              <Table.Tr key={ticket.ticketNumber}>
                                <Table.Td>
                                  <Text fz="xs" fw={700} className="sp-mono">
                                    {ticket.ticketNumber}
                                  </Text>
                                  <Text fz={10} c="dimmed">
                                    {formatDate(ticket.createdAt)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text fz="xs" lineClamp={2} maw={220}>
                                    {ticket.issue}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <StatusBadge status={ticket.warrantyStatus} size="xs" />
                                </Table.Td>
                                <Table.Td>
                                  <StatusBadge status={ticket.status} size="xs" />
                                </Table.Td>
                                <Table.Td ta="right">
                                  {ticket.status === 'RESOLVED' ? (
                                    <Button
                                      size="compact-xs"
                                      color="teal"
                                      leftSection={<CheckCircle2 size={12} />}
                                      loading={
                                        confirmMutation.isPending &&
                                        confirmMutation.variables === ticket.ticketNumber
                                      }
                                      onClick={() => confirmMutation.mutate(ticket.ticketNumber)}
                                    >
                                      Confirm fix
                                    </Button>
                                  ) : (
                                    <Text fz={10} c="dimmed">
                                      {ticket.status === 'CLOSED' ? 'Closed' : 'In progress'}
                                    </Text>
                                  )}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    )}
                  </Paper>
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 4 }}>
                <Stack gap="lg">
                  <Paper p="lg" radius="lg" className="sp-soft-card">
                    <Text fw={700} fz="sm" mb="sm">
                      Account snapshot
                    </Text>
                    <Stack gap="sm">
                      {[
                        ['Orders', String(customer.orders.length)],
                        ['Open tickets', String(openTickets.length)],
                        [
                          'Outstanding',
                          formatINR(
                            customer.orders.reduce((sum, order) => sum + order.balanceDue, 0),
                          ),
                        ],
                        ['Registered number', customer.phone],
                      ].map(([label, value]) => (
                        <Group key={label} justify="space-between">
                          <Text fz="xs" c="dimmed">
                            {label}
                          </Text>
                          <Text fz="xs" fw={700} className="sp-mono">
                            {value}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                    <Divider my="md" />
                    <Text fz={10} c="dimmed">
                      Need to update your address or add a contact person? Call the support desk and
                      we will update your file.
                    </Text>
                  </Paper>

                  <Paper p="lg" radius="lg" className="sp-soft-card">
                    <Group gap="sm" mb="sm">
                      <ThemeIcon size={36} radius="xl" color="indigo" variant="light">
                        <ShieldCheck size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={700} fz="sm">
                          Warranty promise
                        </Text>
                        <Text fz={10} c="dimmed">
                          25-year panel · 10-year inverter
                        </Text>
                      </div>
                    </Group>
                    <Stack gap="sm">
                      {[
                        'Warranty starts when installation is completed.',
                        'Every serial is linked to your order.',
                        'Support sees warranty status instantly.',
                        'Billable repairs are quoted before work.',
                      ].map((item) => (
                        <Group key={item} gap="sm" align="flex-start" wrap="nowrap">
                          <CheckCircle2 size={14} color="#0f766e" style={{ marginTop: 2 }} />
                          <Text fz="xs">{item}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>

                  <Paper p="lg" radius="lg" className="sp-soft-card">
                    <Stack gap="sm">
                      <Group gap="sm">
                        <Headphones size={17} color="#0f766e" />
                        <Text fw={700} fz="sm">
                          Contact us
                        </Text>
                      </Group>
                      <Button component="a" href="tel:+919876543210" variant="light" color="sun" leftSection={<Phone size={14} />} fullWidth>
                        +91 98765 43210
                      </Button>
                      <Button
                        component="a"
                        href="mailto:support@sunpower.in"
                        variant="light"
                        color="gray"
                        leftSection={<Mail size={14} />}
                        fullWidth
                      >
                        support@sunpower.in
                      </Button>
                    </Stack>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </Container>

      <Modal opened={ticketOpen} onClose={() => setTicketOpen(false)} title="Raise a support ticket" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light" radius="md" icon={<LifeBuoy size={16} />}>
            Add the serial number from the inverter label for instant warranty detection.
          </Alert>
          <TextInput label="Registered mobile" value={submitted} readOnly />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Serial number (optional)"
              placeholder="SN-INV-3K-STK-0001"
              value={ticketForm.serialNumber}
              onChange={(event) => {
                const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                setTicketForm((current) => ({ ...current, serialNumber: val }));
              }}
            />
            <TextInput
              label="Fault code (optional)"
              placeholder="E-03, Wi-Fi, no display…"
              value={ticketForm.faultCode}
              onChange={(event) => {
                const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                setTicketForm((current) => ({ ...current, faultCode: val }));
              }}
            />
          </SimpleGrid>
          <Textarea
            label="What is the issue?"
            placeholder="Inverter trips at noon, battery not charging, monitoring offline…"
            minRows={4}
            required
            value={ticketForm.issue}
            onChange={(event) => {
              const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
              setTicketForm((current) => ({ ...current, issue: val }));
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTicketOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              leftSection={<LifeBuoy size={15} />}
              disabled={ticketForm.issue.trim().length < 10}
              loading={ticketMutation.isPending}
              onClick={() => ticketMutation.mutate()}
            >
              Raise ticket
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
