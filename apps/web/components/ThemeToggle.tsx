'use client';

import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <ActionIcon
      onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
      variant="light"
      color="sun"
      size="lg"
      radius="md"
      aria-label="Toggle color scheme"
      title={computedColorScheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {computedColorScheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </ActionIcon>
  );
}
