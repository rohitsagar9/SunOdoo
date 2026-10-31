'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Ruler,
  ShieldCheck,
  StickyNote,
  Trophy,
  UserRound,
  XCircle,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, titleCase } from '@/lib/format';
import type { AuthUser, Lead, Survey } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const STANDARD_SLOTS = [
  '09:00 - 12:00',
  '13:00 - 16:00',
  '16:00 - 19:00',
];

const REJECTION_REASONS = [
  'Insufficient shadow-free roof area',
  'Structural weakness / damaged roof structure',
  'Unsafe roof access / hazardous pitch',
  'Fragile or asbestos sheet roofing',
  'Electrical earthing / grid mismatch',
];

export default function LeadDetailPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR']}>
      <LeadDetail />
    </RoleGate>
  );
}

function LeadDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const leadQuery = useQuery({
    queryKey: ['lead', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Lead>(`/leads/${id}`)).data,
  });

  const techQuery = useQuery({
    queryKey: ['users', 'TECHNICIAN'],
    queryFn: async () =>
      (await api.get<AuthUser[]>('/auth/users', { params: { role: 'TECHNICIAN' } })).data,
  });

  const lead = leadQuery.data;

  const [details, setDetails] = useState({
    requestedKw: '1',
    systemType: 'ON_GRID',
    monthlyBill: '',
    roofAreaSqft: '',
    notes: '',
  });
  const [surveyForm, setSurveyForm] = useState({
    technicianId: '',
    scheduledAt: '',
    slot: '09:00 - 12:00',
    notes: '',
  });
  const [surveyReport, setSurveyReport] = useState({
    roofDirection: '',
    tiltDegrees: '',
    cableDistanceM: '',
    shadowFreeAreaSqft: '',
    findings: '',
  });
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    capacityKw: '1',
    systemType: 'ON_GRID',
    discount: '',
    notes: '',
  });
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [rejectionNotes, setRejectionNotes] = useState('');

  useEffect(() => {
    if (!lead) return;
    setDetails({
      requestedKw: String(lead.requestedKw),
      systemType: lead.systemType,
      monthlyBill: lead.monthlyBill ? String(lead.monthlyBill) : '',
      roofAreaSqft: lead.roofAreaSqft ? String(lead.roofAreaSqft) : '',
      notes: lead.notes ?? '',
    });
    setSurveyForm((current) => {
      let sched = current.scheduledAt;
      if (lead.survey?.scheduledAt) {
        const d = new Date(lead.survey.scheduledAt);
        if (!isNaN(d.getTime())) {
          sched = d.toISOString().slice(0, 16);
        }
      }
      return {
        technicianId: lead.survey?.technicianId ?? current.technicianId,
        scheduledAt: sched,
        slot: current.slot,
        notes: lead.survey?.findings ?? '',
      };
    });
    setSurveyReport({
      roofDirection: lead.survey?.roofDirection ?? '',
      tiltDegrees: lead.survey?.tiltDegrees != null ? String(lead.survey.tiltDegrees) : '',
      cableDistanceM: lead.survey?.cableDistanceM != null ? String(lead.survey.cableDistanceM) : '',
      shadowFreeAreaSqft:
        lead.survey?.shadowFreeAreaSqft != null ? String(lead.survey.shadowFreeAreaSqft) : '',
      findings: lead.survey?.findings ?? '',
    });
    setQuoteForm((current) => ({
      ...current,
      capacityKw: String(lead.requestedKw),
      systemType: lead.systemType,
    }));
  }, [lead?.id, lead?.updatedAt]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['lead', id] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  }

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.patch(`/leads/${id}`, payload)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({ title: 'Lead updated', message: 'Changes saved.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not save', message: apiError(error), color: 'red' }),
  });

  const dateStr = surveyForm.scheduledAt ? surveyForm.scheduledAt.slice(0, 10) : '';
  const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  const jobsQuery = useQuery({
    queryKey: ['jobs-for-slot', surveyForm.technicianId, dateStr],
    enabled: Boolean(surveyForm.technicianId && isDateValid),
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: string; scheduledSlot?: string; status: string; leadId?: string }>>('/jobs', {
          params: { technicianId: surveyForm.technicianId, date: dateStr },
        });
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const occupiedSlots = useMemo(() => {
    const jobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : [];
    return jobs
      .filter((j) => j && j.status !== 'CANCELLED' && j.status !== 'COMPLETED' && j.leadId !== id && j.scheduledSlot)
      .map((j) => j.scheduledSlot!);
  }, [jobsQuery.data, id]);

  const surveyMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/leads/${id}/survey`, {
          technicianId: surveyForm.technicianId,
          scheduledAt: surveyForm.scheduledAt,
          slot: surveyForm.slot || undefined,
          notes: surveyForm.notes || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Survey scheduled',
        message: 'The technician job has been created and the slot reserved.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not schedule survey', message: apiError(error), color: 'red' }),
  });

  const surveyReportMutation = useMutation({
    mutationFn: async (payload: { approve: boolean; reasons?: string[]; notes?: string }) => {
      if (!lead?.survey) throw new Error('No survey');
      const response = await api.patch(`/surveys/${lead.survey.id}`, {
        roofDirection: surveyReport.roofDirection || undefined,
        tiltDegrees: surveyReport.tiltDegrees || undefined,
        cableDistanceM: surveyReport.cableDistanceM || undefined,
        shadowFreeAreaSqft: surveyReport.shadowFreeAreaSqft || undefined,
        findings: payload.notes || surveyReport.findings || undefined,
        approved: payload.approve,
        rejectionReasons: payload.reasons,
      });
      return response.data as Survey;
    },
    onSuccess: (_data, vars) => {
      invalidate();
      setRejectOpen(false);
      notifications.show({
        title: vars.approve ? 'Survey approved' : 'Roof marked infeasible',
        message: vars.approve
          ? 'Survey approved. Quote can now be generated.'
          : 'Rejection reasons recorded. Quote generation is locked.',
        color: vars.approve ? 'teal' : 'orange',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update survey', message: apiError(error), color: 'red' }),
  });

  const quoteMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/quotes', {
          leadId: id,
          capacityKw: quoteForm.capacityKw,
          systemType: quoteForm.systemType,
          discount: quoteForm.discount || undefined,
          notes: quoteForm.notes || undefined,
        })
      ).data as { id: string; quoteNumber: string; total: number },
    onSuccess: (quote) => {
      invalidate();
      setQuoteOpen(false);
      notifications.show({
        title: 'Quote generated',
        message: `${quote.quoteNumber} for ${formatINR(quote.total)} is ready to share.`,
        color: 'teal',
      });
      router.push(`/dashboard/quotes/${quote.id}`);
    },
    onError: (error) =>
      notifications.show({ title: 'Could not generate quote', message: apiError(error), color: 'red' }),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { status: string; lostReason?: string }) =>
      (await api.patch(`/leads/${id}`, payload)).data,
    onSuccess: () => {
      invalidate();
      setLostOpen(false);
      notifications.show({ title: 'Pipeline updated', message: 'Lead status changed.', color: 'teal' });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not update status', message: apiError(error), color: 'red' }),
  });

  if (leadQuery.isLoading) return <LoadingState label="Loading the lead…" />;
  if (leadQuery.isError) {
    return <Alert color="red" title="Could not load lead">{apiError(leadQuery.error)}</Alert>;
  }
  if (!lead) return null;

  const survey = lead.survey;
  const quote = lead.quotes?.[0];
  const canQuote = Boolean(survey?.approved);
  const technicians = techQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={`${lead.reference} · ${titleCase(lead.source)}`}
        title={lead.customer?.name ?? 'Lead overview'}
        description={`${lead.requestedKw} kW ${titleCase(lead.systemType)} requirement · ${lead.customer?.city ?? lead.customer?.address ?? 'Location pending'}`}
        actions={
          <>
            <Button
              component={Link}
              href="/dashboard/leads"
              variant="subtle"
              color="gray"
              leftSection={<ArrowLeft size={15} />}
            >
              Kanban
            </Button>
            <Button
              component="a"
              href={`tel:${lead.customer?.phone ?? ''}`}
              variant="light"
              color="teal"
              leftSection={<Phone size={15} />}
            >
              Call customer
            </Button>
          </>
        }
      />

      <Group gap="xs" mb="lg" wrap="wrap">
        <StatusBadge status={lead.status} />
        <Badge variant="light" color="sun">
          {lead.requestedKw} kW
        </Badge>
        <Badge variant="light" color={lead.systemType === 'OFF_GRID' ? 'grape' : 'ocean'}>
          {titleCase(lead.systemType)}
        </Badge>
        <Badge variant="light" color="gray">
          Owner: {lead.assignedTo?.name ?? 'Unassigned'}
        </Badge>
        <Badge variant="light" color="gray">
          Created {formatDate(lead.createdAt)}
        </Badge>
      </Group>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Panel
              title="Qualification & requirement"
              subtitle="Verify the bill and roof before booking a survey"
              action={<ClipboardCheck size={16} color="#64748b" />}
            >
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <TextInput
                    label="Size (kW)"
                    type="number"
                    min={1}
                    max={5}
                    value={details.requestedKw}
                    onChange={(event) => {
                      const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                      setDetails((current) => ({ ...current, requestedKw: val }));
                    }}
                  />
                  <TextInput
                    label="Monthly bill (₹)"
                    type="number"
                    min={0}
                    max={1000000}
                    step="1"
                    placeholder="Max ₹10,00,000"
                    value={details.monthlyBill}
                    onChange={(event) => {
                      const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                      setDetails((current) => ({
                        ...current,
                        monthlyBill: String(val).replace(/\D/g, '').slice(0, 7),
                      }));
                    }}
                  />
                  <TextInput
                    label="Roof area (sq ft)"
                    type="number"
                    value={details.roofAreaSqft}
                    onChange={(event) => {
                      const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                      setDetails((current) => ({ ...current, roofAreaSqft: val }));
                    }}
                  />
                </SimpleGrid>
                <div>
                  <Text fz="sm" fw={500} mb={6}>
                    System type
                  </Text>
                  <SegmentedControl
                    value={details.systemType}
                    onChange={(value) => setDetails((current) => ({ ...current, systemType: value }))}
                    data={[
                      { label: 'On-grid', value: 'ON_GRID' },
                      { label: 'Off-grid', value: 'OFF_GRID' },
                    ]}
                  />
                </div>
                <Textarea
                  label="Internal notes"
                  minRows={2}
                  value={details.notes}
                  onChange={(event) => {
                    const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                    setDetails((current) => ({ ...current, notes: val }));
                  }}
                />
                <Group justify="space-between">
                  {lead.status === 'NEW' ? (
                    <Button
                      variant="light"
                      color="teal"
                      leftSection={<CheckCircle2 size={15} />}
                      onClick={() => statusMutation.mutate({ status: 'VERIFIED' })}
                      loading={statusMutation.isPending}
                    >
                      Mark verified
                    </Button>
                  ) : (
                    <Text fz="xs" c="dimmed">
                      Verified leads can book a roof survey below.
                    </Text>
                  )}
                  <Button
                    color="sun"
                    onClick={() =>
                      updateMutation.mutate({
                        requestedKw: Number(details.requestedKw) || 1,
                        systemType: details.systemType,
                        monthlyBill: details.monthlyBill ? Number(details.monthlyBill) : 0,
                        roofAreaSqft: details.roofAreaSqft ? Number(details.roofAreaSqft) : 0,
                        notes: details.notes,
                      })
                    }
                    loading={updateMutation.isPending}
                  >
                    Save changes
                  </Button>
                </Group>
              </Stack>
            </Panel>

            <Panel
              title="Roof survey"
              subtitle="Book a technician, then record the site measurements"
              action={<Ruler size={16} color="#64748b" />}
            >
              {!survey ? (
                <Stack gap="md">
                  <Alert color="blue" variant="light" radius="md">
                    Schedule a survey to unlock quote generation. The technician receives a job card
                    automatically.
                  </Alert>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Select
                      label="Technician"
                      placeholder="Choose a technician"
                      data={technicians.map((tech) => ({ value: tech.id, label: tech.name }))}
                      value={surveyForm.technicianId || null}
                      onChange={(value) =>
                        setSurveyForm((current) => ({ ...current, technicianId: value ?? '' }))
                      }
                    />
                    <TextInput
                      label="Date & time"
                      type="datetime-local"
                      value={surveyForm.scheduledAt}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyForm((current) => ({ ...current, scheduledAt: val }));
                      }}
                    />
                    <Select
                      label="Slot"
                      placeholder="Select slot"
                      data={STANDARD_SLOTS.map((slot) => {
                        const occupied = occupiedSlots.includes(slot);
                        return {
                          value: slot,
                          label: occupied ? `${slot} (Occupied · Unavailable)` : `${slot} (Available)`,
                          disabled: occupied,
                        };
                      })}
                      value={surveyForm.slot}
                      onChange={(value) =>
                        setSurveyForm((current) => ({ ...current, slot: value ?? '' }))
                      }
                      allowDeselect={false}
                      error={occupiedSlots.includes(surveyForm.slot) ? 'Technician is already booked in this slot' : undefined}
                    />
                    <TextInput
                      label="Visit notes"
                      placeholder="Gate code, contact person…"
                      value={surveyForm.notes}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyForm((current) => ({ ...current, notes: val }));
                      }}
                    />
                  </SimpleGrid>
                  <Group justify="flex-end">
                    <Button
                      leftSection={<CalendarPlus size={15} />}
                      color="sun"
                      disabled={!surveyForm.technicianId || !surveyForm.scheduledAt || !surveyForm.slot || occupiedSlots.includes(surveyForm.slot)}
                      loading={surveyMutation.isPending}
                      onClick={() => surveyMutation.mutate()}
                    >
                      Schedule survey
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Stack gap="md">
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="sm">
                      <ThemeIcon size={38} radius="md" color="indigo" variant="light">
                        <CalendarPlus size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fz="sm" fw={700}>
                          {survey.scheduledAt ? formatDateTime(survey.scheduledAt) : 'Not scheduled'}
                        </Text>
                        <Text fz={11} c="dimmed">
                          {survey.technician?.name ?? 'Technician'} ·{' '}
                          {survey.completedAt ? `Completed ${formatDate(survey.completedAt)}` : 'Awaiting visit'}
                        </Text>
                      </div>
                    </Group>
                    <Badge color={survey.approved ? 'teal' : survey.findings?.includes('[DISAPPROVED') ? 'red' : 'yellow'} variant="light">
                      {survey.approved ? 'Feasibility Approved' : survey.findings?.includes('[DISAPPROVED') ? 'Infeasible / Disapproved' : 'Pending approval'}
                    </Badge>
                  </Group>

                  {survey.findings?.includes('[DISAPPROVED') && (
                    <Alert color="red" variant="light" title="Roof Survey Disapproved / Infeasible">
                      <Text fz="xs" mb={4}>
                        The technician reported that the roof cannot safely support installation.
                      </Text>
                      <Text fz="xs" fw={700}>
                        Reason: {survey.findings}
                      </Text>
                      <Text fz={11} c="dimmed" mt={4}>
                        Sales cannot generate a quote unless feasibility issues are resolved and re-approved.
                      </Text>
                    </Alert>
                  )}

                  <Divider />

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <TextInput
                      label="Roof direction"
                      placeholder="South / South-West"
                      value={surveyReport.roofDirection}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyReport((current) => ({
                          ...current,
                          roofDirection: val,
                        }));
                      }}
                    />
                    <TextInput
                      label="Tilt (degrees)"
                      type="number"
                      value={surveyReport.tiltDegrees}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyReport((current) => ({
                          ...current,
                          tiltDegrees: val,
                        }));
                      }}
                    />
                    <TextInput
                      label="Cable distance (m)"
                      type="number"
                      value={surveyReport.cableDistanceM}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyReport((current) => ({
                          ...current,
                          cableDistanceM: val,
                        }));
                      }}
                    />
                    <TextInput
                      label="Shadow-free area (sq ft)"
                      type="number"
                      value={surveyReport.shadowFreeAreaSqft}
                      onChange={(event) => {
                        const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                        setSurveyReport((current) => ({
                          ...current,
                          shadowFreeAreaSqft: val,
                        }));
                      }}
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Survey findings"
                    minRows={2}
                    value={surveyReport.findings}
                    onChange={(event) => {
                      const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                      setSurveyReport((current) => ({ ...current, findings: val }));
                    }}
                  />
                  <Group justify="space-between" wrap="wrap">
                    <Button
                      variant="light"
                      color="gray"
                      onClick={() => surveyReportMutation.mutate({ approve: false })}
                      loading={surveyReportMutation.isPending}
                    >
                      Save measurements
                    </Button>
                    <Group gap="sm">
                      {!survey.approved && (
                        <>
                          <Button
                            color="red"
                            variant="light"
                            leftSection={<XCircle size={15} />}
                            onClick={() => setRejectOpen(true)}
                          >
                            Disapprove / Infeasible
                          </Button>
                          <Button
                            color="teal"
                            leftSection={<ShieldCheck size={15} />}
                            onClick={() => surveyReportMutation.mutate({ approve: true })}
                            loading={surveyReportMutation.isPending}
                          >
                            Approve survey
                          </Button>
                        </>
                      )}
                      {survey.approved && (
                        <Button
                          color="sun"
                          leftSection={<FilePlus2 size={15} />}
                          onClick={() => setQuoteOpen(true)}
                        >
                          Generate quote
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Stack>
              )}
            </Panel>

            <Panel
              title="Quotes"
              subtitle="Itemised BOM generated from the approved survey"
              action={
                <Button
                  size="compact-sm"
                  variant="light"
                  color="sun"
                  leftSection={<FilePlus2 size={14} />}
                  disabled={!canQuote}
                  onClick={() => setQuoteOpen(true)}
                >
                  New quote
                </Button>
              }
            >
              {lead.quotes && lead.quotes.length > 0 ? (
                <Stack gap="sm">
                  {lead.quotes.map((item) => (
                    <Paper
                      key={item.id}
                      withBorder
                      p="sm"
                      radius="md"
                      component={Link}
                      href={`/dashboard/quotes/${item.id}`}
                      className="sp-hover-lift"
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="sm" fw={700}>
                            {item.quoteNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {item.capacityKw} kW · {titleCase(item.systemType)} · valid to{' '}
                            {formatDate(item.validUntil)}
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text fz="sm" fw={800} className="sp-mono">
                            {formatINR(item.total)}
                          </Text>
                          <StatusBadge status={item.status} size="xs" />
                        </div>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Alert color={canQuote ? 'blue' : 'yellow'} variant="light" radius="md">
                  {canQuote
                    ? 'The survey is approved. Generate the 1–5 kW BOM quote when the customer is ready.'
                    : 'Approve the roof survey first — quotes are built from the verified site measurements.'}
                </Alert>
              )}
            </Panel>

            {(lead.orders?.length || lead.jobs?.length) && (
              <Panel title="Orders & field work" subtitle="What happened after the quote">
                <Stack gap="sm">
                  {lead.orders?.map((order) => (
                    <Paper key={order.id} withBorder p="sm" radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="sm" fw={700} component={Link} href={`/dashboard/orders/${order.id}`}>
                            {order.orderNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            Total {formatINR(order.total)} · balance {formatINR(order.balanceDue)}
                          </Text>
                        </div>
                        <StatusBadge status={order.status} />
                      </Group>
                    </Paper>
                  ))}
                  {lead.jobs?.map((job) => (
                    <Paper key={job.id} withBorder p="sm" radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fz="sm" fw={700} component={Link} href={`/dashboard/jobs/${job.id}`}>
                            {job.jobNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {titleCase(job.type)} · {formatDate(job.scheduledDate)} ·{' '}
                            {job.technician?.name ?? 'Unassigned'}
                          </Text>
                        </div>
                        <StatusBadge status={job.status} />
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Panel>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel title="Customer" subtitle="Contact and site details">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={36} radius="xl" color="sun" variant="light">
                    <UserRound size={17} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      {lead.customer.name}
                    </Text>
                    <Text fz={11} c="dimmed" className="sp-mono">
                      {lead.customer.phone}
                    </Text>
                  </div>
                </Group>
                {lead.customer.email && (
                  <Group gap={8} wrap="nowrap">
                    <Mail size={14} color="#94a3b8" />
                    <Text fz="xs" c="dimmed">
                      {lead.customer.email}
                    </Text>
                  </Group>
                )}
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <MapPin size={14} color="#94a3b8" style={{ marginTop: 2 }} />
                  <Text fz="xs" c="dimmed">
                    {lead.customer.address}
                    {lead.customer.city ? `, ${lead.customer.city}` : ''}
                    {lead.customer.state ? `, ${lead.customer.state}` : ''}
                    {lead.customer.pincode ? ` — ${lead.customer.pincode}` : ''}
                  </Text>
                </Group>
                <Divider />
                <SimpleGrid cols={2} spacing="sm">
                  <InlineStat label="Monthly bill" value={formatINR(lead.customer.monthlyBill)} />
                  <InlineStat
                    label="Roof area"
                    value={`${lead.customer.roofAreaSqft ?? 0} ft²`}
                  />
                </SimpleGrid>
              </Stack>
            </Panel>

            <Panel title="Pipeline actions" subtitle="Keep the lead moving">
              <Stack gap="sm">
                {lead.status === 'NEW' && (
                  <Button
                    color="teal"
                    leftSection={<CheckCircle2 size={15} />}
                    onClick={() => statusMutation.mutate({ status: 'VERIFIED' })}
                    loading={statusMutation.isPending}
                  >
                    Mark verified
                  </Button>
                )}
                {!survey && (
                  <Alert color="yellow" variant="light" radius="md">
                    Book a roof survey to continue.
                  </Alert>
                )}
                {survey && !survey.approved && (
                  <Button
                    color="indigo"
                    leftSection={<Ruler size={15} />}
                    onClick={() => surveyReportMutation.mutate({ approve: true })}
                    loading={surveyReportMutation.isPending}
                  >
                    Approve survey
                  </Button>
                )}
                {canQuote && !quote && (
                  <Button
                    color="sun"
                    leftSection={<FilePlus2 size={15} />}
                    onClick={() => setQuoteOpen(true)}
                  >
                    Generate quote
                  </Button>
                )}
                {quote && !['WON', 'LOST'].includes(lead.status) && (
                  <>
                    <Button
                      variant="light"
                      color="yellow"
                      leftSection={<FileText size={15} />}
                      onClick={() => statusMutation.mutate({ status: 'NEGOTIATION' })}
                      loading={statusMutation.isPending}
                    >
                      Move to negotiation
                    </Button>
                    <Button
                      color="teal"
                      leftSection={<Trophy size={15} />}
                      onClick={() => statusMutation.mutate({ status: 'WON' })}
                      loading={statusMutation.isPending}
                    >
                      Mark won
                    </Button>
                  </>
                )}
                {!['WON', 'LOST'].includes(lead.status) && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<XCircle size={15} />}
                    onClick={() => setLostOpen(true)}
                  >
                    Mark lost
                  </Button>
                )}
                {lead.status === 'WON' && (
                  <Alert color="teal" variant="light" radius="md" icon={<Trophy size={16} />}>
                    Won — the quote has become an order. Warehouse and installation teams can take over.
                  </Alert>
                )}
                {lead.status === 'LOST' && (
                  <Alert color="red" variant="light" radius="md" icon={<XCircle size={16} />}>
                    Lost{lead.lostReason ? `: ${lead.lostReason}` : '.'}
                  </Alert>
                )}
              </Stack>
            </Panel>

            <Panel title="Lead activity" subtitle="Audit trail highlights">
              <Timeline active={3} bulletSize={20} lineWidth={2}>
                <Timeline.Item title="Enquiry received" bullet={<StickyNote size={11} />}>
                  <Text fz={11} c="dimmed">
                    {formatDateTime(lead.createdAt)} · {titleCase(lead.source)}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Verified" bullet={<CheckCircle2 size={11} />}>
                  <Text fz={11} c="dimmed">
                    {['NEW'].includes(lead.status) ? 'Pending verification' : 'Requirement checked'}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Survey" bullet={<Ruler size={11} />}>
                  <Text fz={11} c="dimmed">
                    {survey
                      ? `${survey.approved ? 'Approved' : 'Booked'} · ${formatDate(survey.scheduledAt)}`
                      : 'Not booked'}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Quote & order" bullet={<IndianRupee size={11} />}>
                  <Text fz={11} c="dimmed">
                    {quote ? `${quote.quoteNumber} · ${formatINR(quote.total)}` : 'Not quoted'}
                  </Text>
                </Timeline.Item>
              </Timeline>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal opened={quoteOpen} onClose={() => setQuoteOpen(false)} title="Generate BOM quote" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light" radius="md">
            The 1–5 kW template adds panels, inverter, structure, cables, safety BOS and services.
            Prices are pulled from the live product catalogue.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Capacity (kW)"
              min={1}
              max={5}
              value={quoteForm.capacityKw}
              onChange={(value) =>
                setQuoteForm((current) => ({ ...current, capacityKw: String(value) }))
              }
            />
            <NumberInput
              label="Discount (₹)"
              min={0}
              value={quoteForm.discount}
              onChange={(value) =>
                setQuoteForm((current) => ({ ...current, discount: String(value) }))
              }
            />
          </SimpleGrid>
          <div>
            <Text fz="sm" fw={500} mb={6}>
              System type
            </Text>
            <SegmentedControl
              fullWidth
              value={quoteForm.systemType}
              onChange={(value) => setQuoteForm((current) => ({ ...current, systemType: value }))}
              data={[
                { label: 'On-grid', value: 'ON_GRID' },
                { label: 'Off-grid', value: 'OFF_GRID' },
              ]}
            />
          </div>
          <Textarea
            label="Quote notes"
            minRows={2}
            placeholder="Payment terms, subsidy assumptions…"
            value={quoteForm.notes}
            onChange={(event) => {
              const val = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
              setQuoteForm((current) => ({ ...current, notes: val }));
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setQuoteOpen(false)}>
              Cancel
            </Button>
            <Button color="sun" onClick={() => quoteMutation.mutate()} loading={quoteMutation.isPending}>
              Generate quote
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Technician Disapproval: Mark Roof Infeasible"
        size="md"
        radius="md"
      >
        <Stack gap="md">
          <Text fz="xs" c="dimmed">
            If the technician determines the site is infeasible, select the reasons and provide photo evidence. This will inform Sales and lock quote generation.
          </Text>
          <Text fz="sm" fw={700}>Select Infeasibility Reasons (check all that apply):</Text>
          <Stack gap="xs">
            {REJECTION_REASONS.map((reason) => (
              <Checkbox
                key={reason}
                label={reason}
                checked={rejectionReasons.includes(reason)}
                onChange={(e) => {
                  if (e.currentTarget.checked) {
                    setRejectionReasons((prev) => [...prev, reason]);
                  } else {
                    setRejectionReasons((prev) => prev.filter((r) => r !== reason));
                  }
                }}
              />
            ))}
          </Stack>
          <FileInput
            label="Site photo of issue"
            placeholder="Upload proof photo (JPG/PNG)"
            accept="image/png,image/jpeg,image/webp"
            leftSection={<Camera size={15} />}
          />
          <Textarea
            label="Technician observations"
            placeholder="Describe obstruction, shading, structural cracks, etc."
            minRows={3}
            value={rejectionNotes}
            onChange={(e) => setRejectionNotes(e?.target?.value ?? (e?.currentTarget as any)?.value ?? '')}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={rejectionReasons.length === 0}
              loading={surveyReportMutation.isPending}
              onClick={() =>
                surveyReportMutation.mutate({
                  approve: false,
                  reasons: rejectionReasons,
                  notes: rejectionNotes,
                })
              }
            >
              Submit Disapproval to Sales
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={lostOpen} onClose={() => setLostOpen(false)} title="Mark lead as lost" size="md">
        <Stack gap="md">
          <Textarea
            label="Reason"
            placeholder="Price too high, chose another vendor, roof unsuitable…"
            minRows={3}
            value={lostReason}
            onChange={(event) => setLostReason(event?.target?.value ?? (event?.currentTarget as any)?.value ?? '')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={lostReason.trim().length < 3}
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'LOST', lostReason })}
            >
              Mark lost
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
