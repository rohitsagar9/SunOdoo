'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  IndianRupee,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatINR, timeAgo, titleCase } from '@/lib/format';
import type { Lead } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const columns = [
  { status: 'NEW', label: 'New', color: 'blue' },
  { status: 'VERIFIED', label: 'Verified', color: 'cyan' },
  { status: 'SURVEY_SCHEDULED', label: 'Survey booked', color: 'indigo' },
  { status: 'SURVEY_COMPLETED', label: 'Survey done', color: 'violet' },
  { status: 'QUOTED', label: 'Quoted', color: 'orange' },
  { status: 'NEGOTIATION', label: 'Negotiation', color: 'yellow' },
  { status: 'WON', label: 'Won', color: 'teal' },
  { status: 'LOST', label: 'Lost', color: 'red' },
] as const;

const leadStatuses = columns.map((column) => column.status);

const sources = [
  { value: 'PHONE', label: 'Phone call' },
  { value: 'WEB_FORM', label: 'Website form' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WALK_IN', label: 'Walk-in' },
];

export default function LeadsPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR']}>
      <LeadsKanban />
    </RoleGate>
  );
}

function LeadsKanban() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [mine, setMine] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [focusStatus, setFocusStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') setNewOpen(true);
    const status = params.get('status');
    if (status && leadStatuses.includes(status as (typeof leadStatuses)[number])) {
      setFocusStatus(status);
    }
  }, []);

  useEffect(() => {
    if (!focusStatus) return;
    const element = document.getElementById(`lead-col-${focusStatus}`);
    element?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [focusStatus]);

  const query = useQuery({
    queryKey: ['leads', debouncedSearch, mine],
    queryFn: async () => {
      const response = await api.get<Lead[]>('/leads', {
        params: {
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(mine ? { mine: 'true' } : {}),
        },
      });
      return response.data;
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch(`/leads/${id}`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({
        title: 'Lead moved',
        message: 'The pipeline has been updated.',
        color: 'teal',
      });
    },
    onError: (error) => {
      notifications.show({ title: 'Could not move lead', message: apiError(error), color: 'red' });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const column of columns) map.set(column.status, []);
    for (const lead of query.data ?? []) {
      map.get(lead.status)?.push(lead);
    }
    return map;
  }, [query.data]);

  const totalLeads = query.data?.length ?? 0;
  const totalValue = (query.data ?? []).reduce(
    (sum, lead) => sum + (lead.quotes?.[0]?.total ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Leads Pipeline"
        description="Enquiries from the website, phone and walk-ins. Move cards as the conversation progresses through the sales Pipeline."
        actions={
          <>
            <Button leftSection={<Plus size={15} />} color="sun" onClick={() => setNewOpen(true)}>
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

      <Panel padding="md" className="sp-no-print">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Search reference, name or phone…"
              leftSection={<Search size={15} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              w={{ base: '100%', sm: 320 }}
            />
            <Switch
              label="Only my leads"
              checked={mine}
              onChange={(event) => setMine(event.currentTarget.checked)}
            />
            {focusStatus && (
              <Badge
                variant="light"
                color="sun"
                rightSection={
                  <ActionIcon size="xs" variant="transparent" color="sun" onClick={() => setFocusStatus(null)}>
                    ×
                  </ActionIcon>
                }
              >
                Focus: {titleCase(focusStatus)}
              </Badge>
            )}
          </Group>
          <Group gap="lg">
            <div>
              <Text fz={10} c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em' }}>
                Leads shown
              </Text>
              <Text fw={800} fz="lg">
                {totalLeads}
              </Text>
            </div>
            <div>
              <Text fz={10} c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.1em' }}>
                Quoted value
              </Text>
              <Text fw={800} fz="lg" c="teal.7">
                {formatINR(totalValue, true)}
              </Text>
            </div>
          </Group>
        </Group>
      </Panel>

      {query.isLoading && <LoadingState label="Loading the pipeline…" />}
      {query.isError && (
        <Alert color="red" title="Could not load leads" mt="md">
          {apiError(query.error)}
        </Alert>
      )}

      {!query.isLoading && !query.isError && totalLeads === 0 && (
        <Box mt="md">
          <EmptyState
            title={search || mine ? 'No leads match this filter' : 'No enquiries yet'}
            description={
              search || mine
                ? 'Try clearing the search or the “only my leads” switch.'
                : 'Submit the public website enquiry form to see a lead land here instantly.'
            }
            action={
              <Button leftSection={<Plus size={15} />} color="sun" onClick={() => setNewOpen(true)}>
                Add the first lead
              </Button>
            }
          />
        </Box>
      )}

      {!query.isLoading && !query.isError && totalLeads > 0 && (
        <ScrollArea type="auto" mt="md" offsetScrollbars>
          <Group align="flex-start" gap="md" wrap="nowrap" pb="md">
            {columns.map((column) => {
              const leads = grouped.get(column.status) ?? [];
              const dimmed = focusStatus && focusStatus !== column.status;
              return (
                <Box
                  key={column.status}
                  id={`lead-col-${column.status}`}
                  w={300}
                  style={{ flex: '0 0 300px', opacity: dimmed ? 0.45 : 1, transition: 'opacity 160ms ease' }}
                >
                  <Group justify="space-between" mb="xs" px={4}>
                    <Group gap={6}>
                      <Box w={9} h={9} bg={`${column.color}.5`} style={{ borderRadius: 99 }} />
                      <Text fz="sm" fw={700}>
                        {column.label}
                      </Text>
                    </Group>
                    <Badge variant="light" color={column.color} size="sm">
                      {leads.length}
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        moving={moveMutation.isPending}
                        onOpen={() => router.push(`/dashboard/leads/${lead.id}`)}
                        onMove={(status) => moveMutation.mutate({ id: lead.id, status })}
                      />
                    ))}
                    {leads.length === 0 && (
                      <Box
                        p="md"
                        style={{
                          border: '1px dashed #dbe3ec',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,.5)',
                        }}
                      >
                        <Text fz="xs" c="dimmed" ta="center">
                          Nothing here
                        </Text>
                      </Box>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Group>
        </ScrollArea>
      )}

      <NewLeadModal opened={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

function LeadCard({
  lead,
  moving,
  onOpen,
  onMove,
}: {
  lead: Lead;
  moving: boolean;
  onOpen: () => void;
  onMove: (status: string) => void;
}) {
  const quote = lead.quotes?.[0];
  return (
    <Box
      p="md"
      className="sp-soft-card sp-hover-lift"
      style={{ cursor: 'pointer', borderLeft: '3px solid #f5a800' }}
      onClick={onOpen}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb={6}>
        <div style={{ minWidth: 0 }}>
          <Text fz="sm" fw={700} truncate>
            {lead.customer.name}
          </Text>
          <Text fz={10} c="dimmed" className="sp-mono">
            {lead.reference}
          </Text>
        </div>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              loading={moving}
              onClick={(event) => event.stopPropagation()}
              aria-label="Lead actions"
            >
              <MoreHorizontal size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
            <Menu.Label>Move to</Menu.Label>
            {columns
              .filter((column) => column.status !== lead.status)
              .map((column) => (
                <Menu.Item key={column.status} onClick={() => onMove(column.status)}>
                  {column.label}
                </Menu.Item>
              ))}
            <Menu.Divider />
            <Menu.Item leftSection={<ArrowRight size={14} />} onClick={onOpen}>
              Open lead
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Group gap={6} mb={8} wrap="wrap">
        <Badge size="xs" variant="light" color="sun">
          {lead.requestedKw} kW
        </Badge>
        <Badge size="xs" variant="light" color={lead.systemType === 'OFF_GRID' ? 'grape' : 'ocean'}>
          {titleCase(lead.systemType)}
        </Badge>
        <Badge size="xs" variant="light" color="gray">
          {titleCase(lead.source)}
        </Badge>
      </Group>

      <Stack gap={4}>
        <Group gap={6} wrap="nowrap">
          <Building2 size={12} color="#94a3b8" />
          <Text fz={11} c="dimmed" truncate>
            {lead.customer.city ?? lead.customer.address}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap">
          <UserRound size={12} color="#94a3b8" />
          <Text fz={11} c="dimmed" truncate>
            {lead.assignedTo?.name ?? 'Unassigned'}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap">
          <CalendarClock size={12} color="#94a3b8" />
          <Text fz={11} c="dimmed">
            {timeAgo(lead.createdAt)}
          </Text>
        </Group>
      </Stack>

      <Divider my={8} />
      <Group justify="space-between" wrap="nowrap">
        <Group gap={4}>
          <Phone size={12} color="#64748b" />
          <Text fz={11} c="dimmed" className="sp-mono">
            {lead.customer.phone}
          </Text>
        </Group>
        {quote ? (
          <Tooltip label={`${quote.quoteNumber} · ${titleCase(quote.status)}`}>
            <Group gap={2}>
              <IndianRupee size={12} color="#0f766e" />
              <Text fz={11} fw={700} c="teal.7">
                {formatINR(quote.total, true)}
              </Text>
            </Group>
          </Tooltip>
        ) : (
          <Text fz={10} c="dimmed">
            No quote yet
          </Text>
        )}
      </Group>
      {lead.status === 'LOST' && lead.lostReason && (
        <Text fz={10} c="red.6" mt={6}>
          Lost: {lead.lostReason}
        </Text>
      )}
      <StatusBadge status={lead.status} size="xs" />
    </Box>
  );
}

function NewLeadModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    requestedKw: '3',
    systemType: 'ON_GRID',
    monthlyBill: '',
    roofAreaSqft: '',
    notes: '',
    source: 'PHONE',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<Lead>('/leads', {
        name: values.name.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        city: values.city.trim() || undefined,
        requestedKw: values.requestedKw,
        systemType: values.systemType,
        monthlyBill: values.monthlyBill ? values.monthlyBill : undefined,
        roofAreaSqft: values.roofAreaSqft ? values.roofAreaSqft : undefined,
        notes: values.notes.trim() || undefined,
        source: values.source,
      });
      return response.data;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({
        title: 'Lead created',
        message: `${lead.reference} is now in the New column.`,
        color: 'teal',
      });
      setValues({
        name: '',
        phone: '',
        address: '',
        city: '',
        requestedKw: '3',
        systemType: 'ON_GRID',
        monthlyBill: '',
        roofAreaSqft: '',
        notes: '',
        source: 'PHONE',
      });
      onClose();
      router.push(`/dashboard/leads/${lead.id}`);
    },
    onError: (error) => {
      notifications.show({ title: 'Could not create lead', message: apiError(error), color: 'red' });
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (values.name.trim().length < 2) nextErrors.name = 'Enter the customer name';
    if (values.phone.replace(/\D/g, '').length < 10) nextErrors.phone = 'Enter a 10-digit phone number';
    if (values.address.trim().length < 5) nextErrors.address = 'Enter the site address';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New enquiry" size="lg" radius="lg">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Customer name"
            placeholder="Full name"
            required
            value={values.name}
            error={errors.name}
            onChange={(event) => update('name', event.currentTarget.value)}
          />
          <TextInput
            label="Phone"
            placeholder="9876543210"
            required
            value={values.phone}
            error={errors.phone}
            onChange={(event) => update('phone', event.currentTarget.value)}
          />
        </SimpleGrid>
        <TextInput
          label="Site address"
          placeholder="House, street, area"
          required
          value={values.address}
          error={errors.address}
          onChange={(event) => update('address', event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="City"
            placeholder="Bengaluru"
            value={values.city}
            onChange={(event) => update('city', event.currentTarget.value)}
          />
          <Select
            label="Source"
            data={sources}
            value={values.source}
            onChange={(value) => update('source', value ?? 'PHONE')}
            allowDeselect={false}
          />
        </SimpleGrid>

        <div>
          <Text fz="sm" fw={500} mb={6}>
            System type
          </Text>
          <SegmentedControl
            fullWidth
            value={values.systemType}
            onChange={(value) => update('systemType', value)}
            data={[
              { label: 'On-grid', value: 'ON_GRID' },
              { label: 'Off-grid', value: 'OFF_GRID' },
            ]}
          />
        </div>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="Size (kW)"
            type="number"
            min={1}
            max={5}
            value={values.requestedKw}
            onChange={(event) => update('requestedKw', event.currentTarget.value)}
          />
          <TextInput
            label="Monthly bill (₹)"
            type="number"
            placeholder="4200"
            value={values.monthlyBill}
            onChange={(event) => update('monthlyBill', event.currentTarget.value)}
          />
          <TextInput
            label="Roof area (sq ft)"
            type="number"
            placeholder="650"
            value={values.roofAreaSqft}
            onChange={(event) => update('roofAreaSqft', event.currentTarget.value)}
          />
        </SimpleGrid>

        <Textarea
          label="Notes"
          placeholder="Anything the surveyor should know?"
          minRows={3}
          value={values.notes}
          onChange={(event) => update('notes', event.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="sun" onClick={submit} loading={mutation.isPending} leftSection={<Plus size={15} />}>
            Create lead
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
