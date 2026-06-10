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
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
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
);

const StrategicCharts = ({ filters, selectedReport, loading }) => {
  const [chartData, setChartData] = useState({
    momentum: null,
    hhi: null,
    partnerLoyalty: null,
    topPorts: null,
    hsCodeShare: null,
  });
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch chart data
  useEffect(() => {
    if (selectedReport !== "strategic" || loading) return;

    const fetchChartData = async () => {
      setChartLoading(true);
      setError(null);
      try {
        const [momentumRes, hhiRes, loyaltyRes, portsRes, hsRes] =
          await Promise.all([
            apiService.aiMomentum(filters),
            apiService.aiHHI(filters),
            apiService.aiPartnerLoyalty(filters),
            apiService.aiTopPorts(filters),
            apiService.aiHSCodeShare(filters),
          ]);

        setChartData({
          momentum: momentumRes,
          hhi: hhiRes,
          partnerLoyalty: loyaltyRes,
          topPorts: portsRes,
          hsCodeShare: hsRes,
        });
      } catch (err) {
        setError(err.message || "Failed to fetch chart data");
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [filters, selectedReport, loading]);

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

  // Partner Loyalty Chart Data (Bar)
  const partnerLoyaltyChartData = chartData.partnerLoyalty
    ? {
        labels: (chartData.partnerLoyalty.pairs || []).map(
          (p) =>
            `${p.importer?.substring(0, 20)}... → ${p.exporter?.substring(
              0,
              15,
            )}...`,
        ),
        datasets: [
          {
            label: "Quantity (KG)",
            data: (chartData.partnerLoyalty.pairs || []).map(
              (p) => p.quantity_kg,
            ),
            backgroundColor: "#3b82f6",
            borderColor: "#1e40af",
            borderWidth: 1,
          },
        ],
      }
    : null;

  // Top Ports Chart Data (Bar)
  const topPortsChartData = chartData.topPorts
    ? {
        labels: (chartData.topPorts.ports || []).map((p) => p.port),
        datasets: [
          {
            label: "Quantity (KG)",
            data: (chartData.topPorts.ports || []).map((p) => p.quantity_kg),
            backgroundColor: "#10b981",
            borderColor: "#065f46",
            borderWidth: 1,
          },
        ],
      }
    : null;

  // HS Code Share Chart Data (Pie)
  const hsCodeShareChartData = chartData.hsCodeShare
    ? {
        labels: (chartData.hsCodeShare.hs_codes || []).map((h) => h.label),
        datasets: [
          {
            label: "Share %",
            data: (chartData.hsCodeShare.hs_codes || []).map(
              (h) => h.share_pct,
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

  return (
    <div className="st-root" style={{ marginBottom: "2rem" }}>

      {/* Top 10 High-Growth Products Table */}
      {chartData.momentum && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "1.5rem",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          }}
        >
          <h3
            style={{
              marginBottom: "1rem",
              color: "#0f172a",
              fontSize: "1.1em",
            }}
          >
            Top 10 High-Growth Products (Momentum Analysis)
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.95 rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "12px 8px",
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
                      padding: "12px 8px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Product Item
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Dec Volume (KG)
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Vol Increase (KG)
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      borderBottom: "2px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Growth %
                  </th>
                </tr>
              </thead>
              <tbody>
                {(chartData.momentum.products || []).map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 8px", color: "#475569" }}>
                      {row.rank}
                    </td>
                    <td style={{ padding: "12px 8px", color: "#475569" }}>
                      {row.item}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        color: "#475569",
                        textAlign: "right",
                      }}
                    >
                      {row.dec_volume_kg.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        color: "#475569",
                        textAlign: "right",
                      }}
                    >
                      {row.vol_increase_kg.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        color: row.growth_pct >= 0 ? "#059669" : "#dc2626",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {row.growth_pct >= 0 ? "+" : ""}
                      {row.growth_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <h2
        style={{ marginTop: "2rem", marginBottom: "1.5rem", color: "#0f172a" }}
      >
        Strategic Analysis Charts
      </h2>

      {/* HHI Metric */}
      {chartData.hhi && (
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
            Market Concentration (HHI)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#f8fafc",
                borderRadius: "6px",
                borderLeft: "4px solid #3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: "0.9em",
                  color: "#64748b",
                  marginBottom: "0.5rem",
                }}
              >
                HHI Value
              </div>
              <div
                style={{ fontSize: "2em", fontWeight: 700, color: "#0f172a" }}
              >
                {chartData.hhi.hhi}
              </div>
            </div>
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#f8fafc",
                borderRadius: "6px",
                borderLeft: "4px solid #10b981",
              }}
            >
              <div
                style={{
                  fontSize: "0.9em",
                  color: "#64748b",
                  marginBottom: "0.5rem",
                }}
              >
                Market Status
              </div>
              <div
                style={{ fontSize: "1.2em", fontWeight: 600, color: "#0f172a" }}
              >
                {chartData.hhi.label}
              </div>
            </div>
          </div>
          <p
            style={{ marginTop: "1rem", color: "#64748b", fontSize: "0.95 rem" }}
          >
            {chartData.hhi.interpretation}
          </p>
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
        {/* Partner Loyalty Chart */}
        {partnerLoyaltyChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              Top Partner Loyalty (Qty/Supplier)
            </h3>
            <div style={{ height: "450px" }}>
              <Bar
                data={partnerLoyaltyChartData}
                options={chartOptions}
              />
            </div>
          </div>
        )}

        {/* Top Ports Chart */}
        {topPortsChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              Top Logistics Ports (KG)
            </h3>
            <div style={{ height: "450px" }}>
              <Bar data={topPortsChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* HS Code Share Chart */}
        {hsCodeShareChartData && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1.5rem",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#0f172a",
                fontSize: "1.1em",
              }}
            >
              HS Code Volume Share
            </h3>
            <div style={{ height: "350px" }}>
              <Pie
                data={hsCodeShareChartData}
                options={pieOptions}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategicCharts;
