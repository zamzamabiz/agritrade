import React, { useEffect, useState } from "react";
import { HS_CHAPTERS } from "../constants/hsChapters";
import apiService from "../services/apiService";
import "./ReportFilters.css";

const ReportFilters = ({ filters, filterOptions, onFilterChange, onApplyFilters, onClearFilters, onExportReport, loading, isExporting = false, selectedReport }) => {
    const currentYear = new Date().getFullYear();
    const pad = (value) => String(value).padStart(2, '0');
    const toMonthValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const getPresetRange = (preset) => {
        const now = new Date();
        const end = toMonthValue(now);
        if (preset === 'last30') {
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            return { start: toMonthValue(startDate), end };
        }
        if (preset === 'quarter') {
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            return { start: `${now.getFullYear()}-${pad(quarterStartMonth + 1)}`, end };
        }
        if (preset === 'lastQuarter') {
            const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            const previousQuarterEnd = new Date(now.getFullYear(), currentQuarterStartMonth, 0);
            const previousQuarterStart = new Date(previousQuarterEnd.getFullYear(), previousQuarterEnd.getMonth() - 2, 1);
            return { start: toMonthValue(previousQuarterStart), end: toMonthValue(previousQuarterEnd) };
        }
        if (preset === 'ytd') {
            return { start: `${now.getFullYear()}-01`, end };
        }
        return { start: '', end: '' };
    };
    const monthOptions = [
        { value: '01', label: 'Jan' },
        { value: '02', label: 'Feb' },
        { value: '03', label: 'Mar' },
        { value: '04', label: 'Apr' },
        { value: '05', label: 'May' },
        { value: '06', label: 'Jun' },
        { value: '07', label: 'Jul' },
        { value: '08', label: 'Aug' },
        { value: '09', label: 'Sep' },
        { value: '10', label: 'Oct' },
        { value: '11', label: 'Nov' },
        { value: '12', label: 'Dec' },
    ];
    const yearOptions = Array.from({ length: 61 }, (_, i) => String(currentYear - 30 + i));

    const [showExportMenu, setShowExportMenu] = useState(false);
    const [countryApiOptions, setCountryApiOptions] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState(true);
    const exportDisabled = !selectedReport || loading || isExporting;
    const isMarketIntel = selectedReport === "market-intel";
    const countryOptions = countryApiOptions.length
        ? countryApiOptions
        : (filterOptions.countries || []).filter(Boolean).map((name) => ({ id: name, name }));
    const labelStyle = { fontSize: '0.9em', color: 'var(--theme-heading)', fontWeight: 600 };
    const inputStyle = { padding: '6px', border: '1px solid var(--theme-surface-border)', borderRadius: 6, color: 'var(--theme-text)', backgroundColor: 'var(--theme-input-bg, var(--theme-surface))' };

    useEffect(() => {
        let active = true;
        const t = setTimeout(async () => {
            try {
                const rows = await apiService.getCountries('');
                if (!active) return;
                const normalized = rows
                    .filter((c) => c && c.id !== undefined && c.name)
                    .map((c) => ({ id: String(c.id), name: c.name }));
                setCountryApiOptions(normalized);
            } catch (e) {
                if (!active) return;
                setCountryApiOptions([]);
            }
        }, 250);

        return () => {
            active = false;
            clearTimeout(t);
        };
    }, []);

    const MonthYearField = ({ label, name, value }) => {
        const [selectedYear = '', selectedMonth = ''] = (value || '').split('-');

        const updateMonthYear = (nextYear, nextMonth) => {
            const year = nextYear || selectedYear;
            const month = nextMonth || selectedMonth;

            if (!year || !month) {
                onFilterChange({ target: { name, value: '' } });
                return;
            }

            onFilterChange({ target: { name, value: `${year}-${month}` } });
        };

        return (
            <div className="rf-field">
                <label style={labelStyle}>{label}</label><br />
                <div className="rf-month-year">
                    <select
                        className="rf-input-select"
                        value={selectedMonth}
                        onChange={(e) => updateMonthYear('', e.target.value)}
                        style={{ ...inputStyle, minWidth: 86 }}
                        disabled={loading}
                    >
                        <option value="">Month</option>
                        {monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>

                    <select
                        className="rf-input-select"
                        value={selectedYear}
                        onChange={(e) => updateMonthYear(e.target.value, '')}
                        style={{ ...inputStyle, minWidth: 100 }}
                        disabled={loading}
                    >
                        <option value="">Year</option>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>
        );
    };

    const applyPreset = (preset) => {
        onFilterChange({ target: { name: 'periodPreset', value: preset } });
        if (!preset || preset === 'custom') return;
        const range = getPresetRange(preset);
        if (range.start) onFilterChange({ target: { name: 'startDate', value: range.start } });
        if (range.end) onFilterChange({ target: { name: 'endDate', value: range.end } });
    };

    return (
        <div className="rf-wrap" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            <div className="rf-field">
                <label style={labelStyle}>Period Preset</label><br />
                <select
                    className="rf-input-select"
                    name="periodPreset"
                    value={filters.periodPreset || 'custom'}
                    onChange={(e) => applyPreset(e.target.value)}
                    style={{ ...inputStyle, minWidth: 150 }}
                    disabled={loading}
                >
                    <option value="custom">Custom</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="quarter">Current Quarter</option>
                    <option value="lastQuarter">Previous Quarter</option>
                    <option value="ytd">Year to Date</option>
                </select>
            </div>
            {/* Date Filters */}
            <MonthYearField label="Start Month" name="startDate" value={filters.startDate} />
            <MonthYearField label="End Month" name="endDate" value={filters.endDate} />
            <div className="rf-field rf-compare-toggle">
                <label style={labelStyle}>Comparison</label><br />
                <button
                    type="button"
                    className={`rf-compare-btn ${filters.comparisonMode ? 'active' : ''}`}
                    onClick={() => onFilterChange({ target: { name: 'comparisonMode', value: !filters.comparisonMode } })}
                    disabled={loading}
                >
                    {filters.comparisonMode ? 'Comparison On' : 'Comparison Off'}
                </button>
            </div>
            {filters.comparisonMode && (
                <>
                    <div className="rf-field">
                        <label style={labelStyle}>Compare Preset</label><br />
                        <select
                            className="rf-input-select"
                            name="comparisonPreset"
                            value={filters.comparisonPreset || 'previousPeriod'}
                            onChange={onFilterChange}
                            style={{ ...inputStyle, minWidth: 160 }}
                            disabled={loading}
                        >
                            <option value="previousPeriod">Previous Period</option>
                            <option value="previousYear">Previous Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                    <MonthYearField label="Compare Start" name="compareStartDate" value={filters.compareStartDate} />
                    <MonthYearField label="Compare End" name="compareEndDate" value={filters.compareEndDate} />
                </>
            )}
            {/* Country Filter */}
            <div className="rf-field">
                <label style={labelStyle}>Country</label><br />
                <select
                    className="rf-input-select"
                    name="origin_country_id"
                    value={filters.origin_country_id}
                    onChange={onFilterChange}
                    style={{ ...inputStyle, minWidth: isMarketIntel ? 150 : 170 }}
                >
                    <option value="">All Countries</option>
                    {countryOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                </select>
            </div>
            {/* HS Chapter Filter */}
            <div className="rf-field">
                <label style={labelStyle}>HS Chapter</label><br />
                <select
                    className="rf-input-select"
                    name="chapter"
                    value={filters.chapter}
                    onChange={onFilterChange}
                    style={{ ...inputStyle, minWidth: 100 }}
                >
                    <option value="">All</option>
                    {HS_CHAPTERS.map((ch) => (
                        <option key={ch.code} value={ch.code}>{ch.code} - {ch.name}</option>
                    ))}
                </select>
            </div>
            {/* Action Buttons */}
            <div className="rf-actions">
                <button
                    type="button"
                    className="rf-btn rf-btn-muted"
                    onClick={() => setShowAdvanced((value) => !value)}
                    disabled={loading}
                >
                    {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                </button>
                <button
                    className="rf-btn rf-btn-primary"
                    onClick={onApplyFilters}
                    disabled={loading || !selectedReport}
                >
                    Apply Filters
                </button>

                <button
                    className="rf-btn rf-btn-muted"
                    onClick={onClearFilters}
                    disabled={loading}
                >
                    Clear Filters
                </button>

                <div
                    className="rf-export-wrap"
                    onMouseEnter={() => !exportDisabled && setShowExportMenu(true)}
                    onMouseLeave={() => setShowExportMenu(false)}
                >
                    <button
                        type="button"
                        className="rf-btn rf-btn-primary"
                        disabled={exportDisabled}
                    >
                        {isExporting ? (
                            <>
                                <span className="rf-spinner" aria-hidden="true" />
                                Exporting...
                            </>
                        ) : (
                            "Export Report"
                        )}
                    </button>

                    {showExportMenu && (
                        <div className="rf-export-menu">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowExportMenu(false);
                                    onExportReport('excel');
                                }}
                                className="rf-export-item"
                            >
                                Export as XLSX
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowExportMenu(false);
                                    onExportReport('pdf');
                                }}
                                className="rf-export-item"
                            >
                                Export as PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showAdvanced && (
                <div className="rf-advanced-note">
                    Use presets for fast range selection, then compare the current window against a previous or custom period.
                </div>
            )}
        </div>
    );
};

export default ReportFilters;
