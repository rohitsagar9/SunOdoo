'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Image,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { api, apiError, assetUrl } from '@/lib/api';
import { formatDateTime, formatINR, titleCase } from '@/lib/format';
import type { Payment } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function PaymentsPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR', 'SUPPORT', 'WAREHOUSE']}>
      <PaymentsQueue />
    </RoleGate>
  );
}

function PaymentsQueue() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>('PENDING');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Payment | null>(null);

  const query = useQuery({
    queryKey: ['payments'],
    queryFn: async () => (await api.get<Payment[]>('/payments')).data,
  });

  const payments = query.data ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
    queryClient.invalidateQueries({ queryKey: ['quote'] });
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/payments/${id}/approve`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Payment approved',
        message: 'The order balance and installation job have been updated.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not approve', message: apiError(error), color: 'red' }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason: text }: { id: string; reason: string }) =>
      (await api.post(`/payments/${id}/reject`, { reason: text })).data,
    onSuccess: () => {
      invalidate();
      setRejecting(null);
      setReason('');
      notifications.show({
        title: 'Payment rejected',
        message: 'The customer or technician will see the rejection reason.',
        color: 'orange',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not reject', message: apiError(error), color: 'red' }),
  });

  const counts = useMemo(
    () => ({
      PENDING: payments.filter((payment) => payment.status === 'PENDING').length,
      APPROVED: payments.filter((payment) => payment.status === 'APPROVED').length,
      REJECTED: payments.filter((payment) => payment.status === 'REJECTED').length,
      ALL: payments.length,
    }),
    [payments],
  );

  const pendingValue = payments
    .filter((payment) => payment.status === 'PENDING')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const approvedValue = payments
    .filter((payment) => payment.status === 'APPROVED')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const filtered = payments.filter((payment) => {
    if (tab !== 'ALL' && payment.status !== tab) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return [
      payment.order?.orderNumber,
      payment.order?.customer.name,
      payment.ticket?.ticketNumber,
      payment.ticket?.customer.name,
      payment.reference,
      payment.submittedBy?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        eyebrow="Office verification"
        title="Payment queue"
        description="Match every UPI screenshot to an order, then approve to flip the balance and unlock installation."
        actions={
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={15} />}
            onClick={() => query.refetch()}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Waiting to verify"
          value={formatINR(pendingValue)}
          hint={`${counts.PENDING} screenshot${counts.PENDING === 1 ? '' : 's'}`}
          icon={Wallet}
          color="orange"
          tone="filled"
        />
        <StatCard
          label="Approved value"
          value={formatINR(approvedValue, true)}
          hint={`${counts.APPROVED} payments`}
          icon={CheckCircle2}
          color="teal"
        />
        <StatCard
          label="Rejected"
          value={String(counts.REJECTED)}
          hint="Need customer follow-up"
          icon={XCircle}
          color="red"
        />
        <StatCard
          label="All submissions"
          value={String(counts.ALL)}
          hint="Every method and status"
          icon={ShieldCheck}
          color="ocean"
        />
      </SimpleGrid>

      <Panel padding="md" className="sp-no-print">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Tabs value={tab} onChange={(value) => setTab(value ?? 'PENDING')}>
            <Tabs.List>
              <Tabs.Tab value="PENDING">
                Pending <Badge size="xs" ml={6} color="orange" variant="light">{counts.PENDING}</Badge>
              </Tabs.Tab>
              <Tabs.Tab value="APPROVED">
                Approved <Badge size="xs" ml={6} color="teal" variant="light">{counts.APPROVED}</Badge>
              </Tabs.Tab>
              <Tabs.Tab value="REJECTED">
                Rejected <Badge size="xs" ml={6} color="red" variant="light">{counts.REJECTED}</Badge>
              </Tabs.Tab>
              <Tabs.Tab value="ALL">All</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <TextInput
            placeholder="Search order, customer or UTR…"
            leftSection={<Search size={15} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            w={{ base: '100%', sm: 300 }}
          />
        </Group>
      </Panel>

      <Stack mt="md" gap="md">
        {query.isLoading && <LoadingState label="Loading payment submissions…" />}
        {query.isError && (
          <Alert color="red" title="Could not load payments">
            {apiError(query.error)}
          </Alert>
        )}
        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <EmptyState
            title="Nothing in this queue"
            description="Customer UPI screenshots and technician site collections land here for office approval."
          />
        )}
        {filtered.length > 0 && (
          <Panel padding={0}>
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={980}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Submitted</Table.Th>
                    <Table.Th>Against</Table.Th>
                    <Table.Th ta="right">Amount</Table.Th>
                    <Table.Th>Method</Table.Th>
                    <Table.Th>Proof</Table.Th>
                    <Table.Th>Submitted by</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Decision</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtered.map((payment) => (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <Text fz="xs" fw={600}>
                          {formatDateTime(payment.createdAt)}
                        </Text>
                        {payment.approvedAt && (
                          <Text fz={10} c="dimmed">
                            Decided {formatDateTime(payment.approvedAt)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" fw={600}>
                          {payment.order?.customer.name ?? payment.ticket?.customer.name ?? 'Payment'}
                        </Text>
                        <Text fz={10} c="dimmed" className="sp-mono">
                          {payment.order?.orderNumber ?? payment.ticket?.ticketNumber ?? '—'}
                          {payment.reference ? ` · ${payment.reference}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" fw={800} className="sp-mono">
                          {formatINR(payment.amount)}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          {titleCase(payment.type)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">{titleCase(payment.method)}</Text>
                        {payment.notes && (
                          <Text fz={10} c="dimmed" lineClamp={1} maw={160}>
                            {payment.notes}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {payment.screenshotUrl ? (
                          <Group gap={6} wrap="nowrap">
                            <Image
                              src={assetUrl(payment.screenshotUrl)}
                              alt="Payment screenshot"
                              w={44}
                              h={44}
                              radius="sm"
                              fit="cover"
                              style={{ cursor: 'zoom-in', border: '1px solid #e2e8f0' }}
                              onClick={() => setPreview(payment)}
                            />
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="gray"
                              component="a"
                              href={assetUrl(payment.screenshotUrl)}
                              target="_blank"
                              leftSection={<ExternalLink size={12} />}
                            >
                              Open
                            </Button>
                          </Group>
                        ) : (
                          <Group gap={4}>
                            <ImageIcon size={14} color="#94a3b8" />
                            <Text fz={10} c="dimmed">
                              No proof
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">{payment.submittedBy?.name ?? 'Customer link'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge status={payment.status} />
                      </Table.Td>
                      <Table.Td>
                        {payment.status === 'PENDING' ? (
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Button
                              size="compact-xs"
                              color="teal"
                              leftSection={<CheckCircle2 size={12} />}
                              loading={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(payment.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="compact-xs"
                              variant="light"
                              color="red"
                              leftSection={<XCircle size={12} />}
                              onClick={() => {
                                setRejecting(payment);
                                setReason('');
                              }}
                            >
                              Reject
                            </Button>
                          </Group>
                        ) : (
                          <Text fz={10} c="dimmed" ta="right">
                            {payment.approvedBy?.name ?? '—'}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Panel>
        )}
      </Stack>

      <Modal opened={Boolean(preview)} onClose={() => setPreview(null)} title="Payment screenshot" size="lg">
        {preview?.screenshotUrl && (
          <Stack gap="sm">
            <Image src={assetUrl(preview.screenshotUrl)} alt="Payment proof" radius="md" />
            <Group justify="space-between">
              <div>
                <Text fz="sm" fw={700}>
                  {preview.order?.customer.name ?? preview.ticket?.customer.name}
                </Text>
                <Text fz="xs" c="dimmed">
                  {formatINR(preview.amount)} · {titleCase(preview.method)} ·{' '}
                  {preview.reference ?? 'No reference'}
                </Text>
              </div>
              <Button
                component="a"
                href={assetUrl(preview.screenshotUrl)}
                target="_blank"
                variant="light"
                leftSection={<ExternalLink size={14} />}
              >
                Open full size
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject payment"
        size="md"
      >
        <Stack gap="md">
          <Alert color="red" variant="light" radius="md" icon={<XCircle size={16} />}>
            Rejecting does not delete the submission. Add a clear reason so sales can ask the
            customer for a valid screenshot.
          </Alert>
          <Textarea
            label="Reason"
            placeholder="Screenshot unclear, amount mismatch, duplicate UTR…"
            minRows={3}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={reason.trim().length < 3}
              loading={rejectMutation.isPending}
              onClick={() =>
                rejecting && rejectMutation.mutate({ id: rejecting.id, reason })
              }
            >
              Reject payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
