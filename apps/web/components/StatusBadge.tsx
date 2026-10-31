import { Badge } from '@mantine/core';
import { statusColor, titleCase } from '@/lib/format';

export function StatusBadge({
  status,
  size = 'sm',
  variant = 'light',
}: {
  status?: string | null;
  size?: string;
  variant?: 'light' | 'filled' | 'dot';
}) {
  return (
    <Badge color={statusColor(status)} variant={variant} size={size} radius="sm">
      {titleCase(status)}
    </Badge>
  );
}
