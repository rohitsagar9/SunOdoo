'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  CopyButton,
  Grid,
  Group,
  Image,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  Check,
  Copy,
  Download,
  FolderOpen,
  Hash,
  Layers,
  ListFilter,
  Printer,
  QrCode,
  Search,
  Sparkles,
  Tags,
  Warehouse,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatINR, safeValue, titleCase } from '@/lib/format';
import type { InventoryUnit } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState, LoadingState } from '@/components/States';
import { Panel } from '@/components/dashboard/Panel';
import { RoleGate } from '@/components/dashboard/RoleGate';

interface BarcodeItem {
  sku: string;
  name: string;
  category: string;
  folder: string;
  path: string;
  unit: string;
  unitPrice: number;
  warrantyMonths: number;
}

interface BarcodeManifest {
  generatedAt: string;
  symbology: string;
  count: number;
  folders: Record<string, string>;
  items: BarcodeItem[];
}

export default function BarcodesPage() {
  return (
    <RoleGate roles={['DIRECTOR', 'SALES', 'WAREHOUSE', 'TECHNICIAN', 'SUPPORT']}>
      <BarcodeLibrary />
    </RoleGate>
  );
}

function BarcodeLibrary() {
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('products');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedProductSerials, setSelectedProductSerials] = useState<{
    sku: string;
    name: string;
    units: InventoryUnit[];
  } | null>(null);

  const query = useQuery({
    queryKey: ['barcodes', 'manifest'],
    queryFn: async () => {
      const response = await fetch('/barcodes/manifest.json');
      if (!response.ok) throw new Error('Could not load the barcode manifest');
      return (await response.json()) as BarcodeManifest;
    },
    staleTime: Infinity,
  });

  const availableUnitsQuery = useQuery({
    queryKey: ['inventory', 'units', 'IN_STOCK'],
    queryFn: async () =>
      (await api.get<InventoryUnit[]>('/inventory', { params: { status: 'IN_STOCK' } })).data,
  });

  const manifest = query.data;
  const availableUnits = availableUnitsQuery.data ?? [];

  // Group in-stock units by SKU
  const unitsBySku = useMemo(() => {
    const map = new Map<string, InventoryUnit[]>();
    for (const unit of availableUnits) {
      const sku = unit.product.sku;
      if (!map.has(sku)) {
        map.set(sku, []);
      }
      map.get(sku)!.push(unit);
    }
    return map;
  }, [availableUnits]);

  const folders = useMemo(() => {
    if (!manifest) return [];
    return Object.entries(manifest.folders).map(([category, name]) => ({
      category,
      folder: name,
      count: manifest.items.filter((item) => item.category === category).length,
    }));
  }, [manifest]);

  const items = useMemo(() => {
    if (!manifest) return [];
    const term = search.trim().toLowerCase();
    return manifest.items.filter((item) => {
      const matchesFolder = !folder || item.folder === folder;
      const matchesTerm =
        !term ||
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const stockCount = (unitsBySku.get(item.sku) ?? []).length;
      const matchesStock = !inStockOnly || stockCount > 0;
      return matchesFolder && matchesTerm && matchesStock;
    });
  }, [manifest, folder, search, inStockOnly, unitsBySku]);

  // Filtered available stock units for Tab 2
  const filteredAvailableUnits = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableUnits.filter((unit) => {
      const matchesFolder = !folder || unit.product.category.toLowerCase().replace('_', '-') === folder.toLowerCase();
      const matchesTerm =
        !term ||
        unit.serialNumber.toLowerCase().includes(term) ||
        unit.product.sku.toLowerCase().includes(term) ||
        unit.product.name.toLowerCase().includes(term) ||
        unit.product.category.toLowerCase().includes(term) ||
        (unit.warehouseLocation && unit.warehouseLocation.toLowerCase().includes(term));
      return matchesFolder && matchesTerm;
    });
  }, [availableUnits, folder, search]);

  return (
    <>
      <PageHeader
        eyebrow="Inventory & Barcodes"
        title="Barcode library"
        description="Labels generated in Code 128 for every product code, available stock serial codes, and tools."
        actions={
          <Button
            variant="light"
            color="gray"
            leftSection={<Printer size={15} />}
            onClick={() => window.print()}
            className="sp-no-print"
          >
            Print view
          </Button>
        }
      />

      {query.isError && (
        <Alert color="red" title="Could not load barcodes" mb="md" radius="md">
          {(query.error as Error).message}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard
          label="Master Product Codes"
          value={String(manifest?.count ?? 0)}
          hint={manifest ? `${manifest.count} SKUs · ${manifest.symbology}` : 'Labels generated'}
          icon={QrCode}
          color="indigo"
          tone="filled"
        />
        <StatCard
          label="Available Stock Units"
          value={String(availableUnits.length)}
          hint="Active serialized units in stock"
          icon={Boxes}
          color="teal"
        />
        <StatCard
          label="Products In Stock"
          value={String(unitsBySku.size)}
          hint={`${unitsBySku.size} of ${manifest?.items.length ?? 0} SKUs have stock`}
          icon={Tags}
          color="sun"
        />
        <StatCard
          label="Category Folders"
          value={String(folders.length)}
          hint="Organised by product category"
          icon={FolderOpen}
          color="ocean"
        />
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Stack gap="md">
            <Panel
              title="Folders"
              subtitle="apps/web/public/barcodes"
              action={<FolderOpen size={16} color="#64748b" />}
            >
              <Stack gap={4}>
                <Button
                  variant={folder === null ? 'light' : 'subtle'}
                  color="sun"
                  justify="space-between"
                  onClick={() => setFolder(null)}
                  fullWidth
                >
                  <span>All categories</span>
                  <Badge size="xs" variant="light">
                    {manifest?.items.length ?? 0}
                  </Badge>
                </Button>
                {folders.map((entry) => (
                  <Button
                    key={entry.folder}
                    variant={folder === entry.folder ? 'light' : 'subtle'}
                    color={folder === entry.folder ? 'sun' : 'gray'}
                    justify="space-between"
                    onClick={() => setFolder(entry.folder)}
                    fullWidth
                  >
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {entry.folder}/
                    </span>
                    <Badge size="xs" variant="light" color="gray">
                      {entry.count}
                    </Badge>
                  </Button>
                ))}
              </Stack>
            </Panel>

            <Panel title="Filter Options" subtitle="Display preferences">
              <Stack gap="xs">
                <Switch
                  label="Available in-stock only"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.currentTarget.checked)}
                  color="teal"
                  size="sm"
                />
              </Stack>
            </Panel>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Panel
            title={folder ? `${folder}/ labels & codes` : 'Barcode & Product Codes'}
            subtitle="View product master codes, download Code 128 labels, or copy available stock codes"
            action={
              <TextInput
                placeholder="Search code, SKU, or serial…"
                leftSection={<Search size={15} />}
                value={search}
                onChange={(event) => setSearch(safeValue(event))}
                w={{ base: 180, sm: 260 }}
                className="sp-no-print"
              />
            }
          >
            <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'products')} mb="md">
              <Tabs.List>
                <Tabs.Tab value="products" leftSection={<QrCode size={14} />}>
                  Product Master Codes <Badge size="xs" ml={6}>{items.length}</Badge>
                </Tabs.Tab>
                <Tabs.Tab value="serials" leftSection={<Boxes size={14} />}>
                  Available Stock Codes <Badge size="xs" color="teal" ml={6}>{filteredAvailableUnits.length}</Badge>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="products" pt="md">
                {query.isLoading ? (
                  <LoadingState label="Loading barcode library…" />
                ) : items.length === 0 ? (
                  <EmptyState
                    title="No product codes match"
                    description="Try a different search term or uncheck 'Available in-stock only'."
                  />
                ) : (
                  <ScrollArea h={720} type="auto">
                    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md" pr={6}>
                      {items.map((item) => {
                        const units = unitsBySku.get(item.sku) ?? [];
                        const inStock = units.length;
                        return (
                          <Paper
                            key={item.sku}
                            withBorder
                            radius="md"
                            p="md"
                            className="sp-hover-lift"
                            style={{
                              background: 'var(--sp-card)',
                              border: '1px solid var(--sp-border)',
                            }}
                          >
                            <Group justify="space-between" align="flex-start" mb={8} wrap="nowrap">
                              <div>
                                <Group gap={6} align="center">
                                  <Badge size="sm" variant="filled" color="indigo" className="sp-mono">
                                    {item.sku}
                                  </Badge>
                                  <CopyButton value={item.sku}>
                                    {({ copied, copy }) => (
                                      <Tooltip label={copied ? 'Product code copied!' : 'Copy product code'}>
                                        <Button
                                          size="compact-xs"
                                          variant="subtle"
                                          color={copied ? 'teal' : 'gray'}
                                          onClick={copy}
                                          p={2}
                                        >
                                          {copied ? <Check size={12} /> : <Copy size={12} />}
                                        </Button>
                                      </Tooltip>
                                    )}
                                  </CopyButton>
                                </Group>
                                <Text fz={11} c="dimmed" lineClamp={2} mih={30} mt={4} style={{ color: 'var(--sp-headings)' }}>
                                  {item.name}
                                </Text>
                              </div>
                              <Stack gap={4} align="flex-end">
                                <Badge size="xs" variant="light" color="indigo">
                                  {titleCase(item.category)}
                                </Badge>
                                <Badge size="xs" variant="light" color={inStock > 0 ? 'teal' : 'gray'}>
                                  {inStock > 0 ? `${inStock} in stock` : '0 in stock'}
                                </Badge>
                              </Stack>
                            </Group>

                            <Box
                              p={8}
                              style={{
                                background: '#ffffff',
                                border: '1px dashed var(--sp-border)',
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                            >
                              <Image
                                src={item.path}
                                alt={`Code 128 barcode for ${item.sku}`}
                                h={82}
                                fit="contain"
                                style={{ maxWidth: '100%' }}
                              />
                            </Box>

                            <Group justify="space-between" mt={8} gap={4}>
                              <Text fz={10} c="dimmed">
                                {formatINR(item.unitPrice)} · {item.warrantyMonths} mo
                              </Text>
                              <Text fz={10} c="dimmed" className="sp-mono">
                                {item.folder}/
                              </Text>
                            </Group>

                            <Group gap={6} mt={8} grow className="sp-no-print">
                              <Button
                                component="a"
                                href={item.path}
                                download={`${item.sku}.svg`}
                                size="compact-xs"
                                variant="light"
                                color="sun"
                                leftSection={<Download size={12} />}
                              >
                                SVG
                              </Button>
                              <CopyButton value={item.sku}>
                                {({ copied, copy }) => (
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    color={copied ? 'teal' : 'indigo'}
                                    leftSection={copied ? <Check size={12} /> : <Copy size={12} />}
                                    onClick={copy}
                                  >
                                    {copied ? 'Copied' : 'Code'}
                                  </Button>
                                )}
                              </CopyButton>
                              {inStock > 0 && (
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  color="teal"
                                  leftSection={<Boxes size={12} />}
                                  onClick={() =>
                                    setSelectedProductSerials({
                                      sku: item.sku,
                                      name: item.name,
                                      units,
                                    })
                                  }
                                >
                                  Stock ({inStock})
                                </Button>
                              )}
                            </Group>
                          </Paper>
                        );
                      })}
                    </SimpleGrid>
                  </ScrollArea>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="serials" pt="md">
                {availableUnitsQuery.isLoading ? (
                  <LoadingState label="Loading available stock codes…" />
                ) : filteredAvailableUnits.length === 0 ? (
                  <EmptyState
                    title="No available stock codes match"
                    description="No in-stock serialized items match your search filter."
                  />
                ) : (
                  <ScrollArea h={720}>
                    <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="sm" miw={650}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Available Product Code / Serial</Table.Th>
                          <Table.Th>Product Details</Table.Th>
                          <Table.Th>Category</Table.Th>
                          <Table.Th>Warehouse Location</Table.Th>
                          <Table.Th ta="right">Action</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredAvailableUnits.map((unit) => (
                          <Table.Tr key={unit.id}>
                            <Table.Td>
                              <Group gap="xs">
                                <Text fz="xs" fw={700} className="sp-mono" style={{ color: 'var(--sp-headings)' }}>
                                  {unit.serialNumber}
                                </Text>
                                <CopyButton value={unit.serialNumber}>
                                  {({ copied, copy }) => (
                                    <Tooltip label={copied ? 'Serial copied!' : 'Copy serial code'}>
                                      <Button
                                        size="compact-xs"
                                        variant="subtle"
                                        color={copied ? 'teal' : 'gray'}
                                        onClick={copy}
                                        p={2}
                                      >
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                      </Button>
                                    </Tooltip>
                                  )}
                                </CopyButton>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="xs" fw={600} style={{ color: 'var(--sp-headings)' }}>
                                {unit.product.name}
                              </Text>
                              <Text fz={10} c="dimmed" className="sp-mono">
                                SKU: {unit.product.sku}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color="indigo">
                                {titleCase(unit.product.category)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                <Warehouse size={12} color="#64748b" />
                                <Text fz="xs">{unit.warehouseLocation || 'Main warehouse'}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td ta="right">
                              <CopyButton value={unit.serialNumber}>
                                {({ copied, copy }) => (
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    color={copied ? 'teal' : 'sun'}
                                    leftSection={copied ? <Check size={12} /> : <Copy size={12} />}
                                    onClick={copy}
                                  >
                                    {copied ? 'Copied' : 'Copy Code'}
                                  </Button>
                                )}
                              </CopyButton>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Tabs.Panel>
            </Tabs>
          </Panel>
        </Grid.Col>
      </Grid>

      {/* Modal for viewing all available stock codes for a product */}
      <Modal
        opened={Boolean(selectedProductSerials)}
        onClose={() => setSelectedProductSerials(null)}
        title={
          <Group gap="xs">
            <Boxes size={18} color="#0f766e" />
            <Text fw={700}>
              Available Product Codes: {selectedProductSerials?.sku}
            </Text>
          </Group>
        }
        size="lg"
      >
        {selectedProductSerials && (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text fz="sm" fw={600} style={{ color: 'var(--sp-headings)' }}>
                  {selectedProductSerials.name}
                </Text>
                <Text fz="xs" c="dimmed">
                  {selectedProductSerials.units.length} unit(s) ready in warehouse stock
                </Text>
              </div>
              <CopyButton
                value={selectedProductSerials.units.map((u) => u.serialNumber).join('\n')}
              >
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    color={copied ? 'teal' : 'indigo'}
                    variant="light"
                    leftSection={copied ? <Check size={14} /> : <Copy size={14} />}
                    onClick={copy}
                  >
                    {copied ? 'All Codes Copied' : 'Copy All Codes'}
                  </Button>
                )}
              </CopyButton>
            </Group>

            <ScrollArea h={320}>
              <Stack gap="xs">
                {selectedProductSerials.units.map((unit, index) => (
                  <Box
                    key={unit.id}
                    p="xs"
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-card-subtle)',
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <div>
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color="gray">
                            #{index + 1}
                          </Badge>
                          <Text fz="xs" fw={700} className="sp-mono" style={{ color: 'var(--sp-headings)' }}>
                            {unit.serialNumber}
                          </Text>
                        </Group>
                        <Text fz={10} c="dimmed" mt={2}>
                          Location: {unit.warehouseLocation || 'Main warehouse'}
                        </Text>
                      </div>
                      <CopyButton value={unit.serialNumber}>
                        {({ copied, copy }) => (
                          <Button
                            size="compact-xs"
                            variant="light"
                            color={copied ? 'teal' : 'gray'}
                            leftSection={copied ? <Check size={12} /> : <Copy size={12} />}
                            onClick={copy}
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        )}
                      </CopyButton>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        )}
      </Modal>

      <Box mt="md">
        <Panel title="How the label folders work" subtitle="Generated by scripts/generate-assets.mjs" className="sp-no-print">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {folders.map((entry) => (
              <Group key={entry.folder} gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon size={32} radius="md" color="indigo" variant="light">
                  <FolderOpen size={16} />
                </ThemeIcon>
                <div>
                  <Text fz="xs" fw={700} className="sp-mono">
                    /barcodes/{entry.folder}/
                  </Text>
                  <Text fz={10} c="dimmed">
                    {entry.count} label(s) for {titleCase(entry.category)} products and tools.
                  </Text>
                </div>
              </Group>
            ))}
          </SimpleGrid>
        </Panel>
      </Box>
    </>
  );
}
