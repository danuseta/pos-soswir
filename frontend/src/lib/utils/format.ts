
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  
  const parts = dateString.replace('T', ' ').split(' ');
  const datePart = parts[0];
  const timePart = parts[1] ? parts[1].split('.')[0] : '00:00:00';
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                     'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  
  return `${day} ${monthNames[month - 1]} ${year}, ${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}`;
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
  
  const parts = dateString.replace('T', ' ').split(' ');
  const datePart = parts[0];
  
  const [year, month, day] = datePart.split('-').map(Number);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                     'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  
  return `${day} ${monthNames[month - 1]} ${year}`;
}

export function formatTime(dateString: string): string {
  if (!dateString) return '';
  
  const parts = dateString.replace('T', ' ').split(' ');
  const timePart = parts[1] ? parts[1].split('.')[0] : '00:00:00';
  
  const [hours, minutes] = timePart.split(':').map(Number);
  
  return `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}`;
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