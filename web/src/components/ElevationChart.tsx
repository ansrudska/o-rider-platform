import { useRef, useCallback, useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { ChartEvent, ActiveElement, Chart, Plugin } from "chart.js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

function isDarkMode() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

const crosshairPlugin: Plugin<"line"> = {
  id: "crosshair",
  beforeDraw(chart) {
    const active = chart.getActiveElements();
    const first = active[0];
    if (!first) return;
    const { x } = first.element;
    const area = chart.chartArea;
    if (!area) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isDarkMode() ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export interface OverlayDataset {
  label: string;
  data: number[];
  color: string;
  yAxisID: string;
  unit?: string;
}

interface ElevationChartProps {
  data: { distance: number; elevation: number }[];
  height?: number;
  onHoverIndex?: (index: number | null) => void;
  overlays?: OverlayDataset[];
}

export default function ElevationChart({
  data,
  height = 180,
  onHoverIndex,
  overlays,
}: ElevationChartProps) {
  const chartRef = useRef<Chart<"line">>(null);

  const handleHover = useCallback(
    (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!onHoverIndex) return;
      if (elements.length > 0 && elements[0] != null) {
        onHoverIndex(elements[0].index);
      } else {
        onHoverIndex(null);
      }
    },
    [onHoverIndex],
  );

  const handleLeave = useCallback(() => {
    onHoverIndex?.(null);
  }, [onHoverIndex]);

  const dark = useMemo(() => isDarkMode(), []);
  const tickColor = dark ? "#6b7280" : "#9ca3af";
  const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  const chartData = {
    labels: data.map((d) => `${(d.distance / 1000).toFixed(1)}`),
    datasets: [
      {
        label: "\uACE0\uB3C4 (m)",
        data: data.map((d) => d.elevation),
        fill: true,
        backgroundColor: dark ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.08)",
        borderColor: "#22c55e",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#F97316",
        pointHoverBorderColor: dark ? "#1f2937" : "#fff",
        pointHoverBorderWidth: 2,
        tension: 0.4,
        yAxisID: "yElev",
      },
      ...(overlays ?? []).map((o) => ({
        label: o.label,
        data: o.data,
        borderColor: o.color,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        yAxisID: o.yAxisID,
      })),
    ],
  };

  // Build dynamic scales for overlays
  const overlayScales: Record<string, object> = {};
  if (overlays) {
    for (const o of overlays) {
      overlayScales[o.yAxisID] = {
        type: "linear" as const,
        position: "right" as const,
        display: false,
      };
    }
  }

  return (
    <div style={{ height }} onMouseLeave={handleLeave}>
      <Line
        ref={chartRef}
        data={chartData}
        plugins={[crosshairPlugin]}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          onHover: handleHover,
          plugins: {
            tooltip: { enabled: false },
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 10 },
                color: tickColor,
                maxTicksLimit: 10,
              },
              title: { display: true, text: "km", font: { size: 10 }, color: tickColor },
            },
            yElev: {
              type: "linear",
              position: "left",
              grid: { color: gridColor },
              ticks: {
                font: { size: 10 },
                color: "rgba(34,197,94,0.6)",
                callback: (v) => `${v}m`,
              },
            },
            ...overlayScales,
          },
        }}
      />
    </div>
  );
}
