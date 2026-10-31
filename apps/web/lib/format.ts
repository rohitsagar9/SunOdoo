import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatINR(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN').format(value ?? 0);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return dayjs(value).format('DD MMM YYYY');
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  return dayjs(value).format('DD MMM YYYY, h:mm A');
}

export function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  return dayjs(value).format('h:mm A');
}

export function timeAgo(value?: string | Date | null) {
  if (!value) return '—';
  return dayjs(value).fromNow();
}

export function initials(name?: string | null) {
  if (!name) return 'SP';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function titleCase(value?: string | null) {
  if (!value) return '—';
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusColor(status?: string | null): string {
  switch (status) {
    case 'NEW':
      return 'blue';
    case 'VERIFIED':
      return 'cyan';
    case 'SURVEY_SCHEDULED':
      return 'indigo';
    case 'SURVEY_COMPLETED':
      return 'violet';
    case 'QUOTED':
      return 'orange';
    case 'NEGOTIATION':
      return 'yellow';
    case 'WON':
    case 'ACCEPTED':
    case 'APPROVED':
    case 'PAID':
    case 'COMPLETED':
    case 'INSTALLED':
    case 'IN_WARRANTY':
    case 'RESOLVED':
    case 'CLOSED':
      return 'teal';
    case 'LOST':
    case 'REJECTED':
    case 'CANCELLED':
    case 'OUT_OF_WARRANTY':
    case 'OVERDUE':
    case 'FAULTY':
      return 'red';
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'SENT':
    case 'SCHEDULED':
      return 'yellow';
    case 'ADVANCE_PAID':
    case 'READY_TO_DISPATCH':
    case 'DISPATCHED':
    case 'IN_PROGRESS':
    case 'OPEN':
    case 'SUBMITTED':
    case 'DOCUMENTS_PENDING':
      return 'orange';
    case 'DISBURSED':
      return 'green';
    case 'UNKNOWN':
    default:
      return 'gray';
  }
}

export function systemLabel(type?: string | null) {
  return type === 'OFF_GRID' ? 'Off-Grid' : 'On-Grid';
}

export function daysLeft(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function todayInputValue() {
  return dayjs().format('YYYY-MM-DD');
}

export function toInputDateTime(value?: string | Date | null) {
  if (!value) return '';
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
}
