import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import apiService from '../services/apiService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const formatCount = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
const formatKg = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0));

const ExecutiveOverview = ({ filters, selectedReport, loading, summaryData, summaryLoading, comparisonData, onDrilldown }) => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    commodityPortfolio: null,
    topImporters: null,
    topExporters: null,
    monthlyPulse: null,
    hhi: null,
    topPorts: null,
    importerShare: null,
    momentum: null,
    originMonthly: null,
    partnerLoyalty: null,
  });
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedFilters = useMemo(() => ({
    startDate: filters?.startDate || '',
    endDate: filters?.endDate || '',
    item: filters?.item || '',
    importer: filters?.importer || '',
    exporter: filters?.exporter || '',
    origin_country_id: filters?.origin_country_id || '',
    chapter: filters?.chapter || '',
  }), [filters]);

  useEffect(() => {
    if (selectedReport !== 'overview' || loading) return;

    let active = true;
    const fetchOverview = async () => {
      setViewLoading(true);
      setError(null);
      try {
        const [commodityPortfolio, topImporters, topExporters, monthlyPulse, hhi, topPorts, importerShare, momentum, originMonthly, partnerLoyalty] = await Promise.all([
          apiService.aiCommodityPortfolio(normalizedFilters),
          apiService.aiTopImporters(normalizedFilters),
          apiService.aiTopExporters(normalizedFilters),
          apiService.aiMonthlyPulse(normalizedFilters),
          apiService.aiHHI(normalizedFilters),
          apiService.aiTopPorts(normalizedFilters),
          apiService.aiImporterShare(normalizedFilters),
          apiService.aiMomentum(normalizedFilters),
          apiService.aiOriginMonthly(normalizedFilters),
          apiService.aiPartnerLoyalty(normalizedFilters),
        ]);

        if (!active) return;
        setData({
          commodityPortfolio,
          topImporters,
          topExporters,
          monthlyPulse,
          hhi,
          topPorts,
          importerShare,
          momentum,
          originMonthly,
          partnerLoyalty,
        });
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load overview data');
      } finally {
        if (active) setViewLoading(false);
      }
    };

    fetchOverview();

    return () => {
      active = false;
    };
  }, [normalizedFilters, selectedReport, loading]);

  const isDarkTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const chartTickColor = isDarkTheme ? '#cbd5e1' : '#475569';
  const chartGridColor = isDarkTheme ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.28)';
  const legendColor = isDarkTheme ? '#e2e8f0' : '#334155';

  const monthlyPulseData = data.monthlyPulse
    ? {
        labels: data.monthlyPulse.months || [],
        datasets: [
          {
            label: 'Total Quantity (KG)',
            data: data.monthlyPulse.total_kg || [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.18)',
            fill: true,
            tension: 0.38,
            borderWidth: 2,
          },
        ],
      }
    : null;

  const importerShareData = data.importerShare
    ? {
        labels: (data.importerShare.importers || []).slice(0, 8).map((row) => row.importer),
        datasets: [
          {
            label: 'Share %',
            data: (data.importerShare.importers || []).slice(0, 8).map((row) => row.share_pct),
            backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'],
            borderColor: '#fff',
            borderWidth: 2,
          },
        ],
      }
    : null;

  const topPortsData = data.topPorts
    ? {
        labels: (data.topPorts.ports || []).map((row) => row.port),
        datasets: [
          {
            label: 'Quantity (KG)',
            data: (data.topPorts.ports || []).map((row) => row.quantity_kg),
            backgroundColor: '#10b981',
            borderRadius: 8,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: legendColor } },
    },
    scales: {
      x: { ticks: { color: chartTickColor }, grid: { color: chartGridColor } },
      y: {
        ticks: { color: chartTickColor, callback: (value) => Number(value).toLocaleString() },
        grid: { color: chartGridColor },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: legendColor } },
    },
  };

  const commodityRows = useMemo(() => data.commodityPortfolio?.commodities || [], [data.commodityPortfolio]);
  const topImporterRows = useMemo(() => data.topImporters?.importers || [], [data.topImporters]);
  const topExporterRows = useMemo(() => data.topExporters?.exporters || [], [data.topExporters]);
  const topSignal = summaryData?.ai_pulse?.message || 'Filtered performance signals are loading.';
  const signalTag = summaryData?.ai_pulse?.tag || 'Monitoring';

  const concentrationData = data.hhi
    ? {
        labels: ['Fragmentation', 'Concentration'],
        datasets: [
          {
            data: [Math.max(0, 3500 - Number(data.hhi.hhi || 0)), Math.min(3500, Number(data.hhi.hhi || 0))],
            backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(245, 158, 11, 0.9)'],
            borderWidth: 0,
          },
        ],
      }
    : null;

  const topMoverRows = data.momentum?.products || [];
  const treemapRows = commodityRows.slice(0, 12);
  const heatmapRows = data.originMonthly?.origins || [];
  const flowRows = data.partnerLoyalty?.pairs || [];

  const anomalyFlags = useMemo(() => {
    const flags = [];
    const hhiValue = Number(data.hhi?.hhi || 0);
    const topCommodityShare = Number(commodityRows[0]?.share_pct || 0);
    if (hhiValue >= 2500) flags.push(`Highly concentrated market structure (${hhiValue} HHI).`);
    if (topCommodityShare >= 35) flags.push(`Top commodity concentration is high at ${topCommodityShare.toFixed(1)}%.`);
    if ((summaryData?.active_buyers || 0) && Number(summaryData.active_buyers) <= 3) flags.push('Low buyer diversity in the filtered set.');
    if (!flags.length) flags.push('No major concentration anomalies detected in the current filter window.');
    return flags;
  }, [commodityRows, data.hhi, summaryData]);

  const quickDrilldowns = [
    { label: 'Market Intel', action: () => (onDrilldown ? onDrilldown('market-intel') : navigate('/reports')) },
    { label: 'Strategic View', action: () => (onDrilldown ? onDrilldown('strategic') : navigate('/reports')) },
    { label: 'Importers', action: () => navigate('/trade-data?trade_type=import') },
    { label: 'Exporters', action: () => navigate('/trade-data?trade_type=export') },
  ];

  const kpis = [
    { label: 'Shipments', value: formatCount(summaryData?.shipments), tone: 'cyan' },
    { label: 'Active Buyers', value: formatCount(summaryData?.active_buyers), tone: 'emerald' },
    { label: 'Origin Countries', value: formatCount(summaryData?.origins), tone: 'amber' },
    { label: 'Total Volume KG', value: formatKg(summaryData?.total_quantity_kg), tone: 'slate' },
    { label: 'HHI', value: formatCount(data.hhi?.hhi), tone: 'rose' },
    { label: 'Market Status', value: data.hhi?.label || 'Loading', tone: 'violet' },
  ];

  if (viewLoading) {
    return <div className="ro-shell ro-loading">Loading executive overview...</div>;
  }

  if (error) {
    return <div className="ro-shell ro-error">{error}</div>;
  }

  return (
    <section className="ro-shell">
      <div className="ro-hero-strip">
        <div>
          <div className="ro-eyebrow">Overview</div>
          <h2 className="ro-title">Executive trade dashboard</h2>
          <p className="ro-copy">
            A concise operating view of trade volume, concentration, partner structure, and movement across the currently filtered dataset.
          </p>
        </div>
        <div className="ro-signal-card">
          <div className="ro-signal-tag">{signalTag}</div>
          <p>{topSignal}</p>
        </div>
      </div>

      <div className="ro-kpi-grid">
        {kpis.map((card) => (
          <article key={card.label} className={`ro-kpi tone-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{summaryLoading ? '—' : card.value}</strong>
          </article>
        ))}
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Quick drilldowns</h3>
              <p>Jump to the next analytical layer</p>
            </div>
          </div>
          <div className="ro-drill-grid">
            {quickDrilldowns.map((item) => (
              <button key={item.label} type="button" className="ro-drill-btn" onClick={item.action}>{item.label}</button>
            ))}
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Anomaly flags</h3>
              <p>Signals that may need review</p>
            </div>
          </div>
          <ul className="ro-flag-list">
            {anomalyFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Top movers</h3>
              <p>Fastest growing items in the selected window</p>
            </div>
          </div>
          <div className="ro-mover-list">
            {topMoverRows.slice(0, 6).map((row) => (
              <div key={`${row.rank}-${row.item}`} className="ro-mover-row">
                <div>
                  <strong>{row.item}</strong>
                  <span>{Number(row.dec_volume_kg || 0).toLocaleString()} KG</span>
                </div>
                <span className={Number(row.growth_pct || 0) >= 0 ? 'ro-growth-up' : 'ro-growth-down'}>
                  {Number(row.growth_pct || 0) >= 0 ? '+' : ''}{Number(row.growth_pct || 0)}%
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Comparison snapshot</h3>
              <p>{summaryLoading ? 'Loading current period' : 'Current period vs comparison window'}</p>
            </div>
          </div>
          <div className="ro-compare-grid">
            {[
              ['Shipments', summaryData?.shipments, comparisonData?.shipments],
              ['Active Buyers', summaryData?.active_buyers, comparisonData?.active_buyers],
              ['Volume KG', summaryData?.total_quantity_kg, comparisonData?.total_quantity_kg],
            ].map(([label, current, compare]) => (
              <div key={label} className="ro-compare-card">
                <span>{label}</span>
                <strong>{formatCount(current)}</strong>
                <em>vs {formatCount(compare)}</em>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel ro-panel-large">
          <div className="ro-panel-head">
            <div>
              <h3>Monthly trade pulse</h3>
              <p>Volume trend across the selected period</p>
            </div>
          </div>
          <div className="ro-chart">
            {monthlyPulseData ? <Line data={monthlyPulseData} options={chartOptions} /> : <div className="ro-empty">No monthly pulse data</div>}
          </div>
        </article>

        <article className="ro-panel ro-panel-large">
          <div className="ro-panel-head">
            <div>
              <h3>Top importer share</h3>
              <p>Concentration of inbound demand</p>
            </div>
          </div>
          <div className="ro-chart">
            {importerShareData ? <Pie data={importerShareData} options={pieOptions} /> : <div className="ro-empty">No importer share data</div>}
          </div>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Commodity treemap</h3>
              <p>Relative footprint of top commodities</p>
            </div>
          </div>
          <div className="ro-treemap">
            {treemapRows.length ? treemapRows.map((row) => (
              <div
                key={`${row.rank}-${row.item}`}
                className="ro-treemap-tile"
                style={{ flexGrow: Math.max(1, Number(row.share_pct || 1)), flexBasis: `${Math.max(120, Number(row.share_pct || 1) * 9)}px` }}
              >
                <span>{row.item}</span>
                <strong>{Number(row.share_pct || 0).toFixed(1)}%</strong>
              </div>
            )) : <div className="ro-empty">No commodity data</div>}
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Concentration chart</h3>
              <p>HHI and market structure balance</p>
            </div>
          </div>
          <div className="ro-chart ro-chart-short">
            {concentrationData ? <Doughnut data={concentrationData} options={pieOptions} /> : <div className="ro-empty">No concentration data</div>}
          </div>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Origin heatmap</h3>
              <p>Monthly volume by origin country</p>
            </div>
          </div>
          <div className="ro-heatmap-wrap">
            <div className="ro-heatmap-head">
              <span>Country</span>
              {(data.originMonthly?.months || []).map((month) => <span key={month}>{month}</span>)}
            </div>
            <div className="ro-heatmap-body">
              {heatmapRows.slice(0, 6).map((row) => {
                const max = Math.max(...row.monthly_kg, 1);
                return (
                  <div key={row.country} className="ro-heatmap-row">
                    <strong>{row.country}</strong>
                    {row.monthly_kg.map((value, idx) => (
                      <span
                        key={`${row.country}-${idx}`}
                        className="ro-heat-cell"
                        title={`${row.country} ${value.toLocaleString()} KG`}
                        style={{ background: `rgba(245, 158, 11, ${0.08 + (value / max) * 0.85})` }}
                      >
                        {Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Partner flow</h3>
              <p>Sankey-style importer/exporter relationships</p>
            </div>
          </div>
          <div className="ro-flow-list">
            {flowRows.slice(0, 6).map((row) => (
              <div key={`${row.importer}-${row.exporter}`} className="ro-flow-row">
                <div className="ro-flow-node left">{row.importer}</div>
                <div className="ro-flow-band">
                  <span style={{ width: `${Math.max(18, Math.min(100, (Number(row.quantity_kg || 0) / Math.max(...flowRows.map((it) => Number(it.quantity_kg || 0)), 1)) * 100))}%` }} />
                </div>
                <div className="ro-flow-node right">{row.exporter}</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Top commodities</h3>
              <p>Ranked by quantity</p>
            </div>
          </div>
          <div className="ro-table-wrap">
            <table className="ro-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Item</th>
                  <th>Qty (KG)</th>
                  <th>Share %</th>
                </tr>
              </thead>
              <tbody>
                {commodityRows.slice(0, 6).map((row) => (
                  <tr key={`${row.rank}-${row.item}`}>
                    <td>{row.rank}</td>
                    <td>{row.item}</td>
                    <td className="ro-num">{Number(row.quantity_kg || 0).toLocaleString()}</td>
                    <td className="ro-num">{Number(row.share_pct || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Top ports</h3>
              <p>Logistics throughput hotspots</p>
            </div>
          </div>
          <div className="ro-chart ro-chart-short">
            {topPortsData ? <Bar data={topPortsData} options={chartOptions} /> : <div className="ro-empty">No port data</div>}
          </div>
        </article>
      </div>

      <div className="ro-grid ro-grid-2">
        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Top exporters</h3>
              <p>Supplier concentration by volume</p>
            </div>
          </div>
          <div className="ro-table-wrap">
            <table className="ro-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Exporter</th>
                  <th>Qty (KG)</th>
                </tr>
              </thead>
              <tbody>
                {(topExporterRows || []).slice(0, 6).map((row) => (
                  <tr key={`${row.rank}-${row.exporter}`}>
                    <td>{row.rank}</td>
                    <td>{row.exporter}</td>
                    <td className="ro-num">{Number(row.quantity_kg || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="ro-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Top importers</h3>
              <p>Demand concentration by volume</p>
            </div>
          </div>
          <div className="ro-table-wrap">
            <table className="ro-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Importer</th>
                  <th>Qty (KG)</th>
                </tr>
              </thead>
              <tbody>
                {(topImporterRows || []).slice(0, 6).map((row) => (
                  <tr key={`${row.rank}-${row.importer}`}>
                    <td>{row.rank}</td>
                    <td>{row.importer}</td>
                    <td className="ro-num">{Number(row.quantity_kg || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {data.hhi?.interpretation && (
        <article className="ro-panel ro-insight-panel">
          <div className="ro-panel-head">
            <div>
              <h3>Concentration interpretation</h3>
              <p>Decision support signal for market structure</p>
            </div>
            <span className="ro-pill">{data.hhi.label}</span>
          </div>
          <p>{data.hhi.interpretation}</p>
        </article>
      )}
    </section>
  );
};

export default ExecutiveOverview;
