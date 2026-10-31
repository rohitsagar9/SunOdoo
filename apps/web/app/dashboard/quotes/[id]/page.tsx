'use client';

import { useState } from 'react';
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
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Printer,
  ShieldCheck,
  Sun,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, titleCase } from '@/lib/format';
import type { Quote } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function QuoteDetailPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR']}>
      <QuoteDetail />
    </RoleGate>
  );
}

function QuoteDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const queryClient = useQueryClient();
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalc, setRecalc] = useState({ capacityKw: '1', systemType: 'ON_GRID', discount: '0' });

  const query = useQuery({
    queryKey: ['quote', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
  });

  const quote = query.data;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['quote', id] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.patch(`/quotes/${id}/status`, { status: 'ACCEPTED' })).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Quote accepted',
        message: 'An order has been created and the lead marked won.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not accept quote', message: apiError(error), color: 'red' }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) =>
      (await api.patch(`/quotes/${id}/status`, { status })).data,
    onSuccess: () => {
      invalidate();
      notifications.show({ title: 'Quote status updated', message: 'Saved.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update status', message: apiError(error), color: 'red' }),
  });

  const recalcMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/quotes/${id}/recalculate`, {
          capacityKw: recalc.capacityKw,
          systemType: recalc.systemType,
          discount: recalc.discount,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      setRecalcOpen(false);
      notifications.show({
        title: 'Quote recalculated',
        message: 'The BOM and totals have been rebuilt.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not recalculate', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) return <LoadingState label="Loading the quote…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load quote">{apiError(query.error)}</Alert>;
  }
  if (!quote) return null;

  const order = quote.order;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/q/${quote.publicToken}` : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      notifications.show({ title: 'Link copied', message: publicUrl, color: 'teal' });
    } catch {
      notifications.show({ title: 'Copy this link', message: publicUrl, color: 'orange' });
    }
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg" className="sp-no-print" wrap="wrap">
        <Group gap="sm">
          <Button
            component={Link}
            href="/dashboard/quotes"
            variant="subtle"
            color="gray"
            leftSection={<ArrowLeft size={15} />}
          >
            Quotes
          </Button>
          <div>
            <Text fz={11} fw={700} tt="uppercase" c="sun.7" style={{ letterSpacing: '0.12em' }}>
              Quote {quote.quoteNumber}
            </Text>
            <Text fw={800} fz={24} style={{ letterSpacing: '-0.03em' }}>
              {quote.customer.name}
            </Text>
          </div>
          <StatusBadge status={quote.status} />
        </Group>
        <Group gap="sm" wrap="wrap">
          <Button
            variant="light"
            color="gray"
            leftSection={<Copy size={15} />}
            onClick={copyLink}
          >
            Copy customer link
          </Button>
          <Button
            variant="light"
            color="teal"
            component="a"
            href={`/q/${quote.publicToken}`}
            target="_blank"
            leftSection={<ExternalLink size={15} />}
          >
            Public view
          </Button>
          <Button
            variant="light"
            color="gray"
            leftSection={<Printer size={15} />}
            onClick={() => window.print()}
          >
            Print
          </Button>
          {!order && (
            <Button
              color="teal"
              leftSection={<CheckCircle2 size={15} />}
              loading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              Accept & create order
            </Button>
          )}
        </Group>
      </Group>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper p={{ base: 'md', sm: 36 }} className="sp-soft-card sp-print-surface" radius="lg">
            <Group justify="space-between" align="flex-start" mb="xl" wrap="wrap">
              <Group gap="sm">
                <ThemeIcon size={44} radius="xl" color="sun" variant="filled">
                  <Sun size={22} />
                </ThemeIcon>
                <div>
                  <Text fw={800} fz="lg" lh={1.1}>
                    SunPower Solutions
                  </Text>
                  <Text fz={10} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.16em' }}>
                    Solar operations · GSTIN 29ABCDE1234F1Z5
                  </Text>
                  <Text fz={10} c="dimmed">
                    14 MG Road, Bengaluru 560001 · +91 80 4000 1234 · hello@sunpower.in
                  </Text>
                </div>
              </Group>
              <div style={{ textAlign: 'right' }}>
                <Text fw={800} fz={22} style={{ letterSpacing: '0.02em' }}>
                  QUOTATION
                </Text>
                <Text fz="xs" c="dimmed" className="sp-mono">
                  {quote.quoteNumber}
                </Text>
                <Text fz="xs" c="dimmed">
                  {formatDate(quote.createdAt)}
                </Text>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" mb="xl">
              <div>
                <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={4} style={{ letterSpacing: '0.1em' }}>
                  Prepared for
                </Text>
                <Text fw={700}>{quote.customer.name}</Text>
                <Text fz="xs" c="dimmed">
                  {quote.customer.address}
                </Text>
                <Text fz="xs" c="dimmed">
                  {[quote.customer.city, quote.customer.state, quote.customer.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
                <Text fz="xs" c="dimmed" className="sp-mono">
                  {quote.customer.phone}
                </Text>
                {quote.customer.email && (
                  <Text fz="xs" c="dimmed">
                    {quote.customer.email}
                  </Text>
                )}
              </div>
              <div>
                <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={4} style={{ letterSpacing: '0.1em' }}>
                  System
                </Text>
                <Text fw={700}>
                  {quote.capacityKw} kW {titleCase(quote.systemType)} solar plant
                </Text>
                <Text fz="xs" c="dimmed">
                  Valid until {formatDate(quote.validUntil)}
                </Text>
                <Text fz="xs" c="dimmed">
                  Prepared by {quote.createdBy?.name ?? 'SunPower sales'}
                </Text>
                <Badge mt={6} variant="light" color={quote.status === 'ACCEPTED' ? 'teal' : 'sun'}>
                  {titleCase(quote.status)}
                </Badge>
              </div>
            </SimpleGrid>

            <Table verticalSpacing="xs" horizontalSpacing="sm" mb="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th ta="center">Qty</Table.Th>
                  <Table.Th ta="right">Rate</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {quote.items.map((item, index) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text fz="xs" c="dimmed">
                        {index + 1}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{item.description}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz={10} c="dimmed">
                        {titleCase(item.category)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text fz="sm" className="sp-mono">
                        {item.quantity} {item.unit}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" className="sp-mono">
                        {formatINR(item.unitPrice)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" fw={600} className="sp-mono">
                        {formatINR(item.total)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="flex-end">
              <Box w={{ base: '100%', sm: 320 }}>
                <Group justify="space-between" mb={6}>
                  <Text fz="sm" c="dimmed">
                    Subtotal
                  </Text>
                  <Text fz="sm" className="sp-mono">
                    {formatINR(quote.subtotal)}
                  </Text>
                </Group>
                {quote.discount > 0 && (
                  <Group justify="space-between" mb={6}>
                    <Text fz="sm" c="dimmed">
                      Discount
                    </Text>
                    <Text fz="sm" c="red.6" className="sp-mono">
                      − {formatINR(quote.discount)}
                    </Text>
                  </Group>
                )}
                <Group justify="space-between" mb={6}>
                  <Text fz="sm" c="dimmed">
                    GST ({quote.taxRate}%)
                  </Text>
                  <Text fz="sm" className="sp-mono">
                    {formatINR(quote.taxAmount)}
                  </Text>
                </Group>
                <Divider my={8} />
                <Group justify="space-between" mb={4}>
                  <Text fw={700}>Total</Text>
                  <Text fw={800} fz="lg" className="sp-mono">
                    {formatINR(quote.total)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text fz="xs" c="dimmed">
                    Advance to confirm
                  </Text>
                  <Text fz="sm" fw={700} c="teal.7" className="sp-mono">
                    {formatINR(quote.advanceAmount)}
                  </Text>
                </Group>
              </Box>
            </Group>

            {quote.notes && (
              <>
                <Divider my="lg" />
                <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={4} style={{ letterSpacing: '0.1em' }}>
                  Notes
                </Text>
                <Text fz="xs" c="dimmed">
                  {quote.notes}
                </Text>
              </>
            )}

            <Divider my="lg" />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={4} style={{ letterSpacing: '0.1em' }}>
                  Included
                </Text>
                <Text fz="xs" c="dimmed">
                  Design, supply, installation, commissioning and 5-year workmanship support. Panel
                  warranty up to 25 years; inverter and battery as per manufacturer terms.
                </Text>
              </div>
              <div>
                <Text fz={10} fw={700} tt="uppercase" c="dimmed" mb={4} style={{ letterSpacing: '0.1em' }}>
                  Payment
                </Text>
                <Text fz="xs" c="dimmed">
                  Pay by UPI to sunpower@upi, upload the screenshot in the customer link, and our
                  office verifies it. Balance is collected after installation.
                </Text>
              </div>
            </SimpleGrid>

            <Text fz={10} c="dimmed" ta="center" mt="xl">
              This is a computer-generated quotation. Prices are valid until{' '}
              {formatDate(quote.validUntil)}. Thank you for choosing SunPower Solutions.
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }} className="sp-no-print">
          <Stack gap="md">
            <Panel title="Customer decision" subtitle="Share the public link to collect acceptance">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={38} radius="md" color="sun" variant="light">
                    <FileText size={18} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fz="sm" fw={700}>
                      Public link
                    </Text>
                    <Text fz={10} c="dimmed" truncate className="sp-mono">
                      /q/{quote.publicToken}
                    </Text>
                  </div>
                </Group>
                <Button variant="light" color="teal" leftSection={<Copy size={15} />} onClick={copyLink} fullWidth>
                  Copy link
                </Button>
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<ExternalLink size={15} />}
                  component="a"
                  href={`/q/${quote.publicToken}`}
                  target="_blank"
                  fullWidth
                >
                  Preview as customer
                </Button>
                <Divider />
                <Select
                  label="Set status"
                  data={['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((value) => ({
                    value,
                    label: titleCase(value),
                  }))}
                  value={quote.status}
                  onChange={(value) => value && statusMutation.mutate(value)}
                  allowDeselect={false}
                  disabled={Boolean(order)}
                />
                {!order && (
                  <Button
                    color="teal"
                    leftSection={<CheckCircle2 size={15} />}
                    loading={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate()}
                    fullWidth
                  >
                    Accept on behalf of customer
                  </Button>
                )}
                {!order && (
                  <Button
                    variant="light"
                    color="indigo"
                    leftSection={<Calculator size={15} />}
                    onClick={() => {
                      setRecalc({
                        capacityKw: String(quote.capacityKw),
                        systemType: quote.systemType,
                        discount: String(quote.discount),
                      });
                      setRecalcOpen(true);
                    }}
                    fullWidth
                  >
                    Recalculate BOM
                  </Button>
                )}
                {order && (
                  <Alert color="teal" variant="light" radius="md" icon={<ShieldCheck size={16} />}>
                    Accepted. Order <b>{order.orderNumber}</b> is live.
                  </Alert>
                )}
              </Stack>
            </Panel>

            {order && (
              <Panel
                title="Order"
                subtitle="Created from this quote"
                action={
                  <Button
                    component={Link}
                    href={`/dashboard/orders/${order.id}`}
                    size="compact-sm"
                    variant="light"
                    color="sun"
                    rightSection={<ArrowRight size={14} />}
                  >
                    Open
                  </Button>
                }
              >
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fz="xs" c="dimmed">
                      Status
                    </Text>
                    <StatusBadge status={order.status} size="xs" />
                  </Group>
                  <SimpleGrid cols={2} spacing="sm">
                    <InlineStat label="Order total" value={formatINR(order.total, true)} />
                    <InlineStat
                      label="Balance"
                      value={formatINR(order.balanceDue, true)}
                      color={order.balanceDue > 0 ? '#d97706' : '#0f766e'}
                    />
                  </SimpleGrid>
                  <Divider />
                  <Text fz="xs" fw={700}>
                    Payments
                  </Text>
                  {order.payments && order.payments.length > 0 ? (
                    order.payments.map((payment) => (
                      <Group key={payment.id} justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="xs">
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
                    ))
                  ) : (
                    <Text fz="xs" c="dimmed">
                      No payments submitted yet.
                    </Text>
                  )}
                </Stack>
              </Panel>
            )}

            <Panel title="Source lead" subtitle="Trace the enquiry behind this quote">
              {quote.lead ? (
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fz="sm" fw={700}>
                      {quote.lead.customer.name}
                    </Text>
                    <StatusBadge status={quote.lead.status} size="xs" />
                  </Group>
                  <Text fz={10} c="dimmed">
                    {quote.lead.reference} · {quote.lead.requestedKw} kW · {titleCase(quote.lead.source)}
                  </Text>
                  <Button
                    component={Link}
                    href={`/dashboard/leads/${quote.lead.id}`}
                    variant="light"
                    color="gray"
                    leftSection={<ArrowLeft size={14} />}
                    fullWidth
                  >
                    Open lead
                  </Button>
                </Stack>
              ) : (
                <Text fz="sm" c="dimmed">
                  This quote is not linked to a lead.
                </Text>
              )}
            </Panel>

            <Panel title="Quick facts">
              <SimpleGrid cols={2} spacing="sm">
                <InlineStat label="Line items" value={quote.items.length} />
                <InlineStat label="Capacity" value={`${quote.capacityKw} kW`} />
                <InlineStat label="Tax rate" value={`${quote.taxRate}%`} />
                <InlineStat label="Advance" value={formatINR(quote.advanceAmount, true)} />
              </SimpleGrid>
              <Group mt="md" gap="xs">
                <Button
                  component="a"
                  href={`/q/${quote.publicToken}`}
                  target="_blank"
                  variant="light"
                  color="teal"
                  size="compact-sm"
                  leftSection={<Wallet size={14} />}
                >
                  Pay page
                </Button>
                <Button
                  variant="light"
                  color="gray"
                  size="compact-sm"
                  leftSection={<Download size={14} />}
                  onClick={() => window.print()}
                >
                  Save PDF
                </Button>
              </Group>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={recalcOpen} onClose={() => setRecalcOpen(false)} title="Recalculate quote" size="md">
        <Stack gap="md">
          <Alert color="orange" variant="light" radius="md">
            Rebuilding replaces every line item using the latest catalogue prices.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Capacity (kW)"
              min={1}
              max={5}
              value={recalc.capacityKw}
              onChange={(value) => setRecalc((current) => ({ ...current, capacityKw: String(value) }))}
            />
            <NumberInput
              label="Discount (₹)"
              min={0}
              value={recalc.discount}
              onChange={(value) => setRecalc((current) => ({ ...current, discount: String(value) }))}
            />
          </SimpleGrid>
          <div>
            <Text fz="sm" fw={500} mb={6}>
              System type
            </Text>
            <SegmentedControl
              fullWidth
              value={recalc.systemType}
              onChange={(value) => setRecalc((current) => ({ ...current, systemType: value }))}
              data={[
                { label: 'On-grid', value: 'ON_GRID' },
                { label: 'Off-grid', value: 'OFF_GRID' },
              ]}
            />
          </div>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRecalcOpen(false)}>
              Cancel
            </Button>
            <Button color="sun" onClick={() => recalcMutation.mutate()} loading={recalcMutation.isPending}>
              Recalculate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
