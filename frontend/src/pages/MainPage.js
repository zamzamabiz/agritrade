import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MainPage.css';

// ─── HS Sections reference data ─────────────────────────────────────────────
const HS_SECTIONS = [
  { num: 'I',     chapters: '01–05', label: 'Live Animals & Animal Products' },
  { num: 'II',    chapters: '06–14', label: 'Vegetable Products' },
  { num: 'III',   chapters: '15',    label: 'Fats & Oils' },
  { num: 'IV',    chapters: '16–24', label: 'Food, Beverages & Tobacco' },
  { num: 'V',     chapters: '25–27', label: 'Mineral Products' },
  { num: 'VI',    chapters: '28–38', label: 'Chemical Products' },
  { num: 'VII',   chapters: '39–40', label: 'Plastics & Rubber' },
  { num: 'VIII',  chapters: '41–43', label: 'Hides, Leather & Furs' },
  { num: 'IX',    chapters: '44–46', label: 'Wood & Cork Products' },
  { num: 'X',     chapters: '47–49', label: 'Pulp, Paper & Paperboard' },
  { num: 'XI',    chapters: '50–63', label: 'Textiles & Apparel' },
  { num: 'XII',   chapters: '64–67', label: 'Footwear, Headgear & Umbrellas' },
  { num: 'XIII',  chapters: '68–70', label: 'Stone, Plaster, Cement & Glass' },
  { num: 'XIV',   chapters: '71',    label: 'Precious Metals & Gemstones' },
  { num: 'XV',    chapters: '72–83', label: 'Base Metals' },
  { num: 'XVI',   chapters: '84–85', label: 'Machinery & Electronics' },
  { num: 'XVII',  chapters: '86–89', label: 'Vehicles & Transport' },
  { num: 'XVIII', chapters: '90–92', label: 'Instruments & Clocks' },
  { num: 'XIX',   chapters: '93',    label: 'Arms & Ammunition' },
  { num: 'XX',    chapters: '94–96', label: 'Miscellaneous Manufactures' },
  { num: 'XXI',   chapters: '97–99', label: 'Works of Art & Special' },
];

const MODULES = [
  { title: 'Data Upload',       desc: 'Ingest CSV/Excel trade files mapped to HS chapters 01–99.',  icon: '↑',  tag: 'INGEST',   route: '/upload',     chapter: '01–99' },
  { title: 'Trade Explorer',    desc: 'Query records by HS code, chapter, section, origin & date.',  icon: '◎',  tag: 'QUERY',    route: '/trade-data', chapter: '6-DIGIT' },
  { title: 'Analytics',         desc: 'Visual dashboards across all 21 HS sections and 97 chapters.',icon: '▦',  tag: 'INSIGHTS', route: '/dashboard',  chapter: '21 SEC' },
  { title: 'Reports',           desc: 'Generate and export structured trade reports by HS chapter.', icon: '⊞',  tag: 'EXPORT',   route: '/reports',    chapter: 'OUTPUT' },
  { title: 'Profile',           desc: 'Manage account access, roles and data permissions.',          icon: '◈',  tag: 'ACCOUNT',  route: '/profile',    chapter: 'CONFIG' },
];

const TICKER_ITEMS = [
  'HS CHAPTER 01 · LIVE ANIMALS',
  'HS CHAPTER 27 · MINERAL FUELS & OILS',
  'HS CHAPTER 72 · IRON & STEEL',
  'HS CHAPTER 84 · NUCLEAR REACTORS & MACHINERY',
  'HS CHAPTER 85 · ELECTRICAL MACHINERY',
  'HS CHAPTER 61 · KNITTED APPAREL',
  'HS CHAPTER 10 · CEREALS',
  'HS CHAPTER 30 · PHARMACEUTICAL PRODUCTS',
  'HS CHAPTER 39 · PLASTICS',
  'HS CHAPTER 87 · VEHICLES',
  'HS CHAPTER 90 · OPTICAL INSTRUMENTS',
  'HS CHAPTER 52 · COTTON',
];

const getModuleGridColumns = (width) => {
  if (width < 640) return '1fr';
  if (width < 1024) return 'repeat(2, minmax(0, 1fr))';
  if (width < 1486) return 'repeat(3, minmax(0, 1fr))';
  return 'repeat(5, minmax(0, 1fr))';
};

