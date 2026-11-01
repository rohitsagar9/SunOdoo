'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Headphones,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wrench,
  Zap,
} from 'lucide-react';
import { z } from 'zod';
import { api, apiError } from '@/lib/api';

const solarCategories = [
  { value: 'Solar Inverter fault / Error code', label: '⚡ Inverter error code / Zero grid export' },
  { value: 'Rooftop Panels / PV Array damage', label: '☀️ Solar panel glass crack / shading / DC wiring' },
  { value: 'AC/DC Distribution & MCB Tripping', label: '🔌 AC/DC box tripping / neutral earth leakage' },
  { value: 'Solar Battery Bank backup failure', label: '🔋 Battery not charging / backup drop' },
  { value: 'Net-Metering & Generation reading', label: '📊 Bi-directional meter / export mismatch' },
  { value: 'Routine Cleaning & AMC check', label: '🧼 Panel washing / AMC health test' },
  { value: 'General Solar Technical query', label: '❓ Other solar breakdown / query' },
];

const inverterBrands = [
  { value: 'Growatt', label: 'Growatt' },
  { value: 'SolarEdge', label: 'SolarEdge' },
  { value: 'Havells / Enphase', label: 'Havells / Enphase' },
  { value: 'Microtek / Luminous', label: 'Microtek / Luminous' },
  { value: 'Sungrow / Delta', label: 'Sungrow / Delta' },
  { value: 'Polycab / Waaree', label: 'Polycab / Waaree' },
  { value: 'Other / Not sure', label: 'Other / Not sure' },
];

const systemSizes = [
  { value: '1 kW', label: '1 kW (Starter Home)' },
  { value: '2 kW', label: '2 kW (Compact Home)' },
  { value: '3 kW', label: '3 kW (Standard Home)' },
  { value: '4 kW', label: '4 kW (Medium Home)' },
  { value: '5 kW', label: '5 kW (Large Villa)' },
  { value: '10 kW+', label: '10 kW+ (Commercial / Factory)' },
];

const priorityOptions = [
  { value: 'URGENT', label: '🚨 Urgent breakdown (Total blackout / hazard)' },
  { value: 'HIGH', label: '⚡ High priority (Zero solar output / error LED)' },
  { value: 'MEDIUM', label: '⏱️ Normal (Low generation / routine query)' },
];

