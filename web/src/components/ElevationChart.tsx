import { useRef, useCallback } from "react";
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

function gradeColor(grade: number): string {
  if (grade < 3) return "#22c55e";
  if (grade < 6) return "#eab308";
  if (grade < 10) return "#f97316";
  return "#ef4444";
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
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
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

  const chartData = {
    labels: data.map((d) => `${(d.distance / 1000).toFixed(1)}`),
    datasets: [
      {
        label: "\uACE0\uB3C4 (m)",
        data: data.map((d) => d.elevation),
        fill: true,
        backgroundColor: "rgba(34, 197, 94, 0.08)",
        borderColor: "#22c55e",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#F97316",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        tension: 0.4,
        yAxisID: "yElev",
        segment: {
          borderColor: (ctx: { p0DataIndex: number; p1DataIndex: number }) => {
            const d0 = data[ctx.p0DataIndex];
            const d1 = data[ctx.p1DataIndex];
            if (!d0 || !d1) return "#22c55e";
            const dist = d1.distance - d0.distance;
            if (dist <= 0) return "#22c55e";
            return gradeColor(((d1.elevation - d0.elevation) / dist) * 100);
          },
        },
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
                color: "#9ca3af",
                maxTicksLimit: 10,
              },
              title: { display: true, text: "km", font: { size: 10 }, color: "#9ca3af" },
            },
            yElev: {
              type: "linear",
              position: "left",
              grid: { color: "rgba(0,0,0,0.04)" },
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
