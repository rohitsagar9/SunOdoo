'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Headphones,
  MapPin,
  Phone,
  RefreshCw,
  SunMedium,
  Wrench,
} from 'lucide-react';
import dayjs from 'dayjs';
import { api, apiError } from '@/lib/api';
import { formatDate, formatTime, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { DashboardTechnician, Job } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statusOptions = [
  { value: 'ALL', label: 'All jobs' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function SchedulePage() {
  return (
    <RoleGate roles={['TECHNICIAN', 'SALES', 'DIRECTOR']}>
      <Schedule />
    </RoleGate>
  );
}

function Schedule() {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('ALL');
  const [workCategory, setWorkCategory] = useState<'ALL' | 'SALES' | 'SUPPORT'>('ALL');

  const query = useQuery({
    queryKey: ['jobs', date, status],
    queryFn: async () => {
      const response = await api.get<Job[]>('/jobs', {
        params: {
          ...(date ? { date } : {}),
          ...(status !== 'ALL' ? { status } : {}),
        },
      });
      return response.data;
    },
  });

  const techDashboard = useQuery({
    queryKey: ['dashboard', 'technician'],
    enabled: user?.role === 'TECHNICIAN' || user?.role === 'DIRECTOR',
    queryFn: async () =>
      (await api.get<DashboardTechnician>('/dashboard/technician')).data,
  });

  const jobs = query.data ?? [];
  const todayKey = dayjs().format('YYYY-MM-DD');

  const salesCount = useMemo(
    () => jobs.filter((j) => j.type === 'SURVEY' || j.type === 'INSTALLATION').length,
    [jobs],
  );
  const supportCount = useMemo(
    () => jobs.filter((j) => j.type === 'REPAIR' || j.type === 'MAINTENANCE').length,
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (workCategory === 'SALES') {
        return job.type === 'SURVEY' || job.type === 'INSTALLATION';
      }
      if (workCategory === 'SUPPORT') {
        return job.type === 'REPAIR' || job.type === 'MAINTENANCE';
      }
      return true;
    });
  }, [jobs, workCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of filteredJobs) {
      const key = dayjs(job.scheduledDate).format('YYYY-MM-DD');
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, dayJobs]) => {
        const sortedDayJobs = [...dayJobs].sort((a, b) => {
          const slotA = a.scheduledSlot ?? dayjs(a.scheduledDate).format('HH:mm');
          const slotB = b.scheduledSlot ?? dayjs(b.scheduledDate).format('HH:mm');
          return slotA.localeCompare(slotB);
        });
        return [dateKey, sortedDayJobs] as [string, Job[]];
      });
  }, [filteredJobs]);

  const jobsToday = jobs.filter(
    (job) => dayjs(job.scheduledDate).format('YYYY-MM-DD') === todayKey,
  ).length;
  const upcoming = jobs.filter(
    (job) =>
      job.status === 'SCHEDULED' &&
      dayjs(job.scheduledDate).isAfter(dayjs(), 'day'),
  ).length;
  const inProgress = jobs.filter((job) => job.status === 'IN_PROGRESS').length;
  const completed = jobs.filter((job) => job.status === 'COMPLETED').length;
  const kpis = techDashboard.data?.kpis;

  return (
    <>
      <PageHeader
        eyebrow={user?.role === 'TECHNICIAN' ? 'My day' : 'Field operations'}
        title="Schedule & jobs"
        description="Survey visits and installations with clock-in, roof photos and customer sign-off."
        actions={
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={15} />}
            onClick={() => {
              query.refetch();
              techDashboard.refetch();
            }}
            loading={query.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Jobs today"
          value={String(kpis?.jobsToday ?? jobsToday)}
          hint={date ? `Filtered to ${formatDate(date)}` : 'Across the schedule'}
          icon={SunMedium}
          color="sun"
          tone="filled"
        />
        <StatCard
          label="Upcoming"
          value={String(kpis?.upcoming ?? upcoming)}
          hint="Scheduled after today"
          icon={CalendarDays}
          color="ocean"
        />
        <StatCard
          label="In progress"
          value={String(inProgress)}
          hint="Crews currently on site"
          icon={Clock3}
          color="orange"
        />
        <StatCard
          label={kpis ? 'Hours this week' : 'Completed'}
          value={kpis ? `${kpis.hoursWeek} h` : String(completed)}
          hint={kpis ? `${kpis.completedMonth} jobs this month` : 'In the filtered list'}
          icon={CheckCircle2}
          color="teal"
        />
      </SimpleGrid>

      <Panel padding="xs">
        <SegmentedControl
          fullWidth
          value={workCategory}
          onChange={(val) => setWorkCategory(val as 'ALL' | 'SALES' | 'SUPPORT')}
          data={[
            { label: `All Jobs (${jobs.length})`, value: 'ALL' },
            { label: `Sales Work (Surveys & Installs: ${salesCount})`, value: 'SALES' },
            { label: `Support Work (Repairs & Service: ${supportCount})`, value: 'SUPPORT' },
          ]}
        />
      </Panel>

      <Panel padding="md" className="sp-no-print">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap="sm">
            <TextInput
              type="date"
              label="Date"
              value={date}
              onChange={(event) => setDate(event.currentTarget.value)}
              w={{ base: '100%', sm: 190 }}
            />
            <Select
              label="Status"
              data={statusOptions}
              value={status}
              onChange={(value) => setStatus(value ?? 'ALL')}
              allowDeselect={false}
              w={{ base: '100%', sm: 170 }}
            />
            {(date || status !== 'ALL') && (
              <Button
                variant="subtle"
                color="gray"
                mt={22}
                onClick={() => {
                  setDate('');
                  setStatus('ALL');
                }}
              >
                Clear filters
              </Button>
            )}
          </Group>
          <Text fz="xs" c="dimmed">
            {user?.role === 'TECHNICIAN'
              ? 'Your list is automatically limited to jobs assigned to you.'
              : 'All crews and survey visits across the company.'}
          </Text>
        </Group>
      </Panel>

      <Grid gap="md" mt="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          {query.isLoading && <LoadingState label="Loading the field schedule…" />}
          {query.isError && (
            <Alert color="red" title="Could not load jobs">
              {apiError(query.error)}
            </Alert>
          )}
          {!query.isLoading && !query.isError && jobs.length === 0 && (
            <EmptyState
              title="No jobs in this view"
              description="Survey visits appear when sales books them. Installations appear after advance payment approval."
            />
          )}
          {jobs.length > 0 && (
            <Stack gap="md">
              {grouped.map(([key, dayJobs]) => (
                <Box key={key}>
                  <Group justify="space-between" mb="xs" px={4}>
                    <Group gap="sm">
                      <ThemeIcon
                        size={30}
                        radius="md"
                        color={key === todayKey ? 'sun' : 'gray'}
                        variant={key === todayKey ? 'filled' : 'light'}
                      >
                        <CalendarDays size={15} />
                      </ThemeIcon>
                      <div>
                        <Text fz="sm" fw={700}>
                          {key === todayKey ? 'Today · ' : ''}
                          {dayjs(key).format('ddd, DD MMM YYYY')}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
                        </Text>
                      </div>
                    </Group>
                  </Group>
                  <Stack gap="sm">
                    {dayJobs.map((job) => (
                      <JobRow key={job.id} job={job} />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {techDashboard.data && (
              <Panel
                title="Assigned support tickets"
                subtitle="Repairs and warranty visits on your plate"
                action={
                  <Button
                    component={Link}
                    href="/dashboard/support"
                    variant="subtle"
                    size="compact-sm"
                    rightSection={<ArrowRight size={13} />}
                  >
                    Desk
                  </Button>
                }
              >
                <Stack gap="sm">
                  {techDashboard.data.tickets.map((ticket) => (
                    <Paper
                      key={ticket.id}
                      withBorder
                      p="sm"
                      radius="md"
                      component={Link}
                      href={`/dashboard/support/${ticket.id}`}
                      className="sp-hover-lift"
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="sm" fw={600}>
                            {ticket.customer.name}
                          </Text>
                          <Text fz={10} c="dimmed" lineClamp={1}>
                            {ticket.ticketNumber} · {ticket.issue}
                          </Text>
                        </div>
                        <StatusBadge status={ticket.priority} size="xs" />
                      </Group>
                    </Paper>
                  ))}
                  {techDashboard.data.tickets.length === 0 && (
                    <Group gap="sm">
                      <Headphones size={16} color="#94a3b8" />
                      <Text fz="sm" c="dimmed">
                        No open tickets assigned.
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Panel>
            )}

            <Panel title="Job day checklist" subtitle="Every visit needs proof">
              <Timeline active={3} bulletSize={22} lineWidth={2}>
                <Timeline.Item title="Clock in" bullet={<Clock3 size={11} />}>
                  <Text fz={11} c="dimmed">
                    Start the timer before climbing the roof.
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Photos" bullet={<SunMedium size={11} />}>
                  <Text fz={11} c="dimmed">
                    Upload finished-roof and inverter photos.
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Signature" bullet={<CheckCircle2 size={11} />}>
                  <Text fz={11} c="dimmed">
                    Customer signs the job card on site.
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Balance" bullet={<Wrench size={11} />}>
                  <Text fz={11} c="dimmed">
                    Collect the remaining amount by UPI or cash.
                  </Text>
                </Timeline.Item>
              </Timeline>
            </Panel>

            <Panel title="Quick links">
              <Stack gap="xs">
                <Button
                  component={Link}
                  href="/dashboard/barcodes"
                  variant="light"
                  color="indigo"
                  justify="space-between"
                  rightSection={<ArrowRight size={14} />}
                  fullWidth
                >
                  Tool & product barcodes
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/orders"
                  variant="light"
                  color="gray"
                  justify="space-between"
                  rightSection={<ArrowRight size={14} />}
                  fullWidth
                >
                  Order packing status
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/support"
                  variant="light"
                  color="gray"
                  justify="space-between"
                  rightSection={<ArrowRight size={14} />}
                  fullWidth
                >
                  Warranty lookup
                </Button>
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <Paper
      p="md"
      className="sp-soft-card sp-hover-lift"
      style={{
        borderLeft: `4px solid ${
          job.status === 'COMPLETED'
            ? '#0f766e'
            : job.status === 'IN_PROGRESS'
              ? '#f5a800'
              : job.type === 'SURVEY'
                ? '#6366f1'
                : '#2178c4'
        }`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon
            size={42}
            radius="md"
            color={job.type === 'SURVEY' ? 'indigo' : 'ocean'}
            variant="light"
          >
            {job.type === 'SURVEY' ? <CalendarDays size={19} /> : <Wrench size={19} />}
          </ThemeIcon>
          <div>
            <Group gap={6} mb={2} wrap="wrap">
              <Text fz="sm" fw={700}>
                {job.customer.name}
              </Text>
              <Badge
                size="xs"
                variant="filled"
                color={job.type === 'REPAIR' || job.type === 'MAINTENANCE' ? 'orange' : 'grape'}
              >
                {job.type === 'REPAIR' || job.type === 'MAINTENANCE' ? 'Support Work' : 'Sales Work'} · {titleCase(job.type)}
              </Badge>
              <StatusBadge status={job.status} size="xs" />
            </Group>
            <Text fz={10} c="dimmed" className="sp-mono">
              {job.jobNumber} · Slot: {job.scheduledSlot ?? formatTime(job.scheduledDate)} ·{' '}
              {job.technician?.name ?? 'Unassigned'}
            </Text>
            <Group gap={5} mt={4} wrap="nowrap">
              <MapPin size={12} color="#94a3b8" />
              <Text fz={11} c="dimmed" lineClamp={1}>
                {job.customer.address}
                {job.customer.city ? `, ${job.customer.city}` : ''}
              </Text>
            </Group>
            {job.order && (
              <Text fz={10} c="dimmed" mt={3}>
                Order {job.order.orderNumber} · {job.order.quote?.capacityKw ?? '—'} kW
              </Text>
            )}
          </div>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button
            component="a"
            href={`tel:${job.customer.phone}`}
            size="compact-sm"
            variant="light"
            color="teal"
            leftSection={<Phone size={13} />}
          >
            Call
          </Button>
          {job.hoursWorked != null && (
            <Badge variant="light" color="teal" size="sm">
              {job.hoursWorked} h logged
            </Badge>
          )}
          <Button
            component={Link}
            href={`/dashboard/jobs/${job.id}`}
            size="compact-sm"
            color="sun"
            rightSection={<ArrowRight size={14} />}
          >
            Job card
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
