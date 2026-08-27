import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  Filler
} from 'chart.js';
import { formatCurrency } from '$lib/utils/format';

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, Filler);

function getThemeColors() {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    primary: 'rgb(59, 130, 246)',
    primaryAlpha: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
    primaryHover: 'rgb(37, 99, 235)',
    text: isDark ? 'rgb(203, 213, 225)' : 'rgb(71, 85, 105)',
    textPrimary: isDark ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)',
    border: isDark ? 'rgb(71, 85, 105)' : 'rgb(203, 213, 225)',
    gridColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.5)',
    tooltipBg: isDark ? 'rgb(30, 41, 59)' : 'rgb(248, 250, 252)'
  };
}

function formatCurrencyShort(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

export const dashboardChartOptions: any = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: () => getThemeColors().tooltipBg,
      titleColor: () => getThemeColors().textPrimary,
      bodyColor: () => getThemeColors().textPrimary,
      borderColor: () => getThemeColors().border,
      borderWidth: 2,
      cornerRadius: 8,
      displayColors: false,
      titleFont: { size: 14, weight: 'bold' as any },
      bodyFont: { size: 13 },
      callbacks: { label: (context: any) => `Pendapatan: ${formatCurrency(context.parsed.y)}` }
    }
  },
  scales: {
    x: {
      display: true,
      grid: { display: false, color: () => getThemeColors().border },
      border: { display: false, color: () => getThemeColors().border },
      ticks: { color: () => getThemeColors().text, font: { family: 'Inter, system-ui, sans-serif' } }
    },
    y: {
      display: true,
      grid: { color: () => getThemeColors().gridColor, borderDash: [3, 3], lineWidth: 1 },
      border: { display: false, color: () => getThemeColors().border },
      ticks: {
        color: () => getThemeColors().text,
        font: { family: 'Inter, system-ui, sans-serif' },
        callback: (value: number) => formatCurrencyShort(value)
      }
    }
  },
  elements: {
    point: { radius: 0, hoverRadius: 8, borderWidth: 2, hoverBorderWidth: 3 },
    line: { borderWidth: 3 }
  },
  interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false }
};

function formatChartLabel(item: any, view: string) {
  const date = new Date(item.date);
  if (view === 'year') return item.year || date.getFullYear().toString();
  if (view === 'week') return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
  return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

export function createDashboardChartData(salesTrend: any[], view: string) {
  if (!salesTrend.length) return { labels: [], datasets: [] };
  const colors = getThemeColors();
  return {
    labels: salesTrend.map((item) => formatChartLabel(item, view)),
    datasets: [{
      label: 'Pendapatan',
      data: salesTrend.map((item) => parseFloat(item.revenue) || 0),
      borderColor: colors.primary,
      backgroundColor: colors.primaryAlpha,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: colors.primary,
      pointBorderColor: colors.primary,
      pointHoverBackgroundColor: colors.primaryHover,
      pointHoverBorderColor: colors.primaryHover,
      pointBorderWidth: 2,
      pointHoverBorderWidth: 3
    }]
  };
}

export function getChartDescription(view: string) {
  if (view === 'year') return 'Pendapatan 5 tahun terakhir';
  if (view === 'week') return 'Pendapatan 7 hari terakhir';
  return 'Pendapatan 6 bulan terakhir';
}

export function getChartPeriod(view: string) {
  if (view === 'year') return '5 tahun terakhir';
  if (view === 'week') return '7 hari terakhir';
  return '6 bulan terakhir';
}

export function getTrendData(salesTrend: any[]) {
  if (salesTrend.length < 2) return { percentage: 0, isUp: true };
  const latest = parseFloat(salesTrend.at(-1)?.revenue || 0);
  const previous = parseFloat(salesTrend.at(-2)?.revenue || 0);
  if (previous === 0) return { percentage: 0, isUp: true };
  const percentage = ((latest - previous) / previous) * 100;
  return { percentage: Math.abs(percentage).toFixed(1), isUp: percentage >= 0 };
}
