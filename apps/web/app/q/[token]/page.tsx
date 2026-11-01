'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  FileInput,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
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
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UploadCloud,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, safeValue, systemLabel, titleCase } from '@/lib/format';
import { Logo } from '@/components/Brand';
import { PaymentQR } from '@/components/PaymentQR';
import { StatusBadge } from '@/components/StatusBadge';
import { ThemeToggle } from '@/components/ThemeToggle';

interface PublicQuote {
  id: string;
  quoteNumber: string;
  systemType: string;
  capacityKw: number;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  validUntil?: string | null;
  advanceAmount: number;
  publicToken: string;
  notes?: string | null;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city?: string | null;
    state?: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    advancePaid: number;
    balanceDue: number;
    payments: Array<{
      id: string;
      amount: number;
      status: string;
      type: string;
      createdAt: string;
    }>;
    job?: { scheduledDate: string; status: string } | null;
  } | null;
}

const methods = ['UPI', 'BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE'];

interface TrancheItem {
  id: string;
  file: File | null;
  amount: number | string;
  method: string;
  reference: string;
  notes: string;
}

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const queryClient = useQueryClient();

  const [tranches, setTranches] = useState<TrancheItem[]>([
    { id: '1', file: null, amount: '', method: 'UPI', reference: '', notes: '' },
  ]);

  const query = useQuery({
    queryKey: ['public-quote', token],
    enabled: Boolean(token),
    queryFn: async () => (await api.get<PublicQuote>(`/public/quotes/${token}`)).data,
  });

  const quote = query.data;
  const order = quote?.order ?? null;

  const approvedPaid = useMemo(
    () =>
      order?.payments
        .filter((payment) => payment.status === 'APPROVED')
        .reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [order],
  );
  const pendingTotal = useMemo(
    () =>
      order?.payments
        .filter((payment) => payment.status === 'PENDING')
        .reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [order],
  );
  const balance = order ? Math.max(order.total - approvedPaid, 0) : (quote?.total ?? 0);
  const accepted = Boolean(order);

  const totalTrancheSum = useMemo(() => {
    return tranches.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [tranches]);

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.post(`/public/quotes/${token}/accept`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-quote', token] });
      notifications.show({
        title: 'Quote accepted',
        message: 'Your order is created. Pay the advance and upload the screenshot below.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not accept the quote', message: apiError(error), color: 'red' }),
  });

  const multiPaymentMutation = useMutation({
    mutationFn: async () => {
      const valid = tranches.filter((t) => t.file && Number(t.amount) > 0);
      if (valid.length === 0) {
        throw new Error('Please attach at least one payment PDF/screenshot and enter the amount.');
      }
      const results = [];
      for (const item of valid) {
        const body = new FormData();
        body.append('amount', String(Number(item.amount)));
        body.append('method', item.method);
        body.append('reference', item.reference.trim());
        body.append('notes', item.notes.trim() || 'Split transaction tranche');
        body.append('payment', item.file!);
        const res = await api.post(`/public/quotes/${token}/payments`, body);
        results.push(res.data);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['public-quote', token] });
      setTranches([{ id: String(Date.now()), file: null, amount: '', method: 'UPI', reference: '', notes: '' }]);
      notifications.show({
        title: 'Payments submitted successfully',
        message: `${results.length} transaction receipt(s) submitted for total ${formatINR(totalTrancheSum)}. Our accounts desk will verify them shortly.`,
        color: 'teal',
        autoClose: 8000,
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not submit payment(s)', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) {
    return (
      <Box mih="100vh" style={{ display: 'grid', placeItems: 'center', background: 'var(--sp-bg)' }}>
        <Stack align="center" gap="sm">
          <Loader color="sun" />
          <Text fz="sm" c="dimmed">
            Loading your quote…
          </Text>
        </Stack>
      </Box>
    );
  }

  if (query.isError || !quote) {
    return (
      <Box mih="100vh" style={{ display: 'grid', placeItems: 'center', background: 'var(--sp-bg)', padding: 24 }}>
        <Paper p="xl" radius="lg" withBorder maw={460} style={{ background: 'var(--sp-card)', borderColor: 'var(--sp-border)' }}>
          <Stack align="center" gap="sm">
            <ThemeIcon size={56} radius="xl" color="red" variant="light">
              <FileText size={26} />
            </ThemeIcon>
            <Title order={3}>Quote unavailable</Title>
            <Text fz="sm" c="dimmed" ta="center">
              {apiError(query.error)} — please contact our sales team and we will resend the link.
            </Text>
            <Button component="a" href="tel:+919876543210" leftSection={<Phone size={15} />} color="sun">
              Call +91 98765 43210
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mih="100vh" style={{ background: 'var(--sp-bg)' }}>
      <Box className="sp-sun-gradient" pb={70} pt="lg">
        <Container size={1120}>
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
                +91 98765 43210
              </Button>
              <Button
                component="a"
                href="mailto:hello@sunpower.in"
                variant="subtle"
                color="gray.1"
                size="compact-sm"
                leftSection={<Mail size={14} />}
              >
                hello@sunpower.in
              </Button>
            </Group>
          </Group>

          <Stack gap={8} mt={40} maw={720}>
            <Group gap="sm">
              <Badge color="sun" variant="filled" radius="sm">
                Quote {quote.quoteNumber}
              </Badge>
              <StatusBadge status={quote.status} size="sm" />
            </Group>
            <Title order={1} c="white" fz={{ base: 30, sm: 42 }} style={{ letterSpacing: '-0.03em' }}>
              Your solar proposal, {quote.customer.name.split(' ')[0]}.
            </Title>
            <Text c="gray.3" fz="sm">
              {quote.capacityKw} kW {systemLabel(quote.systemType)} system · prepared{' '}
              {formatDate(quote.createdAt)} · valid until {formatDate(quote.validUntil)}
            </Text>
          </Stack>
        </Container>
      </Box>

      <Container size={1120} mt={-44} pb={64}>
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              <Paper p="lg" radius="lg" className="sp-soft-card">
                <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
                  <div>
                    <Text className="sp-kicker">Prepared for</Text>
                    <Text fw={800} fz="lg" mt={2}>
                      {quote.customer.name}
                    </Text>
                    <Group gap={6} mt={4}>
                      <MapPin size={13} color="#64748b" />
                      <Text fz="xs" c="dimmed">
                        {quote.customer.address}
                        {quote.customer.city ? `, ${quote.customer.city}` : ''}
                        {quote.customer.state ? `, ${quote.customer.state}` : ''}
                      </Text>
                    </Group>
                    <Group gap={6} mt={2}>
                      <Phone size={13} color="#64748b" />
                      <Text fz="xs" c="dimmed" className="sp-mono">
                        {quote.customer.phone}
                      </Text>
                    </Group>
                  </div>
                  <ThemeIcon size={54} radius="xl" color="sun" variant="light">
                    <Sun size={26} />
                  </ThemeIcon>
                </Group>

                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                  {[
                    ['System size', `${quote.capacityKw} kW`],
                    ['Type', systemLabel(quote.systemType)],
                    ['GST', `${quote.taxRate}%`],
                    ['Advance', formatINR(quote.advanceAmount, true)],
                  ].map(([label, value]) => (
                    <Box key={label} p="sm" style={{ background: 'var(--sp-card-subtle)', border: '1px solid var(--sp-border)', borderRadius: 10 }}>
                      <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
                        {label}
                      </Text>
                      <Text fz="sm" fw={700} mt={2}>
                        {value}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Paper>

              <Paper p={0} radius="lg" className="sp-soft-card" style={{ overflow: 'hidden' }}>
                <Group justify="space-between" p="lg" pb="sm">
                  <div>
                    <Text fw={700}>Itemised bill of materials</Text>
                    <Text fz="xs" c="dimmed">
                      Panels, inverter, structure, cabling, safety and installation
                    </Text>
                  </div>
                  <Badge variant="light" color="indigo">
                    {quote.items.length} lines
                  </Badge>
                </Group>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Description</Table.Th>
                      <Table.Th ta="right">Qty</Table.Th>
                      <Table.Th ta="right">Rate</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {quote.items.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text fz="sm">{item.description}</Text>
                          <Text fz={10} c="dimmed">
                            {titleCase(item.category)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="xs" className="sp-mono">
                            {item.quantity} {item.unit}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="xs" className="sp-mono">
                            {formatINR(item.unitPrice)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="xs" fw={600} className="sp-mono">
                            {formatINR(item.total)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Divider />
                <Stack gap={6} p="lg">
                  <Group justify="space-between">
                    <Text fz="sm" c="dimmed">
                      Subtotal
                    </Text>
                    <Text fz="sm" className="sp-mono">
                      {formatINR(quote.subtotal)}
                    </Text>
                  </Group>
                  {quote.discount > 0 && (
                    <Group justify="space-between">
                      <Text fz="sm" c="dimmed">
                        Discount
                      </Text>
                      <Text fz="sm" c="teal" className="sp-mono">
                        −{formatINR(quote.discount)}
                      </Text>
                    </Group>
                  )}
                  <Group justify="space-between">
                    <Text fz="sm" c="dimmed">
                      GST @ {quote.taxRate}%
                    </Text>
                    <Text fz="sm" className="sp-mono">
                      {formatINR(quote.taxAmount)}
                    </Text>
                  </Group>
                  <Divider my={4} />
                  <Group justify="space-between">
                    <Text fw={800}>Total payable</Text>
                    <Text fw={800} fz="xl" className="sp-mono">
                      {formatINR(quote.total)}
                    </Text>
                  </Group>
                  <Text fz={10} c="dimmed">
                    Price includes supply, installation, commissioning and the standard warranty.
                    Net-metering charges, if any, are billed at actuals.
                  </Text>
                </Stack>
              </Paper>

              {quote.notes && (
                <Paper p="lg" radius="lg" className="sp-soft-card">
                  <Text fw={700} mb={4}>
                    Notes from our team
                  </Text>
                  <Text fz="sm" c="dimmed">
                    {quote.notes}
                  </Text>
                </Paper>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Paper p="lg" radius="lg" className="sp-soft-card">
                {!accepted ? (
                  <Stack gap="sm">
                    <ThemeIcon size={46} radius="xl" color="sun" variant="light">
                      <CheckCircle2 size={22} />
                    </ThemeIcon>
                    <Text fw={800} fz="lg">
                      Ready to go solar?
                    </Text>
                    <Text fz="sm" c="dimmed">
                      Accept this quote to create your order. We will schedule the survey and
                      installation after the advance is verified.
                    </Text>
                    <Button
                      color="sun"
                      size="md"
                      rightSection={<ArrowRight size={16} />}
                      loading={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate()}
                    >
                      Accept quote
                    </Button>
                    <Text fz={10} c="dimmed" ta="center">
                      No payment is taken on this page until you upload a screenshot.
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <ThemeIcon size={46} radius="xl" color="teal" variant="light">
                        <CheckCircle2 size={22} />
                      </ThemeIcon>
                      <StatusBadge status={order?.status} />
                    </Group>
                    <Text fw={800} fz="lg">
                      Order {order?.orderNumber}
                    </Text>
                    <Text fz="sm" c="dimmed">
                      {order?.job
                        ? `Installation ${titleCase(order.job.status)} · ${formatDate(order.job.scheduledDate)}`
                        : 'Our team will call you to schedule the site survey.'}
                    </Text>
                    <SimpleGrid cols={2} spacing="xs">
                      <Box
                        p="sm"
                        style={{
                          background: 'var(--sp-card-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: 10,
                        }}
                      >
                        <Text fz={10} c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                          Approved
                        </Text>
                        <Text
                          fz="sm"
                          fw={700}
                          className="sp-mono"
                          c={approvedPaid > 0 ? 'teal.7' : 'var(--sp-headings)'}
                        >
                          {formatINR(approvedPaid)}
                        </Text>
                      </Box>
                      <Box
                        p="sm"
                        style={{
                          background: 'var(--sp-card-subtle)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: 10,
                        }}
                      >
                        <Text fz={10} c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                          Balance
                        </Text>
                        <Text
                          fz="sm"
                          fw={700}
                          className="sp-mono"
                          c={balance > 0 ? 'orange.7' : 'teal.7'}
                        >
                          {formatINR(balance)}
                        </Text>
                      </Box>
                    </SimpleGrid>
                    {pendingTotal > 0 && (
                      <Alert color="teal" variant="light" radius="md" icon={<Clock3 size={18} />}>
                        <Text fw={700} fz="sm">Payment proof already submitted & awaiting verification</Text>
                        <Text fz="xs">
                          {formatINR(pendingTotal)} is currently pending approval by our accounts team.
                          Your request is already received.
                        </Text>
                      </Alert>
                    )}
                  </Stack>
                )}
              </Paper>

              {accepted && (
                <>
                  <PaymentQR amount={Math.max(balance - pendingTotal, 0) > 0 ? Math.max(balance - pendingTotal, 0) : balance} />
                  <Paper p="lg" radius="lg" className="sp-soft-card">
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <Group gap={6}>
                          <UploadCloud size={18} color="#0f766e" />
                          <Text fw={700} fz="sm">
                            Multi-Receipt & Split Payment Upload
                          </Text>
                        </Group>
                        <Badge size="sm" variant="light" color="indigo">
                          {tranches.length} {tranches.length === 1 ? 'Receipt' : 'Receipts'}
                        </Badge>
                      </Group>

                      <Text fz="xs" c="dimmed">
                        Split your payment across multiple transactions (e.g. 2 x UPI scans or split bank transfers). Upload the PDF receipt or screenshot for each tranche.
                      </Text>

                      <Paper
                        p="sm"
                        radius="md"
                        withBorder
                        style={{
                          backgroundColor: 'var(--sp-card-subtle)',
                          borderColor: 'var(--sp-border)',
                          color: 'var(--sp-headings)',
                        }}
                      >
                        <Text fz="xs" fw={700} mb={6} c="var(--sp-headings)">
                          Bank Transfer (NEFT / RTGS / IMPS) Details:
                        </Text>
                        <SimpleGrid cols={2} spacing="xs">
                          <div>
                            <Text fz={10} c="var(--sp-secondary)">Account Name</Text>
                            <Text fz="xs" fw={600} c="var(--sp-headings)">SunPower Solutions Pvt Ltd</Text>
                          </div>
                          <div>
                            <Text fz={10} c="var(--sp-secondary)">Bank</Text>
                            <Text fz="xs" fw={600} c="var(--sp-headings)">HDFC Bank</Text>
                          </div>
                          <div>
                            <Text fz={10} c="var(--sp-secondary)">Account Number</Text>
                            <Text fz="xs" fw={700} className="sp-mono" c="var(--sp-headings)">50200088991122</Text>
                          </div>
                          <div>
                            <Text fz={10} c="var(--sp-secondary)">IFSC Code</Text>
                            <Text fz="xs" fw={700} className="sp-mono" c="var(--sp-headings)">HDFC0000123</Text>
                          </div>
                        </SimpleGrid>
                      </Paper>

                      {/* Tranche forms list */}
                      <Stack gap="sm">
                        {tranches.map((item, index) => (
                          <Paper
                            key={item.id}
                            p="sm"
                            withBorder
                            radius="md"
                            style={{ background: 'var(--sp-card)' }}
                          >
                            <Group justify="space-between" mb="xs">
                              <Text fz="xs" fw={700} c="sun.7">
                                Transaction #{index + 1}
                              </Text>
                              {tranches.length > 1 && (
                                <Button
                                  size="compact-xs"
                                  variant="subtle"
                                  color="red"
                                  leftSection={<Trash2 size={12} />}
                                  onClick={() =>
                                    setTranches((current) => current.filter((t) => t.id !== item.id))
                                  }
                                >
                                  Remove
                                </Button>
                              )}
                            </Group>

                            <Stack gap="xs">
                              <FileInput
                                label="Receipt PDF / Screenshot"
                                placeholder="Choose PDF or image proof"
                                accept="application/pdf,image/png,image/jpeg,image/webp"
                                value={item.file}
                                onChange={(f) =>
                                  setTranches((current) =>
                                    current.map((t) => (t.id === item.id ? { ...t, file: f } : t)),
                                  )
                                }
                                leftSection={<UploadCloud size={14} />}
                                required
                              />

                              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                                <NumberInput
                                  label="Amount in this receipt (₹)"
                                  min={1}
                                  placeholder="e.g. 50000"
                                  thousandSeparator=","
                                  value={item.amount}
                                  onChange={(v) =>
                                    setTranches((current) =>
                                      current.map((t) => (t.id === item.id ? { ...t, amount: v } : t)),
                                    )
                                  }
                                  required
                                />
                                <Select
                                  label="Method"
                                  data={methods.map((value) => ({ value, label: titleCase(value) }))}
                                  value={item.method}
                                  onChange={(v) =>
                                    setTranches((current) =>
                                      current.map((t) => (t.id === item.id ? { ...t, method: v ?? 'UPI' } : t)),
                                    )
                                  }
                                  allowDeselect={false}
                                />
                              </SimpleGrid>

                              <TextInput
                                label="UTR / Reference Number"
                                placeholder="e.g. UPI Ref / NEFT UTR / Cheque No."
                                value={item.reference}
                                onChange={(e) =>
                                  setTranches((current) =>
                                    current.map((t) =>
                                      t.id === item.id ? { ...t, reference: safeValue(e) } : t,
                                    ),
                                  )
                                }
                              />
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>

                      <Button
                        variant="light"
                        color="indigo"
                        size="xs"
                        leftSection={<Plus size={14} />}
                        onClick={() =>
                          setTranches((current) => [
                            ...current,
                            {
                              id: String(Date.now()),
                              file: null,
                              amount: '',
                              method: 'UPI',
                              reference: '',
                              notes: '',
                            },
                          ])
                        }
                      >
                        + Add Another Transaction / Receipt PDF
                      </Button>

                      {/* Dynamic Live Sum & Comparison */}
                      <Paper p="sm" radius="md" withBorder bg="rgba(245, 158, 11, 0.05)">
                        <Group justify="space-between" mb={4}>
                          <Text fz="xs" fw={700}>
                            Total Sum of {tranches.length} Attached Receipts:
                          </Text>
                          <Text fz="md" fw={800} className="sp-mono" c="sun.7">
                            {formatINR(totalTrancheSum)}
                          </Text>
                        </Group>

                        {totalTrancheSum > 0 && (
                          <Group gap="xs" mt={4} wrap="wrap">
                            {totalTrancheSum === quote.advanceAmount && (
                              <Badge color="teal" variant="light" size="sm">
                                ✅ Exact Match for 30% Advance Due ({formatINR(quote.advanceAmount)})
                              </Badge>
                            )}
                            {totalTrancheSum === balance && (
                              <Badge color="teal" variant="light" size="sm">
                                ✅ Exact Match for 100% Full Payment ({formatINR(balance)})
                              </Badge>
                            )}
                            {totalTrancheSum > quote.advanceAmount && totalTrancheSum < balance && (
                              <Badge color="cyan" variant="light" size="sm">
                                ✅ Covers Advance + Partial Balance ({formatINR(totalTrancheSum)})
                              </Badge>
                            )}
                            {totalTrancheSum < quote.advanceAmount && (
                              <Badge color="orange" variant="light" size="sm">
                                ⚠️ ₹{formatINR(quote.advanceAmount - totalTrancheSum)} remaining to cover 30% advance
                              </Badge>
                            )}
                          </Group>
                        )}
                      </Paper>

                      <Button
                        color="sun"
                        size="md"
                        leftSection={<Wallet size={15} />}
                        disabled={
                          totalTrancheSum <= 0 ||
                          tranches.every((t) => !t.file)
                        }
                        loading={multiPaymentMutation.isPending}
                        onClick={() => multiPaymentMutation.mutate()}
                      >
                        Submit All {tranches.length} Payment Receipts ({formatINR(totalTrancheSum)})
                      </Button>
                    </Stack>
                  </Paper>

                  {order && order.payments.length > 0 && (
                    <Paper p="lg" radius="lg" className="sp-soft-card">
                      <Text fw={700} fz="sm" mb="sm">
                        Payment history
                      </Text>
                      <Stack gap="sm">
                        {order.payments.map((payment) => (
                          <Group key={payment.id} justify="space-between" wrap="nowrap">
                            <div>
                              <Text fz="xs" fw={700} className="sp-mono">
                                {formatINR(payment.amount)}
                              </Text>
                              <Text fz={10} c="dimmed">
                                {titleCase(payment.type)} · {formatDateTime(payment.createdAt)}
                              </Text>
                            </div>
                            <StatusBadge status={payment.status} size="xs" />
                          </Group>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </>
              )}

              <Paper p="lg" radius="lg" className="sp-soft-card">
                <Stack gap="sm">
                  <Group gap={6}>
                    <ShieldCheck size={16} color="#0f766e" />
                    <Text fw={700} fz="sm">
                      What happens next
                    </Text>
                  </Group>
                  {[
                    'Office verifies your payment screenshot',
                    'Warehouse packs and serial-scans the kit',
                    'Crew installs, commissions and hands over',
                    'Warranty starts automatically on completion',
                  ].map((step, index) => (
                    <Group key={step} gap="sm" align="flex-start" wrap="nowrap">
                      <ThemeIcon size={22} radius="xl" color="teal" variant="light">
                        <Text fz={10} fw={800}>
                          {index + 1}
                        </Text>
                      </ThemeIcon>
                      <Text fz="xs">{step}</Text>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              <Button
                component="a"
                href={`/portal?phone=${quote.customer.phone}`}
                variant="light"
                color="indigo"
                leftSection={<Smartphone size={15} />}
              >
                Open customer portal
              </Button>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
}
