'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { formatDate, formatINR, safeValue, titleCase } from '@/lib/format';
import type { Quote } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

export default function QuotesPage() {
  return (
    <RoleGate roles={['SALES', 'DIRECTOR']}>
      <QuotesList />
    </RoleGate>
  );
}

function QuotesList() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('ALL');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('status');
    if (value && statusOptions.some((option) => option.value === value)) setStatus(value);
  }, []);

  const query = useQuery({
    queryKey: ['quotes', debouncedSearch, status],
    queryFn: async () => {
      const response = await api.get<Quote[]>('/quotes', {
        params: {
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(status !== 'ALL' ? { status } : {}),
        },
      });
      return response.data;
    },
  });

  const quotes = query.data ?? [];
  const pipeline = quotes
    .filter((quote) => ['SENT', 'DRAFT'].includes(quote.status))
    .reduce((sum, quote) => sum + quote.total, 0);
  const accepted = quotes
    .filter((quote) => quote.status === 'ACCEPTED')
    .reduce((sum, quote) => sum + quote.total, 0);
  const sentCount = quotes.filter((quote) => quote.status === 'SENT').length;
  const acceptedCount = quotes.filter((quote) => quote.status === 'ACCEPTED').length;

  async function copyLink(quote: Quote) {
    const url = `${window.location.origin}/q/${quote.publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      notifications.show({
        title: 'Customer link copied',
        message: 'Share it on WhatsApp — the customer can accept and pay without logging in.',
        color: 'teal',
      });
    } catch {
      notifications.show({ title: 'Copy failed', message: url, color: 'orange' });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Quotes"
        description="Itemised 1–5 kW bills of materials, customer share links and acceptance status."
        actions={
          <>
            <Button
              component={Link}
              href="/dashboard/leads"
              leftSection={<Plus size={15} />}
              color="sun"
            >
              New from lead
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

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Open pipeline"
          value={formatINR(pipeline, true)}
          hint={`${sentCount} sent quote${sentCount === 1 ? '' : 's'}`}
          icon={FileText}
          color="sun"
        />
        <StatCard
          label="Accepted value"
          value={formatINR(accepted, true)}
          hint={`${acceptedCount} accepted`}
          icon={TrendingUp}
          color="teal"
        />
        <StatCard
          label="Quotes shown"
          value={String(quotes.length)}
          hint={status === 'ALL' ? 'All statuses' : titleCase(status)}
          icon={Wallet}
          color="ocean"
        />
        <StatCard
          label="Average quote"
          value={quotes.length ? formatINR(Math.round(quotes.reduce((sum, q) => sum + q.total, 0) / quotes.length), true) : '₹0'}
          hint="Across the filtered list"
          icon={ArrowRight}
          color="indigo"
        />
      </SimpleGrid>

      <Panel padding="md" className="sp-no-print">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap="sm">
            <TextInput
              placeholder="Search quote number, customer or phone…"
              leftSection={<Search size={15} />}
              value={search}
              onChange={(event) => setSearch(safeValue(event))}
              w={{ base: '100%', sm: 340 }}
            />
            <Select
              data={statusOptions}
              value={status}
              onChange={(value) => setStatus(value ?? 'ALL')}
              allowDeselect={false}
              w={{ base: '100%', sm: 170 }}
            />
          </Group>
          <Text fz="xs" c="dimmed">
            Quotes are generated from an approved survey. Share the public link for one-click acceptance.
          </Text>
        </Group>
      </Panel>

      <Stack mt="md" gap="md">
        {query.isLoading && <LoadingState label="Loading quotes…" />}
        {query.isError && (
          <Alert color="red" title="Could not load quotes">
            {apiError(query.error)}
          </Alert>
        )}
        {!query.isLoading && !query.isError && quotes.length === 0 && (
          <EmptyState
            title="No quotes match this view"
            description="Generate a quote from an approved lead survey, or clear the filters."
            action={
              <Button component={Link} href="/dashboard/leads" color="sun">
                Go to leads
              </Button>
            }
          />
        )}
        {quotes.length > 0 && (
          <Panel padding={0}>
            <ScrollArea>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={900}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quote</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>System</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Valid until</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th ta="right">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {quotes.map((quote) => (
                    <Table.Tr key={quote.id}>
                      <Table.Td>
                        <Text
                          fz="sm"
                          fw={700}
                          component={Link}
                          href={`/dashboard/quotes/${quote.id}`}
                          className="sp-mono"
                        >
                          {quote.quoteNumber}
                        </Text>
                        {quote.order && (
                          <Badge size="xs" variant="light" color="teal" mt={3}>
                            {quote.order.orderNumber}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" fw={600}>
                          {quote.customer.name}
                        </Text>
                        <Text fz={10} c="dimmed" className="sp-mono">
                          {quote.customer.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">
                          {quote.capacityKw} kW · {titleCase(quote.systemType)}
                        </Text>
                        <Text fz={10} c="dimmed">
                          {quote.items.length} line items
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" fw={800} className="sp-mono">
                          {formatINR(quote.total)}
                        </Text>
                        <Text fz={10} c="dimmed">
                          Adv {formatINR(quote.advanceAmount, true)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge status={quote.status} />
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs">{formatDate(quote.validUntil)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs" c="dimmed">
                          {formatDate(quote.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="gray"
                            leftSection={<Copy size={12} />}
                            onClick={() => copyLink(quote)}
                          >
                            Link
                          </Button>
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="sun"
                            component="a"
                            href={`/q/${quote.publicToken}`}
                            target="_blank"
                            leftSection={<ExternalLink size={12} />}
                          >
                            Open
                          </Button>
                          <Button
                            size="compact-xs"
                            color="sun"
                            component={Link}
                            href={`/dashboard/quotes/${quote.id}`}
                            rightSection={<ArrowRight size={12} />}
                          >
                            View
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Panel>
        )}
      </Stack>
    </>
  );
}
