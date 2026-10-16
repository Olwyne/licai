"use client"
import { Bar, Line } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js"
import { chartColors, useThemeTick } from "@/components/features/finance/useThemeTick"
import { eur } from "@/lib/finance/format"

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const kfmt = (v: number | string) => {
  const n = Number(v)
  return Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(0)}k` : Math.round(n).toLocaleString("fr-FR")
}

export function FlowBars({ labels, rev, dep }: { labels: string[]; rev: number[]; dep: number[] }) {
  useThemeTick()
  const { grid, fg, card } = chartColors()
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: "Revenus", data: rev, backgroundColor: "#1D9E75", borderRadius: 4, borderSkipped: false },
          { label: "Dépenses", data: dep, backgroundColor: "#D85A30", borderRadius: 4, borderSkipped: false },
        ],
      }}
      options={{
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: true, position: "top", align: "end", labels: { color: fg, boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: "circle", padding: 14 } },
          tooltip: { backgroundColor: card, titleColor: fg, bodyColor: fg, callbacks: { label: (c) => `${c.dataset.label} : ${eur(c.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: fg, maxRotation: 0 } },
          y: { grid: { color: grid }, border: { display: false }, ticks: { color: fg, maxTicksLimit: 5, callback: kfmt } },
        },
      }}
    />
  )
}

export function SoldeLine({ labels, values, color = "#1D9E75" }: { labels: string[]; values: number[]; color?: string }) {
  useThemeTick()
  const { grid, fg, card } = chartColors()
  return (
    <Line
      data={{
        labels,
        datasets: [{
          label: "Trésorerie", data: values, borderColor: color, borderWidth: 2, tension: 0.35, pointRadius: values.length > 12 ? 0 : 3, pointHoverRadius: 5,
          fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx
            const area = chart.chartArea
            if (!area) return `${color}22`
            const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
            g.addColorStop(0, `${color}47`); g.addColorStop(1, `${color}00`)
            return g
          },
        }],
      }}
      options={{
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: card, titleColor: fg, bodyColor: fg, callbacks: { label: (c) => eur(c.parsed.y ?? 0) } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: fg, maxTicksLimit: 8, maxRotation: 0, autoSkip: true } },
          y: { grid: { color: grid }, border: { display: false }, ticks: { color: fg, maxTicksLimit: 5, callback: kfmt } },
        },
      }}
    />
  )
}
