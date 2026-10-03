import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { RANGES, breakGaps, combineHistories, filterHistory } from '../portfolio/history'
import useCurrency from '../currency/useCurrency'

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler)

// `histories` is one performanceHistory per account (raw CAD); they are summed into a single line
export default function PortfolioValueChart({ histories = [], title = 'Portfolio value' }) {
  const [range, setRange] = useState('ALL')
  // Values stay CAD in the dataset; formatMoney converts to the selected currency for display
  const { formatMoney } = useCurrency()

  const combined = useMemo(() => combineHistories(histories), [histories])
  const points = useMemo(() => breakGaps(filterHistory(combined, range)), [combined, range])

  const realPoints = points.filter((p) => p.marketValue !== null).length
  // Show dots when there are too few points to form a readable line
  const pointRadius = realPoints <= 2 ? 4 : 0

  const data = {
    datasets: [
      {
        data: points.map((p) => ({ x: p.date, y: p.marketValue })),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        spanGaps: false,
        pointRadius,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'time',
        time: { tooltipFormat: 'MMM d, yyyy' },
        // A lone point would otherwise get a zero-width axis
        ...(realPoints === 1 && {
          min: Date.parse(points[0].date) - 86400000,
          max: Date.parse(points[0].date) + 86400000,
        }),
      },
      y: {
        ticks: { callback: (value) => formatMoney(value) },
      },
    },
    plugins: {
      tooltip: {
        callbacks: { label: (ctx) => formatMoney(ctx.parsed.y) },
      },
    },
  }

  return (
    <section className="value-chart" aria-label={title}>
      <div className="value-chart__header">
        <h2 className="value-chart__title">{title}</h2>
        <div className="value-chart__ranges" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              className={r === range ? 'value-chart__range value-chart__range--active' : 'value-chart__range'}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="value-chart__canvas">
        {realPoints === 0 ? <p>No history available for this range.</p> : <Line data={data} options={options} />}
      </div>
    </section>
  )
}
