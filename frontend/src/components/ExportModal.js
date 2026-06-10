import React, { useState, useEffect } from 'react';
import { MdClose, MdDescription, MdPictureAsPdf, MdShare, MdError } from 'react-icons/md';
import apiService from '../services/apiService';
import './ExportModal.css';

// ─── Component ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'item',     label: 'Item Wise',     code: 'RPT.01' },
  { id: 'importer', label: 'Importer Wise', code: 'RPT.02' },
  { id: 'exporter', label: 'Exporter Wise', code: 'RPT.03' },
  { id: 'country',  label: 'Country Wise',  code: 'RPT.04' },
  { id: 'agent',    label: 'Agent Wise',    code: 'RPT.05' },
];

const ExportModal = ({
  isOpen,
  onClose,
  isExporting,
  handleFullExport,
  handleCategoricalExport,
  handleFullShare,
  handleCategoricalShare,
  exportError,
}) => {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const isMobile = () => {
      const ua = (navigator.userAgent || navigator.vendor || window.opera).toLowerCase();
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)
        && window.innerWidth <= 1024;
    };
    setCanShare(isMobile() && apiService.canShare?.());
  }, []);

  if (!isOpen) return null;

  // Normalise error text
  const errText = exportError
    ? (exportError.includes('from and to dates') ? 'Please select both Start and End month/year before exporting.' : exportError)
    : null;

  return (
    <div className="em-overlay" onClick={onClose}>
      <div className="em-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="em-header">
          <div className="em-header-left">
            <div className="em-header-code">EXPORT / REPORT GENERATOR</div>
            <div className="em-header-title">EXPORT DATA</div>
            <div className="em-header-sub">Download or share reports based on current filters</div>
          </div>
          <button className="em-close" onClick={onClose} aria-label="Close">
            <MdClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="em-body">

          {/* Error */}
          {errText && (
            <div className="em-error">
              <MdError size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>EXPORT ERROR</strong>
                {errText}
              </div>
            </div>
          )}

          {/* ─ Full Dataset ─ */}
          <div className="em-section-label">FULL DATASET REPORT</div>
          <div className="em-full-panel">
            <div className="em-full-title">Complete Record Export</div>
            <div className="em-full-desc">
              All records matching your current search filters and chapter selection
            </div>
            <div className="em-full-actions">
              <button className="em-btn em-btn-excel" onClick={() => handleFullExport('excel')} disabled={isExporting}>
                <MdDescription size={14} />
                {isExporting ? 'EXPORTING...' : 'DOWNLOAD EXCEL'}
              </button>
              <button className="em-btn em-btn-pdf" onClick={() => handleFullExport('pdf')} disabled={isExporting}>
                <MdPictureAsPdf size={14} />
                {isExporting ? 'EXPORTING...' : 'DOWNLOAD PDF'}
              </button>

              {canShare && (
                <>
                  <div className="em-share-divider"><span className="em-share-label">SHARE</span></div>
                  <button className="em-btn em-btn-share" onClick={() => handleFullShare('excel')} disabled={isExporting} title="Share Excel">
                    <MdShare size={14} />
                    {isExporting ? 'SHARING...' : 'SHARE EXCEL'}
                  </button>
                  <button className="em-btn em-btn-share-pdf" onClick={() => handleFullShare('pdf')} disabled={isExporting} title="Share PDF">
                    <MdShare size={14} />
                    {isExporting ? 'SHARING...' : 'SHARE PDF'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ─ Categorized ─ */}
          <div className="em-section-label">CATEGORIZED SUMMARY REPORTS</div>
          <div className="em-cat-grid">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="em-cat-card">
                <div className="em-cat-name">{cat.label}</div>
                <div className="em-cat-code">{cat.code}</div>
                <div className="em-cat-actions">
                  <button className="em-cat-btn em-cat-excel"
                    onClick={() => handleCategoricalExport(cat.id, 'excel')} disabled={isExporting}>
                    <MdDescription size={11} /> XLS
                  </button>
                  <button className="em-cat-btn em-cat-pdf"
                    onClick={() => handleCategoricalExport(cat.id, 'pdf')} disabled={isExporting}>
                    <MdPictureAsPdf size={11} /> PDF
                  </button>
                  {canShare && (
                    <button className="em-cat-btn em-cat-share"
                      onClick={() => handleCategoricalShare(cat.id, 'excel')} disabled={isExporting}>
                      <MdShare size={11} /> SHARE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loading overlay */}
        {isExporting && (
          <div className="em-loading-overlay">
            <div className="em-loader-ring" />
            <div className="em-loader-bars">
              <span /><span /><span /><span /><span />
            </div>
            <div className="em-loader-label">GENERATING REPORT</div>
            <div className="em-shimmer-bar" />
            <div className="em-loader-sub">This may take a few moments</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportModal;