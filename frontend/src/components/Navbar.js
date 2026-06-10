import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MdDashboard, MdCloudUpload, MdDataUsage, MdLogout,
  MdMenu, MdClose, MdMergeType, MdPeople, MdAssessment,
  MdPerson, MdLightMode, MdDarkMode, MdRefresh
} from 'react-icons/md';
import './Navbar.css';

// ─── Nav link config ─────────────────────────────────────────────────────────
const NAV_LINKS = [
  { to: '/dashboard',    label: 'DASHBOARD',   icon: <MdDashboard size={13} />,  admin: false },
  { to: '/trade-data',   label: 'TRADE DATA',  icon: <MdDataUsage size={13} />,  admin: false },
  { to: '/reports',      label: 'REPORTS',     icon: <MdAssessment size={13} />, admin: false },
  { to: '/upload',       label: 'UPLOAD',      icon: <MdCloudUpload size={13} />,admin: false },
  { to: '/admin/deduplication', label: 'DEDUP', icon: <MdMergeType size={13} />, admin: true },
  { to: '/admin/users',  label: 'USERS',       icon: <MdPeople size={13} />,     admin: true },
  { to: '/profile',      label: 'PROFILE',     icon: <MdPerson size={13} />,     admin: false },
];

// ─── Component ───────────────────────────────────────────────────────────────
const Navbar = ({ onLogout, userRole, theme, toggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path.split('?')[0]);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
    setMenuOpen(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <nav className="hs-navbar">
      <div className="hs-nav-inner">

        {/* Logo */}
        <Link to="/" className="hs-nav-logo">
          <div className="hs-nav-logo-mark">HS</div>
          <div className="hs-nav-logo-text">
            <span className="hs-nav-logo-primary">TRADEINTEL</span>
            <span className="hs-nav-logo-sub">HS CLASSIFICATION PLATFORM</span>
          </div>
        </Link>

        <div className="hs-nav-sep" />

        {/* Links */}
        <div className={`hs-nav-links ${menuOpen ? 'open' : ''}`}>
          {NAV_LINKS.map(link => {
            if (link.admin && userRole !== 'admin') return null;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`hs-nav-link ${isActive(link.to) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.icon}
                {link.label}
                {link.admin && <span className="hs-admin-dot" />}
              </Link>
            );
          })}

          {/* Mobile actions */}
          <div className="hs-nav-right hs-nav-right-mobile">
            <button className="hs-theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
              {theme === 'dark' ? <MdLightMode size={14} /> : <MdDarkMode size={14} />}
              <span className="hs-btn-text">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
            </button>

            <button className="hs-nav-refresh" onClick={handleRefresh} type="button" aria-label="Refresh page">
              <MdRefresh size={13} />
              <span className="hs-btn-text">REFRESH</span>
            </button>

            <button className="hs-nav-logout" onClick={handleLogout}>
              <MdLogout size={12} />
              <span className="hs-btn-text">LOGOUT</span>
            </button>
          </div>
        </div>

        {/* Right section (desktop) */}
        <div className="hs-nav-right hs-nav-right-desktop">
          <button className="hs-theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            {theme === 'dark' ? <MdLightMode size={14} /> : <MdDarkMode size={14} />}
            <span className="hs-btn-text">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
          </button>

          <button className="hs-nav-refresh" onClick={handleRefresh} type="button" aria-label="Refresh page">
            <MdRefresh size={13} />
            <span className="hs-btn-text">REFRESH</span>
          </button>

          <span className={`hs-role-badge ${userRole === 'admin' ? 'admin' : 'user'}`}>
            {userRole === 'admin' ? 'ADMIN' : 'USER'}
          </span>

          <button className="hs-nav-logout" onClick={handleLogout}>
            <MdLogout size={12} />
            <span className="hs-btn-text">LOGOUT</span>
          </button>
        </div>

        {/* Hamburger */}
        <button className="hs-hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <MdClose size={20} /> : <MdMenu size={20} />}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;