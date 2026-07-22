import fs from 'node:fs'
import path from 'node:path'
import type {
  BenchmarkRunResult,
  SuiteResult,
  BenchmarkResult,
  EnvironmentInfo,
} from './types'

export function generateHtmlReport(
  result: BenchmarkRunResult,
  outputDir: string,
): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boltdocs Benchmark Report - ${result.id}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-hover: #334155;
      --border: #334155;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #06b6d4;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }

    .container { max-width: 1400px; margin: 0 auto; }

    header {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      background: var(--surface);
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, var(--primary), var(--info));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    header .meta {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--surface);
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid var(--border);
      text-align: center;
    }

    .stat-card .label {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--primary);
    }

    .stat-card .unit {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .section {
      background: var(--surface);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .section h2 {
      font-size: 1.3rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .chart-container {
      position: relative;
      height: 400px;
      margin: 1rem 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    tr:hover td { background: var(--surface-hover); }

    .latency { color: var(--warning); }
    .throughput { color: var(--success); }
    .rme { color: var(--text-muted); font-size: 0.8rem; }

    .env-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 0.75rem;
    }

    .env-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .env-item .key { color: var(--text-muted); }
    .env-item .val { font-weight: 500; }

    .suite-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .suite-tab {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }

    .suite-tab:hover, .suite-tab.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }

    @media (max-width: 768px) {
      body { padding: 1rem; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Boltdocs Benchmark Report</h1>
      <div class="meta">
        Run ID: ${result.id} | ${new Date(result.timestamp).toLocaleString()} | Node ${result.environment.nodeVersion}
      </div>
    </header>

    <div class="stats-grid">
      ${generateStatCards(result)}
    </div>

    <div class="section">
      <h2>Environment</h2>
      <div class="env-grid">
        ${generateEnvironmentInfo(result.environment)}
      </div>
    </div>

    ${generateSuiteSections(result)}
  </div>

  <script>
    ${generateCharts(result)}
  </script>
</body>
</html>`

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `benchmark-${result.id}.html`)
  fs.writeFileSync(outputPath, html)
  return outputPath
}

function generateStatCards(result: BenchmarkRunResult): string {
  const totalTasks = result.suites.reduce((acc, s) => acc + s.tasks.length, 0)
  const allTasks = result.suites.flatMap((s) => s.tasks)

  if (allTasks.length === 0) {
    return `
    <div class="stat-card">
      <div class="label">Total Suites</div>
      <div class="value">${result.suites.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Tasks</div>
      <div class="value">0</div>
    </div>
    <div class="stat-card">
      <div class="label">Status</div>
      <div class="value">No tasks completed</div>
    </div>
  `
  }

  const fastestTask = allTasks.reduce((fastest, task) =>
    task.latency.mean < fastest.latency.mean ? task : fastest,
  )
  const slowestTask = allTasks.reduce((slowest, task) =>
    task.latency.mean > slowest.latency.mean ? task : slowest,
  )

  return `
    <div class="stat-card">
      <div class="label">Total Suites</div>
      <div class="value">${result.suites.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Tasks</div>
      <div class="value">${totalTasks}</div>
    </div>
    <div class="stat-card">
      <div class="label">Fastest</div>
      <div class="value latency">${formatDuration(fastestTask.latency.mean)}</div>
      <div class="unit">${fastestTask.task}</div>
    </div>
    <div class="stat-card">
      <div class="label">Slowest</div>
      <div class="value latency">${formatDuration(slowestTask.latency.mean)}</div>
      <div class="unit">${slowestTask.task}</div>
    </div>
  `
}

function generateEnvironmentInfo(env: EnvironmentInfo): string {
  return `
    <div class="env-item">
      <span class="key">Node.js</span>
      <span class="val">${env.nodeVersion}</span>
    </div>
    <div class="env-item">
      <span class="key">Platform</span>
      <span class="val">${env.platform} ${env.arch}</span>
    </div>
    <div class="env-item">
      <span class="key">CPU</span>
      <span class="val">${env.cpuModel}</span>
    </div>
    <div class="env-item">
      <span class="key">Cores</span>
      <span class="val">${env.cpuCores}</span>
    </div>
    <div class="env-item">
      <span class="key">Memory</span>
      <span class="val">${env.totalMemory}</span>
    </div>
  `
}

function generateSuiteSections(result: BenchmarkRunResult): string {
  return result.suites
    .map(
      (suite, idx) => `
    <div class="section">
      <h2>${suite.name}</h2>
      <div class="chart-container">
        <canvas id="chart-${idx}"></canvas>
      </div>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Latency (mean)</th>
            <th>Latency (min)</th>
            <th>Latency (max)</th>
            <th>Latency (p50)</th>
            <th>Latency (p995)</th>
            <th>Latency (p99)</th>
            <th>Latency (p999)</th>
            <th>Throughput (ops/s)</th>
            <th>Samples</th>
            <th>RME</th>
            <th>CV</th>
          </tr>
        </thead>
        <tbody>
          ${suite.tasks
            .map(
              (task) => `
            <tr>
              <td>${task.task}</td>
              <td class="latency">${formatDuration(task.latency.mean)}</td>
              <td class="latency">${formatDuration(task.latency.min)}</td>
              <td class="latency">${formatDuration(task.latency.max)}</td>
              <td class="latency">${formatDuration(task.latency.median)}</td>
              <td class="latency">${formatDuration(task.latency.p995)}</td>
              <td class="latency">${formatDuration(task.latency.p99)}</td>
              <td class="latency">${formatDuration(task.latency.p999)}</td>
              <td class="throughput">${formatNumber(task.throughput.mean)} ops/s</td>
              <td>${task.samples}</td>
              <td class="rme">±${task.latency.rme.toFixed(2)}%</td>
              <td class="rme">${task.latency.cv.toFixed(2)}%</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `,
    )
    .join('')
}

function generateCharts(result: BenchmarkRunResult): string {
  return result.suites
    .map(
      (suite, idx) => `
    new Chart(document.getElementById('chart-${idx}'), {
      type: 'bar',
      data: {
        labels: [${suite.tasks.map((t) => `'${t.task}'`).join(', ')}],
        datasets: [{
          label: 'Latency (ms)',
          data: [${suite.tasks.map((t) => t.latency.mean.toFixed(2)).join(', ')}],
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        }, {
          label: 'Throughput (ops/s)',
          data: [${suite.tasks.map((t) => t.throughput.mean.toFixed(0)).join(', ')}],
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Latency (ms)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: '#334155' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Throughput (ops/s)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  `,
    )
    .join('')
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}
