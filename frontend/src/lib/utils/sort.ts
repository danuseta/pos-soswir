function isNumeric(value: any) {
  return value !== '' && value !== null && value !== undefined && typeof value !== 'boolean' && Number.isFinite(Number(value));
}

export function compareValues(left: any, right: any): number {
  if (isNumeric(left) && isNumeric(right)) return Number(left) - Number(right);
  if (left === right) return 0;
  return left > right ? 1 : -1;
}
