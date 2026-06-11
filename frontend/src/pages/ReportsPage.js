import React, { useState, useCallback, useEffect, useMemo } from "react";
import ReportSidebar from "../components/ReportSidebar";
import ReportFilters from "../components/ReportFilters";
import MarketIntelCharts from "../components/MarketIntelCharts";
import StrategicCharts from "../components/StrategicCharts";
import ItemExporterView from "../components/ItemExporterView";
import ItemImporterView from "../components/ItemImporterView";
import ExecutiveOverview from "../components/ExecutiveOverview";
import apiService from "../services/apiService";
import "./ReportsPage.css";

const INITIAL_FILTERS = {
  startDate: '',
  endDate: '',
  item: '',
  importer: '',
  exporter: '',
  origin_country_id: '',
  chapter: '',
  periodPreset: 'custom',
  comparisonMode: false,
  comparisonPreset: 'previousPeriod',
  compareStartDate: '',
  compareEndDate: '',
};

const parsePeriod = (value) => {
  if (!value) return null;
  const [year, month] = String(value).split('-').map((part) => Number(part));
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
};

const formatPeriod = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const shiftMonths = (value, amount) => {
  const date = parsePeriod(value);
  if (!date) return '';
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return formatPeriod(next);
};

const monthSpan = (startValue, endValue) => {
  const start = parsePeriod(startValue);
  const end = parsePeriod(endValue);
  if (!start || !end) return 0;
  return ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()) + 1;
};

const buildComparisonWindow = (filters) => {
  if (!filters?.comparisonMode) return null;

  if (filters.comparisonPreset === 'custom') {
    if (!filters.compareStartDate || !filters.compareEndDate) return null;
    return { startDate: filters.compareStartDate, endDate: filters.compareEndDate };
  }

  if (!filters.startDate || !filters.endDate) return null;

  if (filters.comparisonPreset === 'previousYear') {
    return {
      startDate: shiftMonths(filters.startDate, -12),
      endDate: shiftMonths(filters.endDate, -12),
    };
  }

  const span = Math.max(monthSpan(filters.startDate, filters.endDate), 1);
  return {
    startDate: shiftMonths(filters.startDate, -span),
    endDate: shiftMonths(filters.startDate, -1),
  };
};

const extractFilters = (payload) => {
  if (payload?.filters) return payload.filters;
  if (payload?.data?.filters) return payload.data.filters;
  return null;
};

const ReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [compareSummaryLoading, setCompareSummaryLoading] = useState(false);
  const [compareSummaryData, setCompareSummaryData] = useState(null);
  const [compareSummaryError, setCompareSummaryError] = useState(null);

  // Filters
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    items: [],
    importers: [],
    exporters: [],
    countries: [],
  });

  const reportMeta = useMemo(() => ({
    overview: {
      eyebrow: 'Executive Overview',
      title: 'Trade Intelligence Command Center',
      description: 'A high-level operating view with KPIs, trends, and the main commercial signals across your filtered data.',
    },
    'market-intel': {
      eyebrow: 'Executive Market Intelligence',
      title: 'Market Intelligence',
      description: 'Top products, share concentration, and monthly movement across the active filters.',
    },
    strategic: {
      eyebrow: 'Strategic Risk & Opportunity',
      title: 'Strategic Analysis',
      description: 'Concentration, partner loyalty, top ports, and HS code share for decision support.',
    },
    'item-exporter': {
      eyebrow: 'Supplier Network View',
      title: 'Item to Exporter',
      description: 'Drill into exporter networks for the selected product scope.',
    },
    'item-importer': {
      eyebrow: 'Buyer Network View',
      title: 'Item to Importer',
      description: 'Drill into importer networks for the selected product scope.',
    },
  }), []);

  const currentMeta = reportMeta[selectedReport] || {
    eyebrow: 'Trade Analytics',
    title: 'Reports',
    description: 'Explore trade intelligence, exports, and drill-down views.',
  };

  const activeFilterCount = useMemo(() => {
    return [
      filters.startDate,
      filters.endDate,
      filters.item,
      filters.importer,
      filters.exporter,
      filters.origin_country_id,
      filters.chapter,
      filters.comparisonMode,
      filters.compareStartDate,
      filters.compareEndDate,
    ]
      .filter(Boolean).length;
  }, [filters]);

  // Handler to select a report type and fetch data
  const handleSelectReport = useCallback(async (reportId, overrideFilters = null) => {
    setSelectedReport(reportId);

    if (reportId === 'overview') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const activeFilters = overrideFilters || filters;
      let params = {
        ...activeFilters,
        country: activeFilters.origin_country_id,
        origin_country_id: activeFilters.origin_country_id,
        item: activeFilters.item,
        importer: activeFilters.importer,
        exporter: activeFilters.exporter,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate,
        chapter: activeFilters.chapter,
      };
      let data = [];
      switch (reportId) {
        case 'overview':
          data = { data: { records: [], filters: {} } };
          break;
        case "item":
          data = await apiService.getRecords(1, 100, '', params, '', '', '', '');
          break;
        case "importer":
          data = await apiService.getRecords(1, 100, '', params, '', '', '', '');
          break;
        case "exporter":
          data = await apiService.getRecords(1, 100, '', params, '', '', '', '');
          break;
        case "country":
          data = await apiService.getRecords(1, 100, '', params, '', '', '', '');
          break;
        case "agent":
          data = await apiService.getRecords(1, 100, '', params, '', '', '', '');
          break;
        case 'market-intel': {
          // Fetch commodity portfolio for the table display
          const res = await apiService.aiCommodityPortfolio(params);
          const rows = (res?.commodities || []).map((p) => ({
            Rank: p.rank || '',
            Item: p.item || '',
            "Quantity (KG)": p.quantity_kg || 0,
            "Share %": p.share_pct || 0,
          }));
          data = { data: { records: rows, filters: {} } };
        }
          break;
        case 'strategic': {
          // Fetch momentum/high-growth products for the table display
          const res = await apiService.aiMomentum(params);
          const rows = (res?.products || []).map((p) => ({
            Rank: p.rank || '',
            Item: p.item || '',
            "Dec Volume (KG)": p.dec_volume_kg || 0,
            "Vol Increase (KG)": p.vol_increase_kg || 0,
            "Growth %": p.growth_pct || 0,
          }));
          data = { data: { records: rows, filters: {} } };
        }
          break;
        case 'item-exporter': {
          // Top exporters as fallback table display (main UI is hierarchical)
          const res = await apiService.aiTopExporters(params);
          const rows = (res?.exporters || []).map((r) => ({
            Rank: r.rank || '',
            Exporter: r.exporter || '',
            "Quantity (KG)": r.quantity_kg || 0,
          }));
          data = { data: { records: rows, filters: {} } };
        }
          break;
        case 'item-importer': {
          // Top importers as fallback table display (main UI is hierarchical)
          const res = await apiService.aiTopImporters(params);
          const rows = (res?.importers || []).map((r) => ({
            Rank: r.rank || '',
            Importer: r.importer || '',
            "Quantity (KG)": r.quantity_kg || 0,
          }));
          data = { data: { records: rows, filters: {} } };
        }
          break;
        default:
          data = [];
      }
      const dataFilters = extractFilters(data);

      if (dataFilters) {
        setFilterOptions({
          items: dataFilters.items || [],
          importers: dataFilters.importers || [],
          exporters: dataFilters.exporters || [],
          countries: dataFilters.origins || [],
        });
      }
    } catch (err) {
      console.log("Failed to fetch report data.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    if (e && !e.target && typeof e === 'object') {
      setFilters((prev) => ({ ...prev, ...e }));
      return;
    }
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Apply filters and fetch report
  const handleApplyFilters = () => {
    if (selectedReport) {
      handleSelectReport(selectedReport);
    }
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    if (selectedReport) {
      handleSelectReport(selectedReport, INITIAL_FILTERS);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const payload = await apiService.aiStats({
          startDate: filters.startDate,
          endDate: filters.endDate,
          item: filters.item,
          importer: filters.importer,
          exporter: filters.exporter,
          origin_country_id: filters.origin_country_id,
          chapter: filters.chapter,
        });

        if (!active) return;
        setSummaryData(payload || null);
      } catch (err) {
        if (!active) return;
        setSummaryError(err.message || 'Failed to load summary');
        setSummaryData(null);
      } finally {
        if (active) setSummaryLoading(false);
      }
    };

    fetchSummary();

    return () => {
      active = false;
    };
  }, [filters, selectedReport]);

  useEffect(() => {
    let active = true;
    const compareWindow = buildComparisonWindow(filters);

    if (!compareWindow) {
      setCompareSummaryData(null);
      setCompareSummaryError(null);
      setCompareSummaryLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchComparison = async () => {
      setCompareSummaryLoading(true);
      setCompareSummaryError(null);
      try {
        const payload = await apiService.aiStats({
          startDate: compareWindow.startDate,
          endDate: compareWindow.endDate,
          item: filters.item,
          importer: filters.importer,
          exporter: filters.exporter,
          origin_country_id: filters.origin_country_id,
          chapter: filters.chapter,
        });

        if (!active) return;
        setCompareSummaryData(payload || null);
      } catch (err) {
        if (!active) return;
        setCompareSummaryError(err.message || 'Failed to load comparison');
        setCompareSummaryData(null);
      } finally {
        if (active) setCompareSummaryLoading(false);
      }
    };

    fetchComparison();

    return () => {
      active = false;
    };
  }, [filters]);

  const buildMetricCard = (label, current, compare, accent) => {
    const currentValue = Number(current || 0);
    const compareValue = Number(compare || 0);
    const delta = currentValue - compareValue;
    const deltaPct = compareValue ? (delta / compareValue) * 100 : (currentValue ? 100 : 0);
    return {
      label,
      value: new Intl.NumberFormat('en-US').format(currentValue),
      compareValue: new Intl.NumberFormat('en-US').format(compareValue),
      deltaText: `${delta >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(deltaPct)}%`,
      deltaValue: delta,
      accent,
    };
  };

  const summaryCards = useMemo(() => {
    const compare = compareSummaryData || {};
    const totalQty = Number(summaryData?.total_quantity_kg || 0);
    const activeBuyers = Number(summaryData?.active_buyers || 0);
    const origins = Number(summaryData?.origins || 0);
    const shipments = Number(summaryData?.shipments || 0);

    return [
      buildMetricCard('Shipments', shipments, compare.shipments, 'cyan'),
      buildMetricCard('Active Buyers', activeBuyers, compare.active_buyers, 'emerald'),
      buildMetricCard('Origin Countries', origins, compare.origins, 'amber'),
      buildMetricCard('Total Volume KG', Math.round(totalQty), Math.round(compare.total_quantity_kg || 0), 'slate'),
    ];
  }, [summaryData, compareSummaryData]);

  const comparisonLabel = useMemo(() => {
    if (!filters.comparisonMode) return 'Comparison off';
    if (compareSummaryLoading) return 'Comparison loading';
    if (compareSummaryError) return 'Comparison unavailable';
    const window = buildComparisonWindow(filters);
    return window?.startDate && window?.endDate ? `Compared with ${window.startDate} to ${window.endDate}` : 'Comparison ready';
  }, [filters, compareSummaryLoading, compareSummaryError]);

  const handleExportReport = async (format = "excel") => {
    if (!selectedReport) return;

    setIsExporting(true);

    const exportParams = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      item: filters.item,
      importer: filters.importer,
      exporter: filters.exporter,
      country: filters.origin_country_id,
      origin_country_id: filters.origin_country_id,
      chapter: filters.chapter,
    };

    try {
      switch (selectedReport) {
        case 'overview':
          await apiService.exportOverviewReport(exportParams, format);
          break;
        case "item":
          await apiService.exportItemWise(exportParams, format);
          break;
        case "importer":
          await apiService.exportImporterWise(exportParams, format);
          break;
        case "exporter":
          await apiService.exportExporterWise(exportParams, format);
          break;
        case "country":
          await apiService.exportCountryWise(exportParams, format);
          break;
        case "agent":
          await apiService.exportAgentWise(exportParams, format);
          break;
        // new advanced reports
        case 'market-intel':
          await apiService.exportMarketIntelReport(exportParams, format);
          break;
        case 'strategic':
          await apiService.exportStrategicReport(exportParams, format);
          break;
        case 'item-exporter':
          await apiService.exportItemExporterReport(exportParams, format);
          break;
        case 'item-importer':
          await apiService.exportItemImporterReport(exportParams, format);
          break;
        default:
          await apiService.exportReport(exportParams, format);
          break;
      }
    } catch (err) {
      console.log("Export failed.", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rp-root">
      {/* Sidebar Component */}
      <ReportSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        selectedReport={selectedReport}
        onSelectReport={handleSelectReport}
        loading={loading}
      />

      {/* Main Content */}
      <div className={`rp-main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="rp-card">
          <section className="rp-hero">
            <div className="rp-hero-copy">
              <div className="rp-eyebrow">{currentMeta.eyebrow}</div>
              <h1 className="rp-title">{currentMeta.title}</h1>
              <p className="rp-subtitle">{currentMeta.description}</p>
            </div>
            <div className="rp-hero-meta">
              <div className="rp-meta-pill">{activeFilterCount} active filters</div>
              <div className="rp-meta-pill">{selectedReport === 'market-intel' ? 'Market' : selectedReport === 'strategic' ? 'Strategic' : 'Hierarchy'} view</div>
              <div className="rp-meta-pill">{comparisonLabel}</div>
            </div>
          </section>

          <section className="rp-summary">
            <div className="rp-summary-head">
              <h2>Executive Summary</h2>
              <span>{summaryLoading ? 'Refreshing...' : summaryError ? 'Summary unavailable' : 'Live from filtered data'}</span>
            </div>
            <div className="rp-summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className={`rp-metric-card accent-${card.accent}`}>
                  <span className="rp-metric-label">{card.label}</span>
                  <strong className="rp-metric-value">{summaryLoading ? '—' : card.value}</strong>
                  {filters.comparisonMode && (
                    <div className="rp-metric-compare">
                      <span>vs {compareSummaryLoading ? '—' : card.compareValue}</span>
                      <strong className={card.deltaValue >= 0 ? 'up' : 'down'}>{card.deltaText}</strong>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {summaryData?.ai_pulse?.message && (
              <div className="rp-insight">
                <span className="rp-insight-tag">{summaryData.ai_pulse.tag}</span>
                <p>{summaryData.ai_pulse.message}</p>
              </div>
            )}
            {summaryError && (
              <div className="rp-summary-error">{summaryError}</div>
            )}
          </section>

          {/* Filters Component */}
          <ReportFilters
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onApplyFilters={handleApplyFilters}
            onClearFilters={handleClearFilters}
            onExportReport={handleExportReport}
            loading={loading}
            isExporting={isExporting}
            selectedReport={selectedReport}
          />

          {selectedReport === 'overview' && (
            <ExecutiveOverview
              filters={filters}
              selectedReport={selectedReport}
              loading={loading}
              summaryData={summaryData}
              summaryLoading={summaryLoading}
              comparisonData={compareSummaryData}
              comparisonLoading={compareSummaryLoading}
              onDrilldown={handleSelectReport}
            />
          )}

          {/* Visualization Components - Charts & Hierarchical Views */}
          {selectedReport === 'market-intel' && (
            <MarketIntelCharts 
              filters={filters} 
              selectedReport={selectedReport} 
              loading={loading}
            />
          )}

          {selectedReport === 'strategic' && (
            <StrategicCharts 
              filters={filters} 
              selectedReport={selectedReport} 
              loading={loading}
            />
          )}

          {selectedReport === 'item-exporter' && (
            <ItemExporterView 
              filters={filters} 
              selectedReport={selectedReport} 
              loading={loading}
            />
          )}

          {selectedReport === 'item-importer' && (
            <ItemImporterView 
              filters={filters} 
              selectedReport={selectedReport} 
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
