'use client';

import { Badge, Button, CopyButton, Group, Image, Paper, Stack, Text } from '@mantine/core';
import { Check, Copy, Smartphone } from 'lucide-react';
import { formatINR } from '@/lib/format';

export function PaymentQR({
  amount,
  title = 'Scan & pay with any UPI app',
  compact = false,
}: {
  amount?: number;
  title?: string;
  compact?: boolean;
}) {
  const upiId = process.env.NEXT_PUBLIC_UPI_ID ?? 'sunpower@upi';
  const upiName = process.env.NEXT_PUBLIC_UPI_NAME ?? 'SunPower Solutions';
  const isAboveUpiLimit = amount !== undefined && amount > 100000;
  const displayAmount = isAboveUpiLimit ? 100000 : amount;

  return (
    <Paper withBorder p={compact ? 'md' : 'lg'} radius="lg" bg="white">
      <Stack align="center" gap="sm">
        <Group gap={6}>
          <Smartphone size={16} color="#0f766e" />
          <Text fz="sm" fw={700}>
            {title}
          </Text>
        </Group>
        <Image
          src="/payments/upi-qr.svg"
          alt={`UPI QR code for ${upiName}`}
          w={compact ? 160 : 200}
          h={compact ? 160 : 200}
          fit="contain"
        />
        <Stack gap={2} align="center">
          <Text fw={800} fz={compact ? 'md' : 'lg'}>
            {upiName}
          </Text>
          <Text fz="xs" c="dimmed" className="sp-mono">
            {upiId}
          </Text>
        </Stack>
        {amount !== undefined && (
          <Stack align="center" gap={4}>
            <Badge size="lg" color="sun" variant="light">
              {formatINR(displayAmount ?? 0)}
              {isAboveUpiLimit && ' (UPI Tranche Limit)'}
            </Badge>
            {isAboveUpiLimit && (
              <Text fz={11} c="orange.8" fw={600} ta="center">
                NPCI UPI rule: ₹1,00,000 max per transfer. Transfer in ₹1L parts or use NEFT/RTGS.
              </Text>
            )}
          </Stack>
        )}
        <CopyButton value={upiId}>
          {({ copied, copy }) => (
            <Button
              size="compact-sm"
              variant="subtle"
              color={copied ? 'teal' : 'gray'}
              leftSection={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={copy}
            >
              {copied ? 'UPI ID copied' : 'Copy UPI ID'}
            </Button>
          )}
        </CopyButton>
        <Text fz={10} c="dimmed" ta="center">
          After paying, upload the screenshot below. Our office verifies it and marks the order paid.
        </Text>
      </Stack>
    </Paper>
  );
}
