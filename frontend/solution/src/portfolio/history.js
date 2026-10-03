// Pure helpers over date series: [{ date: 'YYYY-MM-DD', value }] (account value, price, ...), sorted by date

export const RANGES = ['1D', '1M', 'YTD', '1Y', 'ALL']

const DAY_MS = 86400000

// 'YYYY-MM-DD' <-> UTC milliseconds
const toTime = (date) => Date.parse(`${date}T00:00:00Z`)
const toDate = (time) => new Date(time).toISOString().slice(0, 10)

// Same day `months` earlier (UTC), clamped to the month's last day so Mar 31 - 1 month is Feb 28/29,
// not Mar 3 as Date#setUTCMonth would overflow to
function monthsBefore(now, months) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() - months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Date.UTC(year, month, Math.min(now.getUTCDate(), lastDay))
}

// First date (inclusive) of the window, as 'YYYY-MM-DD'; null means no lower bound
export function rangeStart(range, now) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  switch (range) {
    case '1D':
      return toDate(today - DAY_MS)
    case '1M':
      return toDate(monthsBefore(now, 1))
    case 'YTD':
      // Calendar year, not the dataset's start
      return toDate(Date.UTC(now.getUTCFullYear(), 0, 1))
    case '1Y':
      return toDate(monthsBefore(now, 12))
    default:
      return null
  }
}

// Short history just returns what exists in the window instead of erroring
export function filterHistory(history = [], range = 'ALL', now = new Date()) {
  const start = rangeStart(range, now)
  return start ? history.filter((point) => point.date >= start) : history
}

// Sum several accounts' histories by date. An account missing a date carries its last known
// value forward so a gap in one account doesn't read as a drop in the total. Dates before
// every account has reported are skipped, since the total there would be incomplete.
export function combineHistories(histories = []) {
  const series = histories.filter((h) => h?.length)
  if (series.length <= 1) return series[0] ?? []

  const dates = [...new Set(series.flatMap((h) => h.map((p) => p.date)))].sort()
  const cursors = series.map(() => 0)
  const last = series.map(() => null)
  const combined = []

  for (const date of dates) {
    series.forEach((h, i) => {
      while (cursors[i] < h.length && h[cursors[i]].date <= date) {
        last[i] = h[cursors[i]].value
        cursors[i]++
      }
    })
    if (last.every((v) => v !== null)) {
      combined.push({ date, value: last.reduce((sum, v) => sum + v, 0) })
    }
  }
  return combined
}

// Insert null breaks where the spacing jumps well past the series' usual interval, so a chart
// with spanGaps off leaves the gap empty instead of drawing a straight line across it
export function breakGaps(history = []) {
  if (history.length < 3) return history

  const steps = history.slice(1).map((p, i) => toTime(p.date) - toTime(history[i].date)).sort((a, b) => a - b)
  const typical = steps[Math.floor(steps.length / 2)]

  return history.flatMap((point, i) => {
    if (i === 0) return [point]
    const prev = toTime(history[i - 1].date)
    if (toTime(point.date) - prev <= typical * 1.5) return [point]
    return [{ date: toDate(prev + typical), value: null }, point]
  })
}

// API performanceHistory uses `marketValue`; the chart helpers use a generic `value`
export const fromPerformanceHistory = (history = []) =>
  history.map((point) => ({ date: point.date, value: point.marketValue }))

// Holding detail priceHistory uses `price`; map it to the same generic `value`
export const fromPriceHistory = (history = []) =>
  history.map((point) => ({ date: point.date, value: point.price }))
