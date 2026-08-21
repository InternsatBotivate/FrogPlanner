import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, X, Mail, UserPlus, Loader2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { isGoogleAuthConfigured, renderGoogleButton } from '../lib/googleAuthService';
import { sendSignupOtp, verifyOtp, sendPasswordResetOtp, resetPassword } from '../lib/otpService';
import OtpInput from '../components/OtpInput';
import FrogLogo from '../components/FrogLogo';
import botivateLogo from '../Assets/Botivate_logo.png';
import AboutFrogPlanner from './AboutFrogPlanner/AboutFrogPlanner';
import './Login.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'auth-input block w-full pl-10 pr-3';

const Login = () => {
  const [showAbout, setShowAbout] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Sign In state
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sign Up state — just the email. Everything else moved to /onboarding, which
  // also creates the account (see Onboarding.jsx for why it happens there).
  const [signupEmail, setSignupEmail] = useState('');

  // Google sign-in
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleBtnRef = useRef(null);
  const signupGoogleBtnRef = useRef(null);
  const googleReady = isGoogleAuthConfigured();

  // Signup email verification (OTP)
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [showEmailOtp, setShowEmailOtp] = useState(false);
  const [emailOtpId, setEmailOtpId] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState('username'); // 'username' | 'otp' | 'reset'
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotOtpId, setForgotOtpId] = useState(null);
  const [forgotCode, setForgotCode] = useState('');
  const [sendingForgotOtp, setSendingForgotOtp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setShowSignupModal(true);
  }, [searchParams]);

  const resetForgotState = () => {
    setForgotStep('username');
    setForgotUsername('');
    setForgotOtpId(null);
    setForgotCode('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleSendForgotOtp = async (e) => {
    e?.preventDefault?.();
    if (!forgotUsername.trim()) {
      toast.error('Enter your User ID or email.');
      return;
    }
    setSendingForgotOtp(true);
    const res = await sendPasswordResetOtp(forgotUsername.trim());
    setSendingForgotOtp(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('A verification code has been sent to your email on file.');
    setForgotOtpId(res.otpId);
    setForgotStep('otp');
  };

  const handleForgotResend = async () => {
    const res = await sendPasswordResetOtp(forgotUsername.trim());
    if (res.ok) setForgotOtpId(res.otpId);
    return res;
  };

  const handleForgotOtpConfirm = async (code) => {
    const res = await verifyOtp(forgotOtpId, code);
    if (!res.ok) return res;
    setForgotCode(code);
    setForgotStep('reset');
    return { ok: true };
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setResettingPassword(true);
    const res = await resetPassword(forgotOtpId, forgotCode, newPassword);
    setResettingPassword(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Password reset! You can now sign in.');
    setShowForgotModal(false);
    resetForgotState();
  };

  const handleSendEmailOtp = async () => {
    const email = signupEmail.trim();
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setSendingEmailOtp(true);
    const res = await sendSignupOtp(email);
    setSendingEmailOtp(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEmailOtpId(res.otpId);
    setShowEmailOtp(true);
  };

  const handleEmailOtpResend = () => sendSignupOtp(signupEmail.trim()).then((res) => {
    if (res.ok) setEmailOtpId(res.otpId);
    return res;
  });

  const handleEmailOtpConfirm = async (code) => {
    const res = await verifyOtp(emailOtpId, code);
    if (res.ok) {
      setEmailVerified(true);
      setShowEmailOtp(false);
      // Hand the verified address to the wizard, which collects the rest and
      // creates the account on its last step. sessionStorage (not router state)
      // so a mid-wizard refresh doesn't strand them with a consumed OTP.
      sessionStorage.setItem('fp_pending_signup', JSON.stringify({ email: signupEmail.trim() }));
      toast.success('Email verified!');
      navigate('/onboarding', { replace: true });
    }
    return res;
  };

  const closeSignup = () => {
    setShowSignupModal(false);
    setShowEmailOtp(false);
    setEmailOtpId(null);
    setEmailVerified(false);
    setSignupEmail('');
  };

  /**
   * handleGoogleCredential
   * Receives the ID token from Google's button and exchanges it for a session.
   * New/unfinished accounts go to the wizard; everyone else straight to the app.
   */
  const handleGoogleCredential = async (idToken) => {
    setGoogleBusy(true);
    try {
      const { error, needsOnboarding } = await loginWithGoogle(idToken);
      if (error) {
        toast.error(error.message || 'Google sign-in failed.');
        return;
      }
      if (needsOnboarding) {
        navigate('/onboarding', { replace: true });
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  // Google renders its own button into this container. Re-rendering on every
  // mount keeps it from going stale after a failed attempt.
  useEffect(() => {
    if (!googleReady || !googleBtnRef.current) return;
    let cleanup;
    renderGoogleButton(googleBtnRef.current, handleGoogleCredential, { width: 320 })
      .then((fn) => { cleanup = fn; })
      .catch(() => { /* button just won't show; the password form still works */ });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady]);

  // The sign-up modal offers the same official Google Identity button. New
  // Google accounts continue to onboarding; completed accounts sign in.
  useEffect(() => {
    if (!googleReady || !showSignupModal || showEmailOtp || !signupGoogleBtnRef.current) return;
    let cleanup;
    const width = Math.min(signupGoogleBtnRef.current.clientWidth || 368, 368);
    renderGoogleButton(signupGoogleBtnRef.current, handleGoogleCredential, { width })
      .then((fn) => { cleanup = fn; })
      .catch(() => { /* email verification remains available */ });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady, showSignupModal, showEmailOtp]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await login(id.trim(), password);
      if (error) {
        toast.error(error.message || 'Invalid User ID or Password.');
        return;
      }
      toast.success(`Welcome back!`);
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error('Login error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <main className="auth-frame" aria-labelledby="login-heading">
        <section className="auth-story" aria-label="Frog Planner method">
          <div className="auth-story__topline">
            <Link to="/" className="auth-brand-lockup" aria-label="Go to Frog Planner home">
              <span className="auth-brand-mark"><FrogLogo backgroundless /></span>
              <span>
                <strong>Frog Planner</strong>
                <small>Tackle Your Frog First</small>
              </span>
            </Link>
          </div>

          <div className="auth-story__copy">
            <p className="auth-kicker">Focused daily planning</p>
            <h1>Make progress on what matters most.</h1>
            <p className="auth-story__lede">
              Choose one meaningful priority, give it focused time, and build the rest of your day around it.
            </p>
          </div>

            <div className="frog-note" aria-label="Example daily focus card">
            <div className="frog-note__meta"><span>Today&apos;s priority</span><span>45 min</span></div>
            <div className="frog-note__task">
              <span className="frog-note__check" aria-hidden="true" />
              <p>Finish the task you keep moving to tomorrow.</p>
            </div>
          </div>

          <div className="auth-story__footer">
            <a href="https://www.botivate.in/" target="_blank" rel="noopener noreferrer" className="auth-botivate-link" aria-label="Visit Botivate">
              <img src={botivateLogo} alt="" />
              <span>Powered by <strong>Botivate</strong></span>
            </a>
            <nav aria-label="Legal links">
              <Link to="/privacy-policy">Privacy</Link>
              <Link to="/terms-of-service">Terms</Link>
              <Link to="/delete-account">Delete account</Link>
            </nav>
          </div>
        </section>

        <section className="auth-panel">
          <Link to="/" className="auth-mobile-brand" aria-label="Go to Frog Planner home">
            <span className="auth-brand-mark"><FrogLogo backgroundless /></span>
            <div><strong>Frog Planner</strong><small>Tackle Your Frog First</small></div>
          </Link>

          <div className="auth-panel__meta">
            <span>Account access</span>
            <span className="auth-status"><i /> Secure sign in</span>
          </div>

          <header className="auth-panel__header">
            <h2 id="login-heading">Welcome back</h2>
            <p>Sign in to continue to your planner.</p>
          </header>

            {/* Sign In Form */}
            <form className="auth-form" onSubmit={handleSignIn}>
              <div className="auth-field">
                <label htmlFor="login-id">User ID or email</label>
                <div className="auth-input-wrap">
                  <div className="auth-input-icon">
                    <User aria-hidden="true" />
                  </div>
                  <input id="login-id" type="text" required value={id}
                    onChange={(e) => setId(e.target.value)} className={inputCls}
                    placeholder="Your user ID or email" autoComplete="username" />
                </div>
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="login-password">Password</label>
                  <button type="button" onClick={() => { resetForgotState(); setShowForgotModal(true); }}>
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrap">
                  <div className="auth-input-icon">
                    <Lock aria-hidden="true" />
                  </div>
                  <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-10`}
                    placeholder="Your password" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button type="submit" disabled={submitting}
                className="auth-primary-button">
                <span>
                  {submitting
                    ? <><Loader2 className="auth-spinner" /> Checking your plan…</>
                    : <>Sign in <ArrowRight aria-hidden="true" /></>
                  }
                </span>
              </button>

              {/* ── Google ── */}
              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              {googleReady ? (
                <div className="auth-google-wrap">
                  {/* Google's own rendered button — see googleAuthService.js for
                      why we don't hand-roll one. */}
                  <div ref={googleBtnRef} className="auth-google-button" />
                  {googleBusy && (
                    <div className="auth-google-loading">
                      <Loader2 className="auth-spinner" />
                    </div>
                  )}
                </div>
              ) : (
                <p className="auth-google-unavailable">
                  Google sign-in isn&apos;t configured.
                </p>
              )}

              {/* Sign Up Button */}
              <button type="button" onClick={() => setShowSignupModal(true)}
                className="auth-secondary-button">
                <span>New to Frog Planner?</span>
                <strong>Create an account</strong>
              </button>
            </form>

            {/* Footer links */}
            <div className="auth-panel__footer">
              <button type="button" onClick={() => setShowAbout(true)}
                className="auth-about-link">
                <FrogLogo backgroundless /> About Frog Planner
              </button>
              <a href="https://www.botivate.in/" target="_blank" rel="noopener noreferrer" className="auth-mobile-botivate" aria-label="Visit Botivate">
                <img src={botivateLogo} alt="" /> Powered by <strong>Botivate</strong>
              </a>
              <div className="auth-mobile-legal">
                <Link to="/privacy-policy">Privacy</Link><span>·</span><Link to="/terms-of-service">Terms</Link><span>·</span><Link to="/delete-account">Delete account</Link>
              </div>
            </div>
        </section>
      </main>

      {/* ── SIGN UP MODAL (email verification only) ── */}
      {/* Signup collects nothing else here — the OTP-verified address is handed
          to /onboarding, which gathers the rest and creates the account on its
          final step. See src/pages/Onboarding/Onboarding.jsx. */}
      {showSignupModal && (
        <div className="auth-modal-backdrop" role="presentation">
          <section className="auth-modal auth-modal--signup" role="dialog" aria-modal="true" aria-labelledby="signup-title">
            <header className="auth-modal__header">
              <div>
                <span className="auth-modal__step">New account · Step 01</span>
                <h3 id="signup-title"><UserPlus aria-hidden="true" /> Start with your email.</h3>
              </div>
              <button type="button" onClick={closeSignup} className="auth-modal__close" aria-label="Close sign-up">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="auth-modal__body">
              {!showEmailOtp ? (
                <>
                  <p className="auth-modal__intro">
                    We&apos;ll send a six-digit code to confirm it&apos;s yours. Your planning setup comes next.
                  </p>
                  <div className="auth-field">
                    <label htmlFor="signup-email">Email address</label>
                    <div className="auth-input-wrap">
                      <div className="auth-input-icon">
                        <Mail aria-hidden="true" />
                      </div>
                      <input
                        id="signup-email"
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmailOtp(); }}
                        className={inputCls}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={sendingEmailOtp}
                    className="auth-modal__primary"
                  >
                    {sendingEmailOtp
                      ? <><Loader2 className="auth-spinner" /> Sending code…</>
                      : <>Send verification code <ArrowRight aria-hidden="true" /></>}
                  </button>

                  <div className="auth-modal__divider">
                    <span>or continue with</span>
                  </div>

                  {googleReady ? (
                    <div className="auth-modal__google-wrap">
                      <div ref={signupGoogleBtnRef} className="auth-modal__google-button" />
                      {googleBusy && (
                        <div className="auth-google-loading">
                          <Loader2 className="auth-spinner" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="auth-google-unavailable">
                      Google sign-up isn&apos;t configured.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="auth-modal__intro">
                    Enter the six-digit code sent to <strong>{signupEmail.trim()}</strong>.
                  </p>
                  <OtpInput onConfirm={handleEmailOtpConfirm} onResend={handleEmailOtpResend} />
                  <button
                    type="button"
                    onClick={() => { setShowEmailOtp(false); setEmailOtpId(null); }}
                    className="auth-modal__text-button"
                  >
                    Use a different email
                  </button>
                </>
              )}

              <p className="auth-modal__switch">
                Already have an account?{' '}
                <button type="button" onClick={closeSignup}>
                  Sign in
                </button>
              </p>
            </div>
          </section>
        </div>
      )}

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="auth-modal-backdrop" role="presentation">
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <header className="auth-modal__header">
              <div>
                <span className="auth-modal__step">Account recovery · {forgotStep === 'username' ? 'Identify' : forgotStep === 'otp' ? 'Verify' : 'Reset'}</span>
                <h3 id="reset-title">
                  <KeyRound aria-hidden="true" /> Reset your password.
                </h3>
                <p className="auth-modal__subtitle">
                  {forgotStep === 'username' && 'Enter your User ID or email to receive a code'}
                  {forgotStep === 'otp' && 'Enter the code sent to your email on file'}
                  {forgotStep === 'reset' && 'Choose a new password'}
                </p>
              </div>
              <button type="button" onClick={() => { setShowForgotModal(false); resetForgotState(); }}
                className="auth-modal__close" aria-label="Close password reset">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="auth-modal__body">
              {forgotStep === 'username' && (
                <form onSubmit={handleSendForgotOtp} className="auth-modal__form">
                  <div className="auth-field">
                    <label htmlFor="forgot-id">User ID or email</label>
                    <div className="auth-input-wrap">
                      <div className="auth-input-icon">
                        <User aria-hidden="true" />
                      </div>
                      <input id="forgot-id" type="text" required value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        className={inputCls} placeholder="Enter your user ID or email" />
                    </div>
                  </div>
                  <button type="submit" disabled={sendingForgotOtp}
                    className="auth-modal__primary">
                    {sendingForgotOtp ? <Loader2 className="auth-spinner" /> : null}
                    {sendingForgotOtp ? 'Sending…' : 'Send Code'}
                  </button>
                </form>
              )}

              {forgotStep === 'otp' && (
                <OtpInput onConfirm={handleForgotOtpConfirm} onResend={handleForgotResend} confirmLabel="Confirm" />
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleResetPassword} className="auth-modal__form">
                  <div className="auth-field">
                    <label htmlFor="new-password">New password</label>
                    <div className="auth-input-wrap">
                      <div className="auth-input-icon">
                        <Lock aria-hidden="true" />
                      </div>
                      <input id="new-password" type="password" required value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputCls} placeholder="At least 6 characters" />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="confirm-password">Confirm password</label>
                    <div className="auth-input-wrap">
                      <div className="auth-input-icon">
                        <Lock aria-hidden="true" />
                      </div>
                      <input id="confirm-password" type="password" required value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className={`${inputCls} ${confirmNewPassword && newPassword !== confirmNewPassword ? 'border-rose-300 focus:border-rose-400' : ''}`}
                        placeholder="Repeat password" />
                    </div>
                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                      <p className="auth-modal__error">Passwords don&apos;t match</p>
                    )}
                  </div>
                  <button type="submit" disabled={resettingPassword}
                    className="auth-modal__primary">
                    {resettingPassword ? <Loader2 className="auth-spinner" /> : null}
                    {resettingPassword ? 'Resetting…' : 'Reset Password'}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] rounded-xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden border border-green-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-green-100 flex items-center justify-between bg-green-50/40">
              <span className="text-sm font-bold text-green-800 flex items-center gap-1.5"><FrogLogo backgroundless className="w-4 h-4 object-contain" /> About Frog Planner</span>
              <button type="button" onClick={() => setShowAbout(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-green-50 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><AboutFrogPlanner /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
