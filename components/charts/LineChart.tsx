"use client"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type TooltipItem,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface LineSeries {
  label: string
  data: number[]
  color: string
}

interface Props {
  labels: string[]
  series: LineSeries[]
  yFormatter?: (v: number | string) => string
}

export function LineChart({ labels, series, yFormatter }: Props) {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.color + "22",
      borderWidth: 2,
      pointRadius: labels.length > 20 ? 0 : 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.3,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: series.length > 1,
        labels: { boxWidth: 12, font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"line">) => {
            const label = ctx.dataset.label ?? ""
            const y = ctx.parsed.y ?? 0
            const val = yFormatter ? yFormatter(y) : String(y)
            return `${label}: ${val}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(128,128,128,0.15)" },
        ticks: {
          callback: (v: number | string) =>
            yFormatter ? yFormatter(v) : String(v),
        },
      },
    },
  } as const

  return <Line data={data} options={options} />
}
