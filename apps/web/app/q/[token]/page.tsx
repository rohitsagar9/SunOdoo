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
  ShieldCheck,
  Smartphone,
  Sun,
  UploadCloud,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, systemLabel, titleCase } from '@/lib/format';
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

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<string>('UPI');
  const [amount, setAmount] = useState<number | string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

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

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Attach the payment screenshot');
      const body = new FormData();
      body.append('amount', String(Number(amount)));
      body.append('method', method);
      body.append('reference', reference.trim());
      body.append('notes', notes.trim());
      body.append('payment', file);
      return (await api.post(`/public/quotes/${token}/payments`, body)).data as {
        message: string;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['public-quote', token] });
      setAmount('');
      setReference('');
      setNotes('');
      setFile(null);
      notifications.show({
        title: 'Payment submitted',
        message: result.message,
        color: 'teal',
        autoClose: 7000,
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not submit payment', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) {
    return (
      <Box mih="100vh" style={{ display: 'grid', placeItems: 'center', background: '#f4f7fa' }}>
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
      <Box mih="100vh" style={{ display: 'grid', placeItems: 'center', background: '#f4f7fa', padding: 24 }}>
        <Paper p="xl" radius="lg" withBorder maw={460}>
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
    <Box mih="100vh" style={{ background: '#f4f7fa' }}>
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
                    <Box key={label} p="sm" style={{ background: '#f8fafc', borderRadius: 10 }}>
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
                      <Box p="sm" style={{ background: '#f8fafc', borderRadius: 10 }}>
                        <Text fz={10} c="dimmed" fw={700} tt="uppercase">
                          Approved
                        </Text>
                        <Text fz="sm" fw={700} className="sp-mono">
                          {formatINR(approvedPaid)}
                        </Text>
                      </Box>
                      <Box p="sm" style={{ background: '#fff8e6', borderRadius: 10 }}>
                        <Text fz={10} c="dimmed" fw={700} tt="uppercase">
                          Balance
                        </Text>
                        <Text fz="sm" fw={700} className="sp-mono">
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
                    <Stack gap="sm">
                      <Group gap={6}>
                        <UploadCloud size={16} color="#0f766e" />
                        <Text fw={700} fz="sm">
                          Upload payment screenshot
                        </Text>
                      </Group>
                      {pendingTotal > 0 && (
                        <Alert color="blue" variant="light" radius="md" p="xs">
                          <Text fz="xs" fw={600}>
                            Request already sent for {formatINR(pendingTotal)}. If you made an additional tranche, enter the amount below.
                          </Text>
                        </Alert>
                      )}
                      <Text fz="xs" c="dimmed">
                        {method === 'UPI'
                          ? 'Indian banking rules limit UPI to max ₹1,00,000 per transaction. Pay up to ₹1,00,000 per scan or use Bank Transfer (NEFT/RTGS) for full amounts.'
                          : 'Transfer to our bank account below, then upload the UTR/counterfoil screenshot.'}
                      </Text>

                      {method === 'BANK_TRANSFER' && (
                        <Paper p="sm" radius="md" withBorder bg="var(--sp-card-bg, #f8f9fa)">
                          <Text fz="xs" fw={700} mb={4}>Bank Transfer (NEFT / RTGS / IMPS) Details:</Text>
                          <SimpleGrid cols={2} spacing="xs">
                            <div>
                              <Text fz={10} c="dimmed">Account Name</Text>
                              <Text fz="xs" fw={600}>SunPower Solutions Pvt Ltd</Text>
                            </div>
                            <div>
                              <Text fz={10} c="dimmed">Bank</Text>
                              <Text fz="xs" fw={600}>HDFC Bank</Text>
                            </div>
                            <div>
                              <Text fz={10} c="dimmed">Account Number</Text>
                              <Text fz="xs" fw={700} className="sp-mono">50200088991122</Text>
                            </div>
                            <div>
                              <Text fz={10} c="dimmed">IFSC Code</Text>
                              <Text fz="xs" fw={700} className="sp-mono">HDFC0000123</Text>
                            </div>
                          </SimpleGrid>
                        </Paper>
                      )}

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        <NumberInput
                          label="Amount paid (₹)"
                          min={1}
                          max={method === 'UPI' ? 100000 : (balance || undefined)}
                          thousandSeparator=","
                          description={method === 'UPI' ? 'Max ₹1,00,000 (Bank UPI limit)' : undefined}
                          placeholder={String(method === 'UPI' ? Math.min(balance, 100000) : balance || '')}
                          value={amount}
                          onChange={setAmount}
                        />
                        <Select
                          label="Method"
                          data={methods.map((value) => ({ value, label: titleCase(value) }))}
                          value={method}
                          onChange={(value) => setMethod(value ?? 'UPI')}
                          allowDeselect={false}
                        />
                      </SimpleGrid>
                      <TextInput
                        label={method === 'UPI' ? 'UPI UTR / Reference' : 'Bank UTR / Transaction reference'}
                        placeholder="e.g. 429182948192"
                        value={reference}
                        onChange={(event) => setReference(event.currentTarget.value)}
                      />
                      <FileInput
                        label="Payment proof / screenshot"
                        placeholder="PNG, JPG or PDF"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        value={file}
                        onChange={setFile}
                        leftSection={<UploadCloud size={15} />}
                      />
                      <Textarea
                        label="Notes (optional)"
                        placeholder="Paid from …"
                        minRows={2}
                        value={notes}
                        onChange={(event) => setNotes(event.currentTarget.value)}
                      />
                      <Button
                        color="sun"
                        leftSection={<Wallet size={15} />}
                        disabled={!file || Number(amount) <= 0 || (method === 'UPI' && Number(amount) > 100000)}
                        loading={paymentMutation.isPending}
                        onClick={() => paymentMutation.mutate()}
                      >
                        Submit payment proof
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
