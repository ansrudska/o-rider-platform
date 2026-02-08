import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

interface ElevationChartProps {
  data: { distance: number; elevation: number }[];
  height?: number;
}

export default function ElevationChart({
  data,
  height = 180,
}: ElevationChartProps) {
  const chartData = {
    labels: data.map((d) => `${(d.distance / 1000).toFixed(1)}km`),
    datasets: [
      {
        data: data.map((d) => d.elevation),
        fill: true,
        backgroundColor: "rgba(34, 197, 94, 0.15)",
        borderColor: "rgba(34, 197, 94, 0.8)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Line
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `고도: ${ctx.parsed.y}m`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 10 },
                color: "#9ca3af",
                maxTicksLimit: 8,
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.04)" },
              ticks: {
                font: { size: 10 },
                color: "#9ca3af",
                callback: (v) => `${v}m`,
              },
            },
          },
        }}
      />
    </div>
  );
}
