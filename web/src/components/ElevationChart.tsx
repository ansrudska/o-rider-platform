import { useRef, useCallback } from "react";
import { Line } from "react-chartjs-2";
import type { ChartEvent, ActiveElement, Chart } from "chart.js";
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
  /** Optional performance overlay datasets */
  overlays?: OverlayDataset[];
}

export default function ElevationChart({
  data,
  height = 180,
  onHoverIndex,
  overlays,
}: ElevationChartProps) {
  const chartRef = useRef<Chart<"line">>(null);
  const hasOverlays = overlays && overlays.length > 0;

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
        label: "고도 (m)",
        data: data.map((d) => d.elevation),
        fill: true,
        backgroundColor: "rgba(34, 197, 94, 0.15)",
        borderColor: "rgba(34, 197, 94, 0.8)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#F97316",
        pointHoverBorderColor: "#fff",
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
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          onHover: handleHover,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = Math.round(ctx.parsed?.y ?? 0);
                  const ds = ctx.dataset as { label?: string };
                  return `${ds.label ?? ""}: ${val}`;
                },
              },
            },
            legend: hasOverlays
              ? { position: "bottom", labels: { font: { size: 10 }, padding: 12, usePointStyle: true } }
              : { display: false },
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
