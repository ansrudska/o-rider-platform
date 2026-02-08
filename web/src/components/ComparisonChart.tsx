import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ComparisonChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
  height?: number;
  unit?: string;
}

export default function ComparisonChart({
  labels,
  datasets,
  height = 200,
  unit = "",
}: ComparisonChartProps) {
  const chartData = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color,
      borderRadius: 3,
      barPercentage: 0.8,
      categoryPercentage: 0.7,
    })),
  };

  return (
    <div style={{ height }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { size: 11 }, padding: 12, usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${ctx.dataset.label}: ${ctx.parsed.y}${unit}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: "#6b7280" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.04)" },
              ticks: {
                font: { size: 10 },
                color: "#9ca3af",
                callback: (v) => `${v}${unit}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
