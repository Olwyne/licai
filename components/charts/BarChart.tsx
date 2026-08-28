"use client"
import { Bar } from "react-chartjs-2"
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from "chart.js"
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface BarSeries { label: string; data: number[]; color: string }
interface Props { labels: string[]; series: BarSeries[] }

export function BarChart({ labels, series }: Props) {
  const data = {
    labels,
    datasets: series.map(s => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.color,
      borderRadius: 4,
      borderSkipped: false as const,
    })),
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(128,128,128,0.15)" },
        ticks: { callback: (v: number | string) => `${v} €` },
      },
    },
  } as const

  return <Bar data={data} options={options} />
}
