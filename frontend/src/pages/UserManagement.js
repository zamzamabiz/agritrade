import React, { useState, useEffect } from 'react';
import {
  MdPersonAdd, MdEdit, MdDelete, MdVpnKey, MdRefresh,
  MdCheckCircle, MdError, MdClose, MdSearch, MdSecurity,
  MdEmail, MdPerson
} from 'react-icons/md';
import apiService from '../services/apiService';
import './UserManagement.css';

// ─── Component ───────────────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'user', full_name: '' });
  const [passData, setPassData] = useState({ newPassword: '', confirmPassword: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiService.getUsers();
      setUsers(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); } }, [message]);

  const handleFormSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMessage(null);
    try {
      if (editingUser) { await apiService.updateUser(editingUser.id, formData); setMessage({ type: 'success', text: 'User details updated successfully' }); }
      else { await apiService.createUser(formData); setMessage({ type: 'success', text: 'New user created successfully' }); }
      setShowForm(false); setEditingUser(null); fetchUsers();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  const handlePassSubmit = async (e) => {
    e.preventDefault();
    if (passData.newPassword !== passData.confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    setLoading(true);
    try {
      await apiService.adminChangePassword({ userId: passwordUser.id, newPassword: passData.newPassword });
      setMessage({ type: 'success', text: `Credentials updated for ${passwordUser.username}` });
      setShowPassModal(false); setPassData({ newPassword: '', confirmPassword: '' });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Remove user "${user.username}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await apiService.deleteUser(user.id);
      setMessage({ type: 'success', text: `User ${user.username} removed from system` });
      fetchUsers();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ username: '', email: '', password: '', role: 'user', full_name: '' });
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({ username: user.username, email: user.email || '', role: user.role, full_name: user.full_name || '' });
    setShowForm(true);
  };

  const openPass = (user) => {
    setPasswordUser(user);
    setPassData({ newPassword: '', confirmPassword: '' });
    setShowPassModal(true);
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role !== 'admin').length;

  return (
    <div className="um-root">
      {/* Header */}
      <div className="um-header">
        <div>
          <div className="um-header-label">ADMIN / ACCESS CONTROL</div>
          <h1>USER CENTER</h1>
          <p>Administrate system accounts, manage roles, and monitor access levels</p>
        </div>
        <button className="um-btn-create" onClick={openCreate}>
          <MdPersonAdd size={16} /> REGISTER USER
        </button>
      </div>

      {/* Alert */}
      {message && (
        <div className={`um-alert um-alert-${message.type}`}>
          {message.type === 'success' ? <MdCheckCircle size={16} /> : <MdError size={16} />}
          {message.text}
        </div>
      )}

      {/* Summary chips */}
      <div className="um-summary">
        <span className="um-chip">TOTAL: {users.length}</span>
        <span className="um-chip">ADMINS: {adminCount}</span>
        <span className="um-chip">USERS: {userCount}</span>
        {filtered.length !== users.length && <span className="um-chip um-chip-filtered">FILTERED: {filtered.length}</span>}
      </div>

      {/* Controls */}
      <div className="um-controls">
        <div className="um-search">
          <MdSearch size={16} className="um-search-icon" />
          <input
            type="text"
            placeholder="SEARCH BY USERNAME, EMAIL OR NAME..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="um-refresh-btn" onClick={fetchUsers} disabled={loading} title="Refresh">
          <MdRefresh size={18} className={loading ? 'um-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="um-table-panel">
        <div className="um-table-head-row">
          {['SYS ID', 'USER PROFILE', 'EMAIL', 'ACCESS ROLE', 'MANAGEMENT'].map(h => (
            <div key={h} className="um-th">{h}</div>
          ))}
        </div>
        <div className="um-table-body">
          {loading && users.length === 0 ? (
            <div className="um-loader">
              <div className="um-spinner-wrap">
                <div className="um-spinner" />
                <span>FETCHING SYSTEM ACCOUNTS...</span>
              </div>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((user, i) => (
              <div key={user.id} className="um-row" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="um-td um-id-cell">
                  #{String(user.id).padStart(4, '0')}
                </div>
                <div className="um-td">
                  <div className="um-user-cell">
                    <div className="um-avatar">{user.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="um-username">{user.username}</div>
                      <div className="um-fullname">{user.full_name || '—'}</div>
                    </div>
                  </div>
                </div>
                <div className="um-td um-email-cell">
                  {user.email || '—'}
                </div>
                <div className="um-td">
                  <span className={`um-role-badge ${user.role === 'admin' ? 'um-role-admin' : 'um-role-user'}`}>
                    {user.role?.toUpperCase()}
                  </span>
                </div>
                <div className="um-td">
                  <div className="um-actions">
                    <button className="um-icon-btn" title="Edit user" onClick={() => openEdit(user)}><MdEdit size={15} /></button>
                    <button className="um-icon-btn" title="Reset password" onClick={() => openPass(user)}><MdVpnKey size={15} /></button>
                    <button className="um-icon-btn delete" title="Delete user" onClick={() => handleDelete(user)}><MdDelete size={15} /></button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="um-empty">NO MATCHING USERS FOUND IN REGISTRY</div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="um-overlay">
          <div className="um-modal">
            <div className="um-modal-header">
              <div>
                <div className="um-modal-code">{editingUser ? 'USR.EDIT' : 'USR.CREATE'}</div>
                <div className="um-modal-title">{editingUser ? 'UPDATE PROFILE' : 'REGISTER USER'}</div>
              </div>
              <button className="um-modal-close" onClick={() => setShowForm(false)}><MdClose size={16} /></button>
            </div>
            <div className="um-modal-body">
              <div className="um-modal-sub">
                {editingUser
                  ? <>Modifying account information for <strong>@{editingUser.username}</strong>. Username cannot be changed.</>
                  : 'Enter credentials below to create a new system account with designated access roles.'}
              </div>
              <form onSubmit={handleFormSubmit}>
                <div className="um-form-row">
                  <div className="um-form-group">
                    <div className="um-form-label"><MdPerson size={12} />SYSTEM USERNAME</div>
                    <input className="um-form-input" type="text" required placeholder="e.g. johndoe"
                      value={formData.username} disabled={!!editingUser}
                      onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div className="um-form-group">
                    <div className="um-form-label"><MdEmail size={12} />CONTACT EMAIL</div>
                    <input className="um-form-input" type="email" required placeholder="user@tradeintel.pk"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="um-form-row">
                  <div className="um-form-group">
                    <div className="um-form-label"><MdPerson size={12} />FULL NAME</div>
                    <input className="um-form-input" type="text" placeholder="Full legal name"
                      value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div className="um-form-group">
                    <div className="um-form-label"><MdSecurity size={12} />ACCESS ROLE</div>
                    <select className="um-form-select" value={formData.role}
                      onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                      <option value="user">Standard User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
                {!editingUser && (
                  <div className="um-form-group">
                    <div className="um-form-label"><MdVpnKey size={12} />PASSWORD</div>
                    <input className="um-form-input" type="password" required placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
                  </div>
                )}
                <div className="um-modal-actions">
                  <button type="button" className="um-btn um-btn-ghost" onClick={() => setShowForm(false)}>DISCARD</button>
                  <button type="submit" className="um-btn um-btn-primary" disabled={loading}>
                    {loading ? <><div className="um-spinner-sm" /> PROCESSING...</> : editingUser ? 'SAVE CHANGES' : 'CREATE ACCOUNT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Modal ── */}
      {showPassModal && (
        <div className="um-overlay">
          <div className="um-modal um-modal-sm">
            <div className="um-modal-header">
              <div>
                <div className="um-modal-code">SEC.RESET</div>
                <div className="um-modal-title">RESET PASSWORD</div>
              </div>
              <button className="um-modal-close" onClick={() => setShowPassModal(false)}><MdClose size={16} /></button>
            </div>
            <div className="um-modal-body">
              <div className="um-modal-sub">
                Configuring new access credentials for <strong>@{passwordUser?.username}</strong>.
              </div>
              <form onSubmit={handlePassSubmit}>
                <div className="um-form-group">
                  <div className="um-form-label"><MdVpnKey size={12} />NEW PASSWORD</div>
                  <input className="um-form-input" type="password" required placeholder="Enter new password"
                    value={passData.newPassword}
                    onChange={e => setPassData(p => ({ ...p, newPassword: e.target.value }))} />
                </div>
                <div className="um-form-group">
                  <div className="um-form-label"><MdVpnKey size={12} />CONFIRM PASSWORD</div>
                  <input className="um-form-input" type="password" required placeholder="Verify new password"
                    value={passData.confirmPassword}
                    onChange={e => setPassData(p => ({ ...p, confirmPassword: e.target.value }))} />
                </div>
                {passData.confirmPassword && passData.newPassword !== passData.confirmPassword && (
                  <div className="um-pass-mismatch">
                    ⚠ Passwords do not match
                  </div>
                )}
                <div className="um-modal-actions">
                  <button type="button" className="um-btn um-btn-ghost" onClick={() => setShowPassModal(false)}>CANCEL</button>
                  <button type="submit" className="um-btn um-btn-primary" disabled={loading}>
                    {loading ? <><div className="um-spinner-sm" /> UPDATING...</> : 'SET PASSWORD'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;