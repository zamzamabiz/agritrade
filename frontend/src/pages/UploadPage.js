import React, { useState, useEffect } from 'react';
import {
  MdCloudUpload, MdCheckCircle, MdError, MdDescription,
  MdDelete, MdSearch, MdRefresh,
  MdDataUsage
} from 'react-icons/md';
import apiService from '../services/apiService';
import { HS_CHAPTERS } from '../constants/hsChapters';
import { useNavigate } from 'react-router-dom';
import './UploadPage.css';

// ─── Component ───────────────────────────────────────────────────────────────
const UploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [tradeType, setTradeType] = useState('import');
  const [chapter, setChapter] = useState('');
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [chapterSearch, setChapterSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const savedJobId = localStorage.getItem('activeUploadJobId');
    if (savedJobId) { setJobId(savedJobId); setUploading(true); }
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await apiService.getUploadHistory();
      const data = response?.data || [];
      setHistory(data);
      if (!localStorage.getItem('activeUploadJobId')) {
        const active = data.find(u => ['processing','pending','active'].includes(u.status?.toLowerCase()));
        if (active) setUploading(true);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (!uploading || !jobId) return;
    const iv = setInterval(async () => {
      try {
        const res = await apiService.getJobStatus(jobId);
        setJobStatus(res);
        if (res.state === 'completed' || res.state === 'success') {
          if (res.progress?.status === 'failed') {
            setError(res.progress?.error || res.failedReason || 'Upload processing failed.');
          } else {
            setUploadResult(res);
          }
          setUploading(false); setJobId(null);
          localStorage.removeItem('activeUploadJobId'); fetchHistory();
          clearInterval(iv);
        } else if (res.state === 'failed' || res.state === 'error') {
          setError(res.failedReason || 'Upload processing failed.');
          setUploading(false); setJobId(null);
          localStorage.removeItem('activeUploadJobId'); fetchHistory();
          clearInterval(iv);
        }
      } catch (e) { console.error(e); }
    }, 5000);
    return () => clearInterval(iv);
  }, [uploading, jobId]);

  const validateAndSetFile = (f) => {
    if (!f) return;
    const valid = ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/csv','text/x-csv'];
    if (!valid.includes(f.type) && !f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please select an Excel (.xlsx, .xls) or CSV file'); return;
    }
    setFile(f); setUploadResult(null); setError(null);
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first'); return; }
    if (!chapter) { setError('Please select a chapter'); return; }
    setUploading(true); setError(null); setJobStatus(null); setUploadResult(null);
    try {
      const period = `${periodYear}-${periodMonth}`;
      const res = await apiService.uploadFile(file, tradeType, chapter, period);
      if (res?.jobId) { setJobId(res.jobId); localStorage.setItem('activeUploadJobId', res.jobId); }
      else { setUploadResult(res); setFile(null); setUploading(false); }
    } catch (err) { setError(err.message || 'Upload failed. Please try again.'); setUploading(false); }
  };

  const percent = jobStatus?.progress?.percent ?? jobStatus?.progress;
  const hasPercent = percent !== undefined;

  const filteredChapters = HS_CHAPTERS.filter(ch =>
    ch.code.includes(chapterSearch) || ch.name.toLowerCase().includes(chapterSearch.toLowerCase())
  );

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 20;
  const maxYear = currentYear + 10;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
  const monthOptions = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const statusClass = (st) => {
    const s = st?.toLowerCase();
    if (s === 'success' || s === 'completed') return 'up-hist-success';
    if (s === 'failed' || s === 'error') return 'up-hist-failed';
    if (s === 'processing') return 'up-hist-processing';
    return 'up-hist-pending';
  };

  return (
    <div className="up-root">
      {/* Header */}
      <div className="up-header">
        <div className="up-header-label">DATA INGESTION</div>
        <h1>UPLOAD TRADE DATA</h1>
        <p>Import Excel or CSV files mapped to HS chapters · Supports .xlsx, .xls, .csv</p>
      </div>

      {/* Error */}
      {error && (
        <div className="up-alert up-alert-error">
          <MdError size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="up-alert-error-title">UPLOAD ERROR</div>
            <div>{error}</div>
            {jobStatus?.progress?.rawCount !== undefined && (
              <div className="up-alert-sub">
                Total rows: {jobStatus.progress.rawCount.toLocaleString()} · Valid saved: {(jobStatus.progress.validCount || 0).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Trade Type */}
      <div className="up-panel">
        <div className="up-panel-head">
          <div className="up-panel-code">STEP 01</div>
          <div className="up-panel-title">Select Trade Direction</div>
        </div>
        <div className="up-type-grid">
          {[
            { val: 'import', icon: '↓', label: 'Import Data', desc: 'Inbound trade records — Pakistan as destination' },
            { val: 'export', icon: '↑', label: 'Export Data', desc: 'Outbound trade records — Pakistan as origin' },
          ].map(t => (
            <div key={t.val} className={`up-type-card ${tradeType === t.val ? 'selected' : ''}`}
              onClick={() => setTradeType(t.val)}>
              <input type="radio" className="up-type-radio" name="tradeType" value={t.val}
                checked={tradeType === t.val} onChange={() => setTradeType(t.val)} />
              <div className="up-type-icon">{t.icon}</div>
              <div>
                <div className="up-type-label">{t.label}</div>
                <div className="up-type-desc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Chapter & Period */}
      <div className="up-panel">
        <div className="up-panel-head">
          <div className="up-panel-code">STEP 02</div>
          <div className="up-panel-title">HS Chapter & Period</div>
        </div>
        <div className="up-cp-grid">
          {/* Chapter selector */}
          <div className="up-field up-field-chapter">
            <label className="up-field-label" htmlFor="chapterSelect">HS Chapter</label>
            <div className="up-chapter-search-wrap">
              <MdSearch size={16} className="up-chapter-search-icon" />
              <input
                id="chapterSearch"
                type="text"
                className="up-chapter-search"
                placeholder="Search chapter code or name"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
              />
            </div>
            <select
              id="chapterSelect"
              className="up-native-select"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            >
              <option value="">Select HS Chapter</option>
              {filteredChapters.map((ch) => (
                <option key={ch.code} value={ch.code}>{`CH ${ch.code} - ${ch.name}`}</option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div className="up-field up-field-period">
            <label className="up-field-label" htmlFor="periodMonth">Reporting Period</label>
            <div className="up-period-controls">
              <select
                id="periodMonth"
                className="up-native-select"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                id="periodYear"
                className="up-native-select"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Upload Zone */}
      <div className="up-panel">
        <div className="up-panel-head">
          <div className="up-panel-code">STEP 03</div>
          <div className="up-panel-title">Upload File</div>
        </div>
        <div className="up-panel-body">
          {/* No file, not uploading */}
          {!file && !uploading && !uploadResult && (
            <div className="up-zone"
              onClick={() => document.getElementById('up-file-input').click()}
              onDrop={e => { e.preventDefault(); validateAndSetFile(e.dataTransfer.files[0]); }}
              onDragOver={e => e.preventDefault()}>
              <MdCloudUpload className="up-zone-icon" />
              <div className="up-zone-title">Drag & drop your file here</div>
              <div className="up-zone-sub">or <span>browse files</span> to upload</div>
              <div className="up-zone-formats">
                {['XLSX', 'XLS', 'CSV'].map(f => <span key={f} className="up-fmt-chip">{f}</span>)}
              </div>
              <input type="file" id="up-file-input" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => validateAndSetFile(e.target.files[0])} />
            </div>
          )}

          {/* File selected */}
          {file && !uploading && !uploadResult && (
            <>
              <div className="up-file-preview">
                <MdDescription size={28} className="up-file-icon" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="up-file-name">{file.name}</div>
                  <div className="up-file-meta">
                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{file.name.split('.').pop().toUpperCase()}</span>
                  </div>
                </div>
                <button className="up-file-del" onClick={e => { e.stopPropagation(); setFile(null); }}>
                  <MdDelete size={16} />
                </button>
              </div>
              <button className="up-submit-btn" onClick={handleUpload}>
                <MdCloudUpload size={16} /> CONFIRM & UPLOAD
              </button>
            </>
          )}

          {/* Uploading */}
          {uploading && (
            <div className="up-progress-wrap">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <div className="up-spinner" />
              </div>
              <div className="up-progress-title">
                {['active','processing'].includes(jobStatus?.state) ? 'PROCESSING DATA' : 'UPLOADING FILE'}
              </div>
              <div className="up-progress-sub">
                {jobStatus?.state ? `STATE: ${jobStatus.state.toUpperCase()}` : 'Initializing...'}
              </div>
              {hasPercent && (
                <>
                  <div className="up-progress-pct">{percent}%</div>
                  <div className="up-progress-stats">
                    {jobStatus?.progress?.total && <span>TOTAL: <strong>{jobStatus.progress.total.toLocaleString()}</strong></span>}
                    {jobStatus?.progress?.inserted !== undefined && <span>INSERTED: <strong>{jobStatus.progress.inserted.toLocaleString()}</strong></span>}
                    {jobStatus?.progress?.validCount !== undefined && <span>VALID: <strong>{jobStatus.progress.validCount.toLocaleString()}</strong></span>}
                  </div>
                </>
              )}
              <div className="up-bar-track">
                {hasPercent
                  ? <div className="up-bar-fill" style={{ width: `${percent}%` }} />
                  : <div className="up-bar-indeterminate" />}
              </div>
              <div className="up-jobid">JOB ID: {jobId}</div>
            </div>
          )}

          {/* Success */}
          {uploadResult && (
            <div className="up-success">
              <MdCheckCircle size={56} className="up-success-icon" />
              <div className="up-success-title">UPLOAD SUCCESSFUL</div>
              <div className="up-success-sub">Your data has been successfully ingested into the system</div>
              {(uploadResult?.progress?.inserted !== undefined || uploadResult?.progress?.validCount !== undefined) && (
                <div className="up-success-stats">
                  {uploadResult.progress?.inserted !== undefined && (
                    <div className="up-success-stat">
                      <div className="up-success-stat-val">{uploadResult.progress.inserted.toLocaleString()}</div>
                      <div className="up-success-stat-lbl">RECORDS INSERTED</div>
                    </div>
                  )}
                  {uploadResult.progress?.validCount !== undefined && (
                    <div className="up-success-stat">
                      <div className="up-success-stat-val">{uploadResult.progress.validCount.toLocaleString()}</div>
                      <div className="up-success-stat-lbl">VALID RECORDS</div>
                    </div>
                  )}
                </div>
              )}
              <div className="up-success-actions">
                <button className="up-btn-ghost" onClick={() => navigate(`/trade-data?type=${tradeType}&chapter=${chapter}`)}>
                  <MdDataUsage size={14} /> VIEW DATA
                </button>
                <button className="up-btn-primary" onClick={() => { setUploadResult(null); setFile(null); }}>
                  <MdCloudUpload size={14} /> UPLOAD ANOTHER
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload History */}
      <div>
        <div className="up-history-head">
          <div className="up-history-label-group">
            <span className="up-history-label-line" />
            <span className="up-history-label">UPLOAD HISTORY</span>
          </div>
          <button className="up-history-refresh" onClick={fetchHistory} disabled={loadingHistory}>
            <MdRefresh size={14} className={loadingHistory ? 'up-spin' : ''} />
            {loadingHistory ? 'LOADING...' : 'REFRESH'}
          </button>
        </div>

        <div className="up-hist-table-wrap">
          <div className="up-hist-head">
            {['DATE', 'JOB ID', 'TYPE', 'CHAPTER', 'RECORDS', 'STATUS'].map(h => (
              <div key={h} className="up-hist-th">{h}</div>
            ))}
          </div>
          {history.length > 0 ? history.map(item => (
            <div key={item.id} className="up-hist-row">
              <div className="up-hist-td">
                <div>
                  <div className="up-hist-date-main">{new Date(item.created_at).toLocaleDateString('en-GB').replace(/\//g, '.')}</div>
                  <div className="up-hist-date-sub">{new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                </div>
              </div>
              <div className="up-hist-td up-hist-id">#{String(item.id).padStart(4, '0')}</div>
              <div className="up-hist-td">
                <span className={`up-hist-badge ${item.trade_type === 'I' ? 'up-hist-import' : 'up-hist-export'}`}>
                  {item.trade_type === 'I' ? 'IMPORT' : 'EXPORT'}
                </span>
              </div>
              <div className="up-hist-td up-hist-chapter">
                CH {item.chapter_id}
              </div>
              <div className="up-hist-td">{(item.row_count || 0).toLocaleString()}</div>
              <div className="up-hist-td">
                <div className="up-hist-status-wrap">
                  <span className={`up-hist-badge ${statusClass(item.status)}`}>
                    {item.status?.charAt(0).toUpperCase() + item.status?.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="up-hist-empty">
              {loadingHistory ? 'LOADING HISTORY...' : 'NO UPLOAD HISTORY FOUND'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;