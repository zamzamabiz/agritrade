import React, { useState } from 'react';
import apiService from '../services/apiService';
import { useNavigate, Link } from 'react-router-dom';
import { MdPerson, MdLock, MdEmail, MdBadge, MdVisibility, MdVisibilityOff, MdDashboard, MdCheckCircle, MdAdminPanelSettings } from 'react-icons/md';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'TahirKhan11';

const Signup = () => {
    const [form, setForm] = useState({ username: '', password: '', email: '', full_name: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [adminAuth, setAdminAuth] = useState(false);
    const [adminInput, setAdminInput] = useState({ username: '', password: '' });
    const [adminError, setAdminError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [emailError, setEmailError] = useState('');
    const navigate = useNavigate();

    // Real-time validation
    const validateUsername = (value) => {
        if (!value) {
            setUsernameError('');
            return true;
        }
        if (value.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return false;
        }
        setUsernameError('');
        return true;
    };

    const validateEmail = (value) => {
        if (!value) {
            setEmailError('');
            return true;
        }
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!isValid) {
            setEmailError('Please enter a valid email address');
            return false;
        }
        setEmailError('');
        return true;
    };

    const validatePassword = (value) => {
        if (!value) {
            setPasswordError('');
            return true;
        }
        if (value.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError('');
        
        // Real-time validation
        if (name === 'username') validateUsername(value);
        if (name === 'email') validateEmail(value);
        if (name === 'password') validatePassword(value);
    };

    const handleAdminInput = (e) => {
        setAdminInput({ ...adminInput, [e.target.name]: e.target.value });
        setAdminError('');
    };

    const handleAdminLogin = (e) => {
        e.preventDefault();
        if (
            adminInput.username === ADMIN_USERNAME &&
            adminInput.password === ADMIN_PASSWORD
        ) {
            setAdminAuth(true);
            setAdminError('');
        } else {
            setAdminError('Invalid admin credentials');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Final validation
        const usernameValid = validateUsername(form.username);
        const emailValid = validateEmail(form.email);
        const passwordValid = validatePassword(form.password);

        if (!usernameValid || !emailValid || !passwordValid) {
            setLoading(false);
            return;
        }

        try {
            await apiService.register(form.username, form.password, form.email, form.full_name);
            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const isFormValid = form.username && form.email && form.password && !usernameError && !emailError && !passwordError && !loading;

    // Admin Login View
    if (!adminAuth) {
        return (
            <div className="login-container">
                <div className="login-wrapper">
                    <div className="login-brand">
                        <div className="brand-content">
                            <div className="brand-icon">
                                <MdAdminPanelSettings size={60} />
                            </div>
                            <h1>Admin Access Required</h1>
                            <p className="brand-subtitle">Only authorized administrators can create new accounts</p>
                            
                            <div className="brand-features">
                                <div className="feature-item">
                                    <span className="feature-icon">🔐</span>
                                    <div>
                                        <h4>Secure Access</h4>
                                        <p>Protected registration with admin verification</p>
                                    </div>
                                </div>
                                <div className="feature-item">
                                    <span className="feature-icon">👥</span>
                                    <div>
                                        <h4>User Management</h4>
                                        <p>Controlled user account creation</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="login-form-container">
                        <div className="login-form-wrapper">
                            <div className="form-header">
                                <h2>Admin Verification</h2>
                                <p className="login-subtitle">Enter admin credentials to continue</p>
                            </div>

                            {adminError && (
                                <div className="alert alert-error">
                                    <span className="alert-icon">⚠️</span>
                                    <span className="alert-text">{adminError}</span>
                                </div>
                            )}

                            <form onSubmit={handleAdminLogin} className="login-form">
                                <div className="form-group">
                                    <label className="form-label">Admin Username</label>
                                    <div className="input-wrapper">
                                        <MdPerson className="input-icon" />
                                        <input
                                            type="text"
                                            name="username"
                                            className="form-control"
                                            placeholder="Enter admin username"
                                            value={adminInput.username}
                                            onChange={handleAdminInput}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Admin Password</label>
                                    <div className="input-wrapper">
                                        <MdLock className="input-icon" />
                                        <input
                                            type={showAdminPassword ? 'text' : 'password'}
                                            name="password"
                                            className="form-control"
                                            placeholder="Enter admin password"
                                            value={adminInput.password}
                                            onChange={handleAdminInput}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                                            title={showAdminPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showAdminPassword ? <MdVisibilityOff /> : <MdVisibility />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary login-btn active"
                                    style={{ marginTop: '8px' }}
                                >
                                    <MdAdminPanelSettings size={18} />
                                    Verify Admin Access
                                </button>
                            </form>

                            <div className="login-footer">
                                <p>
                                    <Link to="/login" className="signup-link">Back to Login</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Signup Form View
    return (
        <div className="login-container">
            <div className="login-wrapper">
                <div className="login-brand">
                    <div className="brand-content">
                        <div className="brand-icon">
                            <MdDashboard size={60} />
                        </div>
                        <h1>Create Account</h1>
                        <p className="brand-subtitle">Join AgriTrade-Insights Platform</p>
                        
                        <div className="brand-features">
                            <div className="feature-item">
                                <span className="feature-icon">⚡</span>
                                <div>
                                    <h4>Quick Setup</h4>
                                    <p>Get started in less than a minute</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">🔒</span>
                                <div>
                                    <h4>Secure Platform</h4>
                                    <p>Your data is encrypted and protected</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">📊</span>
                                <div>
                                    <h4>Full Access</h4>
                                    <p>Access all features and analytics tools</p>
                                </div>
                            </div>
                        </div>

                        {success && (
                            <div className="success-message">
                                <MdCheckCircle size={24} />
                                <p>{success}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="login-form-container">
                    <div className="login-form-wrapper">
                        <div className="form-header">
                            <h2>Sign Up</h2>
                            <p className="login-subtitle">Create your account to get started</p>
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                <span className="alert-icon">⚠️</span>
                                <span className="alert-text">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="login-form">
                            {/* Username Input */}
                            <div className="form-group">
                                <label className="form-label">
                                    Username
                                    {form.username && !usernameError && <span className="validation-check">✓</span>}
                                </label>
                                <div className={`input-wrapper ${usernameError ? 'error' : form.username ? 'success' : ''}`}>
                                    <MdPerson className="input-icon" />
                                    <input
                                        type="text"
                                        name="username"
                                        className="form-control"
                                        placeholder="Choose a username"
                                        value={form.username}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                        autoFocus
                                    />
                                </div>
                                {usernameError && <span className="error-message">{usernameError}</span>}
                            </div>

                            {/* Email Input */}
                            <div className="form-group">
                                <label className="form-label">
                                    Email Address
                                    {form.email && !emailError && <span className="validation-check">✓</span>}
                                </label>
                                <div className={`input-wrapper ${emailError ? 'error' : form.email ? 'success' : ''}`}>
                                    <MdEmail className="input-icon" />
                                    <input
                                        type="email"
                                        name="email"
                                        className="form-control"
                                        placeholder="you@example.com"
                                        value={form.email}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                {emailError && <span className="error-message">{emailError}</span>}
                            </div>

                            {/* Full Name Input */}
                            <div className="form-group">
                                <label className="form-label">Full Name (Optional)</label>
                                <div className="input-wrapper">
                                    <MdBadge className="input-icon" />
                                    <input
                                        type="text"
                                        name="full_name"
                                        className="form-control"
                                        placeholder="Your full name"
                                        value={form.full_name}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="form-group">
                                <label className="form-label">
                                    Password
                                    {form.password && !passwordError && <span className="validation-check">✓</span>}
                                </label>
                                <div className={`input-wrapper ${passwordError ? 'error' : form.password ? 'success' : ''}`}>
                                    <MdLock className="input-icon" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        className="form-control"
                                        placeholder="Create a strong password"
                                        value={form.password}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={loading}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                                    </button>
                                </div>
                                {passwordError && <span className="error-message">{passwordError}</span>}
                            </div>

                            {/* Sign Up Button */}
                            <button
                                type="submit"
                                className={`btn btn-primary login-btn ${isFormValid ? 'active' : ''}`}
                                disabled={!isFormValid}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-mini"></span>
                                        Creating account...
                                    </>
                                ) : success ? (
                                    <>
                                        <MdCheckCircle size={18} />
                                        Success!
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>

                        <div className="login-footer">
                            <p>
                                Already have an account?{' '}
                                <Link to="/login" className="signup-link">Sign In</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
