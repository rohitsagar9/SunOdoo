'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  QrCode,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import type { Order, Payment } from '@/lib/types';

interface RecordOfflinePaymentModalProps {
  opened: boolean;
  onClose: () => void;
  initialOrderId?: string;
  initialOrder?: Order;
  onSuccess?: (payment: Payment) => void;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash (Office Counter / In-Hand)', icon: Banknote },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT / RTGS / IMPS)', icon: Building2 },
  { value: 'CHEQUE', label: 'Cheque / Demand Draft', icon: FileText },
  { value: 'CARD', label: 'Card / POS Terminal', icon: CreditCard },
  { value: 'UPI', label: 'Direct UPI / QR Transfer', icon: QrCode },
];

const PAYMENT_TYPES = [
  { value: 'ADVANCE', label: 'Advance Payment' },
  { value: 'BALANCE', label: 'Balance Payment' },
  { value: 'FULL', label: 'Full Settlement (100%)' },
];

export function RecordOfflinePaymentModal({
  opened,
  onClose,
  initialOrderId,
  initialOrder,
  onSuccess,
}: RecordOfflinePaymentModalProps) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['orders', 'for-offline-payment'],
    queryFn: async () => {
      const res = await api.get<Order[]>('/orders');
      return res.data;
    },
    enabled: opened,
  });

  const orders = ordersQuery.data ?? [];

  const [orderId, setOrderId] = useState<string>(initialOrderId ?? initialOrder?.id ?? '');
  const [amount, setAmount] = useState<number | string>(0);
  const [method, setMethod] = useState<string>('CASH');
  const [type, setType] = useState<string>('BALANCE');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);

  // Find currently selected order
  const selectedOrder = useMemo(() => {
    if (initialOrder && initialOrder.id === orderId) return initialOrder;
    return orders.find((o) => o.id === orderId) ?? null;
  }, [orders, orderId, initialOrder]);

  // Sync when modal opens or initialOrder / initialOrderId changes
  useEffect(() => {
    if (opened) {
      const targetId = initialOrderId ?? initialOrder?.id ?? '';
      setOrderId(targetId);
      if (initialOrder) {
        setupDefaultsForOrder(initialOrder);
      }
    }
  }, [opened, initialOrderId, initialOrder]);

  function setupDefaultsForOrder(order: Order) {
    const bal = order.balanceDue;
    if (bal > 0) {
      setAmount(bal);
      setType(order.advancePaid > 0 ? 'BALANCE' : 'ADVANCE');
    } else {
      setAmount(order.total);
      setType('FULL');
    }
    setAutoApprove(true);
  }

  // Handle user picking an order from select dropdown
  const handleSelectOrder = (newOrderId: string | null) => {
    const id = newOrderId ?? '';
    setOrderId(id);
    const ord = orders.find((o) => o.id === id);
    if (ord) {
      setupDefaultsForOrder(ord);
    }
  };

  // Order dropdown options
  const orderSelectData = useMemo(() => {
    return orders.map((o) => {
      const balStr = formatINR(o.balanceDue);
      const totalStr = formatINR(o.total);
      return {
        value: o.id,
        label: `${o.orderNumber} · ${o.customer?.name ?? 'Customer'} (Bal: ${balStr} / ${totalStr})`,
      };
    });
  }, [orders]);

  const recordMutation = useMutation({
    mutationFn: async () => {
      const numAmount = typeof amount === 'number' ? amount : parseInt(String(amount), 10);
      if (!orderId) throw new Error('Please select an order');
      if (!numAmount || numAmount <= 0) throw new Error('Payment amount must be greater than 0');

      const payload = {
        orderId,
        amount: numAmount,
        method,
        type,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        autoApprove,
      };

      const res = await api.post<Payment>('/payments', payload);
      return res.data;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      notifications.show({
        title: autoApprove ? 'Offline payment completed & approved' : 'Payment recorded',
        message: autoApprove
          ? `${formatINR(payment.amount)} collected via ${payment.method}. Order balance and status updated.`
          : `${formatINR(payment.amount)} queued for verification.`,
        color: 'teal',
      });

      onSuccess?.(payment);
      onClose();
    },
    onError: (err) => {
      notifications.show({
        title: 'Could not record offline payment',
        message: apiError(err),
        color: 'red',
      });
    },
  });

  const getReferencePlaceholder = () => {
    switch (method) {
      case 'CASH':
        return 'Receipt # / Cash voucher no. (e.g. CR-1049)';
      case 'BANK_TRANSFER':
        return 'Bank UTR / Transaction reference (e.g. UTR92837492)';
      case 'CHEQUE':
        return 'Cheque no. & Issuing bank (e.g. #409218 - SBI)';
      case 'CARD':
        return 'POS slip no. / Auth code (e.g. POS-9938)';
      case 'UPI':
        return 'UPI reference no. (e.g. 9938210921)';
      default:
        return 'Receipt or transaction reference';
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="teal" variant="light">
            <Banknote size={16} />
          </ThemeIcon>
          <div>
            <Text fw={700} fz="md">
              Record Offline Payment
            </Text>
            <Text fz={11} c="dimmed">
              Direct sales & office counter collection
            </Text>
          </div>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {!initialOrderId && !initialOrder && (
          <Select
            label="Select Order"
            placeholder={ordersQuery.isLoading ? 'Loading orders…' : 'Search by order number or customer name'}
            data={orderSelectData}
            value={orderId}
            onChange={handleSelectOrder}
            searchable
            clearable
            required
            nothingFoundMessage="No orders found"
          />
        )}

        {selectedOrder && (
          <Paper p="sm" withBorder radius="md" bg="var(--sp-card-muted, #f8fafc)">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Group gap="xs">
                  <Text fz="sm" fw={700}>
                    {selectedOrder.customer?.name}
                  </Text>
                  <Badge size="xs" variant="light" color="blue">
                    {selectedOrder.orderNumber}
                  </Badge>
                  <Badge size="xs" variant="outline" color="gray">
                    {selectedOrder.status}
                  </Badge>
                </Group>
                <Text fz={11} c="dimmed" mt={2}>
                  Phone: {selectedOrder.customer?.phone ?? '—'}
                </Text>
              </div>

              <SimpleGrid cols={3} spacing="xs">
                <div>
                  <Text fz={10} c="dimmed">
                    Total
                  </Text>
                  <Text fz="xs" fw={700}>
                    {formatINR(selectedOrder.total)}
                  </Text>
                </div>
                <div>
                  <Text fz={10} c="dimmed">
                    Advance Paid
                  </Text>
                  <Text fz="xs" fw={700} c="teal">
                    {formatINR(selectedOrder.advancePaid)}
                  </Text>
                </div>
                <div>
                  <Text fz={10} c="dimmed">
                    Balance Due
                  </Text>
                  <Text fz="xs" fw={700} c={selectedOrder.balanceDue > 0 ? 'orange' : 'teal'}>
                    {formatINR(selectedOrder.balanceDue)}
                  </Text>
                </div>
              </SimpleGrid>
            </Group>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <NumberInput
            label="Payment Amount (₹)"
            description="Amount collected from customer"
            placeholder="e.g. 50000"
            value={amount}
            onChange={setAmount}
            min={1}
            thousandSeparator=","
            required
            leftSection={<Text fz="xs" fw={700}>₹</Text>}
          />

          <Select
            label="Payment Method"
            description="Mode of offline receipt"
            data={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            value={method}
            onChange={(val) => setMethod(val ?? 'CASH')}
            required
          />
        </SimpleGrid>

        {selectedOrder && selectedOrder.balanceDue > 0 && (
          <Group gap="xs">
            <Text fz="xs" c="dimmed">
              Quick fill:
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              color="orange"
              onClick={() => {
                setAmount(selectedOrder.balanceDue);
                setType(selectedOrder.advancePaid > 0 ? 'BALANCE' : 'ADVANCE');
              }}
            >
              Clear full balance ({formatINR(selectedOrder.balanceDue)})
            </Button>
            {selectedOrder.advancePaid === 0 && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="teal"
                onClick={() => {
                  const adv = Math.round(selectedOrder.total * 0.2); // ~20% advance if applicable
                  setAmount(adv);
                  setType('ADVANCE');
                }}
              >
                20% Advance ({formatINR(Math.round(selectedOrder.total * 0.2))})
              </Button>
            )}
          </Group>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Payment Type"
            data={PAYMENT_TYPES}
            value={type}
            onChange={(val) => setType(val ?? 'BALANCE')}
            required
          />

          <TextInput
            label="Receipt / Reference Number"
            placeholder={getReferencePlaceholder()}
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        </SimpleGrid>

        <Textarea
          label="Notes / Counter Remarks"
          placeholder="e.g. Handed over at office counter to sales team"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          rows={2}
        />

        <Divider my="xs" />

        <Paper p="sm" withBorder radius="md" bg={autoApprove ? 'rgba(16, 185, 129, 0.05)' : undefined}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Group gap={6}>
                <Text fz="sm" fw={700}>
                  Transaction Completed Offline
                </Text>
                <Badge size="xs" color={autoApprove ? 'teal' : 'gray'} variant="light">
                  {autoApprove ? 'Auto-Approve' : 'Queue as Pending'}
                </Badge>
              </Group>
              <Text fz={11} c="dimmed" mt={2}>
                Immediately mark payment as APPROVED, clear the order balance due, and trigger downstream workflow.
              </Text>
            </div>
            <Switch
              size="md"
              color="teal"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.currentTarget.checked)}
            />
          </Group>
        </Paper>

        {autoApprove ? (
          <Alert color="teal" variant="light" icon={<ShieldCheck size={16} />}>
            Approved payment will automatically reflect in the Office queue, reduce order balance due, and update invoice status.
          </Alert>
        ) : (
          <Alert color="blue" variant="light" icon={<AlertCircle size={16} />}>
            Payment will be added to the queue under Pending status for office verification.
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose} disabled={recordMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="teal"
            leftSection={<CheckCircle2 size={16} />}
            loading={recordMutation.isPending}
            onClick={() => recordMutation.mutate()}
            disabled={!orderId || !amount || Number(amount) <= 0}
          >
            {autoApprove ? 'Complete & Record Offline Payment' : 'Save Payment'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
