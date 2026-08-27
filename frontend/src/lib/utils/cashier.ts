function parseServerDate(value: string) {
  if (!value) return null;
  if (!value.includes('Z') && !value.includes('+') && !value.includes('-')) return new Date(`${value}Z`);
  return new Date(value);
}

export function formatCashierDate(value: string) {
  const date = parseServerDate(value);
  return date?.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta'
  }) || '';
}

export function formatCashierTime(value: string) {
  const date = parseServerDate(value);
  return date?.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
  }) || '';
}

export function formatCashierDateOnly(value: string) {
  const date = parseServerDate(value);
  return date?.toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta'
  }) || '';
}

export function formatShiftTime(value: unknown) {
  return String(value).slice(0, 5);
}

export function isCashierOnline(cashier: any) {
  const activityTimestamp = cashier.last_activity || cashier.last_login;
  if (!activityTimestamp) return false;
  const lastActivity = parseServerDate(activityTimestamp);
  return Boolean(lastActivity && (Date.now() - lastActivity.getTime()) / 60_000 < 5);
}

export function filterCashiers(cashiers: any[], search: string, sortField: string, sortDirection: string) {
  const query = search.toLowerCase();
  return cashiers.filter((cashier) => cashier.username.toLowerCase().includes(query)).sort((a, b) => {
    let aValue = a[sortField] || '';
    let bValue = b[sortField] || '';
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    const result = aValue > bValue ? 1 : -1;
    return sortDirection === 'asc' ? result : -result;
  });
}

export function groupCashiers(cashiers: any[], shifts: any[]) {
  return [
    ...shifts.map((shift) => ({ shift, cashiers: cashiers.filter((cashier) => cashier.shift_id === shift.id) })),
    { shift: null, cashiers: cashiers.filter((cashier) => !cashier.shift_id) }
  ];
}

export function validateCashier(cashier: any, isEditing: boolean) {
  if (!cashier.username) return 'Username tidak boleh kosong';
  if (cashier.username.length < 3) return 'Username minimal 3 karakter';
  if (!isEditing && !cashier.password) return 'Password tidak boleh kosong untuk kasir baru';
  if (cashier.password && cashier.password.length < 6) return 'Password minimal 6 karakter';
  if (cashier.password !== cashier.confirmPassword) return 'Konfirmasi password tidak cocok';
  return null;
}
