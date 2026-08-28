"use client"
import { Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js"
ChartJS.register(ArcElement, Tooltip, Legend)

interface DonutSlice { label: string; value: number; color: string }
interface Props { slices: DonutSlice[]; centerLabel?: string }

export function DonutChart({ slices, centerLabel }: Props) {
  const data = {
    labels: slices.map(s => s.label),
    datasets: [{
      data: slices.map(s => s.value),
      backgroundColor: slices.map(s => s.color),
      borderWidth: 2,
      borderColor: "transparent",
      hoverOffset: 4,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; formattedValue: string }) =>
            `${ctx.label}: ${ctx.formattedValue} €`,
        },
      },
    },
    cutout: "70%",
  } as const

  return (
    <div className="donut-wrap">
      <Doughnut data={data} options={options} />
      {centerLabel && <div className="donut-center">{centerLabel}</div>}
    </div>
  )
}
