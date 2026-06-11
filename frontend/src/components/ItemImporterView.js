import React, { useState, useEffect, useRef, useMemo } from "react";
import apiService from "../services/apiService";

const ItemImporterView = ({ filters, selectedReport, loading }) => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [importerData, setImporterData] = useState(null);
  const [allImportersData, setAllImportersData] = useState(null);
  const [expandedImporters, setExpandedImporters] = useState({});
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [showingAllItems, setShowingAllItems] = useState(true);
  const [allItemsPage, setAllItemsPage] = useState(1);
  const [allItemsPageSize, setAllItemsPageSize] = useState(4);
  const productsRequestRef = useRef(0);
  const dataRequestRef = useRef(0);
  const productsInFlightKeyRef = useRef("");
  const dataInFlightKeyRef = useRef("");
  const productsCacheRef = useRef(new Map());
  const dataCacheRef = useRef(new Map());
  const productListId = "item-importer-product-list";

  const normalizedFilters = useMemo(
    () => ({
      startDate: filters?.startDate || "",
      endDate: filters?.endDate || "",
      item: filters?.item || "",
      importer: filters?.importer || "",
      exporter: filters?.exporter || "",
      country: filters?.country || "",
      chapter: filters?.chapter || "",
    }),
    [filters],
  );

  const filtersKey = useMemo(
    () => JSON.stringify(normalizedFilters),
    [normalizedFilters],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const productsKey = useMemo(() => products.join("|"), [products]);
  const queryBaseKey = useMemo(
    () =>
      JSON.stringify({
        filtersKey,
        normalizedSearch,
        productsKey,
        pageSize,
        allItemsPageSize,
      }),
    [filtersKey, normalizedSearch, productsKey, pageSize, allItemsPageSize],
  );

  // Fetch product list
  useEffect(() => {
    if (selectedReport !== "item-importer" || loading) return;

    const cacheHit = productsCacheRef.current.get(filtersKey);
    if (cacheHit) {
      setProducts(cacheHit);
      return;
    }

    if (productsInFlightKeyRef.current === filtersKey) return;
    productsInFlightKeyRef.current = filtersKey;

    const requestId = ++productsRequestRef.current;

    const fetchProducts = async () => {
      setViewLoading(true);
      setError(null);
      try {
        const res = await apiService.aiItemImporterProducts(normalizedFilters);
        if (requestId !== productsRequestRef.current) return;

        const nextProducts = Array.isArray(res.products) ? res.products : [];
        productsCacheRef.current.set(filtersKey, nextProducts);
        setProducts(nextProducts);
      } catch (err) {
        if (requestId === productsRequestRef.current) {
          setError(err.message || "Failed to fetch products");
        }
      } finally {
        if (requestId === productsRequestRef.current) {
          setViewLoading(false);
          productsInFlightKeyRef.current = "";
        }
      }
    };

    fetchProducts();
  }, [selectedReport, loading, filtersKey, normalizedFilters]);

  // Reset pagination state when query context changes.
  useEffect(() => {
    setCurrentPage(1);
    setAllItemsPage(1);
    setExpandedImporters({});
  }, [queryBaseKey]);

  // Fetch all importers or search by product
  useEffect(() => {
    if (selectedReport !== "item-importer") return;

    if (!normalizedSearch && (!products || products.length === 0)) return;

    const pageToken = normalizedSearch ? 1 : allItemsPage;
    const dataKey = JSON.stringify({
      filtersKey,
      normalizedSearch,
      productsKey,
      pageSize,
      allItemsPageSize,
      pageToken,
    });

    const cached = dataCacheRef.current.get(dataKey);
    if (cached) {
      if (cached.mode === "single") {
        setImporterData(cached.payload);
        setAllImportersData(null);
        setShowingAllItems(false);
      } else {
        setAllImportersData(cached.payload);
        setImporterData(null);
        setShowingAllItems(true);
      }
      return;
    }

    if (dataInFlightKeyRef.current === dataKey) return;
    dataInFlightKeyRef.current = dataKey;

    const requestId = ++dataRequestRef.current;

    const fetchImporters = async () => {
      setViewLoading(true);
      setError(null);
      setImporterData(null);
      setAllImportersData(null);

      try {
        if (normalizedSearch) {
          const res = await apiService.aiItemImporter({
            ...normalizedFilters,
            product: searchQuery.trim(),
            page: 1,
            page_size: pageSize,
          });

          if (requestId !== dataRequestRef.current) return;

          dataCacheRef.current.set(dataKey, { mode: "single", payload: res });
          setImporterData(res);
          setShowingAllItems(false);
        } else {
          const startIndex = (allItemsPage - 1) * allItemsPageSize;
          const pageProducts = products.slice(
            startIndex,
            startIndex + allItemsPageSize,
          );
          const allData = [];
          for (const product of pageProducts) {
            try {
              const res = await apiService.aiItemImporter({
                ...normalizedFilters,
                product,
                page: 1,
                page_size: 100,
              });

              if (requestId !== dataRequestRef.current) return;

              if (res.importers && res.importers.length > 0) {
                allData.push({
                  product,
                  importers: res.importers,
                  total: res.total_importers,
                });
              }
            } catch (e) {
              console.error(`Failed to fetch importers for ${product}:`, e);
            }
          }

          if (requestId !== dataRequestRef.current) return;

          dataCacheRef.current.set(dataKey, { mode: "all", payload: allData });
          setAllImportersData(allData);
          setShowingAllItems(true);
        }
      } catch (err) {
        if (requestId === dataRequestRef.current) {
          setError(err.message || "Failed to fetch importer data");
        }
      } finally {
        if (requestId === dataRequestRef.current) {
          setViewLoading(false);
          dataInFlightKeyRef.current = "";
        }
      }
    };

    fetchImporters();
  }, [selectedReport, filtersKey, normalizedFilters, normalizedSearch, products, productsKey, pageSize, allItemsPage, allItemsPageSize, searchQuery]);

  // Load more data when page changes (for single product search)
  useEffect(() => {
    if (!normalizedSearch || currentPage === 1) return;

    const fetchMoreImporters = async () => {
      try {
        const res = await apiService.aiItemImporter({
          ...normalizedFilters,
          product: searchQuery.trim(),
          page: currentPage,
          page_size: pageSize,
        });
        setImporterData(res);
      } catch (err) {
        setError(err.message || "Failed to fetch more data");
      }
    };

    fetchMoreImporters();
  }, [currentPage, normalizedSearch, searchQuery, normalizedFilters, pageSize]);

  const toggleImporter = (importer) => {
    setExpandedImporters((prev) => ({
      ...prev,
      [importer]: !prev[importer],
    }));
  };

  const allItemsTotalPages = Math.max(
    1,
    Math.ceil((products?.length || 0) / allItemsPageSize),
  );
  const pagedAllImportersData = allImportersData || [];

  useEffect(() => {
    if (allItemsPage > allItemsTotalPages) {
      setAllItemsPage(allItemsTotalPages);
    }
  }, [allItemsPage, allItemsTotalPages]);

  if (viewLoading && !importerData && !allImportersData) {
    return (
      <div style={{ padding: "2rem", color: "#64748b" }}>Loading data...</div>
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

  return (
    <div className="ii-root" style={{ marginBottom: "2rem" }}>
      <h2
        style={{ marginTop: "2rem", marginBottom: "1.5rem", color: "#0f172a" }}
      >
        Item {`>`} Importer Hierarchy
      </h2>

      {/* Search Product Input */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "1.5rem",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          marginBottom: "2rem",
        }}
      >
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          Search Item Name (or leave empty to see all)
        </label>
        <input
          type="text"
          list={productListId}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type to search item names or pick from the list"
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            fontSize: "1em",
            color: "#0f172a",
          }}
        />
        <datalist id={productListId}>
          {products.map((product) => (
            <option key={product} value={product} />
          ))}
        </datalist>
        {searchQuery && (
          <p style={{ marginTop: "0.5rem", color: "#64748b", fontSize: "0.9em" }}>
            Searching for: <strong>{searchQuery}</strong>
          </p>
        )}
      </div>

      {/* Single Product Results */}
      {!showingAllItems && importerData && (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ color: "#0f172a", marginBottom: "0.5rem" }}>
              {searchQuery}
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9em" }}>
              Found {importerData.total_importers} importers
            </p>
          </div>

          {/* Importers List */}
          <div style={{ padding: "1.5rem" }}>
            {(importerData.importers || []).length === 0 ? (
              <p style={{ color: "#64748b", padding: "1rem" }}>
                No importers found for this item.
              </p>
            ) : (
              (importerData.importers || []).map((importer, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: "1.5rem",
                    borderLeft: "4px solid #10b981",
                  }}
                >
                  {/* Importer Row */}
                  <div
                    onClick={() => toggleImporter(importer.importer)}
                    style={{
                      padding: "1rem",
                      backgroundColor: "#f8fafc",
                      cursor: "pointer",
                      userSelect: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {importer.importer}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85em",
                          color: "#64748b",
                          marginTop: "0.25rem",
                        }}
                      >
                        {importer.supplier_count} suppliers
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "1.2em",
                        color: "#0f172a",
                        fontWeight: 600,
                        transform: expandedImporters[importer.importer]
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      ▼
                    </span>
                  </div>

                  {/* Suppliers Table (Expandable) */}
                  {expandedImporters[importer.importer] && (
                    <div
                      style={{ padding: "1rem", backgroundColor: "#ffffff" }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.9em",
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                            <th
                              style={{
                                padding: "0.75rem",
                                textAlign: "left",
                                fontWeight: 600,
                                color: "#1e293b",
                                backgroundColor: "#f8fafc",
                              }}
                            >
                              Exporter Supplier
                            </th>
                            <th
                              style={{
                                padding: "0.75rem",
                                textAlign: "left",
                                fontWeight: 600,
                                color: "#1e293b",
                                backgroundColor: "#f8fafc",
                              }}
                            >
                              Country
                            </th>
                            <th
                              style={{
                                padding: "0.75rem",
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#1e293b",
                                backgroundColor: "#f8fafc",
                              }}
                            >
                              Shipments
                            </th>
                            <th
                              style={{
                                padding: "0.75rem",
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#1e293b",
                                backgroundColor: "#f8fafc",
                              }}
                            >
                              Volume (KG)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importer.suppliers || []).map((supplier, sidx) => (
                            <tr
                              key={sidx}
                              style={{ borderBottom: "1px solid #f1f5f9" }}
                            >
                              <td
                                style={{
                                  padding: "0.75rem",
                                  color: "#475569",
                                }}
                              >
                                {supplier.exporter}
                              </td>
                              <td
                                style={{
                                  padding: "0.75rem",
                                  color: "#475569",
                                }}
                              >
                                {supplier.exporter_country}
                              </td>
                              <td
                                style={{
                                  padding: "0.75rem",
                                  color: "#475569",
                                  textAlign: "right",
                                }}
                              >
                                {supplier.shipments}
                              </td>
                              <td
                                style={{
                                  padding: "0.75rem",
                                  color: "#475569",
                                  textAlign: "right",
                                }}
                              >
                                {supplier.quantity_kg.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination for single product */}
          {importerData.total_importers > pageSize && (
            <div
              style={{
                padding: "1.5rem",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: currentPage === 1 ? "#f1f5f9" : "#fff",
                  color: currentPage === 1 ? "#94a3b8" : "#0f172a",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span style={{ padding: "0.5rem 1rem", color: "#64748b" }}>
                Page {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={
                  currentPage * pageSize >= importerData.total_importers
                }
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor:
                    currentPage * pageSize >= importerData.total_importers
                      ? "#f1f5f9"
                      : "#fff",
                  color:
                    currentPage * pageSize >= importerData.total_importers
                      ? "#94a3b8"
                      : "#0f172a",
                  cursor:
                    currentPage * pageSize >= importerData.total_importers
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

      {/* All Items View (when no search) */}
      {showingAllItems && allImportersData && (
        <div style={{ display: "grid", gap: "2rem" }}>
          {pagedAllImportersData.map((itemData, itemIdx) => (
            <div
              key={`${itemData.product}-${itemIdx}`}
              style={{
                backgroundColor: "#fff",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
              }}
            >
              <div
                style={{
                  padding: "1.5rem",
                  borderBottom: "1px solid #e2e8f0",
                  backgroundColor: "#f9fafb",
                }}
              >
                <h3 style={{ color: "#0f172a", marginBottom: "0.25rem" }}>
                  {itemData.product}
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.9em" }}>
                  {itemData.total} importers
                </p>
              </div>

              <div style={{ padding: "1.5rem" }}>
                {(itemData.importers || []).map((importer, impIdx) => (
                  <div
                    key={impIdx}
                    style={{
                      marginBottom: "1rem",
                      paddingBottom: "1rem",
                      borderBottom:
                        impIdx < (itemData.importers || []).length - 1
                          ? "1px solid #f1f5f9"
                          : "none",
                    }}
                  >
                    <div
                      onClick={() =>
                        toggleImporter(
                          `${itemData.product}-${importer.importer}`
                        )
                      }
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                            fontSize: "0.95 rem",
                          }}
                        >
                          {importer.importer}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85em",
                            color: "#64748b",
                            marginTop: "0.25rem",
                          }}
                        >
                          {importer.supplier_count} suppliers
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "1em",
                          color: "#0f172a",
                          fontWeight: 600,
                          transform: expandedImporters[
                            `${itemData.product}-${importer.importer}`
                          ]
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        ▼
                      </span>
                    </div>

                    {/* Suppliers Table */}
                    {expandedImporters[
                      `${itemData.product}-${importer.importer}`
                    ] && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.85em",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                borderBottom: "2px solid #e2e8f0",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                Supplier
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                Country
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "right",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                Shipments
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "right",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                Volume (KG)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(importer.suppliers || []).map(
                              (supplier, sidx) => (
                                <tr
                                  key={sidx}
                                  style={{
                                    borderBottom: "1px solid #f1f5f9",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      color: "#475569",
                                    }}
                                  >
                                    {supplier.exporter}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      color: "#475569",
                                    }}
                                  >
                                    {supplier.exporter_country}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      color: "#475569",
                                      textAlign: "right",
                                    }}
                                  >
                                    {supplier.shipments}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      color: "#475569",
                                      textAlign: "right",
                                    }}
                                  >
                                    {supplier.quantity_kg.toLocaleString()}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(products?.length || 0) > allItemsPageSize && (
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                alignItems: "center",
                gap: "0.75rem",
                backgroundColor: "#fff",
                borderRadius: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "0.85em",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  justifySelf: "start",
                }}
              >
                Per page
                <select
                  value={allItemsPageSize}
                  onChange={(e) => {
                    setAllItemsPage(1);
                    setAllItemsPageSize(Number(e.target.value));
                  }}
                  style={{
                    padding: "0.35rem 0.5rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    color: "#0f172a",
                    backgroundColor: "#fff",
                  }}
                >
                  {[4, 8, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  onClick={() => setAllItemsPage(Math.max(1, allItemsPage - 1))}
                  disabled={allItemsPage === 1}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: allItemsPage === 1 ? "#f1f5f9" : "#fff",
                    color: allItemsPage === 1 ? "#94a3b8" : "#0f172a",
                    cursor: allItemsPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: "0.5rem 1rem", color: "#64748b" }}>
                  Page {allItemsPage} of {allItemsTotalPages}
                </span>
                <button
                  onClick={() =>
                    setAllItemsPage(Math.min(allItemsTotalPages, allItemsPage + 1))
                  }
                  disabled={allItemsPage >= allItemsTotalPages}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor:
                      allItemsPage >= allItemsTotalPages ? "#f1f5f9" : "#fff",
                    color:
                      allItemsPage >= allItemsTotalPages ? "#94a3b8" : "#0f172a",
                    cursor:
                      allItemsPage >= allItemsTotalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>

              <div />
            </div>
          )}

          {(!allImportersData || allImportersData.length === 0) && (
            <p style={{ color: "#64748b", padding: "2rem", textAlign: "center" }}>
              No data available.
            </p>
          )}
        </div>
      )}

      {!showingAllItems && !importerData && (
        <p style={{ color: "#64748b", padding: "2rem", textAlign: "center" }}>
          Enter an item name to search and view importers.
        </p>
      )}
    </div>
  );
};

export default ItemImporterView;