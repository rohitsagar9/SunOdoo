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
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  IndianRupee,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, titleCase, todayInputValue } from '@/lib/format';
import type { Expense } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const categories = [
  'MATERIALS',
  'LABOUR',
  'TRAVEL',
  'TRANSPORT',
  'RENT',
  'MARKETING',
  'UTILITIES',
  'OFFICE',
  'TOOLS',
  'MISCELLANEOUS',
];

export default function ExpensesPage() {
  return (
    <RoleGate roles={['DIRECTOR', 'SALES']}>
      <ExpenseBook />
    </RoleGate>
  );
}

function ExpenseBook() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: 'MATERIALS',
    description: '',
    amount: 0 as number | string,
    date: todayInputValue(),
  });

  const query = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: async () =>
      (
        await api.get<Expense[]>('/expenses', {
          params: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        })
      ).data,
  });

  const expenses = query.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory = !categoryFilter || expense.category === categoryFilter;
      const matchesTerm =
        !term ||
        expense.description.toLowerCase().includes(term) ||
        expense.category.toLowerCase().includes(term) ||
        (expense.job?.jobNumber ?? '').toLowerCase().includes(term) ||
        (expense.job?.customer?.name ?? '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [expenses, categoryFilter, search]);

  const totals = useMemo(() => {
    const byCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const thisMonth = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      total,
      thisMonth,
      average: expenses.length ? total / expenses.length : 0,
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
    };
  }, [expenses]);

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/expenses', {
          category: form.category,
          description: form.description.trim(),
          amount: Number(form.amount) || 0,
          date: form.date || undefined,
        })
      ).data as Expense,
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      setForm({ category: 'MATERIALS', description: '', amount: 0, date: todayInputValue() });
      notifications.show({
        title: 'Expense recorded',
        message: `${titleCase(expense.category)} · ${formatINR(expense.amount)}`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not record expense', message: apiError(error), color: 'red' }),
  });

  const maxCategory = totals.byCategory[0]?.[1] ?? 1;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Expense book"
        description="Record field and office spend so every job, and the director’s P&L, reflects the true cost."
        actions={
          <>
            <Button color="sun" leftSection={<Plus size={15} />} onClick={() => setOpen(true)}>
              Add expense
            </Button>
            <Button
              variant="light"
              color="gray"
              leftSection={<RefreshCw size={15} />}
              loading={query.isFetching}
              onClick={() => query.refetch()}
            >
              Refresh
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Total recorded"
          value={formatINR(totals.total, true)}
          hint={`${expenses.length} entries in range`}
          icon={Receipt}
          color="indigo"
          tone="filled"
        />
        <StatCard
          label="This month"
          value={formatINR(totals.thisMonth, true)}
          hint="Calendar month to date"
          icon={CalendarDays}
          color="sun"
        />
        <StatCard
          label="Average entry"
          value={formatINR(totals.average, true)}
          hint="Per expense line"
          icon={TrendingDown}
          color="orange"
        />
        <StatCard
          label="Categories used"
          value={String(totals.byCategory.length)}
          hint="Across the selected range"
          icon={Wallet}
          color="teal"
        />
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Panel
            title="Expense ledger"
            subtitle="Filter by date, category or description"
            action={<IndianRupee size={16} color="#64748b" />}
            padding={0}
          >
            <Group gap="sm" p="lg" pb="sm" wrap="wrap">
              <TextInput
                placeholder="Search description, job or customer…"
                leftSection={<Search size={15} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <Select
                placeholder="All categories"
                data={categories.map((category) => ({ value: category, label: titleCase(category) }))}
                value={categoryFilter}
                onChange={setCategoryFilter}
                clearable
                w={170}
              />
              <DateInput
                placeholder="From"
                value={from}
                onChange={setFrom}
                valueFormat="DD MMM YYYY"
                clearable
                w={150}
              />
              <DateInput
                placeholder="To"
                value={to}
                onChange={setTo}
                valueFormat="DD MMM YYYY"
                clearable
                w={150}
              />
            </Group>

            {query.isLoading ? (
              <LoadingState label="Loading expenses…" />
            ) : query.isError ? (
              <Alert color="red" title="Could not load expenses">
                {apiError(query.error)}
              </Alert>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No expenses in this range"
                description="Add an expense or widen the date filter."
              />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover miw={860}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Job</Table.Th>
                      <Table.Th>Recorded by</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((expense) => (
                      <Table.Tr key={expense.id}>
                        <Table.Td>
                          <Text fz="xs" className="sp-mono">
                            {formatDate(expense.date)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" fw={600}>
                            {titleCase(expense.category)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs" lineClamp={2} maw={260}>
                            {expense.description}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {expense.job ? (
                            <>
                              <Text fz="xs" fw={600} component={Link} href={`/dashboard/jobs/${expense.job.id}`} className="sp-mono">
                                {expense.job.jobNumber}
                              </Text>
                              <Text fz={10} c="dimmed">
                                {expense.job.customer?.name ?? '—'}
                              </Text>
                            </>
                          ) : (
                            <Text fz="xs" c="dimmed">
                              Overhead
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">{expense.createdBy?.name ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700} className="sp-mono">
                            {formatINR(expense.amount)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel title="Spend by category" subtitle="Selected date range">
              <Stack gap="sm">
                {totals.byCategory.map(([category, amount]) => (
                  <div key={category}>
                    <Group justify="space-between" mb={4}>
                      <Text fz="xs" fw={600}>
                        {titleCase(category)}
                      </Text>
                      <Text fz="xs" c="dimmed" className="sp-mono">
                        {formatINR(amount)}
                      </Text>
                    </Group>
                    <Progress value={(amount / maxCategory) * 100} color="sun" size="sm" />
                  </div>
                ))}
                {totals.byCategory.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No spend recorded yet.
                  </Text>
                )}
              </Stack>
            </Panel>

            <Panel title="Why it matters" subtitle="Cost control feeds the director P&L">
              <Stack gap="sm">
                {[
                  ['Labour is derived from job hours', 'Clock-in and clock-out data prices crew time automatically.'],
                  ['Parts cost comes from the BOM', 'Every quote line carries the purchase cost of the product.'],
                  ['Field expenses complete the picture', 'Fuel, transport and hired help are recorded here.'],
                ].map(([title, text]) => (
                  <Group key={title} gap="sm" align="flex-start" wrap="nowrap">
                    <Receipt size={15} color="#0f766e" style={{ marginTop: 2 }} />
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
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={open} onClose={() => setOpen(false)} title="Record an expense" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light" radius="md">
            Use the category that best matches the spend — the director dashboard groups by category.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Category"
              data={categories.map((category) => ({ value: category, label: titleCase(category) }))}
              value={form.category}
              onChange={(value) => setForm((current) => ({ ...current, category: value ?? 'MATERIALS' }))}
              allowDeselect={false}
            />
            <NumberInput
              label="Amount (₹)"
              min={1}
              thousandSeparator=","
              value={form.amount}
              onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
            />
          </SimpleGrid>
          <TextInput
            label="Description"
            placeholder="Diesel for pickup, 2 helpers, panel cleaning…"
            required
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.currentTarget.value }))
            }
          />
          <DateInput
            label="Date"
            value={form.date}
            onChange={(value) => setForm((current) => ({ ...current, date: value ?? '' }))}
            valueFormat="DD MMM YYYY"
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              color="sun"
              leftSection={<Plus size={15} />}
              disabled={form.description.trim().length < 2 || Number(form.amount) <= 0}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Record expense
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
