'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileText,
  Headphones,
  Home,
  IndianRupee,
  MessageSquare,
  Phone,
  PhoneCall,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  Warehouse,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Logo } from '@/components/Brand';
import { InquiryForm } from '@/components/InquiryForm';
import { PublicIssueForm } from '@/components/PublicIssueForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import classes from './landing.module.css';

const steps = [
  {
    icon: FileText,
    title: 'Enquiry lands instantly',
    text: 'The web form writes straight into the sales dashboard with a reference number — never an inbox.',
  },
  {
    icon: PhoneCall,
    title: 'Verification call',
    text: 'Sales checks the electricity bill, roof space and grid connection, then triggers a site survey.',
  },
  {
    icon: Ruler,
    title: 'Roof survey',
    text: 'A technician records direction, tilt, cable distance and shadow-free area from a mobile job card.',
  },
  {
    icon: CreditCard,
    title: 'Itemised quote & payment',
    text: 'The template adds every panel, inverter, stand and safety part. The customer accepts and pays online.',
  },
  {
    icon: Wrench,
    title: 'Dispatch & installation',
    text: 'Warehouse packs the kit and scans serials. The crew clocks in, uploads photos and collects a signature.',
  },
  {
    icon: ShieldCheck,
    title: '20-year warranty trail',
    text: 'Every serial number is tied to the customer. Support sees warranty status in seconds, not paper registers.',
  },
];

const packages = [
  {
    kw: 1,
    label: 'Starter home',
    onGrid: '₹1.33L',
    offGrid: '₹1.96L',
    points: ['2 × 540 W panels', '1 kW inverter', 'Structure, wiring & earthing'],
  },
  {
    kw: 3,
    label: 'Most popular',
    onGrid: '₹2.62L',
    offGrid: '₹3.26L',
    points: ['6 × 540 W panels', '3 kW inverter', 'Full BOS + installation'],
    featured: true,
  },
  {
    kw: 5,
    label: 'Large home / shop',
    onGrid: '₹3.93L',
    offGrid: '₹5.24L',
    points: ['10 × 540 W panels', '5 kW inverter', 'Net metering support'],
  },
];

const roles = [
  {
    icon: TrendingUp,
    title: 'Director',
    color: 'teal',
    text: 'Revenue collected, profit per job, pending installations and open repairs — without chasing WhatsApp.',
    bullets: ['Weekly & monthly P&L', 'Job-level margin', 'Subsidy pipeline'],
  },
  {
    icon: Users,
    title: 'Sales & Office',
    color: 'sun',
    text: 'A Kanban board from new enquiry to paid order, one-click quotes and a payment screenshot queue.',
    bullets: ['Lead Kanban', 'Template quotes', 'Approve payments'],
  },
  {
    icon: Wrench,
    title: 'Technician',
    color: 'ocean',
    text: 'Today’s route, clock in/out, roof photos, customer signature and the balance QR — all on a phone.',
    bullets: ['Daily schedule', 'Photo + signature', 'UPI collection'],
  },
  {
    icon: Warehouse,
    title: 'Warehouse',
    color: 'indigo',
    text: 'Approved orders, an auto-generated packing checklist and serial scanning before the truck leaves.',
    bullets: ['Packing queue', 'Serial scan', 'Dispatch proof'],
  },
  {
    icon: Headphones,
    title: 'Support',
    color: 'grape',
    text: 'Search by phone or serial, see green/red warranty status and track the ticket until the customer confirms.',
    bullets: ['Warranty lookup', 'Repair tickets', 'Auto billing'],
  },
];

