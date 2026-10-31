'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  FileText,
  Gauge,
  Headphones,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  QrCode,
  Receipt,
  SunMedium,
  Users,
  Warehouse,
} from 'lucide-react';
import { Logo } from '@/components/Brand';
import { initials } from '@/lib/format';
import { homeForRole, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';

const roleMeta: Record<Role, { label: string; color: string; icon: typeof Gauge }> = {
  DIRECTOR: { label: 'Director', color: 'teal', icon: Gauge },
  SALES: { label: 'Sales & office', color: 'sun', icon: LayoutDashboard },
  TECHNICIAN: { label: 'Technician', color: 'ocean', icon: SunMedium },
  WAREHOUSE: { label: 'Warehouse', color: 'indigo', icon: Warehouse },
  SUPPORT: { label: 'Support', color: 'grape', icon: Headphones },
};

interface NavItem {
  label: string;
  href: string;
  icon: typeof Gauge;
  roles: Role[];
  match?: string[];
}

const sections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Pipeline',
    items: [
      { label: 'Leads', href: '/dashboard/leads', icon: Users, roles: ['SALES', 'DIRECTOR'] },
      { label: 'Quotes', href: '/dashboard/quotes', icon: FileText, roles: ['SALES', 'DIRECTOR'] },
      {
        label: 'Payments',
        href: '/dashboard/payments',
        icon: IndianRupee,
        roles: ['SALES', 'DIRECTOR', 'SUPPORT', 'WAREHOUSE'],
      },
      {
        label: 'Orders',
        href: '/dashboard/orders',
        icon: Package,
        roles: ['SALES', 'DIRECTOR', 'WAREHOUSE', 'SUPPORT'],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Schedule & jobs',
        href: '/dashboard/schedule',
        icon: CalendarDays,
        roles: ['TECHNICIAN', 'SALES', 'DIRECTOR'],
        match: ['/dashboard/schedule', '/dashboard/jobs'],
      },
      {
        label: 'Inventory',
        href: '/dashboard/inventory',
        icon: Boxes,
        roles: ['WAREHOUSE', 'DIRECTOR', 'SALES'],
      },
      {
        label: 'Barcode library',
        href: '/dashboard/barcodes',
        icon: QrCode,
        roles: ['DIRECTOR', 'SALES', 'WAREHOUSE', 'TECHNICIAN', 'SUPPORT'],
      },
    ],
  },
  {
    label: 'Care & finance',
    items: [
      {
        label: 'Support tickets',
        href: '/dashboard/support',
        icon: LifeBuoy,
        roles: ['SUPPORT', 'DIRECTOR', 'SALES', 'TECHNICIAN'],
      },
      { label: 'Subsidies', href: '/dashboard/subsidies', icon: Landmark, roles: ['DIRECTOR', 'SALES'] },
      { label: 'Expenses', href: '/dashboard/expenses', icon: Receipt, roles: ['DIRECTOR', 'SALES'] },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  if (loading || !user) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Loader color="sun" />
          <Text c="dimmed" fz="sm">
            Loading your workspace…
          </Text>
        </Stack>
      </Center>
    );
  }

  const meta = roleMeta[user.role];
  const home = homeForRole(user.role);
  const overview: NavItem =
    user.role === 'DIRECTOR'
      ? { label: 'Director overview', href: '/dashboard/director', icon: Gauge, roles: ['DIRECTOR'] }
      : user.role === 'SALES'
        ? { label: 'Sales overview', href: '/dashboard/sales', icon: LayoutDashboard, roles: ['SALES'] }
        : user.role === 'WAREHOUSE'
          ? { label: 'Warehouse overview', href: '/dashboard/warehouse', icon: Warehouse, roles: ['WAREHOUSE'] }
          : user.role === 'SUPPORT'
            ? { label: 'Support overview', href: '/dashboard/support', icon: Headphones, roles: ['SUPPORT'] }
            : { label: 'My day', href: '/dashboard/schedule', icon: SunMedium, roles: ['TECHNICIAN'] };

  const isActive = (item: NavItem) => {
    const targets = item.match ?? [item.href];
    return targets.some((target) => pathname === target || pathname.startsWith(`${target}/`));
  };

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 268, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding="lg"
      styles={{
        main: { background: '#f4f7fa', minHeight: '100vh' },
        navbar: { background: '#ffffff', borderRight: '1px solid #e2e8f0' },
        header: { background: '#ffffff', borderBottom: '1px solid #e2e8f0' },
      }}
    >
      <AppShell.Header px={{ base: 'md', md: 'lg' }}>
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />
            <Logo href={home} compact />
            <Divider orientation="vertical" visibleFrom="sm" />
            <Badge color={meta.color} variant="light" visibleFrom="sm" radius="sm">
              {meta.label}
            </Badge>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              component={Link}
              href={user.role === 'TECHNICIAN' ? '/dashboard/schedule' : '/dashboard/payments'}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </ActionIcon>
            <Menu position="bottom-end" width={230} shadow="md" radius="md">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color={meta.color} radius="xl" size={36}>
                      {initials(user.name)}
                    </Avatar>
                    <div className="sp-hide-mobile">
                      <Text fz="sm" fw={700} lh={1.15}>
                        {user.name}
                      </Text>
                      <Text fz={10} c="dimmed" lh={1.2}>
                        {user.email}
                      </Text>
                    </div>
                    <ChevronDown size={14} className="sp-hide-mobile" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Signed in as</Menu.Label>
                <Menu.Item leftSection={<ThemeIcon size={22} radius="xl" color={meta.color} variant="light"><meta.icon size={12} /></ThemeIcon>}>
                  <Text fz="sm" fw={600}>
                    {user.name}
                  </Text>
                  <Text fz={10} c="dimmed">
                    {meta.label}
                  </Text>
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  component={Link}
                  href="/"
                  leftSection={<SunMedium size={15} />}
                >
                  Public website
                </Menu.Item>
                <Menu.Item
                  component={Link}
                  href="/portal"
                  leftSection={<Headphones size={15} />}
                >
                  Customer portal
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<LogOut size={15} />} onClick={logout}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea} type="never">
          <Stack gap={4}>
            <NavLink
              component={Link}
              href={overview.href}
              label={overview.label}
              leftSection={<overview.icon size={18} />}
              active={isActive(overview)}
              color="sun"
              variant="light"
              style={{ borderRadius: 10, fontWeight: 600 }}
            />
            {visibleSections.map((section) => (
              <div key={section.label}>
                <Text
                  fz={10}
                  fw={700}
                  tt="uppercase"
                  c="dimmed"
                  mt="md"
                  mb={6}
                  px={10}
                  style={{ letterSpacing: '0.12em' }}
                >
                  {section.label}
                </Text>
                <Stack gap={2}>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href + item.label}
                      component={Link}
                      href={item.href}
                      label={item.label}
                      leftSection={<item.icon size={18} />}
                      active={isActive(item)}
                      color="sun"
                      variant="light"
                      style={{ borderRadius: 10, fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider my="md" />
          <Group gap="sm" wrap="nowrap" px={6}>
            <ThemeIcon size={36} radius="xl" color="sun" variant="light">
              <SunMedium size={18} />
            </ThemeIcon>
            <div>
              <Text fz={11} fw={700}>
                SunPower Solutions
              </Text>
              <Text fz={10} c="dimmed">
                Solar operations platform
              </Text>
            </div>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
