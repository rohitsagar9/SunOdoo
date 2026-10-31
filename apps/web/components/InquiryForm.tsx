'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Group,
  NumberInput,
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
import { CheckCircle2, Send, Zap } from 'lucide-react';
import { z } from 'zod';
import { api, apiError } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  phone: z.string().min(10, 'Enter a 10-digit mobile number').max(15),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().min(5, 'Enter your installation address'),
  city: z.string().optional(),
  pincode: z.string().max(10).optional(),
  requestedKw: z.number().min(1).max(5),
  systemType: z.enum(['ON_GRID', 'OFF_GRID']),
  monthlyBill: z.number().min(0).optional(),
  roofAreaSqft: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

type InquiryValues = z.infer<typeof schema>;

export function InquiryForm() {
  const [reference, setReference] = useState<string | null>(null);

  const form = useForm<InquiryValues>({
    initialValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      pincode: '',
      requestedKw: 3,
      systemType: 'ON_GRID',
      monthlyBill: 4000,
      roofAreaSqft: 600,
      notes: '',
    },
    validate: (values) => {
      const result = schema.safeParse(values);
      if (result.success) return {};
      return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
        return errors;
      }, {});
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: InquiryValues) => {
      const response = await api.post<{ reference: string; message: string }>(
        '/public/inquiries',
        values,
      );
      return response.data;
    },
    onSuccess: (data) => {
      setReference(data.reference);
      form.reset();
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack gap="sm">
        <Group gap="sm" mb={2}>
          <ThemeIcon color="sun" variant="light" radius="md">
            <Zap size={18} />
          </ThemeIcon>
          <div>
            <Text fw={800} fz="md">
              Get a free rooftop quote
            </Text>
            <Text fz="xs" c="dimmed">
              Your enquiry lands directly in the sales dashboard — not an inbox.
            </Text>
          </div>
        </Group>

        {reference && (
          <Alert
            icon={<CheckCircle2 size={18} />}
            color="teal"
            title="Enquiry received"
            radius="md"
          >
            Reference <b>{reference}</b>. Our sales team will call you within one working day.
          </Alert>
        )}

        {mutation.isError && (
          <Alert color="red" radius="md" title="Could not send enquiry">
            {apiError(mutation.error)}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput label="Full name" placeholder="Ananya Sharma" required {...form.getInputProps('name')} />
          <TextInput
            label="Mobile number"
            placeholder="98765 43210"
            required
            {...form.getInputProps('phone')}
          />
        </SimpleGrid>

        <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps('email')} />
        <TextInput
          label="Installation address"
          placeholder="House / flat, street, area"
          required
          {...form.getInputProps('address')}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput label="City" placeholder="Bengaluru" {...form.getInputProps('city')} />
          <TextInput label="PIN code" placeholder="560034" {...form.getInputProps('pincode')} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label="System size"
            suffix=" kW"
            min={1}
            max={5}
            required
            {...form.getInputProps('requestedKw')}
          />
          <Select
            label="System type"
            data={[
              { value: 'ON_GRID', label: 'On-Grid (grid connected)' },
              { value: 'OFF_GRID', label: 'Off-Grid (battery backup)' },
            ]}
            required
            {...form.getInputProps('systemType')}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label="Monthly electricity bill"
            prefix="₹"
            min={0}
            thousandSeparator=","
            {...form.getInputProps('monthlyBill')}
          />
          <NumberInput
            label="Shadow-free roof area"
            suffix=" sq ft"
            min={0}
            thousandSeparator=","
            {...form.getInputProps('roofAreaSqft')}
          />
        </SimpleGrid>

        <Textarea
          label="Anything else?"
          placeholder="Subsidy support, battery backup, roof type…"
          autosize
          minRows={2}
          maxRows={4}
          {...form.getInputProps('notes')}
        />

        <Button
          type="submit"
          size="md"
          fullWidth
          loading={mutation.isPending}
          rightSection={<Send size={16} />}
          color="sun"
        >
          Send enquiry to sales team
        </Button>
        <Text fz={10} c="dimmed" ta="center">
          No spam. Your details are used only to prepare your solar quote.
        </Text>
      </Stack>
    </form>
  );
}
