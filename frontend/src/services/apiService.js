const API_BASE_URL =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? process.env.REACT_APP_BASE_URL_DEVELOPMENT
    : process.env.REACT_APP_BASE_URL_PRODUCTION;

let refreshPromise = null;

// Helper to refresh token
const refreshToken = async () => {
  if (refreshPromise) return refreshPromise;

  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) throw new Error("No refresh token available");

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      throw new Error("Session expired. Please login again.");
    }

    const data = await response.json();
    const nextAccessToken = data.accessToken || data.token;
    if (!nextAccessToken) {
      localStorage.removeItem("authToken");
      throw new Error("Invalid refresh response: missing token");
    }

    localStorage.setItem("authToken", nextAccessToken);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }

    return nextAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

// Wrapper to handle 401 and refresh token
const handleResponse = async (response, retryFn) => {
  if (response.status === 401) {
    // Try refresh token
    try {
      await refreshToken();
      if (typeof retryFn === "function") {
        return retryFn();
      }
    } catch (e) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }
  return response.json();
};

const fetchReportsWithAuthRetry = async (url, options) => {
  let response = await fetch(url, options);

  if (response.status === 401) {
    await refreshToken();
    const retryOptions = {
      ...options,
      headers: {
        ...(options?.headers || {}),
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    };
    response = await fetch(url, retryOptions);
  }

  return response;
};

const apiService = {
  // ============ Auth APIs ============
  // Login
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleResponse(response);
    // Save tokens if present
    const accessToken = data.accessToken || data.token;
    if (accessToken) localStorage.setItem("authToken", accessToken);
    if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
    return data;
  },

  // Register (Signup)
  register: async (username, password, email, full_name) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email, full_name }),
    });
    return handleResponse(response);
  },

  // Get current user profile
  getProfile: async () => {
    const retry = () => apiService.getProfile();
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // Update user profile
  updateProfile: async (email, full_name) => {
    const retry = () => apiService.updateProfile(email, full_name);
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ email, full_name }),
    });
    return handleResponse(response, retry);
  },

  // ============ Dashboard APIs ============
  getDashboardStats: async () => {
    const retry = () => apiService.getDashboardStats();
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  getDashboardActivity: async () => {
    const retry = () => apiService.getDashboardActivity();
    const response = await fetch(`${API_BASE_URL}/dashboard/activity`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  getDashboardSummary: async () => {
    const retry = () => apiService.getDashboardSummary();
    const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Upload APIs ============
  uploadFile: async (file, tradeType, chapter, period) => {
    const retry = () => apiService.uploadFile(file, tradeType, chapter, period);
    const formData = new FormData();
    formData.append("file", file);
    if (tradeType) {
      formData.append("trade_type", tradeType);
    }
    if (chapter) {
      formData.append("chapter", chapter);
    }
    if (period) {
      formData.append("period_month", period);
    }

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      body: formData,
    });
    return handleResponse(response, retry);
  },

  getUploadHistory: async () => {
    const retry = () => apiService.getUploadHistory();
    const response = await fetch(`${API_BASE_URL}/upload/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  getUploadDetails: async (uploadId) => {
    const retry = () => apiService.getUploadDetails(uploadId);
    const response = await fetch(`${API_BASE_URL}/upload/${uploadId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  getJobStatus: async (jobId) => {
    const retry = () => apiService.getJobStatus(jobId);
    const response = await fetch(`${API_BASE_URL}/upload/status/${jobId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  deleteUpload: async (uploadId) => {
    const retry = () => apiService.deleteUpload(uploadId);
    const response = await fetch(`${API_BASE_URL}/upload/${uploadId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Records APIs ============
  getRecords: async (
    page = 1,
    limit = 20,
    search = "",
    filters = {},
    tradeType = "import",
    chapter = "",
    sortBy = "",
    sortDir = "desc",
  ) => {
    const retry = () =>
      apiService.getRecords(
        page,
        limit,
        search,
        filters,
        tradeType,
        chapter,
        sortBy,
        sortDir,
      );
    const params = new URLSearchParams({
      page,
      limit,
      ...(search && { search }),
      trade_type: tradeType,
      ...(chapter && { chapter }),
      ...(filters.origin_country_id && { origin_country_id: filters.origin_country_id }),
      ...(filters.origin && { origin: filters.origin }),
      ...(filters.item && { item: filters.item }),
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate }),
      ...(filters.importer && { importer: filters.importer }),
      ...(filters.exporter && { exporter: filters.exporter }),
      ...(sortBy && { sortBy }),
      ...(sortDir && { sortDir }),
    });
    const response = await fetch(`${API_BASE_URL}/data/records?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  getCountries: async (search = "") => {
    const retry = () => apiService.getCountries(search);
    const qs = new URLSearchParams({ ...(search ? { search } : {}) }).toString();

    let response = await fetch(
        `${API_BASE_URL}/countries${qs ? `?${qs}` : ""}`,
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      },
    );

    const payload = await handleResponse(response, retry);
    const rows = payload?.data || payload?.countries || [];
    return Array.isArray(rows) ? rows : [];
  },

  getRecordById: async (recordId) => {
    const retry = () => apiService.getRecordById(recordId);
    const response = await fetch(`${API_BASE_URL}/data/records/${recordId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  updateRecord: async (recordId, data) => {
    const retry = () => apiService.updateRecord(recordId, data);
    const response = await fetch(`${API_BASE_URL}/data/records/${recordId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response, retry);
  },

  deleteRecord: async (recordId) => {
    const retry = () => apiService.deleteRecord(recordId);
    const response = await fetch(`${API_BASE_URL}/data/records/${recordId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Deduplication APIs ============
  getNameClusters: async (type = "importer", threshold = 0.95) => {
    const retry = () => apiService.getNameClusters(type, threshold);
    const params = new URLSearchParams({ type, threshold });
    const response = await fetch(
      `${API_BASE_URL}/data/name-clusters?${params}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      },
    );
    return handleResponse(response, retry);
  },

  mergeNames: async (data) => {
    const retry = () => apiService.mergeNames(data);
    const response = await fetch(`${API_BASE_URL}/data/merge-names`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response, retry);
  },

  // ============ Reports APIs ============
  aiCommodityPortfolio: async (params = {}) => {
    const retry = () => apiService.aiCommodityPortfolio(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/dashboard/commodity-portfolio${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiTopImporters: async (params = {}) => {
    const retry = () => apiService.aiTopImporters(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/dashboard/top-importers${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiTopExporters: async (params = {}) => {
    const retry = () => apiService.aiTopExporters(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/dashboard/top-exporters${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiShipments: async (params = {}) => {
    const retry = () => apiService.aiShipments(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/dashboard/shipments${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiGetProducts: async () => {
    const retry = () => apiService.aiGetProducts();
    const response = await fetch(`${API_BASE_URL}/ai/item-exporter/products`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiExportShipmentsExcel: async (params = {}) => {
    const retry = () => apiService.aiExportShipmentsExcel(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/dashboard/shipments/export${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // Download helper for /ai export endpoints
  aiDownloadFile: async (url, filename = 'report') => {
    const response = await fetchReportsWithAuthRetry(
      `${API_BASE_URL}/ai${url}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'AI report export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  // Helper to handle blob response and download file
  downloadFile: async (
    url,
    method = "GET",
    body = null,
    filename = "report",
  ) => {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        ...(body && { "Content-Type": "application/json" }),
      },
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetchReportsWithAuthRetry(
      `${API_BASE_URL}/reports${url}`,
      options,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Report export failed");
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  // Get report as a blob (for sharing or processing)
  getBlob: async (url, method = "GET", body = null) => {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        ...(body && { "Content-Type": "application/json" }),
      },
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetchReportsWithAuthRetry(
      `${API_BASE_URL}/reports${url}`,
      options,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Report generation failed");
    }

    return await response.blob();
  },

  // Share report using Web Share API
  shareReport: async (blob, filename, title = "Trade Data Report") => {
    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: "Check out this AgriTrade Insights Report.",
        });
        return true;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Sharing failed:", err);
          throw err;
        }
        return false;
      }
    } else {
      throw new Error("Your browser does not support file sharing.");
    }
  },
  exportReport: async (filters = {}, type = "excel") => {
    const date = new Date().toISOString().split("T")[0];
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/export/${type}`,
      "POST",
      filters,
      `trade_report_${date}.${extension}`,
    );
  },

  exportItemWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/item-wise/${type}?${queryParams}`,
      "GET",
      null,
      `item_wise_report.${extension}`,
    );
  },

  exportImporterWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/importer-wise/${type}?${queryParams}`,
      "GET",
      null,
      `importer_wise_report.${extension}`,
    );
  },

  exportExporterWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/exporter-wise/${type}?${queryParams}`,
      "GET",
      null,
      `exporter_wise_report.${extension}`,
    );
  },

  exportCountryWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/country-wise/${type}?${queryParams}`,
      "GET",
      null,
      `country_wise_report.${extension}`,
    );
  },

  exportAgentWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    return apiService.downloadFile(
      `/agent-wise/${type}?${queryParams}`,
      "GET",
      null,
      `agent_wise_report.${extension}`,
    );
  },

  exportMarketIntelReport: async (params = {}, type = 'excel') => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === 'pdf' ? 'pdf' : 'xlsx';
    return apiService.aiDownloadFile(
      `/export/market-intel/${type}${queryParams ? `?${queryParams}` : ''}`,
      `market_intel_report.${extension}`,
    );
  },

  exportStrategicReport: async (params = {}, type = 'excel') => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === 'pdf' ? 'pdf' : 'xlsx';
    return apiService.aiDownloadFile(
      `/export/strategic/${type}${queryParams ? `?${queryParams}` : ''}`,
      `strategic_report.${extension}`,
    );
  },

  exportItemExporterReport: async (params = {}, type = 'excel') => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === 'pdf' ? 'pdf' : 'xlsx';
    return apiService.aiDownloadFile(
      `/export/item-exporter/${type}${queryParams ? `?${queryParams}` : ''}`,
      `item_exporter_report.${extension}`,
    );
  },

  exportItemImporterReport: async (params = {}, type = 'excel') => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === 'pdf' ? 'pdf' : 'xlsx';
    return apiService.aiDownloadFile(
      `/export/item-importer/${type}${queryParams ? `?${queryParams}` : ''}`,
      `item_importer_report.${extension}`,
    );
  },

  // ============ Share Report Functions (Mobile) ============
  shareExportReport: async (filters = {}, type = "excel") => {
    const date = new Date().toISOString().split("T")[0];
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `trade_report_${date}.${extension}`;
    const blob = await apiService.getBlob(`/export/${type}`, "POST", filters);
    return apiService.shareReport(blob, filename, "Trade Data Report");
  },

  shareItemWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `item_wise_report.${extension}`;
    const blob = await apiService.getBlob(
      `/item-wise/${type}?${queryParams}`,
      "GET",
      null,
    );
    return apiService.shareReport(blob, filename, "Item Wise Report");
  },

  shareImporterWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `importer_wise_report.${extension}`;
    const blob = await apiService.getBlob(
      `/importer-wise/${type}?${queryParams}`,
      "GET",
      null,
    );
    return apiService.shareReport(blob, filename, "Importer Wise Report");
  },

  shareExporterWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `exporter_wise_report.${extension}`;
    const blob = await apiService.getBlob(
      `/exporter-wise/${type}?${queryParams}`,
      "GET",
      null,
    );
    return apiService.shareReport(blob, filename, "Exporter Wise Report");
  },

  shareCountryWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `country_wise_report.${extension}`;
    const blob = await apiService.getBlob(
      `/country-wise/${type}?${queryParams}`,
      "GET",
      null,
    );
    return apiService.shareReport(blob, filename, "Country Wise Report");
  },

  shareAgentWise: async (params, type = "excel") => {
    const queryParams = new URLSearchParams(params).toString();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `agent_wise_report.${extension}`;
    const blob = await apiService.getBlob(
      `/agent-wise/${type}?${queryParams}`,
      "GET",
      null,
    );
    return apiService.shareReport(blob, filename, "Agent Wise Report");
  },

  // Check if device supports native sharing
  canShare: () => {
    return navigator.canShare !== undefined;
  },

  // ============ User Management APIs ============
  getUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response);
  },

  createUser: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  updateUser: async (userId, userData) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  deleteUser: async (userId) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response);
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(response);
  },

  adminChangePassword: async (data) => {
    const response = await fetch(`${API_BASE_URL}/users/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // ============ Column Preferences APIs ============
  // Save user's preferred columns
  saveColumnPreferences: async (columns) => {
    const retry = () => apiService.saveColumnPreferences(columns);
    const response = await fetch(`${API_BASE_URL}/users/preferred-columns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ columns }),
    });
    return handleResponse(response, retry);
  },

  // Get user's preferred columns
  getColumnPreferences: async () => {
    const retry = () => apiService.getColumnPreferences();
    const response = await fetch(`${API_BASE_URL}/users/preferred-columns`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Market Intel Chart APIs ============
  aiPricePulse: async (params = {}) => {
    const retry = () => apiService.aiPricePulse(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/market-intel/price-pulse${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiImporterShare: async (params = {}) => {
    const retry = () => apiService.aiImporterShare(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/market-intel/importer-share${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiOriginMonthly: async (params = {}) => {
    const retry = () => apiService.aiOriginMonthly(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/market-intel/origin-monthly${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiMonthlyPulse: async (params = {}) => {
    const retry = () => apiService.aiMonthlyPulse(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/market-intel/monthly-pulse${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Strategic Chart APIs ============
  aiMomentum: async (params = {}) => {
    const retry = () => apiService.aiMomentum(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/strategic/momentum${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiHHI: async (params = {}) => {
    const retry = () => apiService.aiHHI(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/strategic/hhi${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiPartnerLoyalty: async (params = {}) => {
    const retry = () => apiService.aiPartnerLoyalty(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/strategic/partner-loyalty${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiTopPorts: async (params = {}) => {
    const retry = () => apiService.aiTopPorts(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/strategic/top-ports${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiHSCodeShare: async (params = {}) => {
    const retry = () => apiService.aiHSCodeShare(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/strategic/hs-code-share${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  // ============ Item Explorer APIs ============
  aiItemExporterProducts: async (params = {}) => {
    const retry = () => apiService.aiItemExporterProducts(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/item-exporter/products${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiItemExporter: async (params = {}) => {
    const retry = () => apiService.aiItemExporter(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/item-exporter${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },

  aiItemImporter: async (params = {}) => {
    const retry = () => apiService.aiItemImporter(params);
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/ai/item-importer${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });
    return handleResponse(response, retry);
  },
};

export default apiService;
