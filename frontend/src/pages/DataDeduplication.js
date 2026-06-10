import React, { useState, useEffect } from 'react';
import { MdMergeType, MdRefresh, MdCheckCircle, MdError, MdSettingsSuggest } from 'react-icons/md';
import apiService from '../services/apiService';
import './DataDeduplication.css';

// ─── Component ───────────────────────────────────────────────────────────────
const DataDeduplication = () => {
  const [type, setType] = useState('importer');
  const [threshold, setThreshold] = useState(0.95);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(null); // cluster idx being merged
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selections, setSelections] = useState({});
  const [primaryNames, setPrimaryNames] = useState({});

  const fetchClusters = async () => {
    setLoading(true); setError(null); setClusters([]); setSelections({}); setPrimaryNames({});
    try {
      const data = await apiService.getNameClusters(type, threshold);
      const clus = data.clusters || [];
      setClusters(clus);
      const iSel = {}, iPri = {};
      clus.forEach((c, i) => { iSel[i] = c.secondary; iPri[i] = c.primary; });
      setSelections(iSel); setPrimaryNames(iPri);
    } catch (err) {
      setError('Failed to fetch clusters. Please adjust settings and try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchClusters(); }, []); // eslint-disable-line

  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); } }, [message]);

  const toggleSecondary = (idx, name) => {
    setSelections(p => {
      const cur = p[idx] || [];
      return { ...p, [idx]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] };
    });
  };

  const handlePrimaryChange = (idx, val) => {
    setPrimaryNames(p => ({ ...p, [idx]: val }));
    setSelections(p => ({ ...p, [idx]: (p[idx] || []).filter(n => n !== val) }));
  };

  const handleMerge = async (idx) => {
    const primary = primaryNames[idx];
    const secondary = selections[idx];
    if (!secondary?.length) return;
    setMerging(idx);
    try {
      await apiService.mergeNames({ type, primary, secondary });
      setMessage({ type: 'success', text: `Merged ${secondary.length} name${secondary.length > 1 ? 's' : ''} into "${primary}"` });
      setClusters(p => p.filter((_, i) => i !== idx));
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Merge failed' });
    } finally { setMerging(null); }
  };

  return (
    <div className="dd-root">
      {/* Header */}
      <div className="dd-header">
        <div className="dd-header-label">ADMIN / DATA QUALITY</div>
        <h1>DATA DEDUPLICATION</h1>
        <p>
          Clean your dataset by merging similar importer or exporter names using fuzzy string clustering.
          Select a canonical primary name, mark duplicates to merge, then confirm.
        </p>
      </div>

      {/* Alert */}
      {message && (
        <div className={`dd-alert dd-alert-${message.type}`}>
          {message.type === 'success' ? <MdCheckCircle size={16} /> : <MdError size={16} />}
          {message.text}
        </div>
      )}
      {error && (
        <div className="dd-alert dd-alert-error">
          <MdError size={16} /> {error}
        </div>
      )}

      {/* Controls */}
      <div className="dd-controls">
        <div style={{ flex: 1 }}>
          <div className="dd-controls-title">/ CLUSTER PARAMETERS</div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="dd-ctrl-group">
              <div className="dd-ctrl-label">DATA TYPE</div>
              <select className="dd-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="importer">Importers (Pakistan)</option>
                <option value="exporter">Exporters (Overseas)</option>
              </select>
            </div>

            <div className="dd-ctrl-group">
              <div className="dd-ctrl-label">FUZZY THRESHOLD</div>
              <div className="dd-slider-wrap">
                <input type="range" min="0.8" max="0.99" step="0.01"
                  className="dd-slider" value={threshold}
                  onChange={e => setThreshold(parseFloat(e.target.value))} />
                <span className="dd-threshold-val">{Math.round(threshold * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        <button className="dd-fetch-btn" onClick={fetchClusters} disabled={loading}>
          <MdRefresh size={16} className={loading ? 'dd-spin' : ''} />
          {loading ? 'ANALYZING...' : 'FETCH CLUSTERS'}
        </button>
      </div>

      {/* Summary */}
      {!loading && clusters.length > 0 && (
        <div className="dd-summary">
          <span className="dd-chip">CLUSTERS FOUND: {clusters.length}</span>
          <span className="dd-chip">TYPE: {type.toUpperCase()}</span>
          <span className="dd-chip">THRESHOLD: {Math.round(threshold * 100)}%</span>
          <span className="dd-chip" style={{ color: 'rgba(74,222,128,0.7)', borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.06)' }}>
            TOTAL VARIANTS: {clusters.reduce((a, c) => a + 1 + c.secondary.length, 0)}
          </span>
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="dd-loading">
          <div className="dd-spinner" />
          <div className="dd-analyze-bar">
            <span /><span /><span /><span /><span />
          </div>
          <p>ANALYZING DATASET FOR DUPLICATE NAMES...</p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="dd-empty">
          <MdSettingsSuggest size={56} className="dd-empty-icon" />
          <h3>NO DUPLICATES DETECTED</h3>
          <p>Try reducing the threshold (e.g. to 90%) to detect<br />more distant name variations.</p>
        </div>
      ) : (
        <div className="dd-grid">
          {clusters.map((cluster, idx) => {
            const candidates = [cluster.primary, ...cluster.secondary];
            const selPrimary = primaryNames[idx];
            const selCount = selections[idx]?.length || 0;
            const isMerging = merging === idx;

            return (
              <div key={idx} className="dd-cluster" style={{ animationDelay: `${idx * 40}ms` }}>
                {/* Head */}
                <div className="dd-cluster-head">
                  <div className="dd-cluster-id">GRP-{String(idx + 1).padStart(3, '0')} · {candidates.length} VARIATIONS</div>
                  <div className="dd-cluster-title">Cluster #{idx + 1}</div>

                  <div className="dd-canonical-label">CANONICAL NAME (EDITABLE)</div>
                  <input
                    className="dd-canonical-input"
                    value={selPrimary || ''}
                    onChange={e => handlePrimaryChange(idx, e.target.value)}
                    placeholder="Type canonical form..."
                  />
                </div>

                {/* Name list */}
                <div className="dd-name-list">
                  <div className="dd-name-list-header">
                    <span className="dd-col-lbl">PRI</span>
                    <span className="dd-col-lbl">MRG</span>
                    <span className="dd-col-lbl">NAME VARIATION</span>
                  </div>
                  {candidates.map(name => (
                    <div
                      key={name}
                      className={`dd-name-row ${selPrimary === name ? 'is-primary' : ''} ${selections[idx]?.includes(name) ? 'is-selected' : ''}`}
                      onClick={() => { if (selPrimary !== name) toggleSecondary(idx, name); }}
                    >
                      <div onClick={e => e.stopPropagation()}>
                        <input type="radio" className="dd-name-radio"
                          name={`primary-${idx}`}
                          checked={selPrimary === name}
                          onChange={() => handlePrimaryChange(idx, name)} />
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="dd-name-check"
                          checked={selections[idx]?.includes(name) || false}
                          onChange={() => toggleSecondary(idx, name)}
                          disabled={selPrimary === name} />
                      </div>
                      <div className="dd-name-text" title={name}>{name}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="dd-cluster-foot">
                  <div className="dd-selected-count">
                    <strong>{selCount}</strong> NAME{selCount !== 1 ? 'S' : ''} SELECTED TO MERGE
                  </div>
                  <button
                    className="dd-merge-btn"
                    onClick={() => handleMerge(idx)}
                    disabled={isMerging || selCount === 0}
                  >
                    {isMerging
                      ? <><span style={{ width:13,height:13,border:'2px solid rgba(74,222,128,0.2)',borderTopColor:'#4ade80',borderRadius:'50%',animation:'dedupSpin 0.7s linear infinite',display:'inline-block' }} /> MERGING...</>
                      : <><MdMergeType size={14} /> MERGE {selCount > 0 ? selCount : ''}</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DataDeduplication;