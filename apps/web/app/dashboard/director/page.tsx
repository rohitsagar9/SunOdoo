'use client';

import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BadgeIndianRupee,
  Boxes,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  Headphones,
  Landmark,
  RefreshCw,
  Target,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, titleCase } from '@/lib/format';
import type { DashboardDirector, RestockRequest } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { FunnelBars, RevenueChart } from '@/components/Charts';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function DirectorDashboardPage() {
  return (
    <RoleGate roles={['DIRECTOR']}>
      <DirectorDashboard />
    </RoleGate>
  );
}

function DirectorDashboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard', 'director'],
    queryFn: async () => (await api.get<DashboardDirector>('/dashboard/director')).data,
  });

  const restockQuery = useQuery({
    queryKey: ['inventory', 'restock-requests'],
    queryFn: async () => (await api.get<RestockRequest[]>('/inventory/restock-requests')).data,
  });

  const restockRequests = restockQuery.data ?? [];
  const pendingRestock = restockRequests.filter((r) => r.status === 'PENDING');

  const approveRestockMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/inventory/restock-requests/${id}/approve`)).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({
        title: 'Restock approved & cost deducted',
        message: `${res.quantityAdded} units added to inventory. ${formatINR(res.amountDeducted)} deducted from company funds.`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Approval failed', message: apiError(error), color: 'red' }),
  });

  const rejectRestockMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/inventory/restock-requests/${id}/reject`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({
        title: 'Restock request rejected',
        message: 'The request was marked rejected.',
        color: 'gray',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Rejection failed', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) return <LoadingState label="Building the director view…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load the dashboard">{apiError(query.error)}</Alert>;
  }

  const data = query.data!;
  const { kpis } = data;
  const paymentTotal = data.paymentMix.reduce((sum, row) => sum + row.amount, 0) || 1;

  return (
    <>
      <PageHeader
        eyebrow="Director view"
        title="Director overview"
        description="Live Revenue today, margin, field operations and customer care across the whole company."
        actions={
          <Button
            variant="light"
            color="sun"
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
          label="Revenue this month"
          value={formatINR(kpis.revenueMonth)}
          hint={`Revenue today ${formatINR(kpis.revenueToday)} · week ${formatINR(kpis.revenueWeek)}`}
          icon={BadgeIndianRupee}
          color="teal"
          tone="filled"
        />
        <StatCard
          label="Profit this month"
          value={formatINR(kpis.profitMonth)}
          hint={`Expenses ${formatINR(kpis.expensesMonth)}`}
          icon={TrendingUp}
          color="sun"
        />
        <StatCard
          label="Receivables"
          value={formatINR(kpis.receivables)}
          hint={`${kpis.overdueInvoices} overdue invoice${kpis.overdueInvoices === 1 ? '' : 's'}`}
          icon={Wallet}
          color="orange"
        />
        <StatCard
          label="Pending installations"
          value={String(kpis.pendingInstallations)}
          hint={`${kpis.activeJobs} active field jobs`}
          icon={Wrench}
          color="ocean"
        />
        <StatCard
          label="Open support tickets"
          value={String(kpis.openTickets)}
          hint={`${kpis.urgentTickets} marked urgent`}
          icon={Headphones}
          color="grape"
        />
        <StatCard
          label="Lead conversion"
          value={`${kpis.conversionRate}%`}
          hint={`${kpis.wonLeads} won of ${kpis.totalLeads} leads`}
          icon={Target}
          color="cyan"
        />
        <StatCard
          label="Technician hours"
          value={`${kpis.technicianHoursMonth} h`}
          hint="Clocked this month"
          icon={Clock3}
          color="indigo"
        />
        <StatCard
          label="Subsidy files open"
          value={String(kpis.subsidyPending)}
          hint="Documents, submitted or not started"
          icon={Landmark}
          color="lime"
        />
      </SimpleGrid>

      <Grid gap="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Panel
            title="Revenue vs expenses"
            subtitle="Approved payments and recorded expenses, last six months"
            action={<Badge variant="light" color="teal">{formatINR(kpis.profitMonth)} profit MTD</Badge>}
          >
            <RevenueChart data={data.monthly} />
          </Panel>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Panel title="Lead funnel" subtitle="Every enquiry by stage">
            <FunnelBars data={data.funnel} />
          </Panel>
        </Grid.Col>
      </Grid>

      <Grid gap="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Panel
            title="Job profitability"
            subtitle="Revenue against parts, labour and site expenses"
            action={
              <Button
                component={Link}
                href="/dashboard/orders"
                variant="subtle"
                size="compact-sm"
                rightSection={<ArrowRight size={14} />}
              >
                All orders
              </Button>
            }
            padding={0}
          >
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={760}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>System</Table.Th>
                    <Table.Th ta="right">Revenue</Table.Th>
                    <Table.Th ta="right">Cost</Table.Th>
                    <Table.Th ta="right">Profit</Table.Th>
                    <Table.Th ta="right">Margin</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.jobProfitability.map((job) => (
                    <Table.Tr key={job.id}>
                      <Table.Td>
                        <Text fz="sm" fw={600} component={Link} href={`/dashboard/orders/${job.id}`}>
                          {job.orderNumber}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {formatDate(job.completedAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{job.customer}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs" c="dimmed">
                          {job.capacityKw} kW · {titleCase(job.systemType)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" className="sp-mono">
                          {formatINR(job.revenue)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" c="dimmed" className="sp-mono">
                          {formatINR(job.cost)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text
                          fz="sm"
                          fw={700}
                          className="sp-mono"
                          c={job.profit >= 0 ? 'teal.7' : 'red.6'}
                        >
                          {formatINR(job.profit)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Badge variant="light" color={job.margin >= 20 ? 'teal' : job.margin >= 10 ? 'yellow' : 'red'}>
                          {job.margin}%
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {data.jobProfitability.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="dimmed" fz="sm" ta="center" py="md">
                          Completed jobs will appear here with their margin.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md" h="100%">
            <Panel
              title="Waiting to install"
              subtitle="Paid orders not yet completed"
              action={<Badge variant="light" color="orange">{data.pendingInstallOrders.length}</Badge>}
            >
              <Stack gap="sm">
                {data.pendingInstallOrders.map((order) => (
                  <Box
                    key={order.id}
                    component={Link}
                    href={`/dashboard/orders/${order.id}`}
                    p="sm"
                    style={{ border: '1px solid #eef2f7', borderRadius: 10 }}
                    className="sp-hover-lift"
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text fz="sm" fw={700}>
                          {order.customer.name}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {order.orderNumber} · {order.quote?.capacityKw ?? '—'} kW
                        </Text>
                      </div>
                      <StatusBadge status={order.status} />
                    </Group>
                    <Progress
                      value={
                        order.status === 'ADVANCE_PAID'
                          ? 30
                          : order.status === 'READY_TO_DISPATCH'
                            ? 60
                            : 85
                      }
                      color="sun"
                      size="xs"
                      mt={8}
                    />
                  </Box>
                ))}
                {data.pendingInstallOrders.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No paid orders are waiting on installation.
                  </Text>
                )}
              </Stack>
            </Panel>

            <Panel title="Payment mix" subtitle="Approved collections this month">
              <Stack gap="sm">
                {data.paymentMix.map((row) => (
                  <Box key={row.method}>
                    <Group justify="space-between" mb={4}>
                      <Text fz="xs" fw={600}>
                        {titleCase(row.method)}
                      </Text>
                      <Text fz="xs" c="dimmed" className="sp-mono">
                        {formatINR(row.amount)}
                      </Text>
                    </Group>
                    <Progress value={(row.amount / paymentTotal) * 100} color="teal" size="sm" />
                  </Box>
                ))}
                {data.paymentMix.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No payments approved this month yet.
                  </Text>
                )}
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Box mb="md">
        <Panel
          title="Warehouse Restock & Procurement Requests"
          subtitle="Warehouse requests replenish stock. Upon Director agreement, inventory cost is deducted from company funds and units are created."
          action={
            <Button
              component={Link}
              href="/dashboard/inventory"
              variant="subtle"
              size="compact-sm"
              rightSection={<ArrowRight size={14} />}
            >
              Inventory
            </Button>
          }
        >
          {pendingRestock.length === 0 ? (
            <Group gap="sm" p="xs">
              <Check size={16} color="#0f766e" />
              <Text fz="sm" c="dimmed">
                No restock requests awaiting Director approval. All warehouse replenishment is up to date.
              </Text>
            </Group>
          ) : (
            <Stack gap="sm">
              {pendingRestock.map((req) => (
                <Box
                  key={req.id}
                  p="sm"
                  style={{
                    borderRadius: 8,
                    background: 'var(--sp-card-subtle)',
                    border: '1px solid var(--sp-border)',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                    <div>
                      <Group gap="xs" mb={2}>
                        <Badge color="orange" size="xs">
                          {req.quantity} units requested
                        </Badge>
                        <Text fz="xs" c="dimmed">
                          {formatDate(req.createdAt)} · By {req.requestedBy}
                        </Text>
                      </Group>
                      <Text fz="sm" fw={700}>
                        {req.description}
                      </Text>
                      <Text fz="xs" c="dimmed">
                        Unit price: {formatINR(req.unitCost)} · Total cost to deduct:{' '}
                        <Text component="span" fw={700} c="red.8">
                          {formatINR(req.totalCost)}
                        </Text>
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        color="teal"
                        leftSection={<Check size={14} />}
                        loading={approveRestockMutation.isPending}
                        onClick={() => approveRestockMutation.mutate(req.id)}
                      >
                        Agree & Deduct ({formatINR(req.totalCost)})
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<X size={14} />}
                        loading={rejectRestockMutation.isPending}
                        onClick={() => rejectRestockMutation.mutate(req.id)}
                      >
                        Reject
                      </Button>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </Panel>
      </Box>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Panel
            title="Recent collections"
            subtitle="Latest approved payments"
            action={
              <Button
                component={Link}
                href="/dashboard/payments"
                variant="subtle"
                size="compact-sm"
                rightSection={<ArrowRight size={14} />}
              >
                Queue
              </Button>
            }
          >
            <Stack gap="sm">
              {data.recentPayments.map((payment) => (
                <Group key={payment.id} justify="space-between" wrap="nowrap">
                  <div>
                    <Text fz="sm" fw={600}>
                      {payment.order?.customer.name ?? payment.ticket?.customer.name ?? 'Payment'}
                    </Text>
                    <Text fz={10} c="dimmed">
                      {titleCase(payment.method)} · {formatDateTime(payment.approvedAt)}
                    </Text>
                  </div>
                  <Text fz="sm" fw={700} className="sp-mono" c="teal.7">
                    {formatINR(payment.amount)}
                  </Text>
                </Group>
              ))}
              {data.recentPayments.length === 0 && (
                <Text fz="sm" c="dimmed">
                  No approved payments yet.
                </Text>
              )}
            </Stack>
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Panel
            title="Upcoming field work"
            subtitle="Scheduled and in-progress jobs"
            action={<CalendarClock size={16} color="#64748b" />}
          >
            <Stack gap="sm">
              {data.upcomingJobs.map((job) => (
                <Box
                  key={job.id}
                  component={Link}
                  href={`/dashboard/jobs/${job.id}`}
                  p="xs"
                  style={{ border: '1px solid #eef2f7', borderRadius: 8 }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fz="sm" fw={600}>
                        {job.customer.name}
                      </Text>
                      <Text fz={10} c="dimmed">
                        {formatDate(job.scheduledDate)} · {titleCase(job.type)}
                      </Text>
                    </div>
                    <StatusBadge status={job.status} size="xs" />
                  </Group>
                  <Text fz={10} c="dimmed" mt={4}>
                    {job.technician?.name ?? 'Unassigned'}
                  </Text>
                </Box>
              ))}
              {data.upcomingJobs.length === 0 && (
                <Text fz="sm" c="dimmed">
                  Nothing scheduled in the near future.
                </Text>
              )}
            </Stack>
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Panel title="Business snapshot" subtitle={`Generated ${formatDateTime(data.generatedAt)}`}>
            <SimpleGrid cols={2} spacing="md">
              <InlineStat label="Won leads" value={kpis.wonLeads} hint={`${kpis.totalLeads} total`} />
              <InlineStat label="Active jobs" value={kpis.activeJobs} hint="Scheduled or on site" />
              <InlineStat label="Urgent tickets" value={kpis.urgentTickets} color="#dc2626" hint="Need attention" />
              <InlineStat label="Overdue invoices" value={kpis.overdueInvoices} color="#d97706" hint="Past due date" />
            </SimpleGrid>
            <Box mt="lg" p="sm" bg="sun.0" style={{ borderRadius: 10 }}>
              <Group gap="xs" mb={4}>
                <Activity size={14} color="#b37400" />
                <Text fz="xs" fw={700} c="sun.8">
                  Director tip
                </Text>
              </Group>
              <Text fz="xs" c="sun.9">
                Margin is calculated from product cost, ₹250/hour labour and site expenses. Open an
                order to see the full cost breakdown.
              </Text>
            </Box>
            <Group mt="md" gap="xs">
              <Button
                component={Link}
                href="/dashboard/subsidies"
                variant="light"
                color="teal"
                size="compact-sm"
                leftSection={<Landmark size={14} />}
              >
                Subsidies
              </Button>
              <Button
                component={Link}
                href="/dashboard/expenses"
                variant="light"
                color="orange"
                size="compact-sm"
                leftSection={<CircleDollarSign size={14} />}
              >
                Expenses
              </Button>
            </Group>
          </Panel>
        </Grid.Col>
      </Grid>
    </>
  );
}
