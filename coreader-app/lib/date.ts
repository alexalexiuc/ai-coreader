export function formatRelativeDate(iso?: string, format = 'YYYY-MM-DD') {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';

  const parts = {
    YYYY: String(d.getFullYear()),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  } as const;

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => parts[token as keyof typeof parts]);
}
