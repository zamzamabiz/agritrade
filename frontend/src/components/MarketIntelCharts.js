import React, { useState, useEffect } from "react";
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
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import apiService from "../services/apiService";

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

const MarketIntelCharts = ({ filters, selectedReport, loading }) => {
  const [chartData, setChartData] = useState({
    pricePulse: null,
    importerShare: null,
    originMonthly: null,
    monthlyPulse: null,
    commodities: null,
  });
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commodityPage, setCommodityPage] = useState(1);
  const commodityPageSize = 100;

  // Fetch chart data
  useEffect(() => {
    if (selectedReport !== "market-intel" || loading) return;

    const fetchChartData = async () => {
      setChartLoading(true);
      setError(null);
      try {
        const [
          pricePulseRes,
          importerShareRes,
          originMonthlyRes,
          monthlyPulseRes,
          commoditiesRes,
        ] = await Promise.all([
          apiService.aiPricePulse(filters),
          apiService.aiImporterShare(filters),
          apiService.aiOriginMonthly(filters),
          apiService.aiMonthlyPulse(filters),
          apiService.aiCommodityPortfolio(filters),
        ]);

        setChartData({
          pricePulse: pricePulseRes,
          importerShare: importerShareRes,
          originMonthly: originMonthlyRes,
          monthlyPulse: monthlyPulseRes,
          commodities: commoditiesRes,
        });
      } catch (err) {
        setError(err.message || "Failed to fetch chart data");
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [filters, selectedReport, loading]);

  useEffect(() => {
    setCommodityPage(1);
  }, [filters, selectedReport]);

  if (chartLoading) {
    return (
      <div style={{ padding: "2rem", color: "#64748b" }}>Loading charts...</div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          color: "#b91c1c",
          padding: "1rem",
          backgroundColor: "#fee2e2",
          borderRadius: "6px",
        }}
      >
        {error}
      </div>
    );
  }

  // Price Pulse Chart Data
  const pricePulseChartData = chartData.pricePulse
    ? {
        labels: chartData.pricePulse.months || [],
        datasets: (chartData.pricePulse.series || []).map((s, idx) => ({
          label: s.importer,
          data: s.prices,
          borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
          backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 90%)`,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        })),
      }
    : null;

  // Importer Share Chart Data (Pie)
  const importerShareChartData = chartData.importerShare
    ? {
        labels: (chartData.importerShare.importers || []).map(
          (i) => i.importer,
        ),
        datasets: [
          {
            label: "Share %",
            data: (chartData.importerShare.importers || []).map(
              (i) => i.share_pct,
            ),
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
              "#FF6384",
              "#C9CBCF",
              "#4BC0C0",
              "#FF6384",
            ],
            borderColor: "#fff",
            borderWidth: 2,
          },
        ],
      }
    : null;

  // Origin Monthly Chart Data (Stacked Bar)
  const originMonthlyChartData = chartData.originMonthly
    ? {
        labels: chartData.originMonthly.months || [],
        datasets: (chartData.originMonthly.origins || [])
          .slice(0, 6)
          .map((o, idx) => ({
            label: o.country,
            data: o.monthly_kg,
            backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 60%)`,
          })),
      }
    : null;

  // Monthly Pulse Chart Data (Area)
  const monthlyPulseChartData = chartData.monthlyPulse
    ? {
        labels: chartData.monthlyPulse.months || [],
        datasets: [
          {
            label: "Total Quantity (KG)",
            data: chartData.monthlyPulse.total_kg,
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            borderColor: "#3b82f6",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      }
    : null;

  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";
  const chartTickColor = isDarkTheme ? "#cbd5e1" : "#475569";
  const chartGridColor = isDarkTheme
    ? "rgba(148, 163, 184, 0.22)"
    : "rgba(148, 163, 184, 0.28)";
  const legendColor = isDarkTheme ? "#e2e8f0" : "#334155";

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: legendColor,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: chartTickColor,
        },
        grid: {
          color: chartGridColor,
        },
      },
      y: {
        ticks: {
          color: chartTickColor,
          callback: function (value) {
            return value.toLocaleString();
          },
        },
        grid: {
          color: chartGridColor,
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "right",
        labels: {
          color: legendColor,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.parsed || 0;
            return context.label + ": " + value.toFixed(1) + "%";
          },
        },
      },
    },
  };

  const commodityRows = chartData.commodities?.commodities || [];
  const commodityTotalPages = Math.max(
    1,
    Math.ceil(commodityRows.length / commodityPageSize),
  );
  const commodityStart = (commodityPage - 1) * commodityPageSize;
  const commodityPagedRows = commodityRows.slice(
    commodityStart,
    commodityStart + commodityPageSize,
  );

  return (
    <div className="mi-root" style={{ marginBottom: "2rem" }}>
      <h2
        style={{ marginTop: "2rem", marginBottom: "1.5rem", color: "#0f172a" }}
      >
        Market Intelligence Charts
      </h2>

      {/* Commodity Portfolio Table */}
      {chartData.commodities && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
            marginBottom: "2rem",
          }}
        >
          <h3
            style={{
              marginBottom: "1rem",
              color: "#0f172a",
              fontSize: "1.1em",
            }}
          >
            Commodity Portfolio
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                borderSpacing: 0,
                fontSize: "0.95 rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "10px 4px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Rank
                  </th>
                  <th
                    style={{
                      padding: "10px 4px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Item
                  </th>
                  <th
                    style={{
                      padding: "10px 4px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Quantity (KG)
                  </th>
                  <th
                    style={{
                      padding: "10px 4px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Share %
                  </th>
                </tr>
              </thead>
              <tbody>
                {commodityPagedRows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 4px", color: "#475569" }}>
                      {row.rank}
                    </td>
                    <td style={{ padding: "10px 4px", color: "#475569" }}>
                      {row.item}
                    </td>
                    <td
                      style={{
                        padding: "10px 4px",
                        color: "#475569",
                        textAlign: "right",
                      }}
                    >
                      {row.quantity_kg.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px 4px",
                        color: "#475569",
                        textAlign: "right",
                      }}
                    >
                      {row.share_pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {commodityRows.length > commodityPageSize && (
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={() => setCommodityPage(Math.max(1, commodityPage - 1))}
                disabled={commodityPage === 1}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: commodityPage === 1 ? "#f1f5f9" : "#fff",
                  color: commodityPage === 1 ? "#94a3b8" : "#0f172a",
                  cursor: commodityPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>

              <span style={{ color: "#64748b", fontSize: "0.9em" }}>
                Page {commodityPage} of {commodityTotalPages} (100 rows)
              </span>

              <button
                onClick={() =>
                  setCommodityPage(
                    Math.min(commodityTotalPages, commodityPage + 1),
                  )
                }
                disabled={commodityPage >= commodityTotalPages}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor:
                    commodityPage >= commodityTotalPages ? "#f1f5f9" : "#fff",
                  color:
                    commodityPage >= commodityTotalPages
                      ? "#94a3b8"
                      : "#0f172a",
                  cursor:
                    commodityPage >= commodityTotalPages
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Charts Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Price Pulse Chart */}
        {pricePulseChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              minHeight: "460px",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              USD/KG Price Pulse
            </h3>
            <div style={{ height: "460px" }}>
              <Line
                data={pricePulseChartData}
                options={chartOptions}
                height={360}
              />
            </div>
          </div>
        )}

        {/* Importer Share Chart */}
        {importerShareChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              minHeight: "460px",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              Top Importer Share
            </h3>
            <div style={{ height: "460px" }}>
              <Pie
                data={importerShareChartData}
                options={pieOptions}
                height={360}
              />
            </div>
          </div>
        )}

        {/* Monthly Pulse Chart */}
        {monthlyPulseChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              minHeight: "460px",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              Monthly Import Pulse
            </h3>
            <div style={{ height: "460px" }}>
              <Line
                data={monthlyPulseChartData}
                options={chartOptions}
                height={360}
              />
            </div>
          </div>
        )}

        {/* Origin Monthly Chart */}
        {originMonthlyChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              gridColumn: "1 / -1",
              minHeight: "420px",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              Supplying Origins (KG)
            </h3>
            <div style={{ height: "320px" }}>
              <Bar
                data={originMonthlyChartData}
                options={{
                  ...chartOptions,
                  scales: {
                    x: {
                      ...(chartOptions.scales?.x || {}),
                      stacked: false,
                    },
                    y: {
                      ...(chartOptions.scales?.y || {}),
                      stacked: false,
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketIntelCharts;
