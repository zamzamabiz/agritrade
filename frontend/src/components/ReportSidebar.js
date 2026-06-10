import { useEffect, useState } from "react";
import "./ReportSidebar.css";

const ReportSidebar = ({ sidebarOpen, setSidebarOpen, selectedReport, onSelectReport, loading }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const ADVANCED_REPORTS = [
        { id: 'market-intel', label: 'Market Intel' },
        { id: 'strategic', label: 'Strategic Hub' },
        { id: 'item-exporter', label: 'Item > Exporter' },
        { id: 'item-importer', label: 'Item > Importer' },
    ];

    return (
        <>
            {/* Toggle Sidebar Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`rs-toggle-btn ${sidebarOpen ? "open" : "closed"}`}
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
                {sidebarOpen ? "←" : "☰ Reports"}
            </button>

            {/* Side Panel */}
            <div
                className="rs-panel"
                style={{
                    position: "fixed",
                    left: 0,
                    top: 0,
                    width: sidebarOpen ? (isMobile ? "100%" : "280px") : "0",
                    height: "100vh",
                    padding: sidebarOpen ? (isMobile ? "1rem 0.85rem" : "2rem 1rem") : "0",
                    overflowY: "auto",
                    transition: "width 0.3s ease, padding 0.3s ease",
                    zIndex: 1000,
                }}
            >
                {sidebarOpen && (
                    <>
                        <h2 className="rs-title">
                            Reports
                        </h2>
                        {/* <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {REPORT_TYPES.map((rt) => (
                                <button
                                    key={rt.id}
                                    onClick={() => onSelectReport(rt.id)}
                                    disabled={loading && selectedReport !== rt.id}
                                    style={{
                                        padding: "0.75rem 1rem",
                                        backgroundColor: selectedReport === rt.id ? "#6366f1" : "transparent",
                                        color: selectedReport === rt.id ? "#fff" : "#cbd5e1",
                                        border: selectedReport === rt.id ? "1px solid #6366f1" : "1px solid #475569",
                                        borderRadius: "6px",
                                        cursor: loading && selectedReport !== rt.id ? "not-allowed" : "pointer",
                                        fontWeight: selectedReport === rt.id ? 600 : 400,
                                        textAlign: "left",
                                        transition: "all 0.2s ease",
                                        opacity: loading && selectedReport !== rt.id ? 0.6 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedReport !== rt.id && !(loading && selectedReport !== rt.id)) {
                                            e.target.style.backgroundColor = "#334155";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedReport !== rt.id) {
                                            e.target.style.backgroundColor = "transparent";
                                        }
                                    }}
                                >
                                    {rt.label}
                                </button>
                            ))}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '1rem 0' }} /> */}
                        {/* <h3 style={{ marginBottom: '0.75rem', fontSize: '1.05em', fontWeight: 600 }}>Advance Reports</h3> */}
                        <div className="rs-list">
                            {ADVANCED_REPORTS.map((report) => (
                                <button
                                    key={report.id}
                                    onClick={() => onSelectReport && onSelectReport(report.id)}
                                    disabled={loading && selectedReport !== report.id}
                                    className={`rs-report-btn ${selectedReport === report.id ? 'active' : ''}`}
                                >
                                    {report.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Sidebar Spacing */}
            {sidebarOpen && !isMobile && <div style={{ width: "280px" }} />}
        </>
    );
};

export default ReportSidebar;