const scenarios = [
  {
    icon: ClipboardCheck,
    title: 'The 3 kW enquiry',
    text: 'Name, phone, address and system size land in the sales board with an auto reference.',
  },
  {
    icon: BatteryCharging,
    title: 'The kit nobody forgets',
    text: 'Quotes pull the exact BOM from the catalogue, then warehouse gets a packing checklist.',
  },
  {
    icon: Warehouse,
    title: 'Dispatch day',
    text: 'Scan the inverter, battery and charge controller. Warranty starts automatically on delivery.',
  },
  {
    icon: Home,
    title: 'On the roof',
    text: 'Clock in, upload finished-roof photos, capture the signature and close the job from a phone.',
  },
  {
    icon: Zap,
    title: 'The rainy-season fault',
    text: 'Support finds the serial, sees active warranty and raises a zero-cost repair ticket in seconds.',
  },
  {
    icon: IndianRupee,
    title: 'The director’s month-end',
    text: 'Collected this week, profit per completed job, pending installs and open tickets on one screen.',
  },
];

export default function LandingPage() {
  return (
    <main>
      <div className={classes.hero}>
        <div className={classes.grid} />
        <div className={classes.sunGlow} />

        <header className={classes.nav}>
          <Logo light />
          <Group gap="lg" className={classes.navLinks}>
            <a href="#packages">Packages</a>
            <a href="#process">How it works</a>
            <a href="#roles">For teams</a>
            <a href="#support">Report an issue / Helpline</a>
            <Link href="/portal">Customer portal</Link>
          </Group>
          <Group gap="sm">
            <ThemeToggle />
            <Button variant="subtle" color="gray" component={Link} href="/login" className={classes.loginLink}>
              Staff login
            </Button>
            <Button
              color="sun"
              rightSection={<ArrowRight size={15} />}
              component={Link}
              href="#quote"
              visibleFrom="sm"
            >
              Get a free solar plan
            </Button>
          </Group>
        </header>

        <div className={classes.heroInner}>
          <div className={classes.heroCopy}>
            <Badge
              size="lg"
              variant="light"
              color="sun"
              leftSection={<Sparkles size={13} />}
              radius="sm"
            >
              One platform · 40+ installs a month
            </Badge>
            <Title className={classes.heroTitle}>
              From rooftop enquiry to <span>20-year warranty.</span>
            </Title>
            <Text className={classes.heroText}>
              SunPower Solutions runs surveys, quotes, stock, dispatch, installation and service on one
              connected system. No lost WhatsApp leads. No paper serial registers. No guessing at margins.
            </Text>
            <Group gap="md" mt="xl">
              <Button
                size="lg"
                color="sun"
                rightSection={<ArrowRight size={18} />}
                component={Link}
                href="#quote"
              >
                Get a free solar plan
              </Button>
              <Button
                size="lg"
                variant="default"
                component={Link}
                href="/login"
                leftSection={<Users size={17} />}
                className={classes.ghostButton}
              >
                Open staff dashboard
              </Button>
            </Group>

            <SimpleGrid cols={3} mt={40} className={classes.heroStats}>
              <div>
                <Text className={classes.statValue}>1–5 kW</Text>
                <Text className={classes.statLabel}>On-grid & off-grid packages</Text>
              </div>
              <div>
                <Text className={classes.statValue}>15</Text>
                <Text className={classes.statLabel}>Technicians on the field</Text>
              </div>
              <div>
                <Text className={classes.statValue}>2 yrs</Text>
                <Text className={classes.statLabel}>Inverter & battery warranty</Text>
              </div>
            </SimpleGrid>
          </div>

          <div id="quote" className={classes.inquiryCard}>
            <Paper p="xl" radius="xl" shadow="xl" style={{ background: 'var(--sp-card)', border: '1px solid var(--sp-border)' }}>
              <InquiryForm />
            </Paper>
            <Group gap={8} mt="md" justify="center" className={classes.inquiryNote}>
              <CheckCircle2 size={14} />
              <Text fz="xs">
                Instant reference number · Verified site survey in 24 hours
              </Text>
            </Group>
          </div>
        </div>
      </div>

      <section className={classes.section} id="process">
        <div className={classes.sectionHead}>
          <Text className={classes.kicker}>The whole job, one thread</Text>
          <Title order={2} className={classes.sectionTitle}>
            Six steps. Zero paper registers.
          </Title>
          <Text c="dimmed" maw={620} mx="auto" ta="center">
            Every hand-off is visible to the next person — from the first form fill to the last warranty
            claim.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {steps.map((step, index) => (
            <Card key={step.title} className={classes.stepCard} padding="xl">
              <Group justify="space-between" mb="md">
                <ThemeIcon size={46} radius="md" variant="light" color={index % 2 ? 'ocean' : 'sun'}>
                  <step.icon size={22} />
                </ThemeIcon>
                <Text className={classes.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
              </Group>
              <Text fw={800} fz="lg" mb={6}>
                {step.title}
              </Text>
              <Text c="dimmed" fz="sm" lh={1.6}>
                {step.text}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </section>

      <section className={classes.packagesSection} id="packages">
        <div className={classes.sectionHead}>
          <Text className={classes.kicker}>Ready-made systems</Text>
          <Title order={2} className={classes.sectionTitle}>
            A package for every roof.
          </Title>
          <Text c="dimmed" maw={640} mx="auto" ta="center">
            Itemised quotes are generated from the same catalogue the warehouse packs. Prices are
            indicative installed totals, including GST.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {packages.map((pkg) => (
            <Card
              key={pkg.kw}
              padding="xl"
              className={`${classes.packageCard} ${pkg.featured ? classes.featuredPackage : ''}`}
            >
              {pkg.featured && (
                <Badge color="sun" variant="filled" mb="md" radius="sm">
                  Most requested
                </Badge>
              )}
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text className={classes.packageKw}>{pkg.kw} kW</Text>
                  <Text c="dimmed" fz="sm">
                    {pkg.label}
                  </Text>
                </div>
                <ThemeIcon size={48} radius="xl" variant="light" color="sun">
                  <Sun size={24} />
                </ThemeIcon>
              </Group>
              <Divider my="lg" />
              <Stack gap={8} mb="lg">
                {pkg.points.map((point) => (
                  <Group gap={8} key={point} wrap="nowrap">
                    <CheckCircle2 size={15} color="#0f766e" />
                    <Text fz="sm">{point}</Text>
                  </Group>
                ))}
              </Stack>
              <SimpleGrid cols={2} spacing="xs" mb="lg">
                <Paper p="sm" radius="md" bg="gray.0">
                  <Text fz={10} c="dimmed" fw={700} tt="uppercase">
                    On-Grid from
                  </Text>
                  <Text fw={800}>{pkg.onGrid}</Text>
                </Paper>
                <Paper p="sm" radius="md" bg="sun.0">
                  <Text fz={10} c="dimmed" fw={700} tt="uppercase">
                    Off-Grid from
                  </Text>
                  <Text fw={800}>{pkg.offGrid}</Text>
                </Paper>
              </SimpleGrid>
              <Button
                fullWidth
                variant={pkg.featured ? 'filled' : 'light'}
                color="sun"
                component={Link}
                href="#quote"
                rightSection={<ArrowRight size={15} />}
              >
                Get this system quoted
              </Button>
            </Card>
          ))}
        </SimpleGrid>
      </section>

      <section className={classes.section} id="support">
        <div className={classes.sectionHead}>
          <Text className={classes.kicker}>SolarCare™ Customer Helpline & Support</Text>
          <Title order={2} className={classes.sectionTitle}>
            24/7 Breakdown Assistance & Technical Desk
          </Title>
          <Text c="dimmed" maw={660} mx="auto" ta="center">
            Facing low generation, inverter trip, or equipment fault? Speak directly to our engineers or submit an issue ticket below. We verify warranty from serial numbers and dispatch on-field technicians.
          </Text>
        </div>

        <Stack gap="xl" maw={880} mx="auto" mt="xl">
          {/* Unified Direct Helpline Banner */}
          <Paper
            p="lg"
            radius="xl"
            withBorder
            style={{
              background: 'var(--sp-card)',
              borderColor: 'var(--sp-border)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="wrap" gap="md">
                <Group gap="md">
                  <ThemeIcon size={48} radius="md" color="sun" variant="light">
                    <Headphones size={24} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800} fz="lg" c="var(--sp-headings)">
                      Direct Customer Helpline
                    </Text>
                    <Text fz="xs" c="dimmed">
                      Speak directly to our certified solar technical support team
                    </Text>
                  </div>
                </Group>
                <Group gap="sm" wrap="wrap">
                  <Button
                    component="a"
                    href="tel:18007866366"
                    size="sm"
                    color="sun"
                    leftSection={<Phone size={14} />}
                  >
                    1800-SUN-ODOO
                  </Button>
                  <Button
                    component="a"
                    href="tel:+919000000006"
                    size="sm"
                    color="teal"
                    variant="light"
                    leftSection={<Phone size={14} />}
                  >
                    +91 90000 00006
                  </Button>
                  <Button
                    component="a"
                    href="https://wa.me/919000000006?text=Hello%20SunPower%20Support,%20I%20have%20an%20issue%20with%20my%20solar%20system."
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    color="green"
                    variant="light"
                    leftSection={<MessageSquare size={14} />}
                  >
                    WhatsApp Support
                  </Button>
                </Group>
              </Group>

              <Divider />

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                <Group gap={8}>
                  <CheckCircle2 size={15} color="#0f766e" />
                  <Text fz="xs" c="dimmed">Average phone response under 2 mins</Text>
                </Group>
                <Group gap={8}>
                  <CheckCircle2 size={15} color="#0f766e" />
                  <Text fz="xs" c="dimmed">24/7 emergency response for hazard/trip</Text>
                </Group>
                <Group gap={8}>
                  <CheckCircle2 size={15} color="#0f766e" />
                  <Text fz="xs" c="dimmed">Technician site visit within 24 hours</Text>
                </Group>
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* Form Card */}
          <Paper
            p="xl"
            radius="xl"
            withBorder
            style={{
              background: 'var(--sp-card)',
              borderColor: 'var(--sp-border)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            }}
          >
            <PublicIssueForm />
          </Paper>
        </Stack>
      </section>

      <section className={classes.section} id="roles">
        <div className={classes.sectionHead}>
          <Text className={classes.kicker}>Role-based access</Text>
          <Title order={2} className={classes.sectionTitle}>
            Each person sees only what they need.
          </Title>
          <Text c="dimmed" maw={620} mx="auto" ta="center">
            One secure login, five focused dashboards. No shared passwords, no spreadsheet forwarding.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {roles.map((role) => (
            <Card key={role.title} className={classes.roleCard} padding="xl">
              <Group gap="sm" mb="md">
                <ThemeIcon size={44} radius="md" color={role.color} variant="light">
                  <role.icon size={21} />
                </ThemeIcon>
                <div>
                  <Text fw={800}>{role.title}</Text>
                  <Text fz="xs" c="dimmed">
                    Secure role dashboard
                  </Text>
                </div>
              </Group>
              <Text fz="sm" c="dimmed" lh={1.6} mb="md">
                {role.text}
              </Text>
              <Stack gap={6}>
                {role.bullets.map((bullet) => (
                  <Group gap={7} key={bullet}>
                    <CheckCircle2 size={13} color="#0f766e" />
                    <Text fz="xs">{bullet}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          ))}
          <Card className={classes.portalCard} padding="xl">
            <ThemeIcon size={44} radius="md" color="teal" variant="light" mb="md">
              <Headphones size={21} />
            </ThemeIcon>
            <Text fw={800} mb={6}>
              Customer portal
            </Text>
            <Text fz="sm" c="dimmed" lh={1.6} mb="md">
              Customers can view their quote, upload a payment screenshot, check warranty and raise a
              repair ticket with a registered phone number.
            </Text>
            <Button
              variant="light"
              color="teal"
              component={Link}
              href="/portal"
              rightSection={<ArrowRight size={15} />}
            >
              Open customer portal
            </Button>
          </Card>
        </SimpleGrid>
      </section>

      <section className={classes.scenarioSection}>
        <div className={classes.sectionHead}>
          <Text className={classes.kicker}>Built around the real week</Text>
          <Title order={2} className={classes.sectionTitle}>
            The messy parts, handled.
          </Title>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {scenarios.map((scenario) => (
            <Paper key={scenario.title} p="lg" className={classes.scenarioCard}>
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon size={36} radius="md" color="ocean" variant="light">
                  <scenario.icon size={18} />
                </ThemeIcon>
                <Text fw={700} fz="sm">
                  {scenario.title}
                </Text>
              </Group>
              <Text fz="sm" c="dimmed" lh={1.6}>
                {scenario.text}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </section>

      <section className={classes.ctaSection}>
        <Paper className={classes.ctaCard} p={{ base: 'xl', md: 56 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ alignItems: 'center' }}>
            <div>
              <Badge color="sun" variant="light" mb="md">
                Ready for the demo
              </Badge>
              <Title order={2} c="white" style={{ letterSpacing: '-0.03em' }}>
                Give every job a paper trail.
              </Title>
              <Text c="gray.4" mt="md" maw={520}>
                Log in as the director, sales, technician, warehouse or support to see the same data from
                each side of the business.
              </Text>
              <Group mt="xl">
                <Button
                  size="md"
                  color="sun"
                  component={Link}
                  href="/login"
                  rightSection={<ArrowRight size={16} />}
                >
                  Open the demo
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  color="gray"
                  component={Link}
                  href="/portal"
                  className={classes.ctaGhost}
                >
                  Customer portal
                </Button>
              </Group>
            </div>
            <Stack gap="sm">
              {[
                ['Director', 'director@sunpower.in'],
                ['Sales & Office', 'sales@sunpower.in'],
                ['Technician', 'tech@sunpower.in'],
                ['Warehouse', 'warehouse@sunpower.in'],
                ['Support', 'support@sunpower.in'],
              ].map(([role, email]) => (
                <Group
                  key={email}
                  justify="space-between"
                  className={classes.credentialRow}
                  wrap="nowrap"
                >
                  <Group gap={8}>
                    <Clock3 size={14} />
                    <Text fz="sm" c="gray.3">
                      {role}
                    </Text>
                  </Group>
                  <Text fz="xs" c="gray.4" className="sp-mono">
                    {email}
                  </Text>
                </Group>
              ))}
              <Text fz="xs" c="gray.5" ta="right">
                Password for all demo accounts: <b>SunPower@123</b>
              </Text>
            </Stack>
          </SimpleGrid>
        </Paper>
      </section>

      <footer className={classes.footer}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
          <div>
            <Logo light />
            <Text fz="sm" c="gray.5" mt="sm" maw={360}>
              The digital backbone for rooftop solar operations — enquiry, survey, quote, payment,
              dispatch, installation and warranty.
            </Text>
          </div>
          <Group gap={56} align="flex-start">
            <Stack gap={6}>
              <Text fz="xs" fw={700} tt="uppercase" c="gray.4">
                Product
              </Text>
              <a href="#packages">Packages</a>
              <a href="#process">How it works</a>
              <a href="#support">Report an issue / Helpline</a>
              <Link href="/portal">Customer portal</Link>
            </Stack>
            <Stack gap={6}>
              <Text fz="xs" fw={700} tt="uppercase" c="gray.4">
                Teams
              </Text>
              <Link href="/login">Staff login</Link>
              <Link href="/dashboard/barcodes">Barcode library</Link>
              <Link href="/dashboard/warehouse">Dispatch board</Link>
            </Stack>
          </Group>
        </Group>
        <Divider my="xl" color="rgba(255,255,255,.12)" />
        <Group justify="space-between">
          <Text fz="xs" c="gray.6">
            © {new Date().getFullYear()} SunPower Solutions. Demo build.
          </Text>
          <Group gap="xs">
            <Building2 size={13} color="#64748b" />
            <Text fz="xs" c="gray.6">
              Bengaluru · Hyderabad · Pune
            </Text>
          </Group>
        </Group>
      </footer>
    </main>
  );
}
