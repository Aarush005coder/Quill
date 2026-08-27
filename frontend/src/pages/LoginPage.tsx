import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../App';

const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

axios.defaults.baseURL = API_BASE;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

function getCookie(name: string): string | null {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [mode, setMode] = useState<'login' | 'otp-verify' | 'forgot-password' | 'forgot-otp-verify' | 'reset-password'>('login');
  
  // Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // Forgot Password States (Both Username and Email required)
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveTokens = (accessToken: string, refreshToken?: string | null) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken && refreshToken.trim()) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  useEffect(() => {
    const accessToken = searchParams.get('access_token') || searchParams.get('token');
    const refreshToken = searchParams.get('refresh_token');
    const userStr = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      toast.error(decodeURIComponent(error.replace(/\+/g, ' ')));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!accessToken) return;

    try {
      let user: any = null;
      if (userStr) {
        try { user = JSON.parse(decodeURIComponent(userStr)); } catch { user = null; }
      }
      if (!user) {
        try {
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            user = {
              id: Number(payload.user_id) || 0,
              email: payload.email || '',
              first_name: payload.first_name || 'User',
              last_name: payload.last_name || '',
              name: payload.first_name || 'User',
            };
          }
        } catch { user = null; }
      }
      if (!user) user = { id: 0, email: '', first_name: 'User', name: 'User' };

      saveTokens(accessToken, refreshToken);
      login(accessToken, user);
      toast.success('Welcome to Quill! 🎉');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('OAuth login failed. Please try again.');
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    if (mode === 'otp-verify' || mode === 'forgot-otp-verify') {
      setCountdown(60);
      setCanResend(false);
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address format');
      return;
    }
    const lowerEmail = email.trim().toLowerCase();
    const domain = lowerEmail.split('@')[1];
    const commonTypos: Record<string, string> = {
      'gmai.com': 'gmail.com', 'gmil.com': 'gmail.com', 'gmal.com': 'gmail.com',
      'gmail.co': 'gmail.com', 'yahoo.co': 'yahoo.com', 'hotmai.com': 'hotmail.com', 'outlok.com': 'outlook.com',
    };
    if (commonTypos[domain]) {
      const correctEmail = `${lowerEmail.split('@')[0]}@${commonTypos[domain]}`;
      toast.error(`Did you mean ${correctEmail}?`, { duration: 4000 });
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      const res = await axios.post('/auth/login/', { email: email.trim(), password, remember_me: rememberMe }, { headers });

      if (res.data?.requires_otp) {
        setMode('otp-verify');
        setOtp('');
        toast.success(res.data.message || 'OTP sent to your email');
        return;
      }

      const accessToken = res.data?.data?.access || res.data?.access || null;
      const refreshToken = res.data?.data?.refresh || res.data?.refresh || null;
      const user = res.data?.data?.user || res.data?.user || { id: 0, email: email.trim(), name: email.trim().split('@')[0] };

      if (accessToken) {
        saveTokens(accessToken, refreshToken);
        login(accessToken, user);
        toast.success('Welcome back! 👋');
        navigate('/dashboard', { replace: true });
        return;
      }
      toast.error(res.data?.message || 'Login successful but access token was not received');
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.requires_otp) {
        setMode('otp-verify');
        setOtp('');
        toast.success(err.response.data.message || 'OTP sent to your email');
        return;
      }
      const data = err?.response?.data;
      let message = 'Login failed. Please check your credentials.';
      if (data?.message) message = String(data.message);
      else if (data?.detail) message = String(data.detail);
      else if (data?.non_field_errors) message = Array.isArray(data.non_field_errors) ? String(data.non_field_errors[0]) : String(data.non_field_errors);
      else if (data?.errors) {
        const errorKeys = Object.keys(data.errors);
        if (errorKeys.length > 0) message = Array.isArray(data.errors[errorKeys[0]]) ? data.errors[errorKeys[0]][0] : String(data.errors[errorKeys[0]]);
      } else if (typeof data === 'string') message = data;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FORGOT PASSWORD: STEP 1 (Send OTP)
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim() || !forgotEmail.trim()) {
      toast.error('Please enter both Username and Email');
      return;
    }
    
    setLoading(true);
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      await axios.post(
        '/auth/forgot-password/', 
        {
          username: forgotUsername.trim(),
          email: forgotEmail.trim()
        }, 
        { headers }
      );
      
      toast.success(`OTP sent to your registered email!`);
      setMode('forgot-otp-verify');
      setOtp('');
      setCountdown(60);
      setCanResend(false);
      
    } catch (err: any) {
      const data = err?.response?.data;
      let message = 'Failed to send OTP. Please check your details.';
      
      // ✅ FIX: Backend se exact error message extract karna
      if (data?.message) {
        message = String(data.message);
      } else if (data?.errors) {
        const errorKeys = Object.keys(data.errors);
        if (errorKeys.length > 0) {
          const firstKey = errorKeys[0];
          const firstError = data.errors[firstKey];
          message = Array.isArray(firstError) ? String(firstError[0]) : String(firstError);
        }
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FORGOT PASSWORD: STEP 2 (Verify OTP)
  const handleForgotOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      await axios.post(
        '/auth/forgot-password/verify/', 
        {
          username: forgotUsername.trim(),
          email: forgotEmail.trim(),
          otp_code: otp
        }, 
        { headers }
      );
      
      toast.success('OTP Verified! Now set your new password.');
      setMode('reset-password');
      // ❌ HATA DIYA: setOtp(''); (Kyunki Step 3 mein iski zaroorat hai)
      
    } catch (err: any) {
      const data = err?.response?.data;
      let message = 'Invalid or expired OTP';
      if (data?.message) message = String(data.message);
      else if (data?.detail) message = String(data.detail);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };


  // ✅ FORGOT PASSWORD: STEP 3 (Reset Password)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      await axios.post(
        '/auth/forgot-password/reset/', 
        {
          username: forgotUsername.trim(),
          email: forgotEmail.trim(),
          otp_code: otp, // ✅ Ab yeh khali nahi hoga!
          new_password: newPassword
        }, 
        { headers }
      );
      
      toast.success('Password reset successfully! Please login with your new password.');
      
      // ✅ Success ke baad sab kuch clear karein
      setMode('login');
      setForgotUsername('');
      setForgotEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp(''); // ✅ Ab yahan clear karein
      
    } catch (err: any) {
      const data = err?.response?.data;
      let message = 'Failed to reset password';
      if (data?.message) message = String(data.message);
      else if (data?.detail) message = String(data.detail);
      else if (data?.errors) {
        const errorKeys = Object.keys(data.errors);
        if (errorKeys.length > 0) {
          const firstKey = errorKeys[0];
          const firstError = data.errors[firstKey];
          message = Array.isArray(firstError) ? String(firstError[0]) : String(firstError);
        }
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      const res = await axios.post('/auth/otp/verify/', { email: email.trim(), otp_code: otp, purpose: 'login' }, { headers });

      const accessToken = res.data?.data?.access || res.data?.access || null;
      const refreshToken = res.data?.data?.refresh || res.data?.refresh || null;
      const user = res.data?.data?.user || res.data?.user || { id: 0, email: email.trim(), name: email.trim().split('@')[0] };

      if (accessToken) {
        saveTokens(accessToken, refreshToken);
        login(accessToken, user);
        toast.success('Login successful! 🎉');
        navigate('/dashboard', { replace: true });
        return;
      }
      toast.success('OTP verified! Please login.');
      setOtp('');
      setMode('login');
    } catch (err: any) {
      const data = err?.response?.data;
      let message = 'Invalid or expired OTP';
      if (data?.message) message = String(data.message);
      else if (data?.detail) message = String(data.detail);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;

      let payload: any = {};
      if (mode === 'forgot-otp-verify') {
        payload = { username: forgotUsername.trim(), email: forgotEmail.trim(), purpose: 'forgot_password' };
      } else {
        payload = { email: email.trim(), purpose: 'login' };
      }

      await axios.post('/auth/otp/send/', payload, { headers });
      toast.success('OTP resent! Check your email.');
      setCanResend(false);
      setCountdown(60);
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const getOAuthUrl = (provider: 'google' | 'github') => {
    return `${API_BASE}/auth/${provider}/?redirect_uri=${encodeURIComponent(`${window.location.origin}/login`)}`;
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    window.location.href = getOAuthUrl(provider);
  };

  const EmailIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );

  const UserIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const LockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );

  const EyeIcon = ({ off = false }: { off?: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 4.1" />
          <path d="M6.2 6.2C3.5 8.2 2.5 12 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 3-.5" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5.04c1.86 0 3.52.64 4.83 1.9l3.62-3.62C17.95 1.18 15.24 0 12 0 7.27 0 3.18 2.69 1.23 6.61l4.18 3.24C6.22 6.74 8.86 5.04 12 5.04z" />
      <path fill="#4285F4" d="M23.5 12.23c0-.86-.08-1.68-.22-2.47H12v4.68h6.45c-.28 1.48-1.11 2.73-2.36 3.57l3.82 2.96c2.23-2.06 3.59-5.09 3.59-8.74z" />
      <path fill="#FBBC05" d="M5.41 9.15L1.23 5.91C.44 7.48 0 9.25 0 11.13s.44 3.65 1.23 5.22l4.18-3.24C5.16 12.38 5.02 11.59 5.02 10.76s.14-1.62.39-2.36z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.82-2.96c-1.07.72-2.44 1.14-4.12 1.14-3.14 0-5.78-1.7-7.12-4.22L1.7 17.29C3.65 21.31 7.74 24 12 24z" />
    </svg>
  );

  const GithubIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.167 6.839 9.49.5.092.682-.217.682-.483 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.455-1.157-1.11-1.466-1.11-1.466-.908-.621.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.35-1.087.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.58 9.58 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .268.18.58.688.482A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" clipRule="evenodd" />
    </svg>
  );

  const TranslationBubble = ({ countryCode, text, className, delay }: { countryCode: string; text: string; className: string; delay: string }) => (
    <div className={`absolute ${className}`} style={{ animationDelay: delay }}>
      <div className="translation-bubble">
        <span className="flag-circle">
          <img src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`} alt={`${countryCode} flag`} className="country-flag" />
        </span>
        <span className="bubble-text">{text}</span>
      </div>
    </div>
  );

  return (
    <>
      <div className="login-page">
        <div className="background-effects">
          <div className="background-blue" />
          <div className="background-purple" />
          <div className="background-pink" />
        </div>

        <div className="auth-card">
          <section className="visual-panel">
            <div className="world-map"><div className="world-map-image" /></div>
            <div className="world-map-dots" />
            <div className="connection-line line-one" />
            <div className="connection-line line-two" />
            <div className="connection-line line-three" />
            <div className="connection-line line-four" />
            <div className="connection-line line-five" />
            <span className="connection-dot dot-one" />
            <span className="connection-dot dot-two" />
            <span className="connection-dot dot-three" />
            <span className="connection-dot dot-four" />
            <span className="connection-dot dot-five" />
            <span className="connection-dot dot-six" />

            <div className="visual-content">
              <p className="brand-small">QUILL</p>
              <h2>Where words and<br /><span>documents come together.</span></h2>
              <p className="visual-subtitle">Translate. Create. Organize.</p>
            </div>

            <TranslationBubble countryCode="US" text="Hello, how are you?" className="bubble-one floating-slow" delay="0s" />
            <TranslationBubble countryCode="ES" text="Hola, ¿cómo estás?" className="bubble-two floating-medium" delay="1s" />
            <TranslationBubble countryCode="FR" text="Bonjour, comment allez-vous?" className="bubble-three floating-slow" delay="0.5s" />
            <TranslationBubble countryCode="CN" text="你好，你好吗？" className="bubble-four floating-medium" delay="1.5s" />
            <TranslationBubble countryCode="SA" text="مرحبا، كيف حالك؟" className="bubble-five floating-slow" delay="0.8s" />
            <TranslationBubble countryCode="JP" text="こんにちは、お元気ですか？" className="bubble-six floating-slow" delay="1.2s" />
            <TranslationBubble countryCode="DE" text="Hallo, wie geht es dir?" className="bubble-seven floating-medium" delay="1.8s" />
            <TranslationBubble countryCode="IN" text="नमस्ते, आप कैसे हैं?" className="bubble-eight floating-slow" delay="0.6s" />

            <div className="left-glow" />
            <div className="map-overlay" />
          </section>

          <section className="login-panel">
            <div className="login-content">
              
              {/* ================= MODE: LOGIN ================= */}
              {mode === 'login' && (
                <>
                  <div className="welcome-header">
                    <img src="/quill_logo.png" alt="Quill logo" className="welcome-logo" />
                    <div className="welcome-text">
                      <h1>Welcome back</h1>
                      <p>Sign in to continue your journey</p>
                    </div>
                  </div>

                  <div className="social-buttons">
                    <button type="button" onClick={() => handleOAuth('google')} disabled={oauthLoading !== null || loading} className="social-button">
                      {oauthLoading === 'google' ? <span className="social-spinner google-spinner" /> : <GoogleIcon />}
                      <span>{oauthLoading === 'google' ? 'Connecting...' : 'Google'}</span>
                    </button>
                    <button type="button" onClick={() => handleOAuth('github')} disabled={oauthLoading !== null || loading} className="social-button">
                      {oauthLoading === 'github' ? <span className="social-spinner github-spinner" /> : <GithubIcon />}
                      <span>{oauthLoading === 'github' ? 'Connecting...' : 'GitHub'}</span>
                    </button>
                  </div>

                  <div className="divider"><span /><p>or</p><span /></div>

                  <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                      <label htmlFor="email">Email address</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><EmailIcon /></span>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="password-label-row text-xs">
                        <label htmlFor="password">Password</label>
                        <button type="button" onClick={() => setMode('forgot-password')} className="forgot-link" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'right' }}>
                          Forgot password?
                        </button>
                      </div>
                      <div className="input-wrapper">
                        <span className="input-icon"><LockIcon /></span>
                        <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" autoComplete="current-password" required />
                        <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          <EyeIcon off={!showPassword} />
                        </button>
                      </div>
                    </div>

                    <div className="form-options">
                      <label className="remember-label">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                        <span className="custom-check" />
                        <span>Remember me</span>
                      </label>
                    </div>

                    <button type="submit" disabled={loading || oauthLoading !== null} className="login-button">
                      {loading ? <span className="loading-content"><span className="white-spinner" />Signing in...</span> : 'Sign in'}
                    </button>
                  </form>

                  <p className="signup-text">Don't have an account? <button type="button" onClick={() => navigate('/register')} className="forgot-link" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>Create account</button></p>
                </>
              )}

              {/* ================= MODE: FORGOT PASSWORD (Step 1: BOTH Username & Email) ================= */}
              {mode === 'forgot-password' && (
                <>
                  <div className="welcome-header" style={{ flexDirection: 'column', textAlign: 'center', alignItems: 'center' }}>
                    <img src="/quill_logo.png" alt="Quill logo" className="welcome-logo" style={{ marginBottom: '8px' }} />
                    <div className="welcome-text" style={{ textAlign: 'center' }}>
                      <h1>Forgot Password?</h1>
                      <p>Enter your Username and registered Email to reset</p>
                    </div>
                  </div>

                  <form onSubmit={handleForgotPasswordRequest} className="login-form" style={{ marginTop: '20px' }}>
                    <div className="form-group">
                      <label htmlFor="forgot-username">Username</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><UserIcon /></span>
                        <input 
                          id="forgot-username" 
                          type="text" 
                          value={forgotUsername} 
                          onChange={(e) => setForgotUsername(e.target.value)} 
                          placeholder="Enter your username" 
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="forgot-email">Email Address</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><EmailIcon /></span>
                        <input 
                          id="forgot-email" 
                          type="email" 
                          value={forgotEmail} 
                          onChange={(e) => setForgotEmail(e.target.value)} 
                          placeholder="Enter your registered email" 
                          required 
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="login-button" style={{ marginTop: '10px' }}>
                      {loading ? <span className="loading-content"><span className="white-spinner" />Sending OTP...</span> : 'Send OTP'}
                    </button>

                    <div className="otp-actions" style={{ marginTop: '16px' }}>
                      <button type="button" className="back-login" onClick={() => { setMode('login'); setForgotUsername(''); setForgotEmail(''); }}>← Back to login</button>
                    </div>
                  </form>
                </>
              )}

              {/* ================= MODE: FORGOT OTP VERIFY (Step 2) ================= */}
              {mode === 'forgot-otp-verify' && (
                <>
                  <div className="otp-header">
                    <img src="/quill_logo.png" alt="Quill logo" className="otp-logo" />
                    <h1>Verify it's you</h1>
                    <p>We sent a 6-digit code to your registered email</p>
                  </div>

                  <div className="otp-countdown">
                    <span className="countdown-icon">⏱️</span>
                    <span className={countdown === 0 ? 'expired' : ''}>
                      {countdown > 0 ? `OTP expires in ${countdown}s` : 'OTP expired — request new one'}
                    </span>
                  </div>

                  <form onSubmit={handleForgotOtpVerify} className="otp-form">
                    <div className="form-group">
                      <label htmlFor="forgot-otp">Verification code</label>
                      <input 
                        id="forgot-otp" 
                        type="text" 
                        inputMode="numeric" 
                        autoComplete="one-time-code" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                        className="otp-input" 
                        placeholder="000000" 
                        maxLength={6} 
                        required 
                        autoFocus 
                      />
                    </div>

                    <button type="submit" disabled={loading || otp.length !== 6 || countdown === 0} className="login-button">
                      {loading ? <span className="loading-content"><span className="white-spinner" />Verifying...</span> : 'Verify OTP'}
                    </button>

                    <div className="otp-actions">
                      <button type="button" className={`back-login ${!canResend ? 'disabled' : ''}`} onClick={handleResendOtp} disabled={!canResend}>
                        {canResend ? 'Resend OTP' : `Resend in ${countdown}s`}
                      </button>
                      <span className="action-sep">|</span>
                      <button type="button" className="back-login" onClick={() => { setMode('forgot-password'); setOtp(''); }}>← Back</button>
                    </div>
                  </form>
                </>
              )}

              {/* ================= MODE: RESET PASSWORD (Step 3) ================= */}
              {mode === 'reset-password' && (
                <>
                  <div className="welcome-header" style={{ flexDirection: 'column', textAlign: 'center', alignItems: 'center' }}>
                    <img src="/quill_logo.png" alt="Quill logo" className="welcome-logo" style={{ marginBottom: '8px' }} />
                    <div className="welcome-text" style={{ textAlign: 'center' }}>
                      <h1>Create New Password</h1>
                      <p>Your new password must be different from previous ones</p>
                    </div>
                  </div>

                  <form onSubmit={handleResetPassword} className="login-form" style={{ marginTop: '20px' }}>
                    <div className="form-group">
                      <label htmlFor="newPassword">New Password</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><LockIcon /></span>
                        <input 
                          id="newPassword" 
                          type={showNewPassword ? 'text' : 'password'} 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          placeholder="Min. 8 characters" 
                          required 
                        />
                        <button type="button" className="password-toggle" onClick={() => setShowNewPassword(!showNewPassword)} aria-label="Toggle password visibility">
                          <EyeIcon off={!showNewPassword} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirmPassword">Confirm Password</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><LockIcon /></span>
                        <input 
                          id="confirmPassword" 
                          type={showConfirmPassword ? 'text' : 'password'} 
                          value={confirmPassword} 
                          onChange={(e) => setConfirmPassword(e.target.value)} 
                          placeholder="Re-enter new password" 
                          required 
                        />
                        <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label="Toggle password visibility">
                          <EyeIcon off={!showConfirmPassword} />
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="login-button" style={{ marginTop: '10px' }}>
                      {loading ? <span className="loading-content"><span className="white-spinner" />Resetting...</span> : 'Reset Password'}
                    </button>

                    <div className="otp-actions" style={{ marginTop: '16px' }}>
                      <button type="button" className="back-login" onClick={() => { setMode('login'); setForgotUsername(''); setForgotEmail(''); setNewPassword(''); setConfirmPassword(''); setOtp(''); }}>← Back to login</button>
                    </div>
                  </form>
                </>
              )}

              {/* ================= MODE: LOGIN OTP VERIFY ================= */}
              {mode === 'otp-verify' && (
                <>
                  <div className="otp-header">
                    <img src="/quill_logo.png" alt="Quill logo" className="otp-logo" />
                    <h1>Verify your email</h1>
                    <p>We sent a 6-digit code to<br /><strong>{email}</strong></p>
                  </div>

                  <div className="otp-countdown">
                    <span className="countdown-icon">⏱️</span>
                    <span className={countdown === 0 ? 'expired' : ''}>
                      {countdown > 0 ? `OTP expires in ${countdown}s` : 'OTP expired — request new one'}
                    </span>
                  </div>

                  <form onSubmit={handleOtpVerify} className="otp-form">
                    <div className="form-group">
                      <label htmlFor="otp">Verification code</label>
                      <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} className="otp-input" placeholder="000000" maxLength={6} required autoFocus />
                    </div>

                    <button type="submit" disabled={loading || otp.length !== 6 || countdown === 0} className="login-button">
                      {loading ? <span className="loading-content"><span className="white-spinner" />Verifying...</span> : 'Verify & Login'}
                    </button>

                    <div className="otp-actions">
                      <button type="button" className={`back-login ${!canResend ? 'disabled' : ''}`} onClick={handleResendOtp} disabled={!canResend}>
                        {canResend ? 'Resend OTP' : `Resend in ${countdown}s`}
                      </button>
                      <span className="action-sep">|</span>
                      <button type="button" className="back-login" onClick={() => { setMode('login'); setOtp(''); }}>← Back to login</button>
                    </div>
                  </form>
                </>
              )}

              <p className="terms-text">By continuing, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span></p>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }
        #root { scrollbar-width: none; -ms-overflow-style: none; }
        #root::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .login-page { min-height: 100vh; width: 100%; padding: 24px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: #f7f8ff; scrollbar-width: none; -ms-overflow-style: none; }
        .login-page::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .background-effects { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
        .background-blue { position: absolute; width: 600px; height: 600px; top: -300px; left: -250px; border-radius: 50%; background: rgba(191,219,254,0.45); filter: blur(120px); }
        .background-purple { position: absolute; width: 600px; height: 600px; right: -300px; bottom: -300px; border-radius: 50%; background: rgba(221,214,254,0.5); filter: blur(120px); }
        .background-pink { position: absolute; width: 450px; height: 450px; left: 40%; bottom: -300px; border-radius: 50%; background: rgba(251,207,232,0.25); filter: blur(120px); }
        .auth-card { position: relative; z-index: 2; width: min(1400px, calc(100vw - 48px)); height: min(800px, calc(100vh - 48px)); min-height: 580px; display: grid; grid-template-columns: 60% 40%; overflow: hidden; border-radius: 24px; border: 1px solid rgba(255,255,255,0.9); background: rgba(255,255,255,0.82); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); box-shadow: 0 30px 100px rgba(55,65,120,0.14); }
        .visual-panel { position: relative; overflow: hidden; background: linear-gradient(135deg, #eef3ff 0%, #f8f7ff 48%, #fff4f8 100%); }
        .world-map { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1; overflow: hidden; }
        .world-map-image { position: absolute; width: 120%; height: 65%; top: 22%; left: -10%; opacity: 0.105; background-image: url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg"); background-repeat: no-repeat; background-position: center; background-size: contain; filter: grayscale(1) contrast(0.75); transform: scale(1.15); }
        .map-overlay { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: radial-gradient(ellipse at center, rgba(255,255,255,0) 25%, rgba(255,255,255,0.25) 75%, rgba(255,255,255,0.45) 100%); }
        .world-map-dots { position: absolute; width: 90%; height: 48%; top: 29%; left: 5%; opacity: 0.42; background-image: radial-gradient(circle, rgba(99,102,241,0.17) 1.2px, transparent 1.2px); background-size: 9px 9px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 72%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 72%); transform: scaleX(1.3); z-index: 2; }
        .visual-content { position: relative; z-index: 10; padding: clamp(36px, 6vh, 72px) clamp(30px, 4vw, 60px); }
        .brand-small { margin: 0 0 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #6366f1; }
        .visual-content h2 { margin: 0; font-size: clamp(32px, 3.5vw, 52px); line-height: 1.05; letter-spacing: -0.045em; font-weight: 750; color: #17203a; }
        .visual-content h2 span { background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .visual-subtitle { margin-top: 16px; font-size: clamp(14px, 1.2vw, 17px); line-height: 1.5; color: #64748b; }
        .translation-bubble { display: flex; align-items: center; gap: 8px; padding: 7px 12px 7px 8px; border: 1px solid rgba(255,255,255,0.9); border-radius: 999px; background: rgba(255,255,255,0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 35px rgba(80,90,140,0.09); white-space: nowrap; }
        .flag-circle { width: 27px; height: 27px; min-width: 27px; min-height: 27px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; background: #ffffff; border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 2px 7px rgba(15,23,42,0.12); flex-shrink: 0; }
        .country-flag { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 50%; }
        .bubble-text { font-size: 12px; font-weight: 500; color: #334155; }
        .bubble-one { top: 16%; left: 7%; }
        .bubble-two { top: 20%; right: 8%; }
        .bubble-three { top: 38%; right: 4%; }
        .bubble-four { top: 52%; left: 7%; }
        .bubble-five { top: 55%; right: 18%; }
        .bubble-six { bottom: 27%; left: 12%; }
        .bubble-seven { bottom: 20%; right: 8%; }
        .bubble-eight { bottom: 10%; left: 32%; }
        .floating-slow { animation: floatingSlow 6s ease-in-out infinite; }
        .floating-medium { animation: floatingMedium 5s ease-in-out infinite; }
        @keyframes floatingSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes floatingMedium { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(9px); } }
        .connection-line { position: absolute; border-color: rgba(129,140,248,0.23); z-index: 4; }
        .line-one { top: 24%; left: 20%; width: 210px; height: 110px; border-top: 1px solid; border-right: 1px solid; border-radius: 0 100px 0 0; transform: rotate(15deg); }
        .line-two { top: 40%; left: 38%; width: 190px; height: 140px; border-top: 1px solid; border-left: 1px solid; border-radius: 100px 0 0 0; transform: rotate(-20deg); }
        .line-three { top: 56%; left: 22%; width: 260px; height: 140px; border-bottom: 1px solid; border-right: 1px solid; border-radius: 0 0 100px 0; transform: rotate(-10deg); }
        .line-four { top: 67%; left: 47%; width: 170px; height: 100px; border-top: 1px solid; border-radius: 100px 100px 0 0; transform: rotate(25deg); }
        .line-five { top: 31%; left: 53%; width: 130px; height: 90px; border-bottom: 1px solid; border-left: 1px solid; border-radius: 0 0 0 80px; transform: rotate(-15deg); }
        .connection-dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 0 5px rgba(139,92,246,0.08), 0 0 18px rgba(139,92,246,0.25); animation: pulseDot 3s ease-in-out infinite; z-index: 5; }
        .dot-one { top: 25%; left: 39%; }
        .dot-two { top: 40%; left: 59%; }
        .dot-three { top: 57%; left: 29%; }
        .dot-four { top: 68%; left: 48%; }
        .dot-five { top: 78%; left: 61%; }
        .dot-six { top: 34%; left: 72%; }
        @keyframes pulseDot { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }
        .left-glow { position: absolute; width: 500px; height: 250px; bottom: -150px; left: 20%; border-radius: 50%; background: rgba(251,207,232,0.35); filter: blur(90px); z-index: 2; }
        .login-panel { position: relative; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.88); overflow: hidden; }
        .login-content { width: 100%; max-width: 480px; padding: 28px 36px; }
        .welcome-header { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 18px; text-align: left; }
        .welcome-logo { width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }
        .welcome-text h1 { margin: 0; font-size: clamp(22px, 2vw, 28px); line-height: 1.1; font-weight: 750; letter-spacing: -0.04em; color: #17203a; }
        .welcome-text p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: #64748b; }
        .otp-header { text-align: center; margin-bottom: 14px; }
        .otp-logo { width: 48px; height: 48px; object-fit: contain; margin: 0 auto 10px; }
        .otp-header h1 { margin: 0; font-size: 24px; font-weight: 750; color: #17203a; }
        .otp-header p { margin-top: 6px; color: #64748b; font-size: 12px; line-height: 1.5; }
        .otp-header strong { color: #334155; }
        .otp-countdown { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 14px; padding: 8px 14px; border-radius: 8px; background: rgba(99,102,241,0.06); color: #6366f1; font-size: 12px; font-weight: 600; }
        .otp-countdown .expired { color: #ef4444; }
        .countdown-icon { font-size: 14px; }
        .social-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .social-button { width: 100%; height: 40px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; color: #1e293b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .social-button:hover { border-color: #cbd5e1; box-shadow: 0 6px 18px rgba(30,41,59,0.06); transform: translateY(-1px); }
        .social-button:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
        .divider { display: flex; align-items: center; gap: 10px; margin: 10px 0 16px; }
        .divider span { height: 1px; flex: 1; background: #e2e8f0; }
        .divider p { margin: 0; color: #94a3b8; font-size: 11px; }
        .login-form { display: flex; flex-direction: column; gap: 10px; }
        .form-group { width: 100%; }
        .form-group label { display: block; margin-bottom: 5px; color: #334155; font-size: 12px; font-weight: 500; }
        .password-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
        .password-label-row label { margin-bottom: 0; }
        .forgot-link { color: #6366f1; font-size: 11px; font-weight: 600; text-decoration: none; transition: color 0.2s ease; }
        .forgot-link:hover { color: #4f46e5; text-decoration: underline; }
        .input-wrapper { position: relative; width: 100%; }
        .input-wrapper input { width: 100%; height: 44px; display: block; padding: 0 40px; border: 1px solid #dbe3ef; border-radius: 10px; background: #ffffff; color: #17203a; font-size: 13px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .input-wrapper input::placeholder { color: #94a3b8; opacity: 1; font-size: 12px; }
        .input-wrapper input:hover { border-color: #cbd5e1; }
        .input-wrapper input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .input-icon { position: absolute; left: 12px; top: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; transform: translateY(-50%); color: #94a3b8; pointer-events: none; z-index: 2; }
        .password-toggle { position: absolute; right: 10px; top: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; transform: translateY(-50%); border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0; z-index: 3; }
        .password-toggle:hover { color: #64748b; }
        .form-options { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 0; }
        .remember-label { display: flex; align-items: center; gap: 7px; color: #475569; font-size: 11px; cursor: pointer; user-select: none; }
        .remember-label input { position: absolute; opacity: 0; pointer-events: none; }
        .custom-check { width: 15px; height: 15px; flex-shrink: 0; border: 1.5px solid #cbd5e1; border-radius: 4px; background: white; position: relative; transition: all 0.2s ease; }
        .remember-label input:checked + .custom-check { background: #6366f1; border-color: #6366f1; }
        .remember-label input:checked + .custom-check::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .login-button { width: 100%; height: 44px; border: none; border-radius: 10px; background: linear-gradient(100deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%); color: white; font-size: 13px; font-weight: 650; cursor: pointer; box-shadow: 0 8px 20px rgba(99,102,241,0.2); transition: all 0.2s ease; margin-top: 3px; }
        .login-button:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(99,102,241,0.26); }
        .login-button:active { transform: translateY(0); }
        .login-button:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .signup-text { margin: 14px 0 0; text-align: center; color: #64748b; font-size: 12px; }
        .signup-text a, .signup-text button { color: #6366f1; font-weight: 600; text-decoration: none; }
        .signup-text a:hover, .signup-text button:hover { color: #4f46e5; }
        .terms-text { margin: 14px 0 0; text-align: center; color: #94a3b8; font-size: 9px; line-height: 1.5; }
        .terms-text span { color: #64748b; }
        .otp-form { display: flex; flex-direction: column; gap: 14px; }
        .otp-input { width: 100%; height: 50px; border: 1px solid #dbe3ef; border-radius: 12px; text-align: center; font-size: 20px; font-family: monospace; font-weight: 600; letter-spacing: 0.5em; color: #17203a; outline: none; }
        .otp-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .otp-actions { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 4px; }
        .otp-actions .action-sep { color: #cbd5e1; font-size: 12px; }
        .back-login { border: none; background: transparent; color: #64748b; cursor: pointer; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 6px; transition: all 0.2s ease; }
        .back-login:hover { color: #334155; background: rgba(100,116,139,0.06); }
        .back-login.disabled { color: #94a3b8; cursor: not-allowed; background: transparent; }
        .loading-content { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .white-spinner, .social-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; animation: spin 0.8s linear infinite; }
        .social-spinner { border-color: #e2e8f0; }
        .google-spinner { border-top-color: #4285f4; }
        .github-spinner { border-top-color: #111827; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1200px) { .login-page { padding: 20px; } .auth-card { width: calc(100vw - 40px); height: calc(100vh - 40px); grid-template-columns: 60% 40%; } .login-content { padding: 24px 28px; } .visual-content { padding: 48px 32px; } .visual-content h2 { font-size: 36px; } .translation-bubble { padding: 6px 10px 6px 7px; } .bubble-text { font-size: 11px; } .flag-circle { width: 25px; height: 25px; min-width: 25px; min-height: 25px; } .social-buttons { grid-template-columns: 1fr; } .world-map-image { width: 130%; } }
        @media (max-width: 900px) { html, body, #root { height: auto; min-height: 100%; } .login-page { min-height: 100vh; height: auto; padding: 16px; overflow-y: auto; } .auth-card { width: calc(100vw - 32px); height: auto; min-height: calc(100vh - 32px); grid-template-columns: 1fr; overflow: hidden; } .visual-panel { min-height: 200px; } .visual-content { padding: 36px; } .visual-content h2 { font-size: 32px; } .bubble-five, .bubble-six, .bubble-seven, .bubble-eight { display: none; } .login-panel { min-height: auto; overflow: visible; } .login-content { max-width: 520px; padding: 28px; } .world-map-image { width: 120%; height: 90%; top: 5%; } }
        @media (max-width: 640px) { .login-page { padding: 0; align-items: stretch; min-height: 100vh; } .auth-card { width: 100%; min-height: 100vh; height: auto; border-radius: 0; border: none; box-shadow: none; grid-template-columns: 1fr; } .visual-panel { min-height: 160px; max-height: 180px; } .visual-content { padding: 24px 20px; } .brand-small { margin-bottom: 8px; font-size: 10px; } .visual-content h2 { font-size: 26px; } .visual-subtitle { margin-top: 8px; font-size: 12px; } .world-map-dots { top: 18%; height: 75%; } .world-map-image { width: 135%; height: 110%; top: -5%; left: -17%; opacity: 0.09; } .bubble-one { top: 12%; left: auto; right: 6%; } .bubble-two, .bubble-three, .bubble-four, .bubble-five, .bubble-six, .bubble-seven, .bubble-eight { display: none; } .bubble-text { font-size: 10px; } .translation-bubble { padding: 5px 8px 5px 6px; } .flag-circle { width: 23px; height: 23px; min-width: 23px; min-height: 23px; } .login-panel { min-height: auto; overflow: visible; align-items: flex-start; } .login-content { width: 100%; max-width: none; padding: 24px 20px 28px; } .welcome-header { justify-content: flex-start; gap: 10px; margin-bottom: 18px; } .welcome-logo { width: 40px; height: 40px; } .welcome-text h1 { font-size: 22px; } .welcome-text p { font-size: 11px; margin-top: 3px; } .social-buttons { grid-template-columns: 1fr 1fr; gap: 8px; } .social-button { height: 38px; font-size: 12px; } .divider { margin: 14px 0; } .form-group label { font-size: 12px; } .input-wrapper input { height: 42px; font-size: 13px; padding-left: 40px; padding-right: 40px; } .form-options { align-items: flex-start; margin-top: 0; } .remember-label { font-size: 11px; } .login-button { height: 42px; font-size: 13px; } .signup-text { font-size: 12px; margin-top: 14px; } .terms-text { margin-top: 14px; } .otp-logo { width: 44px; height: 44px; } .otp-header h1 { font-size: 22px; } .otp-input { height: 48px; font-size: 18px; } .otp-countdown { font-size: 11px; padding: 6px 10px; } }
        @media (max-width: 380px) { .visual-panel { min-height: 150px; } .visual-content { padding: 20px 16px; } .visual-content h2 { font-size: 23px; } .login-content { padding: 20px 16px 24px; } .welcome-logo { width: 36px; height: 36px; } .welcome-text h1 { font-size: 20px; } .welcome-text p { font-size: 10px; } .world-map-image { width: 150%; } .flag-circle { width: 22px; height: 22px; min-width: 22px; min-height: 22px; } .forgot-link { font-size: 10px; } }
        @media (min-width: 901px) { html, body, #root { height: 100%; overflow: hidden; } .login-page { height: 100vh; min-height: 0; overflow: hidden; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </>
  );
};

export default LoginPage;