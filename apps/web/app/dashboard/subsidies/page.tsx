'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Landmark,
  Pencil,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, safeValue, systemLabel, titleCase } from '@/lib/format';
import type { SubsidyRecord } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statuses = [
  'NOT_STARTED',
  'DOCUMENTS_PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
];

export default function SubsidiesPage() {
  return (
    <RoleGate roles={['DIRECTOR']}>
      <SubsidyTracker />
    </RoleGate>
  );
}

function SubsidyTracker() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SubsidyRecord | null>(null);
  const [form, setForm] = useState({
    status: 'NOT_STARTED',
    amount: 0 as number | string,
    applicationNumber: '',
    notes: '',
  });

  const query = useQuery({
    queryKey: ['subsidies'],
    queryFn: async () => (await api.get<SubsidyRecord[]>('/subsidies')).data,
  });

  const records = query.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = !statusFilter || record.status === statusFilter;
      const matchesTerm =
        !term ||
        record.customer.name.toLowerCase().includes(term) ||
        record.customer.phone.includes(term) ||
        (record.applicationNumber ?? '').toLowerCase().includes(term) ||
        (record.order?.orderNumber ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [records, statusFilter, search]);

  const totals = useMemo(
    () =>
      records.reduce(
        (acc, record) => ({
          pending: acc.pending + (['NOT_STARTED', 'DOCUMENTS_PENDING', 'SUBMITTED'].includes(record.status) ? 1 : 0),
          approved: acc.approved + (['APPROVED', 'DISBURSED'].includes(record.status) ? record.amount : 0),
          disbursed: acc.disbursed + (record.status === 'DISBURSED' ? record.amount : 0),
          pipeline: acc.pipeline + (record.status !== 'REJECTED' ? record.amount : 0),
        }),
        { pending: 0, approved: 0, disbursed: 0, pipeline: 0 },
      ),
    [records],
  );

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      status?: string;
      amount?: number;
      applicationNumber?: string;
      notes?: string;
    }) => {
      const { id, ...body } = payload;
      return (await api.patch<SubsidyRecord>(`/subsidies/${id}`, body)).data;
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['subsidies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditing(null);
      notifications.show({
        title: 'Subsidy updated',
        message: `${record.customer.name} · ${titleCase(record.status)}`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update subsidy', message: apiError(error), color: 'red' }),
  });

  function openEdit(record: SubsidyRecord) {
    setForm({
      status: record.status,
      amount: record.amount,
      applicationNumber: record.applicationNumber ?? '',
      notes: record.notes ?? '',
    });
    setEditing(record);
  }

  return (
    <>
      <PageHeader
        eyebrow="Finance & compliance"
        title="PM Surya Ghar subsidies"
        description="Track every rooftop subsidy from document collection to disbursement against the linked order."
        actions={
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={15} />}
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            Refresh
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Applications"
          value={String(records.length)}
          hint={`${totals.pending} awaiting action`}
          icon={ClipboardList}
          color="indigo"
          tone="filled"
        />
        <StatCard
          label="Subsidy pipeline"
          value={formatINR(totals.pipeline, true)}
          hint="Expected across live applications"
          icon={Landmark}
          color="sun"
        />
        <StatCard
          label="Approved"
          value={formatINR(totals.approved, true)}
          hint="Approved or already disbursed"
          icon={FileCheck2}
          color="teal"
        />
        <StatCard
          label="Disbursed"
          value={formatINR(totals.disbursed, true)}
          hint="Credited to customers"
          icon={Wallet}
          color="green"
        />
      </SimpleGrid>

      <Panel
        title="Subsidy register"
        subtitle="Status changes are timestamped automatically"
        action={
          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Customer, order, application…"
              leftSection={<Search size={15} />}
              value={search}
              onChange={(event) => setSearch(safeValue(event))}
              w={{ base: 170, sm: 240 }}
            />
            <Select
              placeholder="All statuses"
              data={statuses.map((status) => ({ value: status, label: titleCase(status) }))}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={180}
            />
          </Group>
        }
        padding={0}
      >
        {query.isLoading ? (
          <LoadingState label="Loading subsidy applications…" />
        ) : query.isError ? (
          <Alert color="red" title="Could not load subsidies">
            {apiError(query.error)}
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No subsidy applications"
            description="An application is created automatically when a quote is accepted."
          />
        ) : (
          <ScrollArea>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover miw={1040}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Order</Table.Th>
                  <Table.Th>Application</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>
                      <Text fz="sm" fw={600}>
                        {record.customer.name}
                      </Text>
                      <Text fz={10} c="dimmed" className="sp-mono">
                        {record.customer.phone}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {record.order ? (
                        <>
                          <Text fz="xs" fw={600} component={Link} href={`/dashboard/orders/${record.order.id}`} className="sp-mono">
                            {record.order.orderNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {record.order.quote?.capacityKw ?? '—'} kW ·{' '}
                            {systemLabel(record.order.quote?.systemType)}
                          </Text>
                        </>
                      ) : (
                        <Text fz="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text fz="xs" className="sp-mono">
                        {record.applicationNumber ?? 'Not filed'}
                      </Text>
                      {record.notes && (
                        <Text fz={10} c="dimmed" lineClamp={1} maw={200}>
                          {record.notes}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" fw={700} className="sp-mono">
                        {formatINR(record.amount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="xs">{formatDate(record.submittedAt)}</Text>
                      {record.approvedAt && (
                        <Text fz={10} c="dimmed">
                          Approved {formatDate(record.approvedAt)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <StatusBadge status={record.status} size="xs" />
                        <Select
                          size="xs"
                          variant="unstyled"
                          data={statuses.map((status) => ({ value: status, label: titleCase(status) }))}
                          value={record.status}
                          allowDeselect={false}
                          onChange={(status) =>
                            status &&
                            updateMutation.mutate({ id: record.id, status })
                          }
                          w={140}
                          aria-label={`Update status for ${record.customer.name}`}
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="sun"
                        leftSection={<Pencil size={12} />}
                        onClick={() => openEdit(record)}
                      >
                        Edit
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Panel>

      <Grid gap="md" mt="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Panel title="Document checklist" subtitle="What the portal asks for">
            <Stack gap="sm">
              {[
                'Latest electricity bill in the customer’s name',
                'Aadhaar and PAN of the registered consumer',
                'Roof ownership proof or society NOC',
                'Cancelled cheque / bank passbook page',
                'Signed installation and net-metering forms',
              ].map((item) => (
                <Group key={item} gap="sm" align="flex-start" wrap="nowrap">
                  <CheckCircle2 size={15} color="#0f766e" style={{ marginTop: 2 }} />
                  <Text fz="xs">{item}</Text>
                </Group>
              ))}
            </Stack>
          </Panel>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Panel title="Status playbook" subtitle="Keep the pipeline moving">
            <Stack gap="sm">
              {[
                ['Documents pending', 'Chase the customer from the portal; upload nothing until complete.'],
                ['Submitted', 'The portal timestamp is stamped when you move the record.'],
                ['Approved', 'Approval date is captured automatically for the director view.'],
                ['Disbursed', 'Confirm the bank credit before closing the record.'],
              ].map(([title, text]) => (
                <Group key={title} gap="sm" align="flex-start" wrap="nowrap">
                  <Landmark size={15} color="#d97706" style={{ marginTop: 2 }} />
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
        </Grid.Col>
      </Grid>

      <Modal opened={Boolean(editing)} onClose={() => setEditing(null)} title="Edit subsidy record" size="lg">
        {editing && (
          <Stack gap="md">
            <Alert color="blue" variant="light" radius="md">
              {editing.customer.name} · {editing.order?.orderNumber ?? 'No order linked'}
            </Alert>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Status"
                data={statuses.map((status) => ({ value: status, label: titleCase(status) }))}
                value={form.status}
                onChange={(value) => setForm((current) => ({ ...current, status: value ?? 'NOT_STARTED' }))}
                allowDeselect={false}
              />
              <NumberInput
                label="Subsidy amount (₹)"
                min={0}
                thousandSeparator=","
                value={form.amount}
                onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
              />
            </SimpleGrid>
            <TextInput
              label="Application number"
              placeholder="PMSG-2026-000123"
              value={form.applicationNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, applicationNumber: safeValue(event) }))
              }
            />
            <Textarea
              label="Notes"
              placeholder="Documents collected, portal remarks, bank reference…"
              minRows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: safeValue(event) }))}
            />
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                color="sun"
                loading={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editing.id,
                    status: form.status,
                    amount: Number(form.amount) || 0,
                    applicationNumber: form.applicationNumber.trim() || undefined,
                    notes: form.notes.trim() || undefined,
                  })
                }
              >
                Save record
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
