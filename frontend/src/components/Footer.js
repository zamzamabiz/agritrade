import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

// ─── Ticker data ─────────────────────────────────────────────────────────────
const FOOTER_TICKER = [
  'WCO HS 2022 EDITION',
  '21 SECTIONS',
  '97 CHAPTERS',
  '6-DIGIT GLOBAL STANDARD',
  'PAKISTAN CUSTOMS AUTHORITY',
  'IMPORT · EXPORT · CLASSIFICATION',
  'SEC I–XXI COVERAGE',
  'HARMONIZED COMMODITY DESCRIPTION',
  'CHAPTER 01–99 ACTIVE',
];

const Footer = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <footer className="hs-footer">
      {/* Scrolling ticker */}
      <div className="hs-footer-ticker-bar">
        <div className="hs-footer-ticker-inner">
          {[...FOOTER_TICKER, ...FOOTER_TICKER, ...FOOTER_TICKER].map((item, i) => (
            <span key={i} className="hs-footer-ticker-item">
              <span>◆</span>{item}
            </span>
          ))}
        </div>
      </div>

      {/* Main footer content */}
      <div className="hs-footer-main">
        {/* Left: Brand */}
        <div className="hs-footer-brand">
          <div className="hs-footer-brand-name">TRADEINTEL</div>
          <div className="hs-footer-brand-desc">HS CODE CLASSIFICATION INTELLIGENCE PLATFORM</div>
          <div className="hs-footer-brand-desc hs-footer-date">
            {dateStr.toUpperCase()}
          </div>
        </div>

        {/* Center: HS code visual */}
        <div className="hs-footer-center">
          <div className="hs-footer-hs-codes">
            {['C', 'H', 'A', 'P', 'T', 'E', 'R'].map((c, i) => (
              <div key={i} className="hs-footer-code-block">{c}</div>
            ))}
            <div className="hs-footer-code-sep" />
            {['0', '1', '–', '9', '9'].map((c, i) => (
              <div key={i} className={`hs-footer-code-block ${c === '–' ? 'hs-footer-code-muted' : ''}`}>{c}</div>
            ))}
          </div>
          <div className="hs-footer-wco-note">
            WORLD CUSTOMS ORGANIZATION · HARMONIZED SYSTEM
          </div>
          <div className="hs-footer-wco-note hs-footer-wco-sub">
            PAKISTAN CUSTOMS DATA PLATFORM
          </div>
        </div>

        {/* Right: Credits */}
        <div className="hs-footer-right">
          <div className="hs-footer-credit">
            DESIGNED BY <strong>INSHA TAHIR</strong>
          </div>
          <div className="hs-footer-links">
            <Link to="/" className="hs-footer-link">PORTAL</Link>
            <Link to="/dashboard" className="hs-footer-link">DASHBOARD</Link>
            <Link to="/trade-data" className="hs-footer-link">TRADE DATA</Link>
            <Link to="/reports" className="hs-footer-link">REPORTS</Link>
          </div>
          <div className="hs-footer-copyright">
            © {new Date().getFullYear()} TRADEINTEL · ALL RIGHTS RESERVED
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="hs-footer-bottom">
        <span className="hs-footer-bottom-text">
          DATA CLASSIFIED UNDER WCO HARMONIZED SYSTEM · 21 SECTIONS · 97 CHAPTERS · 6-DIGIT HS CODES
        </span>
        <span className="hs-footer-version">
          PLATFORM v2.0 · HS 2022 EDITION
        </span>
      </div>
    </footer>
  );
};

export default Footer;