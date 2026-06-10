import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MdSearch, MdClear,
  MdFilterList
} from 'react-icons/md';
import apiService from '../services/apiService';
import ExportModal from '../components/ExportModal';
import { HS_CHAPTERS } from '../constants/hsChapters';
import './TradeDataPage.css';

// ─── Component ───────────────────────────────────────────────────────────────
const TradeDataPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tradeType = searchParams.get('trade_type') || 'import';
  const chapterParam = searchParams.get('chapter') || '';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [records, setRecords] = useState([]);
  // Define the fixed order of columns for display
  const COLUMN_ORDER = [
    'trade_type',
    'period_date',
    'origin_country',
    'exporter_name',
    'item_name',
    'ntn',
    'importer_name',
    'value_usd',
    'port_of_shipment',
    'quantity',
    'uom',
    // 'agent_name',
    // 'agent_number',
    // 'terminal_sheds',
  ];
  const [tableColumns, setTableColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [sortBy] = useState('');
  const [sortDir] = useState('desc');
  const [selectedChapter, setSelectedChapter] = useState(chapterParam);
  const [chapterSearch, setChapterSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ origin_country_id:'', item:'', importer:'', exporter:'', startDate:'', endDate:'' });
  const [tempFilters, setTempFilters] = useState({ origin_country_id:'', item:'', importer:'', exporter:'', startDate:'', endDate:'' });
  const [filterOptions, setFilterOptions] = useState({ origins:[], items:[], importers:[], exporters:[] });
  const [countryOptions, setCountryOptions] = useState([]);
  const [dropdowns, setDropdowns] = useState({ origin_country_id:false, item:false, importer:false, exporter:false });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(globalSearch), 500);
    return () => clearTimeout(t);
  }, [globalSearch]);

  useEffect(() => { fetchRecords(page); }, [debouncedSearch, filters, selectedChapter, tradeType, page, limit, sortBy, sortDir]); // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.td-fd') && !e.target.closest('.td-export-wrap')) {
        setDropdowns({ origin_country_id:false, item:false, importer:false, exporter:false });
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      try {
        const rows = await apiService.getCountries('');
        if (!active) return;
        const normalized = rows
          .filter((c) => c && c.id !== undefined && c.name)
          .map((c) => ({ id: String(c.id), name: c.name }));
        setCountryOptions(normalized);
      } catch (e) {
        if (!active) return;
        setCountryOptions([]);
      }
    };
    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  const fetchRecords = async (pageNum = 1) => {
    setLoading(true); setError(null);
    try {
      const res = await apiService.getRecords(pageNum, limit, debouncedSearch, filters, tradeType, selectedChapter, sortBy, sortDir);
      setRecords(res?.data?.records || []);
      setTotal(res?.data?.pagination?.total || 0);
      // Handle columns: can be array or JSON string
      let cols = res?.data?.columns;
      // If columns is a string, parse it
      if (typeof cols === 'string') {
        try { cols = JSON.parse(cols); } catch { cols = []; }
      }
      // Only include columns present in both COLUMN_ORDER and cols, in the fixed order
      if (Array.isArray(cols)) {
        setTableColumns(COLUMN_ORDER.filter(col => cols.includes(col)));
      } else {
        setTableColumns([]);
      }
      const fd = res?.data?.filters || {};
      if (fd.origins || fd.items || fd.importers || fd.exporters) {
        setFilterOptions({
          origins: getUnique(fd.origins),
          items: getUnique(fd.items),
          importers: getUnique(fd.importers),
          exporters: getUnique(fd.exporters),
        });
      }
    } catch (err) {
      setError('Failed to load records. Please try again.');
      setRecords([]);
      setTableColumns([]);
    } finally { setLoading(false); }
  };

  const getUnique = (arr) => {
    if (!Array.isArray(arr)) return [];
    const m = new Map();
    arr.map(i => i?.toString().trim()).filter(Boolean)
      .forEach(i => { if (!m.has(i.toLowerCase())) m.set(i.toLowerCase(), i); });
    return Array.from(m.values()).sort();
  };

  const clearFilters = () => {
    const c = { origin_country_id:'', item:'', importer:'', exporter:'', startDate:'', endDate:'' };
    setFilters(c); setTempFilters(c); setGlobalSearch('');
    setPage(1);
  };

  const FilterDropdown = ({ name, label, options }) => {
    const [localSearch, setLocalSearch] = useState('');
    const [apiCountryOptions, setApiCountryOptions] = useState([]);
    const [countryLoading, setCountryLoading] = useState(false);
    const isCountryDropdown = name === 'origin_country_id';
    const isOpen = dropdowns[name];

    useEffect(() => {
      if (!isCountryDropdown || !isOpen) return;

      let active = true;
      const t = setTimeout(async () => {
        try {
          setCountryLoading(true);
          const rows = await apiService.getCountries(localSearch.trim());
          if (!active) return;
          const normalized = rows
            .filter((c) => c && c.id !== undefined && c.name)
            .map((c) => ({ id: String(c.id), name: c.name }));
          setApiCountryOptions(normalized);
        } catch (e) {
          if (!active) return;
          setApiCountryOptions([]);
        } finally {
          if (active) setCountryLoading(false);
        }
      }, 500);

      return () => {
        active = false;
        clearTimeout(t);
      };
    }, [isCountryDropdown, isOpen, localSearch]);

    const isObjectOptions = Array.isArray(options) && options.length > 0 && typeof options[0] === 'object';
    const getOptionValue = (opt) => (isObjectOptions ? String(opt.id) : opt);
    const getOptionLabel = (opt) => (isObjectOptions ? opt.name : opt);
    const currentOptions = isCountryDropdown
      ? (apiCountryOptions.length || localSearch ? apiCountryOptions : options)
      : options;

    const selectedLabel = (tempFilters[name] && isObjectOptions)
      ? (currentOptions.find((o) => String(o.id) === String(tempFilters[name]))?.name || tempFilters[name])
      : tempFilters[name];

    const filteredOptions = isCountryDropdown
      ? (currentOptions || [])
      : (currentOptions || []).filter((o) =>
          getOptionLabel(o).toLowerCase().includes(localSearch.toLowerCase()),
        );

    return (
    <div>
      <div className="td-filter-label">{label}</div>
      <div className="td-fd">
        <div className={`td-fd-trigger ${dropdowns[name] ? 'open' : ''}`}
          onClick={() => !loading && setDropdowns(p => ({ ...p, [name]: !p[name] }))}>
          <span className={`td-fd-val ${tempFilters[name] ? 'set' : ''}`}>
            {selectedLabel || `ALL ${label.toUpperCase()}S`}
          </span>
          <MdSearch size={14} className="td-accent-icon" />
        </div>
        {dropdowns[name] && (
          <div className="td-fd-menu">
            <div className="td-fd-search">
              <MdSearch size={13} className="td-accent-icon" />
              <input type="text" placeholder={`Search ${label.toLowerCase()}...`}
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                onClick={e => e.stopPropagation()} autoFocus />
            </div>
            <div className="td-fd-opts">
              <div className={`td-fd-opt ${!tempFilters[name] ? 'selected' : ''}`}
                onClick={() => { setTempFilters(p => ({ ...p, [name]: '' })); setDropdowns(p => ({ ...p, [name]: false })); }}>
                All {label}s
              </div>
              {isCountryDropdown && countryLoading && (
                <div className="td-fd-empty">LOADING...</div>
              )}
              {filteredOptions
                .map(o => (
                  <div key={getOptionValue(o)} className={`td-fd-opt ${String(tempFilters[name]) === String(getOptionValue(o)) ? 'selected' : ''}`}
                    onClick={() => { setTempFilters(p => ({ ...p, [name]: getOptionValue(o) })); setDropdowns(p => ({ ...p, [name]: false })); setLocalSearch(''); }}>
                    {getOptionLabel(o)}
                  </div>
                ))}
              {!countryLoading && filteredOptions.length === 0 && localSearch && (
                <div className="td-fd-empty">NO RESULTS</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    );
  };

  const totalPages = Math.ceil(total / limit);

  const paginationPages = () => {
    const count = isMobile ? 3 : 5;
    if (totalPages <= count) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(count / 2);
    let start = page - half;
    if (start < 1) start = 1;
    if (start + count - 1 > totalPages) start = totalPages - count + 1;
    return Array.from({ length: count }, (_, i) => start + i);
  };

  // Export handlers
  const handleFullExport = async (type = 'excel') => {
    setExportError(null);
    try { setIsExporting(true); await apiService.exportReport({ ...filters, search: globalSearch, chapter: selectedChapter, tradeType }, type); }
    catch (err) { setExportError(err?.response?.data?.message || err?.message || 'Failed to export'); }
    finally { setIsExporting(false); }
  };
  const handleCategoricalExport = async (cat, type) => {
    setExportError(null);
    const params = { startDate: filters.startDate, endDate: filters.endDate, item: filters.item, importer: filters.importer, exporter: filters.exporter, origin_country_id: filters.origin_country_id, country: filters.origin_country_id, tradeType };
    try {
      setIsExporting(true);
      const map = { item: apiService.exportItemWise, importer: apiService.exportImporterWise, exporter: apiService.exportExporterWise, country: apiService.exportCountryWise, agent: apiService.exportAgentWise };
      if (map[cat]) await map[cat](params, type);
    } catch (err) { setExportError(err?.response?.data?.message || err?.message || 'Failed to export'); }
    finally { setIsExporting(false); }
  };
  const handleFullShare = async (type = 'excel') => {
    setExportError(null);
    try { setIsExporting(true); await apiService.shareExportReport({ ...filters, search: globalSearch, chapter: selectedChapter, tradeType }, type); }
    catch (err) { setExportError(err?.message || 'Share failed'); }
    finally { setIsExporting(false); }
  };
  const handleCategoricalShare = async (cat, type) => {
    setExportError(null);
    const params = { startDate: filters.startDate, endDate: filters.endDate, item: filters.item, importer: filters.importer, exporter: filters.exporter, origin_country_id: filters.origin_country_id, country: filters.origin_country_id, tradeType };
    try {
      setIsExporting(true);
      const map = { item: apiService.shareItemWise, importer: apiService.shareImporterWise, exporter: apiService.shareExporterWise, country: apiService.shareCountryWise, agent: apiService.shareAgentWise };
      if (map[cat]) await map[cat](params, type);
    } catch (err) { setExportError(err?.message || 'Share failed'); }
    finally { setIsExporting(false); }
  };

  const filteredChapters = HS_CHAPTERS.filter(ch =>
    ch.code.includes(chapterSearch.toLowerCase()) ||
    ch.name.toLowerCase().includes(chapterSearch.toLowerCase())
  );

  const switchTradeType = (nextType) => {
    if (nextType === tradeType) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('trade_type', nextType);
    if (selectedChapter) {
      nextParams.set('chapter', selectedChapter);
    } else {
      nextParams.delete('chapter');
    }
    setPage(1);
    setSearchParams(nextParams);
  };

  return (
    <div className={`td-page ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Open Sidebar Button (when closed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="td-toggle-btn"
          title="Show sidebar"
        >
          ☰ Chapters
        </button>
      )}

      {/* Sidebar Panel */}
      <aside className={`td-sidebar ${sidebarOpen ? '' : 'closed'}`}>
        {sidebarOpen && (
          <>
            <div className="td-sidebar-head">
              <span className="td-sidebar-title">
                {tradeType === 'export' ? 'EXPORT' : 'IMPORT'}
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="td-sidebar-close-btn"
                title="Hide sidebar"
              >
                ←
              </button>
            </div>

            <div className="td-sidebar-search">
              <div className="td-chapter-search">
                <MdSearch size={14} className="td-accent-icon" />
                <input
                  type="text"
                  placeholder="Search chapters..."
                  value={chapterSearch}
                  onChange={e => setChapterSearch(e.target.value)}
                />
                {chapterSearch && (
                  <button
                    className="td-chapter-clear"
                    onClick={() => setChapterSearch('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <MdClear size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="td-chapters-list">
              <div
                className={`td-chapter-item ${selectedChapter === '' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedChapter('');
                  setPage(1);
                }}
              >
                <span className="td-ch-code">ALL</span>
                <span className="td-ch-name">All Chapters</span>
              </div>
              {filteredChapters.map(ch => (
                <div
                  key={ch.code}
                  className={`td-chapter-item ${selectedChapter === ch.code ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedChapter(ch.code);
                    setPage(1);
                  }}
                >
                  <span className="td-ch-code">{ch.code}</span>
                  <span className="td-ch-name">{ch.name}</span>
                </div>
              ))}
              {filteredChapters.length === 0 && (
                <div className="td-ch-no-results">NO CHAPTERS FOUND</div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ── Main ── */}
      <main className="td-main">
        {/* Header */}
        <div className="td-content-head">
          <div>
            <div className="td-head-label">
              {tradeType === 'export' ? 'EXPORT ANALYTICS' : 'IMPORT ANALYTICS'}
              {selectedChapter && ` · CH ${selectedChapter}`}
            </div>
            <div className="td-head-title">
              {tradeType === 'export' ? 'EXPORT DATA EXPLORER' : 'IMPORT DATA EXPLORER'}
            </div>
            <div className="td-head-sub">
              Search by HS code, {tradeType === 'export' ? 'exporter' : 'importer'}, item, or origin country
            </div>
          </div>
          <div className="td-head-actions">
            <div className="td-type-toggle" role="group" aria-label="Trade type switch">
              <button
                type="button"
                className={`td-type-btn ${tradeType === 'import' ? 'active' : ''}`}
                onClick={() => switchTradeType('import')}
              >
                IMPORT
              </button>
              <button
                type="button"
                className={`td-type-btn ${tradeType === 'export' ? 'active' : ''}`}
                onClick={() => switchTradeType('export')}
              >
                EXPORT
              </button>
            </div>

            <div className="td-export-wrap">
              <button className="td-export-btn" onClick={() => setExportMenuOpen(true)}>
                ↑ EXPORT REPORT
              </button>
              {exportMenuOpen && (
                <ExportModal isOpen={exportMenuOpen}
                  onClose={() => { setExportMenuOpen(false); setExportError(null); }}
                  isExporting={isExporting}
                  handleFullExport={handleFullExport}
                  handleCategoricalExport={handleCategoricalExport}
                  handleFullShare={handleFullShare}
                  handleCategoricalShare={handleCategoricalShare}
                  exportError={exportError} />
              )}
            </div>
          </div>
        </div>

        {/* Scrollable area */}
        <div className="td-scroll-area">
          {/* Search */}
          <div className="td-search-panel">
            <div className="td-search-row">
              <MdSearch size={18} className="td-search-icon" />
              <input className="td-search-input"
                placeholder="Search by Importer, Exporter, Item, HS Code, or any keyword..."
                value={globalSearch}
                onChange={e => { setGlobalSearch(e.target.value); setPage(1); }}
                disabled={loading} />
              {globalSearch && (
                <button className="td-search-clear" onClick={() => { setGlobalSearch(''); setPage(1); }}>
                  <MdClear size={16} />
                </button>
              )}
              <button className={`td-filter-toggle ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(p => !p)}>
                <MdFilterList size={16} />
                {showFilters ? 'HIDE' : 'FILTERS'}
              </button>
            </div>

            {showFilters && (
              <div className="td-filters">
                <div className="td-filters-grid">
                  <FilterDropdown name="origin_country_id" label="Origin Country" options={countryOptions.length ? countryOptions : filterOptions.origins} />
                  <FilterDropdown name="item" label="Item Name" options={filterOptions.items} />
                  <FilterDropdown name="importer" label="Importer" options={filterOptions.importers} />
                  <FilterDropdown name="exporter" label="Exporter" options={filterOptions.exporters} />
                </div>

                <div className="td-date-row">
                  <div className="td-date-group">
                    <div className="td-filter-label">FROM DATE</div>
                    <input type="month" className="td-month-input"
                      value={tempFilters.startDate}
                      onChange={e => setTempFilters(p => ({ ...p, startDate: e.target.value }))}
                      disabled={loading} />
                  </div>
                  {!isMobile && <div className="td-date-sep">TO</div>}
                  <div className="td-date-group">
                    <div className="td-filter-label">TO DATE</div>
                    <input type="month" className="td-month-input"
                      value={tempFilters.endDate}
                      onChange={e => setTempFilters(p => ({ ...p, endDate: e.target.value }))}
                      disabled={loading} />
                  </div>
                </div>

                <div className="td-filter-actions">
                  <button className="td-btn-apply" onClick={() => { setFilters({ ...tempFilters }); setPage(1); }} disabled={loading}>
                    APPLY FILTERS
                  </button>
                  <button className="td-btn-clear" onClick={clearFilters} disabled={loading}>
                    <MdClear size={13} /> CLEAR ALL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="td-error">
              <MdSearch size={15} /> {error}
            </div>
          )}

          {/* Results */}
          <div className="td-results-panel">
            <div className="td-results-head">
              <span className="td-results-title">SEARCH RESULTS</span>
              <span className="td-results-count">
                {loading ? 'LOADING...' : <><strong>{total.toLocaleString()}</strong> RECORDS FOUND</>}
              </span>
            </div>

            {loading ? (
              <div className="td-loading">
                <div className="td-spinner" />
                <p>FETCHING RECORDS...</p>
              </div>
            ) : records.length > 0 ? (
              <>
                <div className="td-table-wrap">
                  <table className="td-table">
                    <thead>
                      <tr>
                        {tableColumns.map(col => (
                          <th key={col}>{
                            col === 'trade_type' ? 'TYPE'
                            : col === 'period_date' ? 'DATE'
                            : col === 'origin_country' ? 'COUNTRY'
                            : col === 'exporter_name' ? 'EXPORTER'
                            : col === 'item_name' ? 'ITEM'
                            : col === 'item_description' ? 'DESCRIPTION'
                            : col === 'ntn' ? 'NTN'
                            : col === 'importer_name' ? 'IMPORTER'
                            : col === 'value_usd' ? 'VALUE (USD)'
                            : col === 'port_of_shipment' ? 'PORT'
                            : col === 'quantity' ? 'QTY'
                            : col === 'uom' ? 'UOM'
                            // : col === 'agent_name' ? 'AGENT'
                            // : col === 'agent_number' ? 'AGENT NO.'
                            // : col === 'terminal_sheds' ? 'TERMINAL'
                            : col.replace(/_/g, ' ').toUpperCase()
                          }</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id || i} style={{ animationDelay: `${i * 20}ms` }}>
                          {tableColumns.map(col => (
                            <td key={col}>
                              {(() => {
                                if (col === 'trade_type') {
                                  return (
                                    <span className={`td-badge ${r[col] === 'E' ? 'td-badge-export' : 'td-badge-import'}`}>
                                      {r[col] === 'I' ? 'IMP' : r[col] === 'E' ? 'EXP' : r[col] || '—'}
                                    </span>
                                  );
                                }
                                if (col === 'period_date' && r[col]) return new Date(r[col]).toLocaleDateString('en-GB').replace(/\//g, '.');
                                if (col === 'value_usd' && r[col] != null) return `$${Number(r[col]).toLocaleString()}`;
                                if (col === 'quantity' && r[col] != null) return Number(r[col]).toLocaleString();
                                return r[col] != null && r[col] !== '' ? r[col] : '—';
                              })()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="td-table-footer">
                  <div className="td-footer-left">
                    <div className="td-rpp">
                      <span className="td-rpp-label">ROWS:</span>
                      <select className="td-rpp-select" value={limit}
                        onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} disabled={loading}>
                        {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <span className="td-rec-info">
                      <strong>{records.length > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)}</strong> of <strong>{total.toLocaleString()}</strong>
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <div className="td-pagination">
                      <button className="td-page-btn" onClick={() => setPage(1)} disabled={page === 1 || loading}>⟪</button>
                      <button className="td-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>‹</button>
                      {paginationPages().map(n => (
                        <button key={n} className={`td-page-btn ${page === n ? 'active' : ''}`}
                          onClick={() => setPage(n)} disabled={loading}>{n}</button>
                      ))}
                      <button className="td-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>›</button>
                      <button className="td-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages || loading}>⟫</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="td-empty">
                <div className="td-empty-icon">◎</div>
                <div className="td-empty-title">NO RECORDS FOUND</div>
                <div className="td-empty-sub">Try adjusting your filters or search criteria</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TradeDataPage;