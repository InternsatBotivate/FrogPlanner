import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, X, BadgeCheck, Mail, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import Footer from '../components/Footer';
import AboutFrogPlanner from './AboutFrogPlanner/AboutFrogPlanner';

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

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await login(id.trim(), password);
      if (error) {
        toast.error(error.message || 'Invalid User ID or Password.');
        return;
      }
      toast.success(`Welcome back! 🐸`);
      navigate('/', { replace: true });
    } catch {
      toast.error('Login error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!signupName.trim() || !signupId.trim() || !signupPassword.trim()) {
      toast.error('Please fill all required fields.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
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
        designation: 'Team Member',
        department: 'General Division',
        phone: '',
        bio: '',
      });
      if (error) {
        toast.error(error.message || 'Sign up failed. Please try again.');
        return;
      }
      toast.success(`Account created! Welcome, ${signupName.trim()}! 🐸`);
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
              <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-full border-4 border-green-400 bg-green-50 flex items-center justify-center shadow-lg text-6xl lg:text-7xl select-none">
                🐸
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl lg:text-4xl font-black text-green-700 tracking-tight">Frog Planner</h1>
                <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xs">
                  Focus on what matters most. Complete your most important task first — every single day.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Eat the Frog', 'Daily Focus', 'AI Assistant', 'Smart Tasks'].map((f) => (
                  <span key={f} className="px-3 py-1 bg-green-50 text-green-700 text-[11px] font-bold rounded-full border border-green-200">{f}</span>
                ))}
              </div>
              <div className="bg-green-50 rounded-2xl p-4 border border-green-100 text-left w-full max-w-xs">
                <p className="text-gray-600 text-xs font-medium leading-relaxed italic">
                  "20% of your tasks create 80% of your results. Identify those tasks and do them first."
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-yellow-400/60" />
                  <p className="text-amber-500 text-[10px] font-bold">Eat the Frog Method</p>
                </div>
              </div>
            </div>
            <div className="relative z-10 text-center mt-4">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Powered By Botivate</p>
            </div>
          </div>

          {/* ── RIGHT FORM PANEL ── */}
          <div className="flex-1 flex flex-col p-5 sm:p-7 lg:p-10 gap-5 bg-white">

            {/* Mobile logo */}
            <div className="flex flex-col items-center gap-2 md:hidden">
              <div className="w-16 h-16 rounded-full border-4 border-green-400 bg-green-50 flex items-center justify-center shadow-md text-4xl select-none">
                🐸
              </div>
              <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-1.5">
                <span>🐸</span> Frog <span className="text-green-600">Planner</span>
              </h1>
            </div>

            {/* Heading (md+) */}
            <div className="hidden md:block">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                🐸 <span>Sign In</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">Enter your credentials to access Frog Planner.</p>
            </div>

            {/* Sign In Form */}
            <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
              <div className="space-y-1">
                <label htmlFor="login-id" className="text-xs font-bold text-gray-600 uppercase tracking-wider">User ID</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                  </div>
                  <input id="login-id" type="text" required value={id}
                    onChange={(e) => setId(e.target.value)} className={inputCls}
                    placeholder="Enter your user ID" autoComplete="username" />
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
              </div>

              {/* Demo hint */}
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-[11px] text-green-800 font-semibold flex items-center gap-1.5">
                <BadgeCheck size={13} className="flex-shrink-0 text-green-600" />
                Demo — ID: <strong>admin</strong> &nbsp;/&nbsp; Password: <strong>admin123</strong>
              </div>

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
              <Footer minimal />
              <button type="button" onClick={() => setShowAbout(true)}
                className="w-full text-center text-[11px] font-bold text-green-700 hover:text-green-900 hover:underline flex items-center justify-center gap-1 select-none transition-colors">
                <span>🐸</span> About Frog Planner
              </button>
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
                <p className="text-[11px] text-gray-400 mt-0.5">Join Frog Planner and start today 🐸</p>
              </div>
              <button type="button" onClick={() => setShowSignupModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-green-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSignUp} className="p-6 flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                    </div>
                    <input type="text" required value={signupName} onChange={(e) => setSignupName(e.target.value)}
                      className={inputCls} placeholder="Full name" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">User ID *</label>
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
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Email (optional)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                  </div>
                  <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                    className={inputCls} placeholder="your@email.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Password *</label>
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
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confirm *</label>
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

              <button type="submit" disabled={signingUp}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-md shadow-amber-400/25 transition-all mt-1 ${signingUp ? 'opacity-75 cursor-not-allowed' : ''}`}>
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

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] rounded-xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden border border-green-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-green-100 flex items-center justify-between bg-green-50/40">
              <span className="text-sm font-bold text-green-800 flex items-center gap-1.5"><span>🐸</span> About Frog Planner</span>
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
