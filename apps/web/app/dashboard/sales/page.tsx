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
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, timeAgo, titleCase } from '@/lib/format';
import type { DashboardSales } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { FunnelBars } from '@/components/Charts';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

export default function SalesDashboardPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR']}>
      <SalesDashboard />
    </RoleGate>
  );
}

function SalesDashboard() {
  const query = useQuery({
    queryKey: ['dashboard', 'sales'],
    queryFn: async () => (await api.get<DashboardSales>('/dashboard/sales')).data,
  });

  if (query.isLoading) return <LoadingState label="Loading the sales desk…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load the sales dashboard">{apiError(query.error)}</Alert>;
  }

  const data = query.data!;
  const { kpis } = data;

  return (
    <>
      <PageHeader
        eyebrow="Sales & office"
        title="Pipeline desk"
        description="Every web enquiry, quote and payment screenshot in one working queue."
        actions={
          <>
            <Button
              component={Link}
              href="/dashboard/leads?new=1"
              leftSection={<Plus size={15} />}
              color="sun"
            >
              New lead
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
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="New enquiries this week"
          value={String(kpis.newLeadsWeek)}
          hint={`${kpis.surveysToday} survey${kpis.surveysToday === 1 ? '' : 's'} booked today`}
          icon={UserPlus}
          color="sun"
          tone="filled"
        />
        <StatCard
          label="My open leads"
          value={String(kpis.myLeads)}
          hint="Assigned to you"
          icon={Users}
          color="ocean"
        />
        <StatCard
          label="Payments to verify"
          value={String(kpis.pendingPayments)}
          hint={formatINR(kpis.pendingPaymentValue)}
          icon={Wallet}
          color="orange"
        />
        <StatCard
          label="Pipeline value"
          value={formatINR(kpis.pipelineValue, true)}
          hint={`${kpis.quotesSent} sent · ${kpis.quotesAccepted} accepted`}
          icon={BadgeIndianRupee}
          color="teal"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
        <StatCard label="Quotes sent" value={String(kpis.quotesSent)} icon={FileText} color="indigo" />
        <StatCard
          label="Quotes accepted"
          value={String(kpis.quotesAccepted)}
          icon={CalendarCheck}
          color="lime"
        />
        <StatCard
          label="Conversion rate"
          value={`${kpis.conversionRate}%`}
          hint="Won leads across the pipeline"
          icon={Target}
          color="cyan"
        />
      </SimpleGrid>

      <Grid gap="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Panel
            title="Latest enquiries"
            subtitle="Newest leads across web, phone, WhatsApp and walk-in"
            action={
              <Button
                component={Link}
                href="/dashboard/leads"
                variant="subtle"
                size="compact-sm"
                rightSection={<ArrowRight size={14} />}
              >
                Open Kanban
              </Button>
            }
            padding={0}
          >
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Requirement</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Age</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.recentLeads.map((lead) => (
                    <Table.Tr key={lead.id}>
                      <Table.Td>
                        <Text fz="sm" fw={600} component={Link} href={`/dashboard/leads/${lead.id}`}>
                          {lead.customer.name}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {lead.reference} · {lead.customer.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">
                          {lead.requestedKw} kW · {titleCase(lead.systemType)}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {lead.customer.city ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray" size="sm">
                          {titleCase(lead.source)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">{lead.assignedTo?.name ?? 'Unassigned'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge status={lead.status} />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="xs" c="dimmed">
                          {timeAgo(lead.createdAt)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {data.recentLeads.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" fz="sm" ta="center" py="md">
                          No enquiries yet. Share the public website form.
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
          <Panel title="Lead funnel" subtitle="Where every enquiry sits today">
            <FunnelBars data={data.funnel} />
          </Panel>
        </Grid.Col>
      </Grid>

      {data.readyForQuoteLeads && data.readyForQuoteLeads.length > 0 && (
        <Box mb="md">
          <Panel
            title="Surveys completed · Ready for quote"
            subtitle="Technicians completed physical site measurements. Ready to generate itemized BOM quotation."
            action={
              <Badge color="teal" variant="light" size="md">
                {data.readyForQuoteLeads.length} ready
              </Badge>
            }
          >
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Requirement</Table.Th>
                    <Table.Th>Site Measurements</Table.Th>
                    <Table.Th>Feasibility</Table.Th>
                    <Table.Th ta="right">Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.readyForQuoteLeads.map((lead) => (
                    <Table.Tr key={lead.id}>
                      <Table.Td>
                        <Text fz="sm" fw={700} component={Link} href={`/dashboard/leads/${lead.id}`}>
                          {lead.customer.name}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {lead.reference} · {lead.customer.phone} · {lead.customer.city ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="sun" size="sm">
                          {lead.requestedKw} kW {titleCase(lead.systemType)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">
                          {lead.survey?.roofDirection ? `Orientation: ${lead.survey.roofDirection}` : 'Orientation recorded'}
                          {lead.survey?.tiltDegrees ? ` · Tilt: ${lead.survey.tiltDegrees}°` : ''}
                          {lead.survey?.shadowFreeAreaSqft ? ` · ${lead.survey.shadowFreeAreaSqft} sq ft` : ''}
                        </Text>
                        <Text fz={10} c="dimmed">
                          Cable run: {lead.survey?.cableDistanceM ?? '—'} m
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="teal" variant="light" size="sm" leftSection={<CheckCircle2 size={12} />}>
                          Survey Done
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          component={Link}
                          href={`/dashboard/leads/${lead.id}`}
                          size="xs"
                          color="sun"
                          leftSection={<FileText size={13} />}
                        >
                          Generate quote
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Panel>
        </Box>
      )}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Panel
            title="Payments waiting for approval"
            subtitle="UPI screenshots submitted by customers and technicians"
            action={
              <Button
                component={Link}
                href="/dashboard/payments"
                variant="subtle"
                size="compact-sm"
                rightSection={<ArrowRight size={14} />}
              >
                Verify
              </Button>
            }
          >
            <Stack gap="sm">
              {data.pendingPayments.map((payment) => (
                <Group key={payment.id} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Box
                      w={38}
                      h={38}
                      bg="orange.0"
                      style={{ borderRadius: 10, display: 'grid', placeItems: 'center' }}
                    >
                      <Wallet size={17} color="#c2410c" />
                    </Box>
                    <div>
                      <Text fz="sm" fw={600}>
                        {payment.order?.customer.name ?? 'Repair payment'}
                      </Text>
                      <Text fz={10} c="dimmed">
                        {payment.order?.orderNumber ?? payment.ticket?.ticketNumber ?? '—'} ·{' '}
                        {titleCase(payment.method)} · {formatDate(payment.createdAt)}
                      </Text>
                    </div>
                  </Group>
                  <div style={{ textAlign: 'right' }}>
                    <Text fz="sm" fw={700} className="sp-mono">
                      {formatINR(payment.amount)}
                    </Text>
                    <StatusBadge status={payment.status} size="xs" />
                  </div>
                </Group>
              ))}
              {data.pendingPayments.length === 0 && (
                <Text fz="sm" c="dimmed">
                  Nothing waiting. Every screenshot has been verified.
                </Text>
              )}
            </Stack>
          </Panel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="md" h="100%">
            <Panel
              title="Recent collections"
              subtitle="Approved by the office"
              action={<TrendingUp size={16} color="#0f766e" />}
            >
              <Stack gap="sm">
                {data.recentPayments.map((payment) => (
                  <Group key={payment.id} justify="space-between" wrap="nowrap">
                    <div>
                      <Text fz="sm" fw={600}>
                        {payment.order?.customer.name ?? payment.ticket?.customer.name ?? 'Payment'}
                      </Text>
                      <Text fz={10} c="dimmed">
                        {formatDateTime(payment.approvedAt)}
                      </Text>
                    </div>
                    <Text fz="sm" fw={700} c="teal.7" className="sp-mono">
                      {formatINR(payment.amount)}
                    </Text>
                  </Group>
                ))}
                {data.recentPayments.length === 0 && (
                  <Text fz="sm" c="dimmed">
                    No collections yet.
                  </Text>
                )}
              </Stack>
            </Panel>

            <Panel title="Next actions" subtitle="Keep the pipeline moving">
              <Stack gap="xs">
                {[
                  ['Call every NEW enquiry within 15 minutes', '/dashboard/leads?status=NEW'],
                  ['Book surveys for verified leads', '/dashboard/leads?status=VERIFIED'],
                  ['Send pending quotes', '/dashboard/quotes?status=DRAFT'],
                  ['Verify UPI screenshots', '/dashboard/payments'],
                ].map(([label, href]) => (
                  <Button
                    key={label}
                    component={Link}
                    href={href}
                    variant="light"
                    color="gray"
                    justify="space-between"
                    rightSection={<ArrowRight size={14} />}
                    fullWidth
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
              <Progress value={Math.min(100, kpis.conversionRate * 2)} color="sun" size="sm" mt="md" />
              <Text fz={10} c="dimmed" mt={6}>
                {kpis.conversionRate}% of all leads have converted to orders.
              </Text>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
