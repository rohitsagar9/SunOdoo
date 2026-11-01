'use client';

import { useEffect, useState } from 'react';
import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <ActionIcon
        variant="light"
        color="sun"
        size="lg"
        radius="md"
        aria-label="Toggle color scheme"
        title="Toggle color scheme"
      >
        <Moon size={18} />
      </ActionIcon>
    );
  }

  const isLight = computedColorScheme === 'light';

  return (
    <ActionIcon
      onClick={() => setColorScheme(isLight ? 'dark' : 'light')}
      variant="light"
      color="sun"
      size="lg"
      radius="md"
      aria-label="Toggle color scheme"
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </ActionIcon>
  );
}
