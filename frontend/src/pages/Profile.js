import React, { useEffect, useState } from 'react';
import {
  MdPerson, MdEmail, MdBadge, MdLock, MdSave,
  MdCheckCircle, MdVisibility, MdVisibilityOff,
  MdEdit, MdBusiness, MdLocationOn, MdPhone,
  MdLanguage, MdClose
} from 'react-icons/md';
import apiService from '../services/apiService';
import './Profile.css';

const ALL_COLUMNS = [
  // 'id',
  // 'company_id',
  'trade_type',
  // 'chapter_id',
  'hs_code',
  'item_name',
  'item_description',
  'ntn',
  // 'origin_country_id',
  'origin_country',
  'port_of_shipment',
  'importer_name',
  'uom',
  // 'agent_name',
  // 'agent_number',
  // 'terminal_sheds',
  'exporter_name',
  'period_date',
  'quantity',
  'value_usd',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Field = ({ label, icon, children, error, check }) => (
  <div className="pf-form-group">
    <div className="pf-label">
      {icon} {label}
      {check && <span className="pf-label-check">✓ VALID</span>}
    </div>
    {children}
    {error && <div className="pf-error-msg">{error}</div>}
  </div>
);

const InputWrap = ({ disabled, error, children }) => (
  <div className={`pf-input-wrap ${disabled ? 'disabled' : ''} ${error ? 'error' : ''}`}>
    {children}
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [editData, setEditData] = useState({ email: '', full_name: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [pwVal, setPwVal] = useState({ length: false, match: false });

  useEffect(() => { fetchProfile(); }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(t); } }, [message]);
  useEffect(() => { if (passwordMessage) { const t = setTimeout(() => setPasswordMessage(''), 5000); return () => clearTimeout(t); } }, [passwordMessage]);

  const fetchProfile = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiService.getProfile();
      setProfile(res.user); setCompany(res.company);
      setEditData({ email: res.user.email || '', full_name: res.user.full_name || '' });
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const validateEmail = (val) => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(ok || !val ? '' : 'Invalid email address');
    return ok;
  };

  const validatePasswords = (data = passwords) => {
    const v = { length: data.newPassword.length >= 6, match: data.newPassword === data.confirmPassword && data.confirmPassword !== '' };
    setPwVal(v); return v.length && v.match;
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setEditData(p => ({ ...p, [name]: value }));
    if (name === 'email') validateEmail(value);
    setMessage(''); setError('');
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!validateEmail(editData.email)) return;
    setProfileLoading(true); setMessage(''); setError('');
    try {
      const res = await apiService.updateProfile(editData.email, editData.full_name);
      setProfile(res.user); setMessage('Profile updated successfully'); setIsEditing(false);
    } catch (err) { setError(err.message); }
    setProfileLoading(false);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...passwords, [name]: value };
    setPasswords(updated); setPasswordMessage(''); setPasswordError('');
    if (name === 'newPassword' || name === 'confirmPassword') validatePasswords(updated);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!validatePasswords()) { setPasswordError('Check password requirements'); return; }
    setPasswordLoading(true); setPasswordMessage(''); setPasswordError('');
    try {
      await apiService.changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswordMessage('Password updated successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwVal({ length: false, match: false });
    } catch (err) { setPasswordError(err.message); }
    setPasswordLoading(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ email: profile.email || '', full_name: profile.full_name || '' });
    setEmailError(''); setError('');
  };

  // Column preferences state
  const [columnPrefs, setColumnPrefs] = useState(ALL_COLUMNS);
  const [columnPrefsLoading, setColumnPrefsLoading] = useState(false);
  const [columnPrefsMessage, setColumnPrefsMessage] = useState('');

  // Fetch column preferences on mount
  useEffect(() => {
    const fetchColumnPrefs = async () => {
      try {
        const res = await apiService.getColumnPreferences();
        let cols = res?.columns;
        if (typeof cols === 'string') {
          try {
            cols = JSON.parse(cols);
          } catch (e) {
            cols = [];
          }
        }
        if (Array.isArray(cols)) setColumnPrefs(cols);
        else if (Array.isArray(res)) setColumnPrefs(res);
      } catch (e) { /* fallback to default */ }
    };
    fetchColumnPrefs();
  }, []);

  const handleColumnPrefChange = (col) => {
    setColumnPrefs((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
    setColumnPrefsMessage('');
  };

  const handleSaveColumnPrefs = async () => {
    setColumnPrefsLoading(true);
    setColumnPrefsMessage('');
    try {
      await apiService.saveColumnPreferences(columnPrefs);
      setColumnPrefsMessage('Column preferences saved!');
    } catch (e) {
      setColumnPrefsMessage('Failed to save preferences.');
    }
    setColumnPrefsLoading(false);
  };
  // //////////////////////////////////////////////////

  // Initials for avatar
  const initials = (profile?.full_name || profile?.username || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (loading && !profile) {
    return (
      <div className="pf-root">
        <div className="pf-loading">
          <div className="pf-spinner" />
          <p>LOADING PROFILE DATA...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pf-root">
        <div className="pf-alert pf-alert-error">⚠ {error}</div>
      </div>
    );
  }

  return (
    <div className="pf-root">
      {/* Header */}
      <div className="pf-header">
        <div className="pf-header-label">ACCOUNT MANAGEMENT</div>
        <h1>PROFILE SETTINGS</h1>
        <p>Manage your identity, credentials, and company association</p>
      </div>

      <div className="pf-grid">
        {/* ── Left column ── */}
        <div>
          {/* Profile Info */}
          <div className="pf-panel">
            <div className="pf-panel-head">
              <div className="pf-panel-head-left">
                <div>
                  <div className="pf-panel-code">ACCT.01</div>
                  <div className="pf-panel-title">Identity</div>
                </div>
              </div>
              {!isEditing && (
                <button className="pf-btn-icon" onClick={() => setIsEditing(true)}>
                  <MdEdit size={13} /> EDIT
                </button>
              )}
            </div>
            <div className="pf-panel-body">
              {/* Avatar row */}
              <div className="pf-avatar-row">
                <div className="pf-avatar">{initials}</div>
                <div className="pf-avatar-info">
                  <div className="pf-avatar-name">{profile?.full_name || profile?.username || 'User'}</div>
                  <div className="pf-avatar-username">@{profile?.username}</div>
                </div>
              </div>

              {message && <div className="pf-alert pf-alert-success"><MdCheckCircle size={16} />{message}</div>}
              {error && <div className="pf-alert pf-alert-error">⚠ {error}</div>}

              <form onSubmit={handleProfileUpdate}>
                <Field label="USERNAME" icon={<MdPerson size={12} />}>
                  <InputWrap disabled>
                    <div className="pf-input-icon"><MdPerson size={15} /></div>
                    <input className="pf-input" value={profile?.username || ''} disabled />
                  </InputWrap>
                </Field>

                <Field
                  label="EMAIL ADDRESS" icon={<MdEmail size={12} />}
                  error={emailError}
                  check={editData.email && !emailError}
                >
                  <InputWrap disabled={!isEditing} error={!!emailError}>
                    <div className="pf-input-icon"><MdEmail size={15} /></div>
                    <input
                      className="pf-input" type="email" name="email"
                      placeholder="your.email@example.com"
                      value={editData.email}
                      onChange={handleProfileChange}
                      disabled={!isEditing || profileLoading}
                    />
                  </InputWrap>
                </Field>

                <Field label="FULL NAME" icon={<MdBadge size={12} />}>
                  <InputWrap disabled={!isEditing}>
                    <div className="pf-input-icon"><MdBadge size={15} /></div>
                    <input
                      className="pf-input" type="text" name="full_name"
                      placeholder="Enter your full name"
                      value={editData.full_name}
                      onChange={handleProfileChange}
                      disabled={!isEditing || profileLoading}
                    />
                  </InputWrap>
                </Field>

                {isEditing && (
                  <div className="pf-form-actions">
                    <button type="button" className="pf-btn pf-btn-ghost" onClick={handleCancelEdit} disabled={profileLoading}>
                      <MdClose size={13} /> CANCEL
                    </button>
                    <button type="submit" className="pf-btn pf-btn-primary"
                      disabled={profileLoading || !!emailError || !editData.email}>
                      {profileLoading ? <><div className="pf-spinner-sm" /> SAVING...</> : <><MdSave size={13} /> SAVE CHANGES</>}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Company */}
          <div className="pf-panel">
            <div className="pf-panel-head">
              <div className="pf-panel-head-left">
                <div>
                  <div className="pf-panel-code">ACCT.02</div>
                  <div className="pf-panel-title">Company Association</div>
                </div>
              </div>
            </div>
            <div className="pf-panel-body">
              <div className="pf-company-grid">
                {[
                  { label: 'COMPANY NAME', icon: <MdBusiness size={12} />, val: company?.name },
                  { label: 'ADDRESS', icon: <MdLocationOn size={12} />, val: company?.address },
                  { label: 'PHONE NUMBER', icon: <MdPhone size={12} />, val: company?.phone },
                  { label: 'COMPANY EMAIL', icon: <MdEmail size={12} />, val: company?.email },
                  { label: 'WEBSITE', icon: <MdLanguage size={12} />, val: company?.website },
                ].map(f => (
                  <Field key={f.label} label={f.label} icon={f.icon}>
                    <InputWrap disabled>
                      <div className="pf-input-icon">{f.icon}</div>
                      <input className="pf-input" value={f.val || 'N/A'} disabled />
                    </InputWrap>
                  </Field>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="pf-side">
          {/* Change password */}
          <div className="pf-panel">
            <div className="pf-panel-head">
              <div className="pf-panel-head-left">
                <div>
                  <div className="pf-panel-code">SEC.01</div>
                  <div className="pf-panel-title">Change Password</div>
                </div>
              </div>
            </div>
            <div className="pf-panel-body">
              {passwordMessage && <div className="pf-alert pf-alert-success"><MdCheckCircle size={16} />{passwordMessage}</div>}
              {passwordError && <div className="pf-alert pf-alert-error">⚠ {passwordError}</div>}

              <form onSubmit={handleChangePassword}>
                <Field label="CURRENT PASSWORD" icon={<MdLock size={12} />}>
                  <InputWrap>
                    <div className="pf-input-icon"><MdLock size={15} /></div>
                    <input className="pf-input" type={showCurrent ? 'text' : 'password'}
                      name="currentPassword" placeholder="Current password"
                      value={passwords.currentPassword} onChange={handlePasswordChange}
                      disabled={passwordLoading} required />
                    <button type="button" className="pf-toggle-btn" onClick={() => setShowCurrent(p => !p)}>
                      {showCurrent ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                  </InputWrap>
                </Field>

                <Field label="NEW PASSWORD" icon={<MdLock size={12} />}
                  check={passwords.newPassword && pwVal.length}>
                  <InputWrap error={passwords.newPassword && !pwVal.length}>
                    <div className="pf-input-icon"><MdLock size={15} /></div>
                    <input className="pf-input" type={showNew ? 'text' : 'password'}
                      name="newPassword" placeholder="Min. 6 characters"
                      value={passwords.newPassword} onChange={handlePasswordChange}
                      disabled={passwordLoading} required />
                    <button type="button" className="pf-toggle-btn" onClick={() => setShowNew(p => !p)}>
                      {showNew ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                  </InputWrap>
                  {passwords.newPassword && (
                    <div className={`pf-pw-req ${pwVal.length ? 'met' : ''}`}>
                      {pwVal.length ? '✓' : '○'} AT LEAST 6 CHARACTERS
                    </div>
                  )}
                </Field>

                <Field label="CONFIRM PASSWORD" icon={<MdLock size={12} />}
                  check={passwords.confirmPassword && pwVal.match}
                  error={passwords.confirmPassword && !pwVal.match ? 'Passwords do not match' : ''}>
                  <InputWrap error={passwords.confirmPassword && !pwVal.match}>
                    <div className="pf-input-icon"><MdLock size={15} /></div>
                    <input className="pf-input" type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword" placeholder="Re-enter new password"
                      value={passwords.confirmPassword} onChange={handlePasswordChange}
                      disabled={passwordLoading} required />
                    <button type="button" className="pf-toggle-btn" onClick={() => setShowConfirm(p => !p)}>
                      {showConfirm ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                  </InputWrap>
                </Field>

                <div className="pf-form-actions">
                  <button type="submit" className="pf-btn pf-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    disabled={passwordLoading || !passwords.currentPassword || !pwVal.length || !pwVal.match}>
                    {passwordLoading
                      ? <><div className="pf-spinner-sm" /> UPDATING...</>
                      : <><MdLock size={13} /> UPDATE PASSWORD</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Account info */}
          <div className="pf-panel">
            <div className="pf-panel-head">
              <div className="pf-panel-head-left">
                <div>
                  <div className="pf-panel-code">ACCT.03</div>
                  <div className="pf-panel-title">Account Status</div>
                </div>
              </div>
            </div>
            <div className="pf-panel-body">
              <div className="pf-stat-row">
                <span className="pf-stat-label">STATUS</span>
                <span className="pf-badge-active">● ACTIVE</span>
              </div>
              <div className="pf-stat-row">
                <span className="pf-stat-label">ROLE</span>
                <span className="pf-stat-val">{(profile?.role || 'USER').toUpperCase()}</span>
              </div>
              <div className="pf-stat-row">
                <span className="pf-stat-label">MEMBER SINCE</span>
                <span className="pf-stat-val">
                  {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
                </span>
              </div>
              <div className="pf-stat-row">
                <span className="pf-stat-label">LAST UPDATED</span>
                <span className="pf-stat-val">
                  {new Date(profile?.updated_at || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '.')}
                </span>
              </div>
            </div>
          </div>

          {/* Column Preferences Panel */}
          <div className="pf-panel">
            <div className="pf-panel-head">
              <div className="pf-panel-head-left">
                <div>
                  <div className="pf-panel-code">VIEW.01</div>
                  <div className="pf-panel-title">Column Preferences</div>
                </div>
              </div>
            </div>
            <div className="pf-panel-body">
              <form onSubmit={e => { e.preventDefault(); handleSaveColumnPrefs(); }}>
                <div style={{ marginBottom: 12 }}>
                  {ALL_COLUMNS.map(col => (
                    <label key={col} style={{ display: 'block', marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={columnPrefs.includes(col)}
                        onChange={() => handleColumnPrefChange(col)}
                        disabled={columnPrefsLoading}
                      />
                      {' '}{(col).replace(/_/g, ' ').toUpperCase()}
                    </label>
                  ))}
                </div>
                <button type="submit" className="pf-btn pf-btn-primary" disabled={columnPrefsLoading}>
                  {columnPrefsLoading ? 'Saving...' : 'Save Column Preferences'}
                </button>
                {columnPrefsMessage && (
                  <div style={{ marginTop: 8, color: columnPrefsMessage.includes('saved') ? 'green' : 'red' }}>
                    {columnPrefsMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;