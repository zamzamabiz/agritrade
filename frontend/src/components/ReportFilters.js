import React, { useEffect, useState } from "react";
import { HS_CHAPTERS } from "../constants/hsChapters";
import apiService from "../services/apiService";
import "./ReportFilters.css";

const ReportFilters = ({ filters, filterOptions, onFilterChange, onApplyFilters, onClearFilters, onExportReport, loading, isExporting = false, selectedReport }) => {
    const currentYear = new Date().getFullYear();
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

    return (
        <div className="rf-wrap" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            {/* Date Filters */}
            <MonthYearField label="Start Month" name="startDate" value={filters.startDate} />
            <MonthYearField label="End Month" name="endDate" value={filters.endDate} />
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
        </div>
    );
};

export default ReportFilters;
