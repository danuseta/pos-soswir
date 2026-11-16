const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const wibFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

function wibParts(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day, hours: 0, minutes: 0 };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(wibFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours: Number(parts.hour),
    minutes: Number(parts.minute)
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const p = wibParts(dateString);
  if (!p) return '';
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${pad(p.hours)}.${pad(p.minutes)}`;
}

export function formatTransactionDateTime(dateString: string): string {
  const p = dateString ? wibParts(dateString) : null;
  if (!p) return 'Tanggal tidak valid';
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hours)}:${pad(p.minutes)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function formatCompactNumber(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    compactDisplay: 'short'
  }).format(amount || 0);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const p = wibParts(dateString);
  if (!p) return '';
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

export function formatTime(dateString: string): string {
  if (!dateString) return '';
  const p = wibParts(dateString);
  if (!p) return '';
  return `${pad(p.hours)}.${pad(p.minutes)}`;
}

export function getCurrentWIBDateTime(): string {
  const now = new Date();
  
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  const year = wibTime.getUTCFullYear();
  const month = wibTime.getUTCMonth() + 1;
  const day = wibTime.getUTCDate();
  const hours = wibTime.getUTCHours();
  const minutes = wibTime.getUTCMinutes();
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                     'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  
  return `${day} ${monthNames[month - 1]} ${year}, ${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}`;
}

export function parseWIBDateTime(dateString: string): Date {
  if (!dateString) return new Date();
  
  const parts = dateString.replace('T', ' ').split(' ');
  const datePart = parts[0];
  const timePart = parts[1] ? parts[1].split('.')[0] : '00:00:00';
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
} 