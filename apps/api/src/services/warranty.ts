import type { WarrantyStatus } from '@prisma/client';

export const SERIALISED_CATEGORIES = ['INVERTER', 'BATTERY', 'CHARGE_CONTROLLER', 'PANEL'] as const;
export const MUST_SCAN_CATEGORIES = ['INVERTER', 'BATTERY', 'CHARGE_CONTROLLER'] as const;

export function warrantyStatus(end: Date | null | undefined): WarrantyStatus {
  if (!end) return 'UNKNOWN';
  return end.getTime() >= Date.now() ? 'IN_WARRANTY' : 'OUT_OF_WARRANTY';
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function isSerialised(category: string) {
  return (SERIALISED_CATEGORIES as readonly string[]).includes(category);
}

export function mustScan(category: string) {
  return (MUST_SCAN_CATEGORIES as readonly string[]).includes(category);
}
