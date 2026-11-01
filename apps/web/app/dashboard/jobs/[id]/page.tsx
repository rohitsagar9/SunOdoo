'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  FileInput,
  Grid,
  Group,
  Image,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
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
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  Headphones,
  IndianRupee,
  LogIn,
  LogOut,
  MapPin,
  Package,
  PenLine,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Signature,
  SunMedium,
  Truck,
  Upload,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { api, apiError, assetUrl } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, formatTime, safeValue, titleCase } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { Job } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/States';
import { SignaturePad } from '@/components/SignaturePad';
import { PaymentQR } from '@/components/PaymentQR';
import { InlineStat, Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const paymentMethods = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export default function JobDetailPage() {
  return (
    <RoleGate roles={['TECHNICIAN', 'SALES', 'DIRECTOR']}>
      <JobDetail />
    </RoleGate>
  );
}

function JobDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWork = user?.role === 'TECHNICIAN' || user?.role === 'DIRECTOR';

  const query = useQuery({
    queryKey: ['job', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Job>(`/jobs/${id}`)).data,
  });

  const job = query.data;

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Severe shading from trees / tall neighboring buildings');
  const [rejectNotes, setRejectNotes] = useState('');
  const [completion, setCompletion] = useState({
    notes: '',
    systemSizeKw: '',
    testResult: 'Generation normal',
  });
  const [site, setSite] = useState({
    amount: '',
    method: 'UPI',
    reference: '',
    notes: '',
  });
  const [siteFile, setSiteFile] = useState<File | null>(null);

  useEffect(() => {
    if (job) {
      setSignerName((current) => current || job.customer.name);
      setCompletion((current) => ({
        ...current,
        systemSizeKw:
          current.systemSizeKw || String(job.order?.quote?.capacityKw ?? ''),
        notes: current.notes || job.completionNotes || '',
      }));
      setSite((current) => ({
        ...current,
        amount: current.amount || (job.order ? String(job.order.balanceDue) : ''),
      }));
      if (job.ticket) {
        if (job.ticket.inspectionOutcome) {
          setInspection({
            outcome: (job.ticket.inspectionOutcome as 'REPAIR' | 'REPLACEMENT') || 'REPAIR',
            repairBudget: String(job.ticket.repairBudget ?? 1500),
            replacementPart: job.ticket.replacementPart ?? 'Inverter Main Control Board',
            notes: job.ticket.inspectionNotes ?? '',
          });
        }
      }
      if (job.lead?.survey) {
        setMeasurements({
          roofDirection: job.lead.survey.roofDirection ?? '',
          tiltDegrees: job.lead.survey.tiltDegrees != null ? String(job.lead.survey.tiltDegrees) : '',
          cableDistanceM: job.lead.survey.cableDistanceM != null ? String(job.lead.survey.cableDistanceM) : '',
          shadowFreeAreaSqft: job.lead.survey.shadowFreeAreaSqft != null ? String(job.lead.survey.shadowFreeAreaSqft) : '',
          findings: job.lead.survey.findings ?? '',
        });
      }
    }
  }, [job?.id]);

  const [measurements, setMeasurements] = useState({
    roofDirection: '',
    tiltDegrees: '',
    cableDistanceM: '',
    shadowFreeAreaSqft: '',
    findings: '',
  });

  const hasAnyMeasurement = Boolean(
    measurements.roofDirection.trim() ||
    measurements.tiltDegrees.trim() ||
    measurements.cableDistanceM.trim() ||
    measurements.shadowFreeAreaSqft.trim() ||
    measurements.findings.trim()
  );

  const hasAllCoreMeasurements = Boolean(
    measurements.roofDirection.trim() &&
    measurements.tiltDegrees.trim() &&
    measurements.cableDistanceM.trim() &&
    measurements.shadowFreeAreaSqft.trim()
  );

  const surveyMutation = useMutation({
    mutationFn: async (approve?: boolean) => {
      if (!job?.lead?.survey?.id) return;
      if (!hasAnyMeasurement) {
        throw new Error('Please enter roof site measurements before saving.');
      }
      if (approve && !hasAllCoreMeasurements) {
        throw new Error(
          'All measurements (orientation, tilt angle, cable distance, shadow-free area) are required before approving feasibility.',
        );
      }
      return (
        await api.patch(`/surveys/${job.lead.survey.id}`, {
          roofDirection: measurements.roofDirection.trim() || undefined,
          tiltDegrees: measurements.tiltDegrees ? Number(measurements.tiltDegrees) : undefined,
          cableDistanceM: measurements.cableDistanceM ? Number(measurements.cableDistanceM) : undefined,
          shadowFreeAreaSqft: measurements.shadowFreeAreaSqft ? Number(measurements.shadowFreeAreaSqft) : undefined,
          findings: measurements.findings.trim() || undefined,
          ...(approve != null ? { approved: approve } : {}),
        })
      ).data;
    },
    onSuccess: (_data, approve) => {
      invalidate();
      notifications.show({
        title: approve ? 'Feasibility approved' : 'Roof measurements recorded',
        message: approve
          ? 'Site marked feasible. Sales can now issue a quotation.'
          : 'Tilt angle and site measurements saved.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not save measurements', message: apiError(error), color: 'red' }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['job', id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  }

  const clockInMutation = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/clock-in`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Clocked in',
        message: 'The job timer is running.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not clock in', message: apiError(error), color: 'red' }),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/clock-out`)).data,
    onSuccess: (data) => {
      invalidate();
      notifications.show({
        title: 'Clocked out',
        message: `${data.minutes} minutes added. Total ${data.totalMinutes} minutes on this job.`,
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not clock out', message: apiError(error), color: 'red' }),
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error('Choose a photo first');
      const form = new FormData();
      if (photoCaption.trim()) form.append('caption', photoCaption.trim());
      form.append('file', photoFile);
      return (await api.post(`/jobs/${id}/photos`, form)).data;
    },
    onSuccess: () => {
      invalidate();
      setPhotoFile(null);
      setPhotoCaption('');
      notifications.show({
        title: 'Roof photo uploaded',
        message: 'The photo is attached to the job card.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not upload photo', message: apiError(error), color: 'red' }),
  });

  function handleQuickSign() {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 150);
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, 90);
      ctx.bezierCurveTo(90, 30, 140, 130, 190, 70);
      ctx.bezierCurveTo(230, 20, 270, 110, 330, 60);
      ctx.stroke();
      ctx.font = '16px cursive';
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText(signerName || job?.customer?.name || 'Customer', 60, 125);
    }
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData(dataUrl);
    notifications.show({
      title: 'Digital Signature Generated',
      message: 'Click "Save Signature" or "Complete Job" to finalize sign-off.',
      color: 'teal',
    });
  }

  const attachDemoPhotoMutation = useMutation({
    mutationFn: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('☀️ SunPower Solar System Inspection / Proof', 40, 80);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Customer: ${job?.customer?.name ?? 'Site'}`, 40, 140);
        ctx.fillText(`Job Number: ${job?.jobNumber ?? ''}`, 40, 180);
        ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 40, 220);
        ctx.fillText('Equipment Operational · Commissioning Normal', 40, 260);
      }
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'solar-inspection-photo.png', { type: 'image/png' });
      const form = new FormData();
      form.append('file', file);
      form.append('caption', 'On-site solar photo proof');
      return (await api.post(`/jobs/${id}/photos`, form)).data;
    },
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Demo Photo Attached',
        message: 'On-site inspection/commissioning photo attached successfully.',
        color: 'teal',
      });
    },
  });

  const signatureMutation = useMutation({
    mutationFn: async () => {
      if (!signatureData) throw new Error('Draw the signature first');
      return (
        await api.post(`/jobs/${id}/signature`, {
          signerName: signerName.trim(),
          dataUrl: signatureData,
        })
      ).data;
    },
    onSuccess: () => {
      invalidate();
      setSignatureData(null);
      notifications.show({
        title: 'Signature saved',
        message: 'The customer sign-off is attached to the job.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not save signature', message: apiError(error), color: 'red' }),
  });

  const isInstallation = job?.type === 'INSTALLATION';
  const isSurvey = job?.type === 'SURVEY';
  const isRepair = job?.type === 'REPAIR' || job?.type === 'MAINTENANCE';

  const [inspection, setInspection] = useState({
    outcome: 'REPAIR' as 'REPAIR' | 'REPLACEMENT',
    repairBudget: '1500',
    replacementPart: 'Inverter Main Control Board',
    notes: '',
  });

  const inspectionMutation = useMutation({
    mutationFn: async () => {
      if (!inspection.notes.trim()) {
        throw new Error('Please enter inspection observation notes.');
      }
      return (
        await api.post(`/jobs/${id}/inspection`, {
          outcome: inspection.outcome,
          repairBudget: Number(inspection.repairBudget) || 0,
          replacementPart: inspection.outcome === 'REPLACEMENT' ? inspection.replacementPart : undefined,
          notes: inspection.notes.trim(),
        })
      ).data;
    },
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Inspection Recommendation Submitted',
        message: 'Support Desk notified. Support will verify warranty and auto-approve repair.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not submit inspection', message: apiError(error), color: 'red' }),
  });

  const pickupMutation = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/pickup`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Hardware Kit Picked Up',
        message: 'Order status updated to DISPATCHED. Proceed to installation site.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not mark kit picked up', message: apiError(error), color: 'red' }),
  });

  const unloadMutation = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/unload`)).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Hardware Kit Unloaded at Site',
        message: 'Equipment confirmed on site. Proceed with installation, photos and signature.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not mark kit unloaded', message: apiError(error), color: 'red' }),
  });

  const rejectFeasibilityMutation = useMutation({
    mutationFn: async () => {
      const fullReason = rejectNotes.trim()
        ? `${rejectReason}: ${rejectNotes.trim()}`
        : rejectReason;
      return (await api.post(`/jobs/${id}/reject-feasibility`, { reason: fullReason })).data;
    },
    onSuccess: () => {
      invalidate();
      setRejectModalOpen(false);
      notifications.show({
        title: 'Site Marked Not Feasible',
        message: 'Survey rejected and lead marked as LOST. Sales team notified.',
        color: 'orange',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not reject feasibility', message: apiError(error), color: 'red' }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if ((isInstallation || isRepair) && !job?.signature) {
        if (!signatureData) {
          throw new Error('Please capture or draw the customer signature before completing');
        }
        await api.post(`/jobs/${id}/signature`, {
          signerName: signerName.trim() || job?.customer?.name || 'Customer',
          dataUrl: signatureData,
        });
      }
      return (
        await api.post(`/jobs/${id}/complete`, {
          completionNotes: completion.notes || undefined,
          systemSizeKw: isInstallation ? completion.systemSizeKw || undefined : undefined,
          testResult: isInstallation || isRepair ? completion.testResult || undefined : undefined,
        })
      ).data;
    },
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: isSurvey
          ? 'Survey assessment submitted'
          : isRepair
            ? 'Repair Completed & Invoice Generated in Support'
            : 'Installation Completed & Handed Over to Support',
        message: isSurvey
          ? 'Roof feasibility recorded. The sales desk can now generate the quotation.'
          : isRepair
            ? 'The repair visit is closed with customer signature and proof photos. Bill generated and stored in Support!'
            : 'The order is marked installed and warranty records are live.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not complete job', message: apiError(error), color: 'red' }),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('amount', site.amount);
      form.append('method', site.method);
      if (site.reference) form.append('reference', site.reference);
      if (site.notes) form.append('notes', site.notes);
      if (siteFile) form.append('screenshot', siteFile);
      return (await api.post(`/jobs/${id}/payments`, form)).data;
    },
    onSuccess: () => {
      invalidate();
      setSiteFile(null);
      notifications.show({
        title: 'Site payment submitted',
        message: 'The office will verify the screenshot and approve the collection.',
        color: 'teal',
      });
    },
    onError: (error) =>
      notifications.show({ title: 'Could not submit payment', message: apiError(error), color: 'red' }),
  });

  if (query.isLoading) return <LoadingState label="Loading the job card…" />;
  if (query.isError) {
    return <Alert color="red" title="Could not load job">{apiError(query.error)}</Alert>;
  }
  if (!job) return null;

  const timeLogs = job.timeLogs ?? [];
  const photos = job.photos ?? [];
  const openLog = timeLogs.find((log) => !log.clockOut);
  const order = job.order;
  const signatureReady = Boolean(job.signature) || Boolean(signatureData);
  const photosReady = photos.length > 0;
  const unloadedReady = Boolean(job.unloadedAt);
  const canComplete = isSurvey
    ? true
    : isRepair
      ? signatureReady && photosReady
      : !isInstallation || (signatureReady && photosReady && unloadedReady);
  const isAdvancePending = isInstallation && Boolean(order && order.status === 'PENDING_PAYMENT');
  const relatedInstallationJob = job.type === 'INSTALLATION'
    ? job
    : (job.lead?.orders?.find((o) => o.job)?.job ?? null);

  return (
    <>
      {isRepair && job.ticket && (
        <Alert
          color="grape"
          variant="filled"
          radius="md"
          mb="md"
          icon={<Headphones size={22} />}
          title={`🛠️ Solar Repair & Inspection Ticket #${job.ticket.ticketNumber} · ${
            job.ticket.warrantyStatus === 'IN_WARRANTY' ? '✓ UNDER WARRANTY (100% Free Coverage)' : 'OUT OF WARRANTY'
          }`}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <div>
              <Text fz="sm" fw={700}>
                Reported Fault: {job.ticket.issue}
              </Text>
              <Text fz="xs" opacity={0.95}>
                {job.ticket.inspectionOutcome
                  ? `Technician Recommended: ${job.ticket.inspectionOutcome} (${
                      job.ticket.inspectionOutcome === 'REPAIR'
                        ? `Budget: ${formatINR(job.ticket.repairBudget ?? 0)}`
                        : `Part: ${job.ticket.replacementPart ?? 'Equipment'}`
                    }) · ${job.ticket.approvedAt ? '✓ Approved by Support Desk' : '⏳ Awaiting Support Approval'}`
                  : 'Step 1: Inspect solar equipment on site and submit recommendation: Option 1 Repair (with budget) or Option 2 Replacement.'}
              </Text>
            </div>
            <Button
              component={Link}
              href={`/dashboard/support/${job.ticket.id}`}
              color="dark"
              size="sm"
              rightSection={<ArrowRight size={15} />}
            >
              Open Support Ticket (#{job.ticket.ticketNumber})
            </Button>
          </Group>
        </Alert>
      )}

      {relatedInstallationJob && relatedInstallationJob.id !== job.id && (
        <Alert
          color="teal"
          variant="filled"
          radius="md"
          mb="md"
          icon={<Truck size={22} />}
          title={`📦 Hardware Kit Dispatched — Installation Job #${relatedInstallationJob.jobNumber} is Ready!`}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <div>
              <Text fz="sm" fw={700}>
                Site survey was completed and warehouse dispatched hardware for {job.customer.name}!
              </Text>
              <Text fz="xs" opacity={0.95}>
                Open Installation Job #{relatedInstallationJob.jobNumber} to mark kit picked up/unloaded, capture final commissioning photos, get customer signature, and complete the installation for Support handover.
              </Text>
            </div>
            <Button
              component={Link}
              href={`/dashboard/jobs/${relatedInstallationJob.id}`}
              color="dark"
              size="sm"
              rightSection={<ArrowRight size={15} />}
            >
              Open Installation Job & Signature ({relatedInstallationJob.jobNumber})
            </Button>
          </Group>
        </Alert>
      )}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Group gap="sm">
          <Button
            component={Link}
            href="/dashboard/schedule"
            variant="subtle"
            color="gray"
            leftSection={<ArrowLeft size={15} />}
          >
            Schedule
          </Button>
          <div>
            <Text fz={11} fw={700} tt="uppercase" c="sun.7" style={{ letterSpacing: '0.12em' }}>
              {job.jobNumber} · {titleCase(job.type)}
            </Text>
            <Text fw={800} fz={24} style={{ letterSpacing: '-0.03em' }}>
              {job.customer.name}
            </Text>
            <Text fz="xs" c="dimmed">
              {formatDate(job.scheduledDate)} · {job.scheduledSlot ?? 'Slot TBC'} ·{' '}
              {job.technician?.name ?? 'Unassigned'}
            </Text>
          </div>
          <StatusBadge status={job.status} />
        </Group>
        <Group gap="sm" wrap="wrap">
          <Button
            component="a"
            href={`tel:${job.customer.phone}`}
            variant="light"
            color="teal"
            leftSection={<Phone size={15} />}
          >
            Call
          </Button>
          {canWork && !openLog && !['COMPLETED', 'CANCELLED'].includes(job.status) && (
            <Button
              color="sun"
              leftSection={<LogIn size={15} />}
              loading={clockInMutation.isPending}
              disabled={isAdvancePending}
              title={isAdvancePending ? 'Advance payment must be received before starting work' : undefined}
              onClick={() => clockInMutation.mutate()}
            >
              Clock in
            </Button>
          )}
          {canWork && openLog && (
            <Button
              color="orange"
              leftSection={<LogOut size={15} />}
              loading={clockOutMutation.isPending}
              onClick={() => clockOutMutation.mutate()}
            >
              Clock out
            </Button>
          )}
        </Group>
      </Group>

      {isAdvancePending && (
        <Alert
          color="orange"
          variant="light"
          radius="md"
          mb="md"
          title="Work Locked · Advance Payment Pending"
          icon={<ShieldAlert size={18} />}
        >
          Technicians can only start installation work after the customer advance payment is confirmed.
          Warehouse kit dispatch and installation clock-in remain locked until payment is approved.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Time on job
            </Text>
            <Clock3 size={15} color="#64748b" />
          </Group>
          <Text fz={22} fw={800} className="sp-mono">
            {job.hoursWorked != null ? `${job.hoursWorked} h` : openLog ? 'Running' : '—'}
          </Text>
          <Text fz={10} c="dimmed">
            {openLog ? `Clocked in ${formatTime(openLog.clockIn)}` : `${timeLogs.length} time log(s)`}
          </Text>
        </Paper>

        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              {isSurvey ? 'Site photos' : 'Installation photos'}
            </Text>
            <Camera size={15} color="#64748b" />
          </Group>
          <Text fz={22} fw={800} className="sp-mono">
            {photos.length}
          </Text>
          <Text fz={10} c="dimmed">
            {isSurvey
              ? photos.length > 0
                ? 'Roof inspection attached'
                : 'Upload roof photos below'
              : photosReady
                ? 'Finished-roof proof attached'
                : 'At least one required'}
          </Text>
        </Paper>

        {isSurvey ? (
          <Paper p="md" className="sp-soft-card">
            <Group justify="space-between" mb={4}>
              <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
                Feasibility
              </Text>
              <ShieldCheck
                size={15}
                color={
                  job.lead?.survey?.approved
                    ? '#0f766e'
                    : job.lead?.status === 'LOST'
                      ? '#dc2626'
                      : '#d97706'
                }
              />
            </Group>
            <Text
              fz={20}
              fw={800}
              c={
                job.lead?.survey?.approved
                  ? 'teal.7'
                  : job.lead?.status === 'LOST'
                    ? 'red.7'
                    : 'orange.7'
              }
            >
              {job.lead?.survey?.approved
                ? 'Approved'
                : job.lead?.status === 'LOST'
                  ? 'Not Feasible'
                  : 'Pending'}
            </Text>
            <Text fz={10} c="dimmed">
              {job.lead?.survey?.approved
                ? 'Roof feasible for solar'
                : job.lead?.status === 'LOST'
                  ? 'Survey rejected as unfeasible'
                  : 'Feasibility sign-off needed'}
            </Text>
          </Paper>
        ) : (
          <Paper p="md" className="sp-soft-card">
            <Group justify="space-between" mb={4}>
              <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
                Kit logistics & sign-off
              </Text>
              <Truck
                size={15}
                color={job.unloadedAt ? '#0f766e' : job.pickedUpAt ? '#2563eb' : '#64748b'}
              />
            </Group>
            <Text
              fz={18}
              fw={800}
              c={job.unloadedAt ? 'teal.7' : job.pickedUpAt ? 'blue.7' : 'orange.7'}
            >
              {job.unloadedAt
                ? signatureReady
                  ? 'Signed & Unloaded'
                  : 'Unloaded at Site'
                : job.pickedUpAt
                  ? 'In Transit'
                  : 'Kit in Warehouse'}
            </Text>
            <Text fz={10} c="dimmed">
              {job.unloadedAt
                ? signatureReady
                  ? `Signed by ${job.signature?.signerName}`
                  : 'Customer signature pending'
                : job.pickedUpAt
                  ? 'Picked up, heading to site'
                  : 'Awaiting warehouse pickup'}
            </Text>
          </Paper>
        )}

        {isSurvey ? (
          <Paper p="md" className="sp-soft-card">
            <Group justify="space-between" mb={4}>
              <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
                System requirement
              </Text>
              <SunMedium size={15} color="#783cf6" />
            </Group>
            <Text fz={20} fw={800} className="sp-mono">
              {job.lead?.requestedKw ?? 3} kW
            </Text>
            <Text fz={10} c="dimmed">
              {job.lead ? titleCase(job.lead.systemType) : 'Site assessment'}
            </Text>
          </Paper>
        ) : (
          <Paper p="md" className="sp-soft-card">
            <Group justify="space-between" mb={4}>
              <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
                Balance
              </Text>
              <Wallet size={15} color="#d97706" />
            </Group>
            <Text fz={22} fw={800} className="sp-mono">
              {order ? formatINR(order.balanceDue) : '—'}
            </Text>
            <Text fz={10} c="dimmed">
              {order ? `of ${formatINR(order.total)}` : 'No order linked'}
            </Text>
          </Paper>
        )}
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Panel title="Time clock" subtitle="Every visit is timed for payroll and job costing">
              <Group justify="space-between" mb="md" wrap="wrap">
                <Group gap="sm">
                  <ThemeIcon
                    size={38}
                    radius="xl"
                    color={openLog ? 'orange' : 'gray'}
                    variant="light"
                  >
                    <Clock3 size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      {openLog ? 'On the clock' : job.status === 'COMPLETED' ? 'Job closed' : 'Not clocked in'}
                    </Text>
                    <Text fz={11} c="dimmed">
                      {openLog
                        ? `Started ${formatDateTime(openLog.clockIn)}`
                        : `${timeLogs.length} completed session(s)`}
                    </Text>
                  </div>
                </Group>
                {canWork && !['COMPLETED', 'CANCELLED'].includes(job.status) && (
                  <Group gap="sm">
                    {!openLog ? (
                      <Button
                        color="sun"
                        leftSection={<LogIn size={15} />}
                        loading={clockInMutation.isPending}
                        onClick={() => clockInMutation.mutate()}
                      >
                        Clock in
                      </Button>
                    ) : (
                      <Button
                        color="orange"
                        leftSection={<LogOut size={15} />}
                        loading={clockOutMutation.isPending}
                        onClick={() => clockOutMutation.mutate()}
                      >
                        Clock out
                      </Button>
                    )}
                  </Group>
                )}
              </Group>
              <ScrollArea>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={480}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Clock in</Table.Th>
                      <Table.Th>Clock out</Table.Th>
                      <Table.Th ta="right">Minutes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {timeLogs.map((log) => (
                      <Table.Tr key={log.id}>
                        <Table.Td>
                          <Text fz="xs">{formatDateTime(log.clockIn)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="xs">{log.clockOut ? formatDateTime(log.clockOut) : 'Running'}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="xs" className="sp-mono">
                            {log.minutes ?? '—'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {timeLogs.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text fz="xs" c="dimmed" ta="center" py="sm">
                            No time logs yet.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Panel>

            {job.lead?.survey && (
              <Panel
                title="Roof site measurements"
                subtitle="Tilt angle, orientation, and shadow-free area"
                action={<SunMedium size={16} color="#64748b" />}
              >
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <TextInput
                      label="Roof orientation / direction"
                      placeholder="e.g. South / South-West"
                      required
                      value={measurements.roofDirection}
                      onChange={(e) => setMeasurements((prev) => ({ ...prev, roofDirection: safeValue(e) }))}
                    />
                    <TextInput
                      label="Tilt angle (degrees)"
                      type="number"
                      placeholder="e.g. 18"
                      required
                      value={measurements.tiltDegrees}
                      onChange={(e) => setMeasurements((prev) => ({ ...prev, tiltDegrees: safeValue(e) }))}
                    />
                    <TextInput
                      label="Cable distance (m)"
                      type="number"
                      placeholder="e.g. 25"
                      required
                      value={measurements.cableDistanceM}
                      onChange={(e) => setMeasurements((prev) => ({ ...prev, cableDistanceM: safeValue(e) }))}
                    />
                    <TextInput
                      label="Shadow-free area (sq ft)"
                      type="number"
                      placeholder="e.g. 500"
                      required
                      value={measurements.shadowFreeAreaSqft}
                      onChange={(e) => setMeasurements((prev) => ({ ...prev, shadowFreeAreaSqft: safeValue(e) }))}
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Site observations / findings"
                    placeholder="Rooftop structural integrity, shadow analysis, parapet height..."
                    minRows={2}
                    value={measurements.findings}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, findings: safeValue(e) }))}
                  />
                  {!hasAllCoreMeasurements && !job.lead?.survey?.approved && (
                    <Text fz={11} c="dimmed">
                      * All 4 measurements (orientation, tilt angle, cable distance, shadow-free area) are required before approving feasibility.
                    </Text>
                  )}
                  <Group justify="space-between" wrap="wrap">
                    <Badge
                      color={
                        job.lead?.survey?.approved
                          ? 'teal'
                          : job.lead?.status === 'LOST'
                            ? 'red'
                            : 'yellow'
                      }
                      variant="light"
                    >
                      {job.lead?.survey?.approved
                        ? 'Feasibility Approved'
                        : job.lead?.status === 'LOST'
                          ? 'Not Feasible (Rejected)'
                          : 'Feasibility Pending Sign-off'}
                    </Badge>
                    <Group gap="xs">
                      {canWork && !job.lead?.survey?.approved && job.lead?.status !== 'LOST' && (
                        <Button
                          variant="light"
                          color="red"
                          leftSection={<ShieldAlert size={14} />}
                          onClick={() => setRejectModalOpen(true)}
                        >
                          Mark Not Feasible
                        </Button>
                      )}
                      <Button
                        variant="light"
                        color="indigo"
                        disabled={!hasAnyMeasurement || job.lead?.status === 'LOST'}
                        loading={surveyMutation.isPending}
                        onClick={() => {
                          if (!hasAnyMeasurement) {
                            notifications.show({
                              title: 'Measurements required',
                              message: 'Please enter site measurements before saving.',
                              color: 'red',
                            });
                            return;
                          }
                          surveyMutation.mutate(false);
                        }}
                      >
                        Save measurements
                      </Button>
                      {!job.lead?.survey?.approved && job.lead?.status !== 'LOST' && (
                        <Button
                          color="teal"
                          leftSection={<ShieldCheck size={14} />}
                          disabled={!hasAllCoreMeasurements}
                          loading={surveyMutation.isPending}
                          onClick={() => {
                            if (!hasAllCoreMeasurements) {
                              notifications.show({
                                title: 'Missing measurements',
                                message:
                                  'Please enter roof orientation, tilt angle, cable distance, and shadow-free area before approving feasibility.',
                                color: 'red',
                              });
                              return;
                            }
                            surveyMutation.mutate(true);
                          }}
                        >
                          Approve feasibility
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Stack>
              </Panel>
            )}

            {isInstallation && (
              <Panel
                title="Hardware kit logistics & site unloading"
                subtitle="Warehouse pickup and on-site unloading flow before installation completion"
                action={<Truck size={16} color="#64748b" />}
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Paper
                    p="md"
                    withBorder
                    style={{
                      borderColor: job.pickedUpAt ? '#0f766e' : '#f59e0b',
                      background: job.pickedUpAt ? 'rgba(15, 118, 110, 0.04)' : 'var(--sp-card)',
                      borderRadius: 10,
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <ThemeIcon
                          size={28}
                          radius="md"
                          color={job.pickedUpAt ? 'teal' : 'orange'}
                          variant="light"
                        >
                          <Package size={15} />
                        </ThemeIcon>
                        <Text fz="xs" fw={700}>
                          Step 1 · Warehouse Kit Pickup
                        </Text>
                      </Group>
                      <Badge size="xs" color={job.pickedUpAt ? 'teal' : 'yellow'} variant="light">
                        {job.pickedUpAt ? 'Picked Up' : 'Pending Pickup'}
                      </Badge>
                    </Group>
                    <Text fz={11} c="dimmed" mb="sm">
                      {job.pickedUpAt
                        ? `Hardware kit picked up on ${formatDateTime(job.pickedUpAt)}. Status marked DISPATCHED.`
                        : 'Collect all packed inventory units (panels, inverter, rails, BOS) from warehouse.'}
                    </Text>
                    {canWork && !job.pickedUpAt && (
                      <Button
                        size="xs"
                        color="sun"
                        leftSection={<Package size={13} />}
                        loading={pickupMutation.isPending}
                        onClick={() => pickupMutation.mutate()}
                      >
                        Mark Picked Up from Warehouse
                      </Button>
                    )}
                  </Paper>

                  <Paper
                    p="md"
                    withBorder
                    style={{
                      borderColor: job.unloadedAt ? '#0f766e' : '#94a3b8',
                      background: job.unloadedAt ? 'rgba(15, 118, 110, 0.04)' : 'var(--sp-card)',
                      borderRadius: 10,
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <ThemeIcon
                          size={28}
                          radius="md"
                          color={job.unloadedAt ? 'teal' : 'gray'}
                          variant="light"
                        >
                          <Truck size={15} />
                        </ThemeIcon>
                        <Text fz="xs" fw={700}>
                          Step 2 · Unloaded at Customer Site
                        </Text>
                      </Group>
                      <Badge size="xs" color={job.unloadedAt ? 'teal' : 'gray'} variant="light">
                        {job.unloadedAt ? 'Unloaded' : 'Pending Arrival'}
                      </Badge>
                    </Group>
                    <Text fz={11} c="dimmed" mb="sm">
                      {job.unloadedAt
                        ? `Hardware safely unloaded on site at ${formatDateTime(job.unloadedAt)}. Installation ready.`
                        : 'Confirm physical arrival at customer site and unload components for mounting.'}
                    </Text>
                    {canWork && job.pickedUpAt && !job.unloadedAt && (
                      <Button
                        size="xs"
                        color="teal"
                        leftSection={<Truck size={13} />}
                        loading={unloadMutation.isPending}
                        onClick={() => unloadMutation.mutate()}
                      >
                        Mark Unloaded at Site
                      </Button>
                    )}
                  </Paper>
                </SimpleGrid>
              </Panel>
            )}

            {isRepair && (
              <Panel
                title="Step 1 · On-site Equipment Inspection & Recommendation"
                subtitle="Select whether the solar equipment can be repaired or requires replacement"
                action={<Wrench size={16} color="#783cf6" />}
              >
                <Stack gap="md">
                  <div>
                    <Text fz="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                      Technician Diagnostic Recommendation
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={inspection.outcome}
                      onChange={(val) => setInspection((prev) => ({ ...prev, outcome: val as 'REPAIR' | 'REPLACEMENT' }))}
                      data={[
                        { label: 'Option 1: REPAIR (Estimated Budget)', value: 'REPAIR' },
                        { label: 'Option 2: REPLACEMENT (Replace Component)', value: 'REPLACEMENT' },
                      ]}
                      color="grape"
                    />
                  </div>

                  {inspection.outcome === 'REPAIR' ? (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <NumberInput
                        label="Estimated Repair Budget (₹)"
                        description="Estimated technician labor and minor consumables"
                        min={0}
                        step={500}
                        value={inspection.repairBudget}
                        onChange={(val) => setInspection((prev) => ({ ...prev, repairBudget: String(val) }))}
                        required
                      />
                      <TextInput
                        label="Repair Scope"
                        placeholder="e.g. PCB solder reflow & MCB terminal re-torquing"
                        value="Component-level repair on site"
                        disabled
                      />
                    </SimpleGrid>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <TextInput
                        label="Faulty Component to Replace"
                        placeholder="e.g. Inverter Main Board, Solar PV Panel, DC MCB"
                        value={inspection.replacementPart}
                        onChange={(e) => setInspection((prev) => ({ ...prev, replacementPart: safeValue(e) }))}
                        required
                      />
                      <NumberInput
                        label="Estimated Replacement Cost (₹)"
                        description="Component unit cost estimate"
                        min={0}
                        step={500}
                        value={inspection.repairBudget}
                        onChange={(val) => setInspection((prev) => ({ ...prev, repairBudget: String(val) }))}
                        required
                      />
                    </SimpleGrid>
                  )}

                  <Textarea
                    label="On-site Technical Findings & Observations"
                    placeholder="Describe fault symptoms observed on site, voltage/current multimeter readings, error codes..."
                    minRows={3}
                    value={inspection.notes}
                    onChange={(e) => setInspection((prev) => ({ ...prev, notes: safeValue(e) }))}
                    required
                  />

                  {job.ticket?.inspectionOutcome && (
                    <Alert
                      color={job.ticket.approvedAt ? 'teal' : 'yellow'}
                      variant="light"
                      radius="md"
                      icon={job.ticket.approvedAt ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                      title={`Current Recommendation: ${job.ticket.inspectionOutcome} (${
                        job.ticket.inspectionOutcome === 'REPAIR'
                          ? `Budget: ${formatINR(job.ticket.repairBudget ?? 0)}`
                          : `Part: ${job.ticket.replacementPart ?? 'Equipment'}`
                      })`}
                    >
                      {job.ticket.approvedAt
                        ? `✓ Approved by Support Desk on ${formatDateTime(job.ticket.approvedAt)}. ${
                            job.ticket.warrantyStatus === 'IN_WARRANTY'
                              ? 'Covered under warranty (₹0 charge).'
                              : `Customer billable: ${formatINR(job.ticket.totalCharge)}.`
                          }`
                        : '⏳ Awaiting Support Desk warranty review and approval.'}
                    </Alert>
                  )}

                  {canWork && (
                    <Group justify="flex-end">
                      <Button
                        color="grape"
                        leftSection={<Wrench size={15} />}
                        loading={inspectionMutation.isPending}
                        onClick={() => inspectionMutation.mutate()}
                      >
                        {job.ticket?.inspectionOutcome ? 'Update Diagnostic Recommendation' : 'Submit Recommendation to Support Desk'}
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Panel>
            )}

            <Panel
              title={isSurvey ? 'Roof & site photos' : isRepair ? 'Inspection & repair photo proof' : 'Roof & installation photos'}
              subtitle={
                isRepair
                  ? 'At least one photo of the faulty/repaired equipment is required before completing repair'
                  : 'At least one finished-roof photo is required before completion'
              }
              action={<Camera size={16} color="#64748b" />}
            >
              {canWork && (
                <Stack gap="sm" mb="md">
                  <Group align="flex-end" gap="sm" wrap="wrap">
                    <FileInput
                      label="Photo"
                      placeholder="Choose a JPG, PNG or WEBP"
                      accept="image/*"
                      value={photoFile}
                      onChange={setPhotoFile}
                      leftSection={<FileImage size={15} />}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                    <TextInput
                      label="Caption"
                      placeholder={isRepair ? 'Inverter display / repaired component proof' : 'South roof array after commissioning'}
                      value={photoCaption}
                      onChange={(event) => setPhotoCaption(safeValue(event))}
                      style={{ flex: 1, minWidth: 220 }}
                    />
                    <Button
                      leftSection={<Upload size={15} />}
                      color="sun"
                      loading={photoMutation.isPending}
                      disabled={!photoFile}
                      onClick={() => photoMutation.mutate()}
                    >
                      Upload
                    </Button>
                    <Button
                      variant="light"
                      color="cyan"
                      leftSection={<Camera size={14} />}
                      loading={attachDemoPhotoMutation.isPending}
                      onClick={() => attachDemoPhotoMutation.mutate()}
                    >
                      Attach Demo Photo
                    </Button>
                  </Group>
                </Stack>
              )}
              {photos.length > 0 ? (
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                  {photos.map((photo) => (
                    <Box key={photo.id}>
                      <Image
                        src={assetUrl(photo.url)}
                        alt={photo.caption ?? 'Job photo'}
                        radius="md"
                        h={130}
                        fit="cover"
                        style={{ cursor: 'zoom-in', border: '1px solid #e2e8f0' }}
                        onClick={() => setPreviewPhoto(photo.url)}
                      />
                      <Text fz={10} c="dimmed" mt={4} lineClamp={1}>
                        {photo.caption ?? formatDateTime(photo.createdAt)}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              ) : (
                <Alert color="blue" variant="light" radius="md" icon={<Camera size={16} />}>
                  {isRepair
                    ? 'No repair photos yet. Capture inverter display, fault code, or repaired component before completing.'
                    : 'No photos yet. Capture the finished array, inverter display and earthing before leaving site.'}
                </Alert>
              )}
            </Panel>

            {(isInstallation || isRepair) && (
              <Panel
                title="Customer signature"
                subtitle="The sign-off is stored against the job and shown on the order / support ticket"
                action={<PenLine size={16} color="#64748b" />}
              >
                {job.signature ? (
                  <Stack gap="sm">
                    <Alert color="teal" variant="light" radius="md" icon={<CheckCircle2 size={16} />}>
                      Signed by <b>{job.signature.signerName}</b> on{' '}
                      {formatDateTime(job.signature.signedAt)}.
                    </Alert>
                    <Image
                      src={assetUrl(job.signature.dataUrl)}
                      alt="Customer signature"
                      radius="md"
                      maw={360}
                      style={{ border: '1px solid #e2e8f0', background: '#fff' }}
                    />
                  </Stack>
                ) : canWork ? (
                  <Stack gap="sm">
                    <TextInput
                      label="Signer name"
                      value={signerName}
                      onChange={(event) => setSignerName(safeValue(event))}
                    />
                    <SignaturePad onChange={setSignatureData} />
                    <Group justify="space-between">
                      <Button
                        variant="light"
                        color="blue"
                        size="xs"
                        leftSection={<Signature size={14} />}
                        onClick={handleQuickSign}
                      >
                        Quick Sign as Customer
                      </Button>
                      <Button
                        color="sun"
                        leftSection={<Signature size={15} />}
                        disabled={!signatureData || signerName.trim().length < 2}
                        loading={signatureMutation.isPending}
                        onClick={() => signatureMutation.mutate()}
                      >
                        Save signature
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Text fz="sm" c="dimmed">
                    The technician captures the customer signature on site.
                  </Text>
                )}
              </Panel>
            )}

            {isSurvey ? (
              <Panel
                title="Complete survey & feasibility"
                subtitle="Submitting this assessment confirms roof feasibility and enables the sales desk to issue quotation"
                action={<CheckCircle2 size={16} color="#0f766e" />}
              >
                <Stack gap="md">
                  <Textarea
                    label="Survey assessment & roof structural observations"
                    placeholder="Describe roof structural stability, shadow obstacles, parapet conditions, cable entry route..."
                    minRows={3}
                    value={completion.notes}
                    onChange={(event) =>
                      setCompletion((current) => ({ ...current, notes: safeValue(event) }))
                    }
                  />
                  <Group justify="space-between" wrap="wrap">
                    <Badge color={job.lead?.survey?.approved ? 'teal' : 'yellow'} variant="light" size="md">
                      {job.lead?.survey?.approved ? 'Feasibility: Approved' : 'Feasibility: Pending Sign-off'}
                    </Badge>
                    {canWork && (
                      <Button
                        color="teal"
                        leftSection={<CheckCircle2 size={15} />}
                        disabled={job.status === 'COMPLETED'}
                        loading={completeMutation.isPending}
                        onClick={() => completeMutation.mutate()}
                      >
                        {job.status === 'COMPLETED' ? 'Survey completed' : 'Complete survey & submit feasibility'}
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Panel>
            ) : isRepair ? (
              <Panel
                title="Step 2 · Complete Repair & Generate Support Bill"
                subtitle="Completion saves customer sign-off, marks repair resolved, and automatically generates the repair invoice in Support"
                action={<CheckCircle2 size={16} color="#783cf6" />}
              >
                <Stack gap="md">
                  <TextInput
                    label="Post-Repair Commissioning / Test Result"
                    placeholder="e.g. Inverter operational, DC voltage 380V normal, earthing OK"
                    value={completion.testResult}
                    onChange={(event) =>
                      setCompletion((current) => ({ ...current, testResult: safeValue(event) }))
                    }
                  />
                  <Textarea
                    label="Repair Completion & Handover Notes"
                    placeholder="Describe parts replaced or servicing steps completed for customer handover..."
                    minRows={3}
                    value={completion.notes}
                    onChange={(event) =>
                      setCompletion((current) => ({ ...current, notes: safeValue(event) }))
                    }
                  />

                  {job.status === 'COMPLETED' ? (
                    <Alert color="teal" variant="light" radius="md" icon={<CheckCircle2 size={16} />}>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text fz="sm">
                          ✓ Repair Completed! Customer signature and photo proof saved. Official repair bill generated.
                        </Text>
                        {job.ticket && (
                          <Button
                            component={Link}
                            href={`/dashboard/support/${job.ticket.id}`}
                            size="xs"
                            color="grape"
                            rightSection={<ArrowRight size={13} />}
                          >
                            View Support Ticket & Bill (#{job.ticket.ticketNumber})
                          </Button>
                        )}
                      </Group>
                    </Alert>
                  ) : (
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="md" wrap="wrap">
                        <Group gap={6}>
                          <CheckCircle2 size={14} color={photosReady ? '#0f766e' : '#94a3b8'} />
                          <Text fz={11} c={photosReady ? 'teal.7' : 'dimmed'}>
                            Proof Photos ({photos.length})
                          </Text>
                        </Group>
                        <Group gap={6}>
                          <Signature size={14} color={signatureReady ? '#0f766e' : '#94a3b8'} />
                          <Text fz={11} c={signatureReady ? 'teal.7' : 'dimmed'}>
                            Customer Signature {signatureReady ? '✓' : 'Pending'}
                          </Text>
                        </Group>
                        <Group gap={6}>
                          <ShieldCheck size={14} color={job.ticket?.approvedAt ? '#0f766e' : '#94a3b8'} />
                          <Text fz={11} c={job.ticket?.approvedAt ? 'teal.7' : 'dimmed'}>
                            Support Approval {job.ticket?.approvedAt ? '✓' : 'Pending'}
                          </Text>
                        </Group>
                      </Group>

                      {canWork ? (
                        <Button
                          color="grape"
                          leftSection={<CheckCircle2 size={15} />}
                          disabled={!canComplete || job.status === 'COMPLETED'}
                          loading={completeMutation.isPending}
                          onClick={() => completeMutation.mutate()}
                        >
                          Complete Repair & Generate Support Bill
                        </Button>
                      ) : (
                        <Text fz="xs" c="dimmed">
                          Technician or director sign-off required.
                        </Text>
                      )}
                    </Group>
                  )}
                </Stack>
              </Panel>
            ) : (
              <Panel
                title="Complete installation"
                subtitle="Completion flips the order to installed and starts warranty"
                action={<CheckCircle2 size={16} color="#0f766e" />}
              >
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <NumberInput
                      label="Installed system size (kW)"
                      min={0.5}
                      max={20}
                      decimalScale={1}
                      value={completion.systemSizeKw}
                      onChange={(value) =>
                        setCompletion((current) => ({ ...current, systemSizeKw: String(value) }))
                      }
                    />
                    <TextInput
                      label="Commissioning test"
                      placeholder="Generation normal, earthing OK"
                      value={completion.testResult}
                      onChange={(event) =>
                        setCompletion((current) => ({ ...current, testResult: safeValue(event) }))
                      }
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Completion notes"
                    placeholder="Work completed, handover notes, net-metering status…"
                    minRows={3}
                    value={completion.notes}
                    onChange={(event) =>
                      setCompletion((current) => ({ ...current, notes: safeValue(event) }))
                    }
                  />
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="md" wrap="wrap">
                      <Group gap={6}>
                        <Package size={14} color={job.pickedUpAt ? '#0f766e' : '#94a3b8'} />
                        <Text fz={11} c={job.pickedUpAt ? 'teal.7' : 'dimmed'}>
                          Kit Picked Up
                        </Text>
                      </Group>
                      <Group gap={6}>
                        <Truck size={14} color={job.unloadedAt ? '#0f766e' : '#94a3b8'} />
                        <Text fz={11} c={job.unloadedAt ? 'teal.7' : 'dimmed'}>
                          Kit Unloaded
                        </Text>
                      </Group>
                      <Group gap={6}>
                        <CheckCircle2 size={14} color={photosReady ? '#0f766e' : '#94a3b8'} />
                        <Text fz={11} c={photosReady ? 'teal.7' : 'dimmed'}>
                          Photos ({photos.length})
                        </Text>
                      </Group>
                      <Group gap={6}>
                        <Signature size={14} color={signatureReady ? '#0f766e' : '#94a3b8'} />
                        <Text fz={11} c={signatureReady ? 'teal.7' : 'dimmed'}>
                          Signature
                        </Text>
                      </Group>
                    </Group>
                    {canWork ? (
                      <Button
                        color="teal"
                        leftSection={<CheckCircle2 size={15} />}
                        disabled={!canComplete || job.status === 'COMPLETED'}
                        loading={completeMutation.isPending}
                        onClick={() => completeMutation.mutate()}
                      >
                        {job.status === 'COMPLETED' ? 'Installation completed' : 'Complete installation & activate warranty'}
                      </Button>
                    ) : (
                      <Text fz="xs" c="dimmed">
                        Technician or director sign-off required.
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Panel>
            )}

            {isInstallation && order && (
              <Panel
                title="Collect site payment"
                subtitle="UPI QR, cash or transfer. Screenshot goes to the office queue."
                action={<IndianRupee size={16} color="#d97706" />}
              >
                <Grid gap="md">
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <PaymentQR amount={order.balanceDue} compact />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 7 }}>
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Text fz="xs" c="dimmed">
                          Balance due
                        </Text>
                        <Text fz="sm" fw={800} className="sp-mono">
                          {formatINR(order.balanceDue)}
                        </Text>
                      </Group>
                      <NumberInput
                        label="Amount collected (₹)"
                        min={1}
                        max={order.balanceDue}
                        value={site.amount}
                        onChange={(value) =>
                          setSite((current) => ({ ...current, amount: String(value) }))
                        }
                      />
                      <Select
                        label="Method"
                        data={paymentMethods}
                        value={site.method}
                        onChange={(value) => setSite((current) => ({ ...current, method: value ?? 'UPI' }))}
                        allowDeselect={false}
                      />
                      <TextInput
                        label="UPI / cheque reference"
                        placeholder="UTR or cheque number"
                        value={site.reference}
                        onChange={(event) =>
                          setSite((current) => ({ ...current, reference: safeValue(event) }))
                        }
                      />
                      <FileInput
                        label="Payment screenshot"
                        placeholder="Attach proof for UPI"
                        accept="image/*,.pdf"
                        value={siteFile}
                        onChange={setSiteFile}
                        leftSection={<FileImage size={15} />}
                      />
                      <Textarea
                        label="Notes"
                        minRows={2}
                        value={site.notes}
                        onChange={(event) =>
                          setSite((current) => ({ ...current, notes: safeValue(event) }))
                        }
                      />
                      <Button
                        color="sun"
                        leftSection={<Upload size={15} />}
                        disabled={!site.amount || Number(site.amount) <= 0}
                        loading={paymentMutation.isPending}
                        onClick={() => paymentMutation.mutate()}
                      >
                        Submit for approval
                      </Button>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Panel>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Panel title="Customer & site" subtitle="Where the crew is working">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={36} radius="xl" color="sun" variant="light">
                    <UserRound size={17} />
                  </ThemeIcon>
                  <div>
                    <Text fz="sm" fw={700}>
                      {job.customer.name}
                    </Text>
                    <Text fz={11} c="dimmed" className="sp-mono">
                      {job.customer.phone}
                    </Text>
                  </div>
                </Group>
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <MapPin size={14} color="#94a3b8" style={{ marginTop: 2 }} />
                  <Text fz="xs" c="dimmed">
                    {job.customer.address}
                    {job.customer.city ? `, ${job.customer.city}` : ''}
                    {job.customer.state ? `, ${job.customer.state}` : ''}
                  </Text>
                </Group>
                <Divider />
                <SimpleGrid cols={2} spacing="sm">
                  <InlineStat label="Type" value={titleCase(job.type)} />
                  <InlineStat label="Status" value={titleCase(job.status)} />
                  <InlineStat label="Scheduled" value={formatDate(job.scheduledDate)} />
                  <InlineStat label="Slot" value={job.scheduledSlot ?? '—'} />
                </SimpleGrid>
              </Stack>
            </Panel>

            {order && (
              <Panel
                title="Order & warranty"
                subtitle="What was dispatched to site"
                action={
                  <Button
                    component={Link}
                    href={`/dashboard/orders/${order.id}`}
                    size="compact-sm"
                    variant="light"
                    color="sun"
                  >
                    Order
                  </Button>
                }
              >
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fz="sm" fw={700} className="sp-mono">
                      {order.orderNumber}
                    </Text>
                    <StatusBadge status={order.status} size="xs" />
                  </Group>
                  <Text fz="xs" c="dimmed">
                    {order.quote?.capacityKw ?? '—'} kW · {titleCase(order.quote?.systemType)} ·{' '}
                    {formatINR(order.total)}
                  </Text>
                  <Divider />
                  <Text fz="xs" fw={700}>
                    Scanned serials
                  </Text>
                  <ScrollArea h={180}>
                    <Stack gap={6}>
                      {(order.inventoryUnits ?? []).map((unit) => (
                        <Box key={unit.id}>
                          <Text fz={11} className="sp-mono" fw={600}>
                            {unit.serialNumber}
                          </Text>
                          <Text fz={10} c="dimmed">
                            {unit.product.name}
                          </Text>
                        </Box>
                      ))}
                      {(order.inventoryUnits ?? []).length === 0 && (
                        <Text fz="xs" c="dimmed">
                          No serials on this order yet.
                        </Text>
                      )}
                    </Stack>
                  </ScrollArea>
                  <Divider />
                  <Text fz="xs" fw={700}>
                    Payments
                  </Text>
                  {(order.payments ?? []).map((payment) => (
                    <Group key={payment.id} justify="space-between" wrap="nowrap">
                      <Text fz={10} c="dimmed">
                        {titleCase(payment.type)} · {titleCase(payment.method)}
                      </Text>
                      <Group gap={4}>
                        <Text fz={10} fw={700} className="sp-mono">
                          {formatINR(payment.amount)}
                        </Text>
                        <StatusBadge status={payment.status} size="xs" />
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Panel>
            )}

            {job.lead?.survey && (
              <Panel title="Survey findings" subtitle="Recorded before the quote">
                <SimpleGrid cols={2} spacing="sm">
                  <InlineStat label="Roof direction" value={job.lead.survey.roofDirection ?? '—'} />
                  <InlineStat label="Tilt" value={`${job.lead.survey.tiltDegrees ?? '—'}°`} />
                  <InlineStat label="Cable run" value={`${job.lead.survey.cableDistanceM ?? '—'} m`} />
                  <InlineStat
                    label="Shadow-free"
                    value={`${job.lead.survey.shadowFreeAreaSqft ?? '—'} ft²`}
                  />
                </SimpleGrid>
                {job.lead.survey.findings && (
                  <Text fz="xs" c="dimmed" mt="sm">
                    {job.lead.survey.findings}
                  </Text>
                )}
              </Panel>
            )}

            <Panel title="Job timeline" subtitle="Proof collected on site">
              <Timeline active={job.status === 'COMPLETED' ? 4 : openLog ? 2 : 1} bulletSize={22} lineWidth={2}>
                <Timeline.Item title="Scheduled" bullet={<SunMedium size={11} />}>
                  <Text fz={11} c="dimmed">
                    {formatDateTime(job.scheduledDate)}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Clocked in" bullet={<Clock3 size={11} />}>
                  <Text fz={11} c="dimmed">
                    {job.clockInAt ? formatDateTime(job.clockInAt) : 'Pending'}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Photos & signature" bullet={<Camera size={11} />}>
                  <Text fz={11} c="dimmed">
                    {photos.length} photo(s) · {signatureReady ? 'signed' : 'unsigned'}
                  </Text>
                </Timeline.Item>
                <Timeline.Item title="Completed" bullet={<ShieldCheck size={11} />}>
                  <Text fz={11} c="dimmed">
                    {job.completedAt ? formatDateTime(job.completedAt) : 'Pending'}
                  </Text>
                </Timeline.Item>
              </Timeline>
            </Panel>

            <Panel title="Technician">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={36} radius="xl" color="ocean" variant="light">
                  <Wrench size={17} />
                </ThemeIcon>
                <div>
                  <Text fz="sm" fw={700}>
                    {job.technician?.name ?? 'Unassigned'}
                  </Text>
                  <Text fz={10} c="dimmed" className="sp-mono">
                    {job.technician?.phone ?? 'No phone on file'}
                  </Text>
                </div>
              </Group>
            </Panel>
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={
          <Group gap="xs">
            <ShieldAlert size={20} color="#dc2626" />
            <Text fw={700}>Mark Site as Not Feasible</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <Alert color="red" variant="light" radius="md">
            Marking this survey as not feasible will update the site assessment, change the customer lead status to <b>LOST</b>, and alert the sales desk.
          </Alert>

          <Select
            label="Primary Unfeasibility Reason"
            required
            data={[
              'Severe shading from trees / tall neighboring buildings',
              'Weak roof structure / tile damage / load-bearing failure',
              'Insufficient shadow-free roof area for required capacity',
              'Excessive cable routing distance / severe DC voltage drop',
              'Customer cancelled / Resident Welfare Association refusal',
              'Rooftop water stagnation / waterproofing failure risk',
              'Other structural or electrical constraint',
            ]}
            value={rejectReason}
            onChange={(val) => setRejectReason(val ?? 'Other structural or electrical constraint')}
            allowDeselect={false}
          />

          <Textarea
            label="Detailed Technician Observations & Reason"
            placeholder="Explain why this roof cannot safely support the solar plant (e.g. 80% shaded by adjacent banyan tree, decaying wooden purlins, etc.)..."
            minRows={3}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(safeValue(e))}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<ShieldAlert size={15} />}
              loading={rejectFeasibilityMutation.isPending}
              onClick={() => rejectFeasibilityMutation.mutate()}
            >
              Confirm Not Feasible
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(previewPhoto)} onClose={() => setPreviewPhoto(null)} title="Job photo" size="xl">
        {previewPhoto && <Image src={assetUrl(previewPhoto)} alt="Job photo" radius="md" />}
      </Modal>
    </>
  );
}
