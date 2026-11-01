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
  Flame,
  Headphones,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  SunMedium,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';
import dayjs from 'dayjs';
import { api, apiError } from '@/lib/api';
import { formatDate, formatTime, safeValue, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { DashboardTechnician, Job } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

type Horizon = 'TODAY' | 'TOMORROW' | 'NEXT_WEEK' | 'NEXT_MONTH' | 'OVERALL';

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function getJobSortTime(job: Job): number {
  const dateStr = dayjs(job.scheduledDate).format('YYYY-MM-DD');
  let timeStr = '09:00';
  if (job.scheduledSlot) {
    const match = job.scheduledSlot.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      timeStr = `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  } else if (job.scheduledDate) {
    timeStr = dayjs(job.scheduledDate).format('HH:mm');
  }
  return dayjs(`${dateStr}T${timeStr}:00`).valueOf();
}

export default function SchedulePage() {
  return (
    <RoleGate roles={['TECHNICIAN', 'SALES', 'DIRECTOR']}>
      <Schedule />
    </RoleGate>
  );
}

function Schedule() {
  const { user } = useAuth();
  const [horizon, setHorizon] = useState<Horizon>('TODAY');
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
  const now = dayjs();
  const startOfToday = now.startOf('day');
  const endOfWeek = now.add(7, 'day').endOf('day');
  const endOfMonth = now.add(30, 'day').endOf('day');

  const countToday = useMemo(
    () => jobs.filter((j) => dayjs(j.scheduledDate).isSame(now, 'day')).length,
    [jobs, now],
  );
  const countTomorrow = useMemo(
    () => jobs.filter((j) => dayjs(j.scheduledDate).isSame(now.add(1, 'day'), 'day')).length,
    [jobs, now],
  );
  const countNextWeek = useMemo(
    () =>
      jobs.filter(
        (j) =>
          dayjs(j.scheduledDate).isAfter(startOfToday.subtract(1, 'second')) &&
          dayjs(j.scheduledDate).isBefore(endOfWeek),
      ).length,
    [jobs, startOfToday, endOfWeek],
  );
  const countNextMonth = useMemo(
    () =>
      jobs.filter(
        (j) =>
          dayjs(j.scheduledDate).isAfter(startOfToday.subtract(1, 'second')) &&
          dayjs(j.scheduledDate).isBefore(endOfMonth),
      ).length,
    [jobs, startOfToday, endOfMonth],
  );

  const salesCount = useMemo(
    () => jobs.filter((j) => j.type === 'SURVEY' || j.type === 'INSTALLATION').length,
    [jobs],
  );
  const supportCount = useMemo(
    () => jobs.filter((j) => j.type === 'REPAIR' || j.type === 'MAINTENANCE').length,
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (workCategory === 'SALES') {
          if (job.type !== 'SURVEY' && job.type !== 'INSTALLATION') return false;
        } else if (workCategory === 'SUPPORT') {
          if (job.type !== 'REPAIR' && job.type !== 'MAINTENANCE') return false;
        }

        // Horizon filter (applied if user hasn't explicitly picked a custom date)
        if (!date && horizon !== 'OVERALL') {
          const jobDate = dayjs(job.scheduledDate);
          if (horizon === 'TODAY') {
            if (!jobDate.isSame(now, 'day')) return false;
          } else if (horizon === 'TOMORROW') {
            if (!jobDate.isSame(now.add(1, 'day'), 'day')) return false;
          } else if (horizon === 'NEXT_WEEK') {
            if (jobDate.isBefore(startOfToday) || jobDate.isAfter(endOfWeek)) return false;
          } else if (horizon === 'NEXT_MONTH') {
            if (jobDate.isBefore(startOfToday) || jobDate.isAfter(endOfMonth)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => getJobSortTime(a) - getJobSortTime(b));
  }, [jobs, workCategory, horizon, date, now, startOfToday, endOfWeek, endOfMonth]);

  const urgentJobsInOneHour = useMemo(() => {
    return jobs
      .filter((job) => {
        if (job.status !== 'SCHEDULED' && job.status !== 'IN_PROGRESS') return false;
        if (!dayjs(job.scheduledDate).isSame(dayjs(), 'day')) return false;
        const startMs = getJobSortTime(job);
        const diffMins = dayjs(startMs).diff(dayjs(), 'minute');
        return (diffMins >= -30 && diffMins <= 60) || job.status === 'IN_PROGRESS';
      })
      .sort((a, b) => getJobSortTime(a) - getJobSortTime(b));
  }, [jobs]);

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
        const sortedDayJobs = [...dayJobs].sort((a, b) => getJobSortTime(a) - getJobSortTime(b));
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
  const packedAlerts = techDashboard.data?.packedAlerts ?? [];

  const dispatchedInstallationJobs = useMemo(() => {
    return jobs.filter(
      (j) =>
        j.type === 'INSTALLATION' &&
        j.status !== 'COMPLETED' &&
        (j.order?.status === 'DISPATCHED' || Boolean(j.pickedUpAt))
    );
  }, [jobs]);

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

      {dispatchedInstallationJobs.length > 0 && (
        <Alert
          color="teal"
          variant="filled"
          radius="md"
          mb="md"
          icon={<Truck size={22} />}
          title={`🚀 Dispatched Orders Ready for Site Installation (${dispatchedInstallationJobs.length})`}
        >
          <Stack gap="xs" mt={4}>
            <Text fz="xs">
              Hardware kits have been packed and dispatched by warehouse. Technicians can collect/unload the hardware, upload commissioning photos, capture customer signature, and complete the installation:
            </Text>
            {dispatchedInstallationJobs.map((instJob) => (
              <Group
                key={instJob.id}
                justify="space-between"
                p="xs"
                style={{
                  background: 'var(--sp-card)',
                  borderRadius: 8,
                  border: '1px solid var(--sp-border)',
                }}
              >
                <div>
                  <Group gap="xs">
                    <Text fz="xs" fw={700} c="var(--sp-headings)">
                      {instJob.jobNumber} · {instJob.customer.name}
                    </Text>
                    <Badge size="xs" color="teal" variant="light">
                      DISPATCHED
                    </Badge>
                  </Group>
                  <Text fz={10} c="dimmed">
                    {instJob.customer.phone} · {instJob.customer.address}
                    {instJob.customer.city ? `, ${instJob.customer.city}` : ''}
                  </Text>
                </div>
                <Button
                  component={Link}
                  href={`/dashboard/jobs/${instJob.id}`}
                  size="compact-xs"
                  color="sun"
                  rightSection={<ArrowRight size={12} />}
                >
                  Open Installation Job & Signature
                </Button>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {packedAlerts.length > 0 && (
        <Alert
          color="teal"
          variant="light"
          radius="md"
          mb="md"
          icon={<Package size={20} />}
          title={`📦 Hardware Kit Packed in Warehouse (${packedAlerts.length})`}
        >
          <Stack gap="xs" mt={4}>
            <Text fz="xs">
              Warehouse has packed inventory stock for these orders. The technician can now pick up the hardware kit for dispatch:
            </Text>
            {packedAlerts.map((alert) => (
              <Group
                key={alert.id}
                justify="space-between"
                p="xs"
                style={{
                  background: 'var(--sp-card)',
                  borderRadius: 8,
                  border: '1px solid var(--sp-border)',
                }}
              >
                <div>
                  <Text fz="xs" fw={700}>
                    Order {alert.orderNumber} · {alert.customerName}
                  </Text>
                  <Text fz={10} c="dimmed">
                    {alert.message} · {formatDate(alert.createdAt)}
                  </Text>
                </div>
                <Button
                  component={Link}
                  href={alert.orderId ? `/dashboard/orders/${alert.orderId}` : '/dashboard/orders'}
                  size="compact-xs"
                  variant="light"
                  color="teal"
                  rightSection={<ArrowRight size={12} />}
                >
                  View Order Kit
                </Button>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

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

      <Box mb="xs">
        <Panel padding="xs">
          <Group justify="space-between" align="center" px="xs" mb={6}>
            <Text fz="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Schedule Horizon Filter (Earliest Jobs on Top)
            </Text>
            <Text fz={10} c="dimmed">
              {horizon === 'OVERALL' ? 'Showing all dates' : `Filtered to ${titleCase(horizon.replace('_', ' '))}`}
            </Text>
          </Group>
          <SegmentedControl
            fullWidth
            value={horizon}
            onChange={(val) => {
              setHorizon(val as Horizon);
              setDate('');
            }}
            data={[
              { label: `Today (${countToday})`, value: 'TODAY' },
              { label: `Tomorrow (${countTomorrow})`, value: 'TOMORROW' },
              { label: `Next 7 Days (${countNextWeek})`, value: 'NEXT_WEEK' },
              { label: `Next Month (${countNextMonth})`, value: 'NEXT_MONTH' },
              { label: `Overall (${jobs.length})`, value: 'OVERALL' },
            ]}
          />
        </Panel>
      </Box>

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
              label="Custom Date"
              value={date}
              onChange={(event) => {
                setDate(safeValue(event));
                if (event.target.value) setHorizon('OVERALL');
              }}
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
            {(date || status !== 'ALL' || horizon !== 'TODAY') && (
              <Button
                variant="subtle"
                color="gray"
                mt={22}
                onClick={() => {
                  setDate('');
                  setStatus('ALL');
                  setHorizon('TODAY');
                }}
              >
                Reset to Today
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

      {urgentJobsInOneHour.length > 0 && (
        <Alert
          color="red"
          variant="light"
          radius="md"
          mt="md"
          title={
            <Group gap="xs">
              <Flame size={18} color="#dc2626" />
              <Text fw={700}>Priority Alert · Work in 1 Hour or In Progress</Text>
            </Group>
          }
        >
          <Stack gap="xs" mt={4}>
            <Text fz="xs">
              Early jobs scheduled right now or starting within 60 minutes today:
            </Text>
            {urgentJobsInOneHour.map((job) => {
              const diffMins = dayjs(getJobSortTime(job)).diff(dayjs(), 'minute');
              return (
                <Paper
                  key={job.id}
                  p="xs"
                  withBorder
                  style={{ background: 'var(--sp-card)' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Group gap={6}>
                        <Badge
                          color="red"
                          variant="filled"
                          size="xs"
                          leftSection={<Flame size={10} />}
                        >
                          {job.status === 'IN_PROGRESS'
                            ? 'ACTIVE NOW'
                            : diffMins <= 0
                              ? 'DUE NOW'
                              : `STARTS IN ${diffMins}M`}
                        </Badge>
                        <Text fz="sm" fw={700}>
                          {job.customer.name}
                        </Text>
                        <Badge size="xs" variant="light" color={job.type === 'SURVEY' ? 'indigo' : 'ocean'}>
                          {titleCase(job.type)}
                        </Badge>
                      </Group>
                      <Text fz={10} c="dimmed" mt={2}>
                        Slot: {job.scheduledSlot ?? formatTime(job.scheduledDate)} · {job.customer.address}
                        {job.customer.city ? `, ${job.customer.city}` : ''}
                      </Text>
                    </div>
                    <Button
                      component={Link}
                      href={`/dashboard/jobs/${job.id}`}
                      size="compact-xs"
                      color="red"
                      rightSection={<ArrowRight size={12} />}
                    >
                      Open Job Card
                    </Button>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </Alert>
      )}

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
  const isToday = dayjs(job.scheduledDate).isSame(dayjs(), 'day');
  const sortTime = getJobSortTime(job);
  const diffMins = dayjs(sortTime).diff(dayjs(), 'minute');
  const isStartingSoon =
    isToday &&
    (job.status === 'SCHEDULED' || job.status === 'IN_PROGRESS') &&
    diffMins >= -30 &&
    diffMins <= 60;

  return (
    <Paper
      p="md"
      className="sp-soft-card sp-hover-lift"
      style={{
        borderLeft: `4px solid ${
          job.status === 'COMPLETED'
            ? '#0f766e'
            : isStartingSoon || job.status === 'IN_PROGRESS'
              ? '#dc2626'
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
            color={
              isStartingSoon
                ? 'red'
                : job.type === 'SURVEY'
                  ? 'indigo'
                  : 'ocean'
            }
            variant={isStartingSoon ? 'filled' : 'light'}
          >
            {isStartingSoon ? (
              <Flame size={19} />
            ) : job.type === 'SURVEY' ? (
              <CalendarDays size={19} />
            ) : (
              <Wrench size={19} />
            )}
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

              {/* Work within 1 hour urgency indicator */}
              {job.status === 'IN_PROGRESS' && (
                <Badge size="xs" variant="filled" color="orange" leftSection={<Zap size={10} />}>
                  Active Now
                </Badge>
              )}
              {job.status === 'SCHEDULED' && isToday && diffMins >= -30 && diffMins <= 60 && (
                <Badge size="xs" variant="filled" color="red" leftSection={<Flame size={10} />}>
                  {diffMins <= 0 ? 'Due now' : `In ~${diffMins}m`} · In 1 hr
                </Badge>
              )}
              {job.status === 'SCHEDULED' && isToday && diffMins > 60 && diffMins <= 120 && (
                <Badge size="xs" variant="light" color="yellow" leftSection={<Clock3 size={10} />}>
                  In ~{Math.round(diffMins / 60)}h
                </Badge>
              )}

              {/* Kit logistics tags */}
              {job.pickedUpAt && !job.unloadedAt && (
                <Badge size="xs" variant="light" color="cyan">
                  Kit Picked Up
                </Badge>
              )}
              {job.unloadedAt && (
                <Badge size="xs" variant="light" color="teal">
                  Kit Unloaded at Site
                </Badge>
              )}
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
            color={isStartingSoon ? 'red' : 'sun'}
            rightSection={<ArrowRight size={14} />}
          >
            Job card
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
