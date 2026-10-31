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
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Download,
  FolderOpen,
  Printer,
  QrCode,
  Search,
  Tags,
} from 'lucide-react';
import { formatINR, titleCase } from '@/lib/format';
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

  const query = useQuery({
    queryKey: ['barcodes', 'manifest'],
    queryFn: async () => {
      const response = await fetch('/barcodes/manifest.json');
      if (!response.ok) throw new Error('Could not load the barcode manifest');
      return (await response.json()) as BarcodeManifest;
    },
    staleTime: Infinity,
  });

  const manifest = query.data;
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
      return matchesFolder && matchesTerm;
    });
  }, [manifest, folder, search]);

  return (
    <>
      <PageHeader
        eyebrow="Static assets"
        title="Barcode library"
        description="Labels generated in Code 128 for every product and tool, filed in its own category folder for printing and scanning."
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

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
        <StatCard
          label="Labels generated"
          value={String(manifest?.count ?? 0)}
          hint={manifest ? `${manifest.count} Labels generated · ${manifest.symbology}` : 'Labels generated'}
          icon={QrCode}
          color="indigo"
          tone="filled"
        />
        <StatCard
          label="Category folders"
          value={String(folders.length)}
          hint="Each image sits in its product folder"
          icon={FolderOpen}
          color="sun"
        />
        <StatCard
          label="SKUs covered"
          value={String(new Set(manifest?.items.map((item) => item.sku) ?? []).size)}
          hint="Products, services and tools"
          icon={Tags}
          color="teal"
        />
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 3 }}>
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
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Panel
            title={folder ? `${folder}/ labels` : 'All barcode labels'}
            subtitle="Click download to save the SVG, or copy the public path for the catalogue"
            action={
              <TextInput
                placeholder="Search SKU or product…"
                leftSection={<Search size={15} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                w={{ base: 180, sm: 260 }}
                className="sp-no-print"
              />
            }
          >
            {query.isLoading ? (
              <LoadingState label="Loading barcode library…" />
            ) : items.length === 0 ? (
              <EmptyState
                title="No labels match"
                description="Try a different SKU or clear the folder filter."
              />
            ) : (
              <ScrollArea h={720} type="auto">
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md" pr={6}>
                  {items.map((item) => (
                    <Paper
                      key={item.sku}
                      withBorder
                      radius="md"
                      p="md"
                      className="sp-hover-lift"
                      style={{ background: '#fff' }}
                    >
                      <Group justify="space-between" align="flex-start" mb={8} wrap="nowrap">
                        <div>
                          <Text fz="xs" fw={700} className="sp-mono">
                            {item.sku}
                          </Text>
                          <Text fz={11} c="dimmed" lineClamp={2} mih={30}>
                            {item.name}
                          </Text>
                        </div>
                        <Badge size="xs" variant="light" color="indigo">
                          {titleCase(item.category)}
                        </Badge>
                      </Group>

                      <Box
                        p={8}
                        style={{
                          background: '#fff',
                          border: '1px dashed #e2e8f0',
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
                        <CopyButton value={item.path}>
                          {({ copied, copy }) => (
                            <Button
                              size="compact-xs"
                              variant="light"
                              color={copied ? 'teal' : 'gray'}
                              leftSection={copied ? <Check size={12} /> : <Copy size={12} />}
                              onClick={copy}
                            >
                              {copied ? 'Copied' : 'Path'}
                            </Button>
                          )}
                        </CopyButton>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </ScrollArea>
            )}
          </Panel>
        </Grid.Col>
      </Grid>

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
    </>
  );
}
