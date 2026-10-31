'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
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
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  IndianRupee,
  LogIn,
  LogOut,
  MapPin,
  PenLine,
  Phone,
  ShieldCheck,
  Signature,
  SunMedium,
  Upload,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { api, apiError, assetUrl } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, formatTime, titleCase } from '@/lib/format';
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
    }
  }, [job?.id]);

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

  const completeMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/jobs/${id}/complete`, {
          completionNotes: completion.notes || undefined,
          systemSizeKw: completion.systemSizeKw || undefined,
          testResult: completion.testResult || undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Job completed',
        message: 'The order is marked installed and warranty records are live.',
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
  const isInstallation = job.type === 'INSTALLATION';
  const signatureReady = Boolean(job.signature);
  const photosReady = photos.length > 0;
  const canComplete = !isInstallation || (signatureReady && photosReady);

  return (
    <>
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
              Photos
            </Text>
            <Camera size={15} color="#64748b" />
          </Group>
          <Text fz={22} fw={800} className="sp-mono">
            {photos.length}
          </Text>
          <Text fz={10} c="dimmed">
            {photosReady ? 'Finished-roof proof attached' : 'At least one required'}
          </Text>
        </Paper>
        <Paper p="md" className="sp-soft-card">
          <Group justify="space-between" mb={4}>
            <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
              Signature
            </Text>
            <Signature size={15} color="#64748b" />
          </Group>
          <Text fz={22} fw={800} className="sp-mono">
            {signatureReady ? 'Signed' : 'Pending'}
          </Text>
          <Text fz={10} c="dimmed">
            {job.signature ? job.signature.signerName : 'Customer sign-off required'}
          </Text>
        </Paper>
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

            <Panel
              title="Roof & installation photos"
              subtitle="At least one finished-roof photo is required before completion"
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
                      placeholder="South roof array after commissioning"
                      value={photoCaption}
                      onChange={(event) => setPhotoCaption(event.currentTarget.value)}
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
                  No photos yet. Capture the finished array, inverter display and earthing before
                  leaving site.
                </Alert>
              )}
            </Panel>

            <Panel
              title="Customer signature"
              subtitle="The sign-off is stored against the job and shown on the order"
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
                    onChange={(event) => setSignerName(event.currentTarget.value)}
                  />
                  <SignaturePad onChange={setSignatureData} />
                  <Group justify="flex-end">
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

            <Panel
              title="Complete job"
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
                      setCompletion((current) => ({ ...current, testResult: event.currentTarget.value }))
                    }
                  />
                </SimpleGrid>
                <Textarea
                  label="Completion notes"
                  placeholder="Work completed, handover notes, net-metering status…"
                  minRows={3}
                  value={completion.notes}
                  onChange={(event) =>
                    setCompletion((current) => ({ ...current, notes: event.currentTarget.value }))
                  }
                />
                <Group justify="space-between" wrap="wrap">
                  <Group gap="lg">
                    <Group gap={6}>
                      <CheckCircle2 size={14} color={photosReady ? '#0f766e' : '#94a3b8'} />
                      <Text fz={11} c={photosReady ? 'teal.7' : 'dimmed'}>
                        Photos
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
                      {job.status === 'COMPLETED' ? 'Job completed' : 'Complete job'}
                    </Button>
                  ) : (
                    <Text fz="xs" c="dimmed">
                      Technician or director sign-off required.
                    </Text>
                  )}
                </Group>
              </Stack>
            </Panel>

            {order && (
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
                          setSite((current) => ({ ...current, reference: event.currentTarget.value }))
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
                          setSite((current) => ({ ...current, notes: event.currentTarget.value }))
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

      <Modal opened={Boolean(previewPhoto)} onClose={() => setPreviewPhoto(null)} title="Job photo" size="xl">
        {previewPhoto && <Image src={assetUrl(previewPhoto)} alt="Job photo" radius="md" />}
      </Modal>
    </>
  );
}
