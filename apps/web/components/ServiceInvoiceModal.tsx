'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Image,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
  UserRound,
  Wrench,
  Zap,
} from 'lucide-react';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { assetUrl } from '@/lib/api';
import type { Customer, Invoice, Job, JobPhoto, JobSignature, Ticket } from '@/lib/types';

interface ServiceInvoiceModalProps {
  opened: boolean;
  onClose: () => void;
  invoice: Invoice;
  ticket?: Ticket | null;
  job?: Job | null;
  customer: Customer;
  signature?: JobSignature | null;
  photos?: JobPhoto[];
}

export function ServiceInvoiceModal({
  opened,
  onClose,
  invoice,
  ticket,
  job,
  customer,
  signature,
  photos = [],
}: ServiceInvoiceModalProps) {
  const isWarranty = ticket?.warrantyStatus === 'IN_WARRANTY' || invoice.total === 0;
  const isPaid = invoice.status === 'PAID' || isWarranty;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownload = () => {
    if (typeof window !== 'undefined') {
      const text = `
========================================================================
SUNODOO ENERGY SOLUTIONS PVT. LTD. - SERVICE TAX INVOICE
========================================================================
Invoice Number : ${invoice.invoiceNumber}
Date           : ${formatDateTime(invoice.createdAt)}
Service Ticket : ${ticket?.ticketNumber || 'N/A'}
Service Job    : ${job?.jobNumber || 'N/A'}
Warranty Status: ${isWarranty ? 'IN WARRANTY (100% Free Coverage)' : 'BILLABLE (Out of Warranty)'}

CUSTOMER DETAILS:
Name           : ${customer.name}
Phone          : ${customer.phone}
Address        : ${customer.address}${customer.city ? `, ${customer.city}` : ''}

EQUIPMENT / SERVICE DETAILS:
Service Type   : Solar Breakdown Diagnostics & Repair
Fault / Issue  : ${ticket?.issue || job?.notes || 'General Service Visit'}
Replaced Part  : ${ticket?.replacementPart || 'Component Servicing & Inverter Testing'}
Resolution     : ${ticket?.resolution || job?.completionNotes || 'Resolved on site'}

CHARGES BREAKDOWN:
1. Technical Diagnostics & Service Visit : ₹800 ${isWarranty ? '[-₹800 Warranty Discount = ₹0]' : ''}
2. Replacement Parts / Components        : ₹${ticket?.partsCharge || 4500} ${isWarranty ? '[-100% Free Warranty = ₹0]' : ''}
------------------------------------------------------------------------
Subtotal       : ${formatINR(invoice.subtotal)}
GST (18%)      : ${formatINR(invoice.taxAmount)}
TOTAL BILL     : ${formatINR(invoice.total)}
PAYMENT STATUS : ${isPaid ? 'PAID / ZERO BALANCE' : 'PAYMENT PENDING'}
========================================================================
Customer Signer: ${signature?.signerName || customer.name}
Attending Tech : ${job?.technician?.name || 'Authorized Field Engineer'}
========================================================================
`;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}-Service-Bill.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="md"
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="sun" variant="light">
            <FileText size={16} />
          </ThemeIcon>
          <div>
            <Text fz="sm" fw={800} className="sp-mono">
              {invoice.invoiceNumber}
            </Text>
            <Text fz={10} c="dimmed">
              Official SolarCare™ Service Tax Invoice & Receipt
            </Text>
          </div>
        </Group>
      }
      styles={{
        header: {
          borderBottom: '1px solid var(--sp-border)',
          paddingBottom: '10px',
        },
        body: {
          padding: '16px',
        },
      }}
    >
      <Box id="printable-service-invoice">
        {/* Company Header */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: 'var(--sp-card-subtle, rgba(0, 0, 0, 0.02))',
            borderColor: 'var(--sp-border)',
          }}
          mb="md"
        >
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Group gap={6} align="center">
                <Zap size={18} color="#f59e0b" />
                <Text fz="md" fw={900} c="sun">
                  SunOdoo Energy Solutions
                </Text>
              </Group>
              <Text fz={10} c="dimmed" mt={2}>
                SolarCare™ Quick Response & Service Division
              </Text>
              <Text fz={10} c="dimmed">
                GSTIN: 36AAACS1234F1Z5 · HSN/SAC: 998719
              </Text>
              <Text fz={10} c="dimmed">
                24/7 Helpline: 1800-SUN-ODOO | +91 90000 00006
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Badge
                color={isPaid ? 'teal' : 'orange'}
                variant="filled"
                size="md"
                leftSection={isPaid ? <CheckCircle2 size={12} /> : undefined}
              >
                {isPaid ? (isWarranty ? 'PAID · ZERO CHARGE' : 'PAID IN FULL') : 'PAYMENT DUE'}
              </Badge>
              <Text fz={10} c="dimmed" mt={4} className="sp-mono">
                Date: {formatDate(invoice.createdAt)}
              </Text>
              {ticket && (
                <Text fz={10} c="dimmed" className="sp-mono">
                  Ticket: #{ticket.ticketNumber}
                </Text>
              )}
              {job && (
                <Text fz={10} c="dimmed" className="sp-mono">
                  Job: #{job.jobNumber}
                </Text>
              )}
            </div>
          </Group>
        </Paper>

        {/* Customer & System Details */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="md">
          <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--sp-border)' }}>
            <Group gap={6} mb={4}>
              <UserRound size={13} color="#94a3b8" />
              <Text fz={11} fw={700} c="dimmed" tt="uppercase">
                Customer Details
              </Text>
            </Group>
            <Text fz="sm" fw={800}>
              {customer.name}
            </Text>
            <Group gap={4} mt={2}>
              <Phone size={12} color="#94a3b8" />
              <Text fz={11} className="sp-mono" c="dimmed">
                {customer.phone}
              </Text>
            </Group>
            <Group gap={4} mt={2}>
              <MapPin size={12} color="#94a3b8" />
              <Text fz={11} c="dimmed">
                {customer.address}
                {customer.city ? `, ${customer.city}` : ''}
              </Text>
            </Group>
          </Paper>

          <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--sp-border)' }}>
            <Group gap={6} mb={4}>
              <ShieldCheck size={13} color={isWarranty ? '#0f766e' : '#d97706'} />
              <Text fz={11} fw={700} c={isWarranty ? 'teal.7' : 'orange.7'} tt="uppercase">
                Warranty & Equipment
              </Text>
            </Group>
            <Badge color={isWarranty ? 'teal' : 'gray'} variant="light" size="xs">
              {isWarranty ? '✓ Active 10-Yr Solar Warranty' : 'Out of Warranty (Standard Rates)'}
            </Badge>
            <Text fz={11} c="dimmed" mt={4}>
              <strong>Issue Reported:</strong> {ticket?.issue || job?.notes || 'Solar breakdown diagnosis'}
            </Text>
            {ticket?.replacementPart && (
              <Text fz={11} c="dimmed">
                <strong>Component:</strong> {ticket.replacementPart}
              </Text>
            )}
          </Paper>
        </SimpleGrid>

        {/* Itemized Charges Table */}
        <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--sp-border)' }} mb="md">
          <Text fz={11} fw={700} c="dimmed" tt="uppercase" mb="xs">
            Itemized Service Charges & Tax Summary
          </Text>
          <Table verticalSpacing={6} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Service Item / Description</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Warranty Coverage</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <Text fz="xs" fw={600}>
                    On-Site Diagnostic & Labor Visit
                  </Text>
                  <Text fz={10} c="dimmed">
                    Technician testing, safety verification & fault isolation
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {isWarranty ? (
                    <Badge color="teal" size="xs" variant="light">
                      100% Free
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} className="sp-mono">
                  {isWarranty ? '₹0' : formatINR(ticket?.laborCharge || 800)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Text fz="xs" fw={600}>
                    {ticket?.replacementPart || 'Component Servicing & Inverter Testing'}
                  </Text>
                  <Text fz={10} c="dimmed">
                    Genuine OEM solar components & commissioning
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {isWarranty ? (
                    <Badge color="teal" size="xs" variant="light">
                      100% Free
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} className="sp-mono">
                  {isWarranty ? '₹0' : formatINR(ticket?.partsCharge || invoice.subtotal || 0)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text fz="xs" fw={600}>
                    Subtotal
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} className="sp-mono">
                  {formatINR(invoice.subtotal)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text fz="xs" c="dimmed">
                    GST @ {invoice.taxRate}% (CGST + SGST)
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} className="sp-mono">
                  {formatINR(invoice.taxAmount)}
                </Table.Td>
              </Table.Tr>

              <Table.Tr style={{ borderTop: '2px solid var(--sp-border)' }}>
                <Table.Td colSpan={2}>
                  <Text fz="sm" fw={800}>
                    Total Amount Due
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fz="md" fw={900} className="sp-mono" c={isPaid ? 'teal.7' : 'orange.7'}>
                    {isWarranty ? '₹0 (Warranty Covered)' : formatINR(invoice.total)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Customer Signature & Verification Sign-Off */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="md">
          <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--sp-border)' }}>
            <Text fz={10} fw={700} c="dimmed" tt="uppercase" mb={4}>
              Customer Acceptance & Signature
            </Text>
            {signature?.dataUrl ? (
              <Box
                style={{
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.02)',
                  borderRadius: 4,
                  padding: 4,
                }}
              >
                <Image
                  src={signature.dataUrl}
                  alt="Customer Signature"
                  fit="contain"
                  h={50}
                  w="auto"
                />
              </Box>
            ) : (
              <Text fz="xs" fs="italic" c="dimmed" py="xs">
                Digitally confirmed on site
              </Text>
            )}
            <Text fz={11} fw={700} mt={4}>
              Signed by: {signature?.signerName || customer.name}
            </Text>
            <Text fz={10} c="dimmed">
              Time: {formatDateTime(signature?.signedAt || job?.completedAt || invoice.createdAt)}
            </Text>
          </Paper>

          <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--sp-border)' }}>
            <Text fz={10} fw={700} c="dimmed" tt="uppercase" mb={4}>
              Attending SolarCare™ Technician
            </Text>
            <Group gap="xs" mt={4}>
              <ThemeIcon size={28} radius="xl" color="grape" variant="light">
                <Wrench size={14} />
              </ThemeIcon>
              <div>
                <Text fz="xs" fw={700}>
                  {job?.technician?.name || 'Arun Kumar (Senior Technician)'}
                </Text>
                <Text fz={10} c="dimmed">
                  ID: TECH-HYD-04 · Mobile: +91 98765 00004
                </Text>
              </div>
            </Group>
            <Text fz={10} c="teal.7" fw={700} mt={6}>
              ✓ Certified Service Completed & System Tested
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Photos if attached */}
        {photos.length > 0 && (
          <Box mb="md">
            <Text fz={10} fw={700} c="dimmed" tt="uppercase" mb={4}>
              Service Site Proof Photos ({photos.length})
            </Text>
            <Group gap="xs">
              {photos.map((p) => (
                <Box
                  key={p.id}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--sp-border)',
                  }}
                >
                  <Image src={assetUrl(p.url)} alt="Proof" fit="cover" w={60} h={60} />
                </Box>
              ))}
            </Group>
          </Box>
        )}

        {/* Modal Actions */}
        <Divider my="sm" />
        <Group justify="space-between" wrap="wrap">
          <Button variant="default" size="xs" onClick={onClose}>
            Close
          </Button>
          <Group gap="xs">
            <Button
              variant="light"
              color="gray"
              size="xs"
              leftSection={<Download size={13} />}
              onClick={handleDownload}
            >
              Download Bill
            </Button>
            <Button
              color="sun"
              size="xs"
              leftSection={<Printer size={13} />}
              onClick={handlePrint}
            >
              Print Tax Invoice
            </Button>
          </Group>
        </Group>
      </Box>
    </Modal>
  );
}
