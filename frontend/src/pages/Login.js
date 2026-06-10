import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MdPerson, MdLock, MdVisibility, MdVisibilityOff, MdDashboard, MdCheckCircle } from 'react-icons/md';
import apiService from '../services/apiService';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    // Real-time username validation
    const validateUsername = (value) => {
        if (!value) {
            setUsernameError('');
            return true;
        }
        if (value.length < 3) {
            setUsernameError('Username must be at least 3 characters');
        } else {
            setUsernameError('');
        }
        return value.length >= 3;
    };

    // Real-time password validation
    const validatePassword = (value) => {
        if (!value) {
            setPasswordError('');
            return true;
        }
        if (value.length < 3) {
            setPasswordError('Password must be at least 3 characters');
        } else {
            setPasswordError('');
        }
        return value.length >= 3;
    };

    const handleUsernameChange = (e) => {
        const value = e.target.value;
        setUsername(value);
        validateUsername(value);
        setError('');
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        validatePassword(value);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Final validation
        const usernameValid = validateUsername(username);
        const passwordValid = validatePassword(password);

        if (!usernameValid || !passwordValid) {
            return;
        }

        setLoading(true);

        try {
            const res = await apiService.login(username, password);
            localStorage.setItem('authToken', res.token);
            localStorage.setItem('user', JSON.stringify(res.user));
            setSuccess(true);
            onLogin(res.user);
            setTimeout(() => {
                navigate('/');
            }, 800);
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = username && password && !usernameError && !passwordError && !loading;

    return (
        <div className="login-container">
            <div className="login-wrapper">
                {/* Left side - branding */}
                <div className="login-brand">
                    <div className="brand-content">
                        <div className="brand-icon">
                            <MdDashboard size={60} />
                        </div>
                        <h1>AgriTrade-Insights</h1>
                        <p className="brand-subtitle">Agricultural Trade Intelligence & Data Management</p>

                        <div className="brand-features">
                            <div className="feature-item">
                                <span className="feature-icon">✨</span>
                                <div>
                                    <h4>Fast & Secure</h4>
                                    <p>Lightning-fast processing with enterprise-grade security</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">📊</span>
                                <div>
                                    <h4>Real-time Stats</h4>
                                    <p>Live dashboard with instant data insights</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">🔐</span>
                                <div>
                                    <h4>Protected</h4>
                                    <p>SSL encrypted with role-based access control</p>
                                </div>
                            </div>
                        </div>

                        {/* Success Message */}
                        {success && (
                            <div className="success-message">
                                <MdCheckCircle size={24} />
                                <p>Login successful! Redirecting...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side - login form */}
                <div className="login-form-container">
                    <div className="login-form-wrapper">
                        <div className="form-header">
                            <h2>Welcome Back</h2>
                            <p className="login-subtitle">Sign in to your account to continue</p>
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
                                    {username && !usernameError && <span className="validation-check">✓</span>}
                                </label>
                                <div className={`input-wrapper ${usernameError ? 'error' : username ? 'success' : ''}`}>
                                    <MdPerson className="input-icon" />
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={handleUsernameChange}
                                        disabled={loading}
                                        autoComplete="username"
                                        autoFocus
                                    />
                                </div>
                                {usernameError && <span className="error-message">{usernameError}</span>}
                            </div>

                            {/* Password Input */}
                            <div className="form-group">
                                <label className="form-label">
                                    Password
                                    {password && !passwordError && <span className="validation-check">✓</span>}
                                </label>
                                <div className={`input-wrapper ${passwordError ? 'error' : password ? 'success' : ''}`}>
                                    <MdLock className="input-icon" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-control"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={handlePasswordChange}
                                        disabled={loading}
                                        autoComplete="current-password"
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

                            {/* Remember Me & Forgot Password */}
                            <div className="login-options">
                                <label className="remember-me">
                                    <input type="checkbox" disabled={loading} />
                                    <span>Remember me</span>
                                </label>
                                {/* <a href="#forgot" className="forgot-password">Forgot password?</a> */}
                            </div>

                            {/* Login Button */}
                            <button
                                type="submit"
                                className={`btn btn-primary login-btn ${isFormValid ? 'active' : ''}`}
                                disabled={!isFormValid}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-mini"></span>
                                        Signing in...
                                    </>
                                ) : success ? (
                                    <>
                                        <MdCheckCircle size={18} />
                                        Success!
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        {/* Footer Links */}
                        <div className="login-footer">
                            <p>
                                New here?{' '}
                                <Link to="/signup" className="signup-link">Create an account</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
