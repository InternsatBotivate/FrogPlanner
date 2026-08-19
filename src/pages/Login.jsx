import React, { useState } from 'react';
import frogLogo from '../Assets/frog_planner_logo.avif';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, X, BadgeCheck, Mail, UserPlus, Building, Briefcase, Shield, Phone, Loader2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { sendSignupOtp, verifyOtp, sendPasswordResetOtp, resetPassword } from '../lib/otpService';
import OtpInput from '../components/OtpInput';
import Footer from '../components/Footer';
import AboutFrogPlanner from './AboutFrogPlanner/AboutFrogPlanner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'block w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50/60 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all shadow-sm';

const Login = () => {
  const [showAbout, setShowAbout] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Sign In state
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  // New Business & User details
  const [signupBusinessName, setSignupBusinessName] = useState('');
  const [signupPosition, setSignupPosition] = useState('');
  const [signupRole, setSignupRole] = useState('');
  const [signupContact, setSignupContact] = useState('');

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
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

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
      toast.success('Email verified!');
    }
    return res;
  };

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
      navigate('/', { replace: true });
    } catch {
      toast.error('Login error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    // Validate required fields
    if (
      !signupName.trim() ||
      !signupId.trim() ||
      !signupEmail.trim() ||
      !signupPassword.trim() ||
      !signupBusinessName.trim() ||
      !signupPosition.trim() ||
      !signupRole.trim() ||
      !signupContact.trim()
    ) {
      toast.error('Please fill all required fields.');
      return;
    }

    if (!emailVerified) {
      toast.error('Please verify your email before creating an account.');
      return;
    }

    // Validate passwords match
    if (signupPassword !== signupConfirm) {
      toast.error('Passwords do not match.');
      return;
    }

    // Validate password length
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    // Validate numeric Contact Number
    if (!/^\d+$/.test(signupContact.trim())) {
      toast.error('Contact Number must contain only numbers.');
      return;
    }

    setSigningUp(true);
    try {
      const { error } = await register({
        username: signupId.trim(),
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        role: 'USER',
        designation: signupPosition.trim(),
        department: 'General Division',
        phone: signupContact.trim(),
        bio: '',
        business_name: signupBusinessName.trim(),
        user_role: signupRole.trim(),
        emailVerified: true,
      });
      if (error) {
        toast.error(error.message || 'Sign up failed. Please try again.');
        return;
      }
      toast.success(`Account created! Welcome, ${signupName.trim()}!`);
      setShowSignupModal(false);
      navigate('/', { replace: true });
    } catch {
      toast.error('Sign up failed. Please try again.');
    } finally {
      setSigningUp(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-white relative overflow-x-hidden overflow-y-auto">

      {/* Subtle background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[45%] h-[45%] rounded-full bg-green-100/40 blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-[10%] -right-[8%] w-[38%] h-[50%] rounded-full bg-yellow-100/30 blur-3xl animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[40%] rounded-full bg-green-100/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-5 py-6 relative z-10">

        {/* Two-panel card */}
        <div className="w-full max-w-sm md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-[0_12px_48px_rgba(0,0,0,0.08)] border border-green-100 overflow-hidden flex flex-col md:flex-row">

          {/* ── LEFT BRANDING PANEL ── */}
          <div className="hidden md:flex md:w-2/5 lg:w-[42%] bg-white flex-col items-center justify-between p-8 lg:p-10 relative overflow-hidden border-r border-green-100">
            <div className="absolute top-[-20%] left-[-20%] w-72 h-72 rounded-full bg-green-50/60 pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-15%] w-60 h-60 rounded-full bg-yellow-50/60 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-5 flex-1 justify-center w-full">
              <div className="w-24 h-24 lg:w-28 lg:h-28 flex items-center justify-center select-none drop-shadow-lg">
                <img src={frogLogo} alt="Frog Planner" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl lg:text-4xl font-black text-green-700 tracking-tight">Frog Planner</h1>
                <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xs">
                  Focus on what matters most. Complete your most important task first — every single day.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Tackle Your Frog', 'Daily Focus', 'AI Assistant', 'Smart Tasks'].map((f) => (
                  <span key={f} className="px-3 py-1 bg-green-50 text-green-700 text-[11px] font-bold rounded-full border border-green-200">{f}</span>
                ))}
              </div>
              <div className="bg-green-50 rounded-2xl p-4 border border-green-100 text-left w-full max-w-xs">
                <p className="text-gray-600 text-xs font-medium leading-relaxed italic">
                  "20% of your tasks create 80% of your results. Identify those tasks and do them first."
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-yellow-400/60" />
                  <p className="text-amber-500 text-[10px] font-bold">Tackle Your Frog First</p>
                </div>
              </div>
            </div>
            <div className="relative z-10 text-center mt-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Powered By Botivate</p>
              <div className="flex items-center justify-center gap-2">
                <Link to="/privacy-policy" className="text-gray-400 text-[10px] font-semibold hover:text-green-700 hover:underline">
                  Privacy Policy
                </Link>
                <span className="text-gray-300 text-[10px]">·</span>
                <Link to="/delete-account" className="text-gray-400 text-[10px] font-semibold hover:text-green-700 hover:underline">
                  Delete account
                </Link>
              </div>
            </div>
          </div>

          {/* ── RIGHT FORM PANEL ── */}
          <div className="flex-1 flex flex-col p-5 sm:p-7 lg:p-10 gap-5 bg-white">

            {/* Mobile logo */}
            <div className="flex flex-col items-center gap-2 md:hidden">
              <div className="w-16 h-16 flex items-center justify-center select-none drop-shadow-md">
                <img src={frogLogo} alt="Frog Planner" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-1.5">
                <img src={frogLogo} alt="" className="w-5 h-5 object-contain" /> Frog <span className="text-green-600">Planner</span>
              </h1>
            </div>

            {/* Heading (md+) */}
            <div className="hidden md:block">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <img src={frogLogo} alt="" className="w-8 h-8 object-contain" /> <span>Sign In</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">Enter your credentials to access Frog Planner.</p>
            </div>

            {/* Sign In Form */}
            <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
              <div className="space-y-1">
                <label htmlFor="login-id" className="text-xs font-bold text-gray-600 uppercase tracking-wider">User ID or Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                  </div>
                  <input id="login-id" type="text" required value={id}
                    onChange={(e) => setId(e.target.value)} className={inputCls}
                    placeholder="Enter your user ID or email" autoComplete="username" />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="login-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                  </div>
                  <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-10`}
                    placeholder="Enter your password" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => { resetForgotState(); setShowForgotModal(true); }}
                    className="text-[11px] font-semibold text-green-700 hover:text-green-900 hover:underline">
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Demo hint */}

              {/* Sign In Button */}
              <button type="submit" disabled={submitting}
                className={`group relative w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 shadow-md shadow-green-500/25 transition-all overflow-hidden ${submitting ? 'opacity-75 cursor-not-allowed' : ''}`}>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  {submitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Authenticating...</>
                    : <>Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  }
                </span>
              </button>

              {/* Sign Up Button */}
              <button type="button" onClick={() => setShowSignupModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold text-green-700 rounded-xl border-2 border-green-300 bg-white hover:bg-green-50 hover:border-green-400 transition-all shadow-sm">
                <UserPlus className="w-4 h-4" />
                Sign Up — Create New Account
              </button>
            </form>

            {/* Footer links */}
            <div className="pt-3 border-t border-gray-100 space-y-2 mt-auto">
              <button type="button" onClick={() => setShowAbout(true)}
                className="w-full text-center text-[11px] font-bold text-green-700 hover:text-green-900 hover:underline flex items-center justify-center gap-1 select-none transition-colors">
                <img src={frogLogo} alt="" className="w-4 h-4 object-contain" /> About Frog Planner
              </button>
              <div className="flex items-center justify-center gap-2">
                <Link to="/privacy-policy"
                  className="text-[11px] font-semibold text-gray-400 hover:text-green-700 hover:underline transition-colors">
                  Privacy Policy
                </Link>
                <span className="text-gray-300 text-[11px]">·</span>
                <Link to="/delete-account"
                  className="text-[11px] font-semibold text-gray-400 hover:text-green-700 hover:underline transition-colors">
                  Delete account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SIGN UP MODAL ── */}
      {showSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-green-100 overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-green-100 flex items-center justify-between bg-green-50/50">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <UserPlus size={18} className="text-green-600" /> Create Account
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Join Frog Planner and start today</p>
              </div>
              <button type="button" onClick={() => setShowSignupModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-green-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSignUp} className="p-5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              
              {/* Account Details Group */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Full Name *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="text" required value={signupName} onChange={(e) => setSignupName(e.target.value)}
                        className={inputCls} placeholder="Full name" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">User ID *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <BadgeCheck className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="text" required value={signupId}
                        onChange={(e) => setSignupId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        className={inputCls} placeholder="user_id" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Email *</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative group flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="email" required value={signupEmail}
                        disabled={emailVerified}
                        onChange={(e) => {
                          setSignupEmail(e.target.value);
                          setEmailVerified(false);
                          setShowEmailOtp(false);
                        }}
                        className={`${inputCls} ${emailVerified ? 'opacity-70' : ''}`} placeholder="your@email.com" />
                    </div>
                    {emailVerified ? (
                      <span className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl whitespace-nowrap">
                        <BadgeCheck size={13} /> Verified
                      </span>
                    ) : (
                      <button type="button" onClick={handleSendEmailOtp} disabled={sendingEmailOtp}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3.5 py-2 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap">
                        {sendingEmailOtp ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                        {sendingEmailOtp ? 'Sending…' : 'Verify'}
                      </button>
                    )}
                  </div>
                  {showEmailOtp && !emailVerified && (
                    <div className="pt-1.5">
                      <OtpInput onConfirm={handleEmailOtpConfirm} onResend={handleEmailOtpResend} confirmLabel="Confirm" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Password *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type={showSignupPwd ? 'text' : 'password'} required value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className={`${inputCls} pr-9`} placeholder="Min 6 chars" />
                      <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                        {showSignupPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Confirm *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="password" required value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)}
                        className={`${inputCls} ${signupConfirm && signupPassword !== signupConfirm ? 'border-rose-300 focus:border-rose-400' : ''}`}
                        placeholder="Repeat password" />
                    </div>
                    {signupConfirm && signupPassword !== signupConfirm && (
                      <p className="text-[10px] text-rose-500 font-semibold">Passwords don't match</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Profile Details Group */}
              <div className="border border-green-100 rounded-xl p-3.5 bg-green-50/10 space-y-3 mt-1.5">
                <div className="flex items-center gap-1.5 border-b border-green-100/50 pb-1.5">
                  <Building className="h-4 w-4 text-green-700" />
                  <span className="text-[10px] font-extrabold text-green-700 uppercase tracking-wider">Business Profile Details</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Business Name *</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                    </div>
                    <input type="text" required value={signupBusinessName} onChange={(e) => setSignupBusinessName(e.target.value)}
                      className={inputCls} placeholder="e.g. Acme Corporation" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">User Position *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="text" required value={signupPosition} onChange={(e) => setSignupPosition(e.target.value)}
                        className={inputCls} placeholder="e.g. Director" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">User Role *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Shield className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="text" required value={signupRole} onChange={(e) => setSignupRole(e.target.value)}
                        className={inputCls} placeholder="e.g. Administrator" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Contact Number *</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                    </div>
                    <input type="text" required value={signupContact} 
                      onChange={(e) => setSignupContact(e.target.value.replace(/\D/g, ''))}
                      className={inputCls} placeholder="Only numbers e.g. 9876543210" />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={signingUp || !emailVerified}
                title={!emailVerified ? 'Verify your email first' : undefined}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-md shadow-amber-400/25 transition-all mt-1 ${signingUp || !emailVerified ? 'opacity-75 cursor-not-allowed' : ''}`}>
                {signingUp
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
                  : <><UserPlus className="w-4 h-4" />Create Account</>
                }
              </button>

              <p className="text-center text-[11px] text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={() => setShowSignupModal(false)} className="text-green-700 font-bold hover:underline">
                  Sign In
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-green-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-green-100 flex items-center justify-between bg-green-50/50">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <KeyRound size={18} className="text-green-600" /> Reset Password
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {forgotStep === 'username' && 'Enter your User ID or email to receive a code'}
                  {forgotStep === 'otp' && 'Enter the code sent to your email on file'}
                  {forgotStep === 'reset' && 'Choose a new password'}
                </p>
              </div>
              <button type="button" onClick={() => { setShowForgotModal(false); resetForgotState(); }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-green-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {forgotStep === 'username' && (
                <form onSubmit={handleSendForgotOtp} className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">User ID or Email</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="text" required value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        className={inputCls} placeholder="Enter your user ID or email" />
                    </div>
                  </div>
                  <button type="submit" disabled={sendingForgotOtp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 shadow-md shadow-green-500/25 transition-all disabled:opacity-75">
                    {sendingForgotOtp ? <Loader2 size={16} className="animate-spin" /> : null}
                    {sendingForgotOtp ? 'Sending…' : 'Send Code'}
                  </button>
                </form>
              )}

              {forgotStep === 'otp' && (
                <OtpInput onConfirm={handleForgotOtpConfirm} onResend={handleForgotResend} confirmLabel="Confirm" />
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">New Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="password" required value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputCls} placeholder="Min 6 chars" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-550 uppercase tracking-wider">Confirm Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      </div>
                      <input type="password" required value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className={`${inputCls} ${confirmNewPassword && newPassword !== confirmNewPassword ? 'border-rose-300 focus:border-rose-400' : ''}`}
                        placeholder="Repeat password" />
                    </div>
                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                      <p className="text-[10px] text-rose-500 font-semibold">Passwords don't match</p>
                    )}
                  </div>
                  <button type="submit" disabled={resettingPassword}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 shadow-md shadow-green-500/25 transition-all disabled:opacity-75">
                    {resettingPassword ? <Loader2 size={16} className="animate-spin" /> : null}
                    {resettingPassword ? 'Resetting…' : 'Reset Password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] rounded-xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden border border-green-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-green-100 flex items-center justify-between bg-green-50/40">
              <span className="text-sm font-bold text-green-800 flex items-center gap-1.5"><img src={frogLogo} alt="" className="w-4 h-4 object-contain" /> About Frog Planner</span>
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
