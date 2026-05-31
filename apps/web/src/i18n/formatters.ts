export function createIntlFormatters(intlLocale: string) {
  const formatUsd = (value: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);

  const formatDate = (date: string) => {
    const normalized = date.includes('T') ? date.slice(0, 10) : date;
    return new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${normalized}T00:00:00`));
  };

  const formatDateTime = (isoDate: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoDate));

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return new Intl.DateTimeFormat(intlLocale, { month: 'short', year: '2-digit' }).format(date);
  };

  return { formatUsd, formatPercent, formatDate, formatDateTime, formatMonthLabel };
}