const schema = z.object({
  name: z
    .string()
    .min(2, 'Enter your full name')
    .regex(/^[A-Za-z\s.'-]+$/, 'Name should only contain letters and spaces'),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  systemSize: z.string().min(1, 'Select system size'),
  inverterBrand: z.string().optional(),
  category: z.string().min(1, 'Select solar fault category'),
  serialNumber: z.string().max(60).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  issue: z.string().min(10, 'Please describe what happened (at least 10 characters)'),
});

type IssueFormValues = z.infer<typeof schema>;

interface TicketResult {
  ticketNumber: string;
  status: string;
  warrantyStatus: string;
  customerName: string;
  inspectionJobNumber?: string;
  message: string;
}

export function PublicIssueForm() {
  const [result, setResult] = useState<TicketResult | null>(null);

  const form = useForm<IssueFormValues>({
    initialValues: {
      name: '',
      phone: '',
      systemSize: '3 kW',
      inverterBrand: 'Growatt',
      category: 'Solar Inverter fault / Error code',
      serialNumber: '',
      priority: 'HIGH',
      issue: '',
    },
    validate: (values) => {
      const parsed = schema.safeParse(values);
      if (parsed.success) return {};
      return parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const key = issue.path[0];
        if (typeof key === 'string' && !acc[key]) acc[key] = issue.message;
        return acc;
      }, {});
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: IssueFormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone,
        category: values.category,
        serialNumber: values.serialNumber || undefined,
        priority: values.priority,
        issue: `[${values.systemSize} System · ${values.inverterBrand || 'Inverter'}] ${values.issue}`,
      };
      const response = await api.post<TicketResult>('/public/tickets', payload);
      return response.data;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="xs" mb={4}>
        <div>
          <Group gap={6} align="center">
            <Text fw={800} fz="md" c="var(--sp-headings)">
              Fill Solar Breakdown Form
            </Text>
            <Badge size="xs" color="sun" variant="light">
              No Login Required
            </Badge>
          </Group>
          <Text fz={11} c="dimmed">
            Instant automatic warranty check & certified on-site technician dispatch
          </Text>
        </div>
      </Group>

      {result ? (
        <Stack gap="md">
          <Alert
            icon={<CheckCircle2 size={24} />}
            color="teal"
            radius="md"
            title={`Solar Ticket #${result.ticketNumber} Raised Successfully!`}
          >
            <Stack gap="xs" mt="xs">
              <Text fz="sm">
                Thank you, <b>{result.customerName}</b>. Your solar breakdown report has been registered in the engineering queue.
              </Text>
              <Group gap="xs" wrap="wrap">
                <Badge color="teal" variant="light">
                  Status: {result.status}
                </Badge>
                <Badge
                  color={result.warrantyStatus === 'IN_WARRANTY' ? 'teal' : 'yellow'}
                  variant="outline"
                  leftSection={<ShieldCheck size={12} />}
                >
                  Warranty: {result.warrantyStatus.replace('_', ' ')}
                </Badge>
                {result.inspectionJobNumber && (
                  <Badge color="indigo" variant="light" leftSection={<Wrench size={12} />}>
                    Inspection Job: #{result.inspectionJobNumber} (Scheduled Today)
                  </Badge>
                )}
              </Group>
              <Text fz="xs" c="dimmed">
                {result.message}
              </Text>
            </Stack>
          </Alert>

          <Paper p="sm" radius="md" withBorder style={{ background: 'var(--sp-card-subtle)' }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <div>
                <Text fz="xs" fw={700}>
                  Next Step: Certified Technician Site Inspection
                </Text>
                <Text fz={11} c="dimmed">
                  Technician inspects on site, diagnoses fault, and provides Repair (with budget) or Replacement assessment. Support will verify warranty and auto-approve.
                </Text>
              </div>
              <Button
                component={Link}
                href={`/portal?phone=${form.values.phone}`}
                color="sun"
                size="sm"
                rightSection={<ArrowRight size={14} />}
              >
                Track Live on Customer Portal
              </Button>
            </Group>
          </Paper>

          <Button
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => {
              setResult(null);
              form.reset();
            }}
          >
            Log another solar issue
          </Button>
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                Fill Solar Breakdown Form (No Login Required)
              </Text>
              <Badge size="xs" color="teal" variant="dot">
                Auto-Warranty Check
              </Badge>
            </Group>

            {mutation.isError && (
              <Alert color="red" radius="md" title="Could not submit issue" icon={<AlertCircle size={16} />}>
                {apiError(mutation.error)}
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <TextInput
                label="Full name"
                placeholder="Ramesh Gupta"
                required
                {...form.getInputProps('name')}
                onChange={(event) => {
                  const raw = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                  const val = String(raw).replace(/[^A-Za-z\s.'-]/g, '');
                  form.setFieldValue('name', val);
                }}
              />
              <TextInput
                label="Mobile number"
                placeholder="9876543210"
                required
                maxLength={10}
                {...form.getInputProps('phone')}
                onChange={(event) => {
                  const raw = event?.target?.value ?? (event?.currentTarget as any)?.value ?? '';
                  const val = String(raw).replace(/\D/g, '').slice(0, 10);
                  form.setFieldValue('phone', val);
                }}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <Select
                label="Solar plant size"
                required
                data={systemSizes}
                {...form.getInputProps('systemSize')}
              />
              <Select
                label="Inverter brand / model"
                data={inverterBrands}
                {...form.getInputProps('inverterBrand')}
              />
            </SimpleGrid>

            <Select
              label="Solar equipment & fault category"
              required
              data={solarCategories}
              {...form.getInputProps('category')}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <TextInput
                label="Inverter serial number (optional)"
                placeholder="e.g. SN-INV-5K-0016"
                description="Enables instant warranty coverage check"
                {...form.getInputProps('serialNumber')}
              />
              <Select
                label="Severity level"
                required
                data={priorityOptions}
                {...form.getInputProps('priority')}
              />
            </SimpleGrid>

            <Textarea
              label="Describe solar breakdown symptoms"
              placeholder="e.g. Inverter display is flashing Error 04 and generation dropped to zero since morning. Parapet shading is clear."
              required
              minRows={2}
              {...form.getInputProps('issue')}
            />

            <Button
              type="submit"
              color="sun"
              size="md"
              fullWidth
              loading={mutation.isPending}
              leftSection={<Send size={15} />}
            >
              Raise Solar Ticket & Dispatch Technician
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
