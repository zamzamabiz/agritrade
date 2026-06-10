import React, { useState, useCallback } from "react";
import ReportSidebar from "../components/ReportSidebar";
import ReportFilters from "../components/ReportFilters";
import MarketIntelCharts from "../components/MarketIntelCharts";
import StrategicCharts from "../components/StrategicCharts";
import ItemExporterView from "../components/ItemExporterView";
import ItemImporterView from "../components/ItemImporterView";
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
};

const extractFilters = (payload) => {
  if (payload?.filters) return payload.filters;
  if (payload?.data?.filters) return payload.data.filters;
  return null;
};

const ReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState('market-intel');
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filters
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    items: [],
    importers: [],
    exporters: [],
    countries: [],
  });

  // Handler to select a report type and fetch data
  const handleSelectReport = useCallback(async (reportId, overrideFilters = null) => {
    setSelectedReport(reportId);
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
          <h1 className="rp-title">Reports & Export</h1>
          <p className="rp-subtitle">
            Select a report type from the sidebar and filter to view, export, or share trade data reports.
          </p>

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
