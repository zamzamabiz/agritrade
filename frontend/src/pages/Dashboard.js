import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdUploadFile, MdDataUsage, MdCheckCircle, MdErrorOutline, MdRefresh } from 'react-icons/md';
import { Line } from 'react-chartjs-2';
import apiService from '../services/apiService';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ─── Component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState({ totalRecords: 0, uniqueOrigins: 0, uniqueItems: 0, uniqueImporters: 0, averageWeeklyRecords: 0 });
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ filesUploaded: 0, recordsProcessed: 0, successRate: 0, errors: 0 });

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, activityRes, summaryRes] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getDashboardActivity(),
        apiService.getDashboardSummary(),
      ]);
      const actSummary = activityRes.summary || {};
      const reversed = [...(activityRes.data || [])].reverse();
      const sd = {
        filesUploaded: actSummary.totalFilesUploaded || statsRes.data?.filesUploaded || 0,
        recordsProcessed: actSummary.totalRecordsProcessed || statsRes.data?.recordsProcessed || 0,
        successRate: statsRes.data?.successRate || 0,
        errors: statsRes.data?.errors || 0,
      };
      setSummary({
        totalRecords: summaryRes.data?.totalRecords || 0,
        uniqueOrigins: summaryRes.data?.uniqueOrigins || 0,
        uniqueItems: summaryRes.data?.uniqueItems || 0,
        uniqueImporters: summaryRes.data?.uniqueImporters || 0,
        averageWeeklyRecords: actSummary.averageWeeklyRecords || 0,
      });
      setActivityData(reversed);
      animateStats(sd);
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const animateStats = (final) => {
    let f = 0; const limit = 45;
    const iv = setInterval(() => {
      f++;
      const ease = 1 - Math.pow(1 - f / limit, 3);
      setStats({
        filesUploaded: Math.floor(final.filesUploaded * ease),
        recordsProcessed: Math.floor(final.recordsProcessed * ease),
        successRate: (final.successRate * ease).toFixed(1),
        errors: Math.floor(final.errors * ease),
      });
      if (f >= limit) { clearInterval(iv); setStats(final); }
    }, 16);
  };

  const chartData = {
    labels: activityData.map(i => new Date(i.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Files Uploaded',
        data: activityData.map(i => i.filesUploaded || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.06)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#080c14',
        pointBorderWidth: 2,
      },
      {
        label: 'Records Processed',
        data: activityData.map(i => i.recordsProcessed || 0),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.05)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#080c14',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'rgba(226,232,240,0.5)', font: { size: 11, family: 'IBM Plex Mono', weight: '500' }, padding: 20, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: 'rgba(8,12,20,0.97)',
        borderColor: 'rgba(245,158,11,0.4)',
        borderWidth: 1,
        titleColor: '#f59e0b',
        bodyColor: 'rgba(226,232,240,0.7)',
        padding: 12,
        cornerRadius: 3,
        titleFont: { family: 'IBM Plex Mono', size: 11 },
        bodyFont: { family: 'IBM Plex Mono', size: 11 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(245,158,11,0.05)' },
        ticks: { color: 'rgba(226,232,240,0.35)', font: { size: 10, family: 'IBM Plex Mono' } },
        border: { color: 'rgba(245,158,11,0.1)' },
      },
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(226,232,240,0.35)', font: { size: 10, family: 'IBM Plex Mono' } },
        border: { color: 'rgba(245,158,11,0.1)' },
      },
    },
  };

  const STAT_CARDS = [
    { icon: <MdUploadFile size={20} />, val: loading ? '—' : stats.filesUploaded, label: 'FILES UPLOADED', color: '#f59e0b', code: 'SYS.01' },
    { icon: <MdDataUsage size={20} />, val: loading ? '—' : Number(stats.recordsProcessed).toLocaleString(), label: 'RECORDS PROCESSED', color: '#38bdf8', code: 'SYS.02' },
    { icon: <MdCheckCircle size={20} />, val: loading ? '—' : `${stats.successRate}%`, label: 'SUCCESS RATE', color: '#4ade80', code: 'SYS.03' },
    { icon: <MdErrorOutline size={20} />, val: loading ? '—' : stats.errors, label: 'ERRORS', color: '#f87171', code: 'SYS.04' },
  ];

  const INSIGHTS = [
    { icon: '▦', val: loading ? '—' : summary.totalRecords.toLocaleString(), label: 'TOTAL RECORDS', color: '#f59e0b' },
    { icon: '◎', val: loading ? '—' : summary.uniqueOrigins, label: 'UNIQUE ORIGINS', color: '#38bdf8' },
    { icon: '≡', val: loading ? '—' : summary.uniqueItems, label: 'UNIQUE HS ITEMS', color: '#a78bfa' },
    { icon: '⊡', val: loading ? '—' : summary.uniqueImporters, label: 'UNIQUE IMPORTERS', color: '#4ade80' },
    { icon: '↗', val: loading ? '—' : Math.round(summary.averageWeeklyRecords).toLocaleString(), label: 'AVG WEEKLY ACTIVITY', color: '#fb923c' },
  ];

  return (
    <div className="db-page-root" style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080c14 0%, #0b0f1a 50%, #080c14 100%)',
      fontFamily: "'Syne', sans-serif",
      color: '#e2e8f0',
      position: 'relative',
    }}>
      <div style={{ position: 'relative', zIndex: 2, marginTop: '1rem', padding: '0 2rem 3rem' }}>
        {error && (
          <div className="error-banner" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <button
          className={`db-refresh-btn ${loading ? 'loading' : ''}`}
          onClick={fetchDashboardData}
          disabled={loading}
        >
          <span className="spin-icon" style={{ display: 'flex' }}><MdRefresh size={15} /></span>
          {loading ? 'LOADING' : 'REFRESH'}
        </button>

        {/* ── Page title ── */}
        <div style={{ marginBottom: '2rem', animation: 'fadeUp 0.5s ease forwards' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'rgba(245,158,11,0.5)', letterSpacing: '2px', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: '20px', height: '1px', background: 'rgba(245,158,11,0.4)' }} />
            OPERATIONS OVERVIEW
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', letterSpacing: '2px', color: '#f8fafc', lineHeight: 1 }}>
            DASHBOARD
          </h1>
          <p style={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.875rem', marginTop: '0.35rem', fontFamily: "'Syne', sans-serif" }}>
            Pakistan's HS-structured import & export trade intelligence platform · 21 Sections · 97 Chapters
          </p>
        </div>

        {/* ── Trade Portals ── */}
        <section className="db-section db-section-delay-1">
          <div className="section-chip">TRADE DATA PORTALS</div>
          <div className="db-portal-grid">
            {[
              { type: 'IMPORT', dir: 'INBOUND', icon: '↓', color: '#4ade80', desc: "Pakistan's inbound trade flows — filter by HS chapter, section, country of origin, and importer.", route: '/trade-data?trade_type=import', chapters: 'CH 01–99' },
              { type: 'EXPORT', dir: 'OUTBOUND', icon: '↑', color: '#38bdf8', desc: 'Outbound trade records — identify growth opportunities across international markets by HS code.', route: '/trade-data?trade_type=export', chapters: 'CH 01–99' },
            ].map(p => (
              <div key={p.type} className="db-portal-card" style={{ '--portal-color': p.color }} onClick={() => navigate(p.route)}>
                <div className="db-portal-strip" />
                <div className="db-portal-head">
                  <div>
                    <span className="db-portal-dir">{p.dir} TRADE</span>
                    <h3 className="db-portal-title">{p.type} ANALYTICS</h3>
                  </div>
                  <span className="db-portal-icon">{p.icon}</span>
                </div>
                <p className="db-portal-desc">{p.desc}</p>
                <div className="db-portal-foot">
                  <span className="db-portal-chip">{p.chapters}</span>
                  <span className="db-portal-open">OPEN →</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── System Stats ── */}
        <section className="db-section db-section-delay-2">
          <div className="section-chip">SYSTEM STATUS</div>
          <div className="db-stat-grid">
            {STAT_CARDS.map(card => (
              <div key={card.label} className="db-stat-card" style={{ '--stat-color': card.color }}>
                <div className="db-stat-iconbox">
                  {card.icon}
                </div>
                <div className="db-stat-main">
                  <div className={`db-stat-value ${loading ? 'loading' : ''}`}>
                    {card.val}
                  </div>
                  <div className="db-stat-label">{card.label}</div>
                </div>
                <div className="db-stat-code">{card.code}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Analytics ── */}
        <section className="db-section db-section-delay-3">
          <div className="section-chip">MARKET ANALYTICS</div>
          <div className="db-analytics-grid">

            {/* Chart panel */}
            <div className="db-panel db-panel-pad-lg">
              <div className="db-panel-head">
                <div>
                  <div className="db-panel-code">CHART.01</div>
                  <div className="db-panel-title">Activity Tracking</div>
                  <div className="db-panel-sub">Weekly upload & processing trends</div>
                </div>
                <div className="db-panel-pills">
                  {['F', 'M', 'R'].map(l => (
                    <div key={l} className="db-panel-pill">{l}</div>
                  ))}
                </div>
              </div>
              <div className="db-chart-wrap">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Insights panel */}
            <div className="db-panel db-panel-pad-lg">
              <div className="db-panel-head db-panel-head-tight">
                <div className="db-panel-code">INTEL.01</div>
                <div className="db-panel-title">Intelligence Summary</div>
                <div className="db-panel-sub">Aggregated key metrics</div>
              </div>
              <div className="db-insight-list">
                {INSIGHTS.map(item => (
                  <div key={item.label} className="db-insight-row" style={{ '--insight-color': item.color }}>
                    <span className="db-insight-icon">{item.icon}</span>
                    <div className="db-insight-main">
                      <div className="db-insight-value">{item.val}</div>
                      <div className="db-insight-label">{item.label}</div>
                    </div>
                    <div className="db-insight-bar" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick Start ── */}
        <section className="db-section db-section-delay-4">
          <div className="section-chip">QUICK START</div>
          <div className="db-qs-grid">
            {[
              { n: '01', title: 'Upload Trade Files', desc: 'Import CSV or Excel files mapped to specific HS chapters. System validates and categorizes automatically.' },
              { n: '02', title: 'Filter & Query', desc: 'Search by 6-digit HS code, chapter (01–99), section, country of origin, importer, or date range.' },
              { n: '03', title: 'Generate Reports', desc: 'Export structured trade reports by HS section, chapter, or custom filter sets for stakeholders.' },
            ].map(step => (
              <div key={step.n} className="db-qs-card">
                <div className="db-qs-step">
                  {step.n}
                </div>
                <div>
                  <h4 className="db-qs-title">{step.title}</h4>
                  <p className="db-qs-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}