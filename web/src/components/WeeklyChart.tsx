import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import type { WeeklyStat } from "../data/demo";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface WeeklyChartProps {
  data: WeeklyStat[];
  dataKey?: "distance" | "time" | "elevation";
  height?: number;
}

const LABEL_MAP = {
  distance: { label: "거리 (km)", color: "rgba(249, 115, 22, 0.7)" },
  time: { label: "시간 (h)", color: "rgba(59, 130, 246, 0.7)" },
  elevation: { label: "고도 (m)", color: "rgba(34, 197, 94, 0.7)" },
};

export default function WeeklyChart({
  data,
  dataKey = "distance",
  height = 150,
}: WeeklyChartProps) {
  const config = LABEL_MAP[dataKey];

  const chartData = {
    labels: data.map((d) => d.week),
    datasets: [
      {
        data: data.map((d) => d[dataKey]),
        backgroundColor: config.color,
        borderRadius: 3,
        barPercentage: 0.7,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `${config.label}: ${ctx.parsed.y}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, color: "#9ca3af" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.04)" },
              ticks: { font: { size: 10 }, color: "#9ca3af" },
            },
          },
        }}
      />
    </div>
  );
}