export default function MainPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [, setTime] = useState(new Date());
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const moduleGridColumns = getModuleGridColumns(viewportWidth);
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth < 1100;

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Subtle grid-line canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);

    // Draw a faint world-map-like set of horizontal latitude lines
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const y = (h / 12) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = 'rgba(245,158,11,0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const x = (w / 20) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.strokeStyle = 'rgba(245,158,11,0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="mp-page-root" style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080c14 0%, #0b0f1a 50%, #080c14 100%)',
      fontFamily: "'Syne', sans-serif",
      color: '#e2e8f0',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Canvas grid backdrop */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />

      {/* Scanline effect */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(transparent, rgba(245,158,11,0.06), transparent)',
        animation: 'scanline 8s linear infinite',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Glow orbs */}
      <div style={{ position: 'fixed', top: '20%', right: '8%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 2, margin: '0 auto', padding: isMobile ? '0 1rem 2rem' : '0 2rem 3rem' }}>

        {/* ── Ticker ── */}
        <div className="ticker-wrap" style={{ padding: '0.45rem 0', marginBottom: '0' }}>
          <div className="ticker-inner">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                color: 'rgba(245,158,11,0.5)',
                marginRight: '3rem',
                letterSpacing: '0.5px',
              }}>
                <span style={{ color: 'rgba(245,158,11,0.25)', marginRight: '0.5rem' }}>◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Hero ── */}
        <div style={{
          padding: isMobile ? '2.5rem 0 2rem' : '4rem 0 3rem',
          animation: 'fadeUp 0.6s ease forwards',
          display: 'grid',
          gridTemplateColumns: isTablet ? '1fr' : '1fr auto',
          gap: isMobile ? '1.5rem' : '3rem',
          alignItems: 'end',
          borderBottom: '1px solid rgba(245,158,11,0.08)',
          marginBottom: '3rem',
        }}>
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '28px', height: '2px', background: '#f59e0b' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: '#f59e0b', letterSpacing: '2px' }}>
                GLOBAL TRADE CLASSIFICATION INTELLIGENCE
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: isMobile ? 'clamp(2.4rem, 14vw, 3.8rem)' : 'clamp(3.5rem, 8vw, 7rem)',
              lineHeight: 0.95,
              letterSpacing: '2px',
              color: '#f8fafc',
              marginBottom: '1.5rem',
            }}>
              HARMONIZED<br />
              <span style={{ color: '#f59e0b' }}>SYSTEM</span><br />
              INSIGHTS
            </h1>

            <p style={{
              color: 'var(--theme-muted)',
              fontSize: '1rem',
              lineHeight: 1.75,
              maxWidth: '520px',
              fontFamily: "'Syne', sans-serif",
              fontWeight: 400,
            }}>
              A unified platform for Pakistan's import and export intelligence, structured across
              all <strong style={{ color: '#f59e0b' }}>21 HS sections</strong> and{' '}
              <strong style={{ color: '#f59e0b' }}>97 chapters</strong> of the World Customs
              Organization's Harmonized Commodity Description and Coding System.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', flexWrap: 'wrap' }}>
              {[
                ['21', 'HS Sections'],
                ['97', 'Chapters'],
                ['6-digit', 'Code Depth'],
                ['Import + Export', 'Trade Types'],
              ].map(([val, lbl]) => (
                <div key={lbl} style={{
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: '3px',
                  padding: '0.6rem 1rem',
                  background: 'rgba(245,158,11,0.05)',
                }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: '#f59e0b', letterSpacing: '1px', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--theme-muted)', marginTop: '2px', letterSpacing: '0.5px' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* HS Code visual */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isTablet ? 'flex-start' : 'center',
            gap: '0.4rem',
            opacity: 0.85,
            minWidth: isTablet ? '0' : '220px',
            width: isTablet ? '100%' : 'auto',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'rgba(245,158,11,0.5)', letterSpacing: '1.5px', marginBottom: '0.5rem' }}>HS CODE ANATOMY</div>
            <div style={{ display: 'flex', gap: '4px', fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? '2rem' : '2.8rem', letterSpacing: isMobile ? '2px' : '4px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '4px', padding: '0 10px', color: '#f59e0b', lineHeight: '3rem' }}>8</div>
              <div style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '4px', padding: '0 10px', color: '#f59e0b', lineHeight: '3rem' }}>4</div>
              <div style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '4px', padding: '0 10px', color: '#38bdf8', lineHeight: '3rem' }}>1</div>
              <div style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '4px', padding: '0 10px', color: '#38bdf8', lineHeight: '3rem' }}>5</div>
              <div style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '4px', padding: '0 10px', color: '#a78bfa', lineHeight: '3rem' }}>1</div>
              <div style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '4px', padding: '0 10px', color: '#a78bfa', lineHeight: '3rem' }}>0</div>
            </div>
            <div style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: isTablet ? 'flex-start' : 'center', marginTop: '4px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ textAlign: 'center', flex: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(245,158,11,0.7)', letterSpacing: '0.5px' }}>CHAPTER</div>
                <div style={{ fontSize: '0.5rem', color: 'var(--theme-accent-muted)' }}>84 = Machinery</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(56,189,248,0.7)', letterSpacing: '0.5px' }}>HEADING</div>
                <div style={{ fontSize: '0.5rem', color: 'rgba(56,189,248,0.4)' }}>15 = Turbojets</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(167,139,250,0.7)', letterSpacing: '0.5px' }}>SUBHEADING</div>
                <div style={{ fontSize: '0.5rem', color: 'rgba(167,139,250,0.4)' }}>10 = Thrust ≤25kN</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Modules Grid ── */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: 'rgba(245,158,11,0.5)', letterSpacing: '2px' }}>/ PLATFORM MODULES</span>
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--theme-muted)' }}>
              SELECT A MODULE TO CONTINUE →
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: moduleGridColumns,
            gap: '1px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.08)',
          }}>
            {MODULES.map((mod, i) => (
              <ModuleCard key={mod.title} mod={mod} index={i} onClick={() => navigate(mod.route)} />
            ))}
          </div>
        </div>

        {/* ── HS Sections Reference ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: 'rgba(245,158,11,0.5)', letterSpacing: '2px' }}>/ HS CLASSIFICATION FRAMEWORK</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(245,158,11,0.1)' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--theme-muted)' }}>21 SECTIONS · 97 CHAPTERS</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '6px',
          }}>
            {HS_SECTIONS.map((sec, i) => (
              <div key={sec.num} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(245,158,11,0.09)',
                borderRadius: '3px',
                padding: '0.75rem',
                animation: `fadeUp 0.4s ${0.02 * i}s ease forwards`,
                opacity: 0,
                transition: 'border-color 0.2s, background 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.09)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: 'rgba(245,158,11,0.6)', fontWeight: 600 }}>SEC {sec.num}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: 'var(--theme-muted)' }}>CH {sec.chapters}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-muted)', lineHeight: 1.4, fontWeight: 400 }}>{sec.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ mod, index, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="hs-module-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        animation: `fadeUp 0.5s ${index * 0.07}s ease forwards`,
        opacity: 0,
        borderRadius: 0,
      }}
    >
      <div className="corner-mark" />

      {/* Tag + Icon row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <span className="hs-section-chip">{mod.tag}</span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '1.6rem',
          color: hovered ? '#f59e0b' : 'var(--theme-accent-muted)',
          lineHeight: 1,
          transition: 'color 0.2s',
        }}>{mod.icon}</span>
      </div>

      <h3 style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: '1.05rem',
        color: hovered ? '#f8fafc' : '#cbd5e1',
        marginBottom: '0.6rem',
        transition: 'color 0.2s',
        letterSpacing: '-0.3px',
      }}>{mod.title}</h3>

      <p style={{
        fontSize: '0.83rem',
        color: 'rgba(148,163,184,0.7)',
        lineHeight: 1.6,
        fontWeight: 400,
        marginBottom: '1.5rem',
        fontFamily: "'Syne', sans-serif",
      }}>{mod.desc}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: hovered ? '#f59e0b' : 'var(--theme-accent-muted)',
          letterSpacing: '0.5px',
          transition: 'color 0.2s',
        }}>
          {hovered ? 'OPEN MODULE →' : 'SELECT TO OPEN'}
        </span>
      </div>

      {/* <div className="hs-chapter-badge">{mod.chapter}</div> */}
    </div>
  );
}