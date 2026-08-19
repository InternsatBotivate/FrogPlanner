/**
 * Onboarding.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The post-signup onboarding wizard — one question per screen.
 *
 * Runs in one of two modes, because the two signup paths create the account at
 * different moments:
 *
 *   'google'  The account already exists (api/google-signin.js created it with
 *             onboarding_complete=false) and the user is signed in. Name/email/
 *             avatar are prefilled from Google. 5 steps — the password step is
 *             skipped, since a Google user sets one later in Settings.
 *
 *   'email'   No account exists yet. The email was OTP-verified on the login
 *             page, and the wizard collects everything including the password;
 *             the row is INSERTed on the final step ("Create Account & Start").
 *             6 steps. This ordering is forced by the DB: users_has_credential_check
 *             requires a password or a google_id, so there is nothing valid to
 *             insert before the password is known.
 *
 * Answers live in local state until the final step, so abandoning midway leaves
 * no partial account (email mode) or an untouched onboarding_complete=false row
 * that simply restarts the wizard (google mode).
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, Briefcase, Building2, Check, Eye, EyeOff, GraduationCap,
  Heart, Laptop, Lock, Mail, Phone, Target, User, Calendar as CalendarIcon, Loader2,
} from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';
import { isUsernameAvailable } from '../../lib/authService';

const PENDING_SIGNUP_KEY = 'fp_pending_signup';

const inputCls =
  'block w-full pl-10 pr-3 py-3 text-sm bg-gray-50/60 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all shadow-sm';

const PROFILE_TYPES = [
  { value: 'business_owner', label: 'Business Owner', icon: Building2, hint: 'You run your own company' },
  { value: 'working_professional', label: 'Working Professional', icon: Briefcase, hint: 'You work at a company' },
  { value: 'student', label: 'Student', icon: GraduationCap, hint: 'School or college' },
  { value: 'freelancer', label: 'Freelancer / Self-Employed', icon: Laptop, hint: 'You work for yourself' },
  { value: 'personal', label: 'Personal Use', icon: Heart, hint: 'Just for your own life' },
];

// Which two questions step 3 asks. `null` fields are skipped; `personal` has
// none at all, so step 3 auto-advances for that answer.
const PROFILE_FIELDS = {
  business_owner: { nameLabel: 'Business Name', roleLabel: 'Your Position' },
  working_professional: { nameLabel: 'Company Name', roleLabel: 'Your Job Role' },
  student: { nameLabel: 'School / College Name', roleLabel: 'Course' },
  freelancer: { nameLabel: null, roleLabel: 'Profession / Service' },
  personal: { nameLabel: null, roleLabel: null },
};

const GOALS = [
  { value: 'work_career', label: 'Work & Career', hint: 'Ship more of what matters at work' },
  { value: 'business', label: 'Business', hint: 'Move the needle on your own venture' },
  { value: 'studies', label: 'Studies', hint: 'Stay on top of coursework and exams' },
  { value: 'personal_life', label: 'Personal Life', hint: 'Habits, health, and life admin' },
];

/** Cheap strength signal for the password step — length plus character variety. */
const passwordStrength = (pw) => {
  if (!pw) return { score: 0, label: '', cls: '' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { score, label: 'Weak', cls: 'bg-red-400 text-red-600' };
  if (score === 3) return { score, label: 'Fair', cls: 'bg-amber-400 text-amber-600' };
  if (score === 4) return { score, label: 'Good', cls: 'bg-lime-500 text-lime-600' };
  return { score, label: 'Strong', cls: 'bg-green-500 text-green-600' };
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, register, finishOnboarding } = useAuthStore();
  const addPlannerTasks = usePlannerStore((s) => s.addPlannerTasks);

  // Survives a refresh so a mid-wizard reload doesn't dump an email signup back
  // to the login page with their OTP already consumed.
  const pending = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(PENDING_SIGNUP_KEY) || 'null');
    } catch {
      return null;
    }
  }, []);

  const mode = isAuthenticated ? 'google' : 'email';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [profileType, setProfileType] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgRole, setOrgRole] = useState('');
  const [goal, setGoal] = useState('');
  const [firstFrog, setFirstFrog] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Prefill: Google gives us name/email/photo; an email signup only has the
  // address it just verified.
  const seeded = useRef(false);
  useEffect(() => {
    if (loading || seeded.current) return;
    if (mode === 'google' && user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      seeded.current = true;
    } else if (mode === 'email' && pending?.email) {
      setEmail(pending.email);
      // Suggest a User ID from the address; the field stays editable.
      setUsername(
        pending.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 20),
      );
      seeded.current = true;
    }
  }, [loading, mode, user, pending]);

  // Nothing to onboard: either already done, or an email signup with no
  // verified address in hand. Bounce rather than render a broken wizard.
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && user?.onboarding_complete !== false) {
      navigate('/dashboard', { replace: true });
    } else if (!isAuthenticated && !pending?.email) {
      navigate('/login', { replace: true });
    }
  }, [loading, isAuthenticated, user, pending, navigate]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-white">
        <FrogLogo className="w-14 h-14 animate-bounce" />
      </div>
    );
  }

  const profileFields = PROFILE_FIELDS[profileType] || {};
  const strength = passwordStrength(password);

  // The steps actually shown, in order. Derived rather than hardcoded because
  // two things remove steps: 'personal' has no step-3 questions, and a Google
  // account skips the password step. Everything below indexes into this, so
  // progress and Back/Continue can't drift out of sync with what's rendered.
  const sequence = [
    1,
    2,
    ...(profileType && profileType !== 'personal' ? [3] : []),
    4,
    5,
    ...(mode === 'email' ? [6] : []),
  ];
  const stepIndex = Math.max(0, sequence.indexOf(step));
  const isLastStep = step === sequence[sequence.length - 1];

  // ── Per-step validation ────────────────────────────────────────────────
  const stepValid = () => {
    switch (step) {
      case 1:
        return (
          fullName.trim().length > 1 &&
          username.trim().length >= 3 &&
          !usernameError &&
          phone.trim().length >= 7 &&
          !!dob
        );
      case 2:
        return !!profileType;
      case 3:
        // 'personal' asks nothing; otherwise every shown field is required.
        if (!profileFields.nameLabel && !profileFields.roleLabel) return true;
        if (profileFields.nameLabel && !orgName.trim()) return false;
        if (profileFields.roleLabel && !orgRole.trim()) return false;
        return true;
      case 4:
        return !!goal;
      case 5:
        return firstFrog.trim().length > 2;
      case 6:
        return password.length >= 8 && password === confirm;
      default:
        return false;
    }
  };

  const checkUsername = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameError('At least 3 characters.');
      return false;
    }
    if (!/^[a-z0-9._-]+$/.test(trimmed)) {
      setUsernameError('Lowercase letters, numbers, dot, dash and underscore only.');
      return false;
    }
    // In google mode the user already owns a generated username — exclude their
    // own row so keeping it isn't reported as taken.
    const free = await isUsernameAvailable(trimmed, mode === 'google' ? user?.id : null);
    if (!free) {
      setUsernameError('That User ID is taken.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const next = async () => {
    if (!stepValid()) return;
    if (step === 1 && !(await checkUsername())) return;

    if (isLastStep) {
      await handleFinish();
      return;
    }
    setStep(sequence[stepIndex + 1]);
  };

  const back = () => {
    if (stepIndex > 0) setStep(sequence[stepIndex - 1]);
  };

  // ── Final submit ───────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const answers = {
        name: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        dateOfBirth: dob,
        profileType,
        orgName,
        orgRole,
        improvementGoal: goal,
      };

      let userId = user?.id;

      if (mode === 'email') {
        const { error } = await register({
          ...answers,
          email: email.trim(),
          password,
          emailVerified: true, // the login page OTP-verified it before we got here
        });
        if (error) {
          toast.error(error.message || 'Could not create your account.');
          setSubmitting(false);
          return;
        }
        userId = useAuthStore.getState().user?.id;
      } else {
        const { error } = await finishOnboarding(answers);
        if (error) {
          toast.error(error.message || 'Could not save your details.');
          setSubmitting(false);
          return;
        }
      }

      // Step 5's answer becomes a real task for today, flagged as the Frog, so
      // the planner isn't empty on first open.
      if (userId && firstFrog.trim()) {
        try {
          await addPlannerTasks(userId, [
            {
              description: firstFrog.trim(),
              duration: 'Morning',
              category: 'Work',
              priority: 'Frog',
              date: todayStr(),
              selectValue: 'Select',
              remarks: '',
            },
          ]);
        } catch {
          // The account is already created — a failed first task is not worth
          // blocking entry over. They can add it from the planner.
          toast.error('Account ready, but we could not save your first frog.');
        }
      }

      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      toast.success("You're all set. Time to tackle your frog!");
      navigate('/dashboard', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Presentational helpers ─────────────────────────────────────────────
  const ChoiceCard = ({ selected, onClick, icon: Icon, label, hint }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
        selected
          ? 'border-green-500 bg-green-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40'
      }`}
    >
      {Icon && (
        <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${selected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
          <Icon className="w-5 h-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
      {selected && <Check className="w-5 h-5 text-green-600 shrink-0" />}
    </button>
  );

  const Field = ({ icon: Icon, children }) => (
    <div className="relative group">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-500 transition-colors pointer-events-none" />
      {children}
    </div>
  );

  const stepTitles = {
    1: { title: 'Basic details', sub: 'Confirm this looks right.' },
    2: { title: 'What best describes you?', sub: 'We use this to tailor your workspace.' },
    3: { title: 'A bit more about that', sub: 'Just two quick fields.' },
    4: { title: 'What would you like to improve?', sub: 'Choose where you want to become more focused.' },
    5: { title: 'Set your first Frog', sub: 'The one task that would make today feel successful.' },
    6: { title: 'Secure your account', sub: 'Last step — pick a password.' },
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white relative overflow-x-hidden">
      {/* ambient blobs, matching the login page */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-green-100/40 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute bottom-0 -right-24 w-80 h-80 rounded-full bg-lime-100/40 blur-3xl animate-pulse" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Header + progress */}
        <div className="flex items-center gap-3 mb-6">
          <FrogLogo className="w-10 h-10" />
          <div className="flex-1">
            <p className="text-sm font-extrabold text-gray-900">Frog Planner</p>
            <p className="text-[11px] text-gray-500">
              Step {stepIndex + 1} of {sequence.length}
            </p>
          </div>
        </div>

        <div
          className="flex gap-1.5 mb-8"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={sequence.length}
        >
          {sequence.map((n, i) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-green-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-black text-gray-900 leading-tight">{stepTitles[step].title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">{stepTitles[step].sub}</p>

        {/* ── Step bodies ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Full Name *</label>
              <Field icon={User}>
                <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </Field>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">User ID *</label>
              <Field icon={User}>
                <input
                  className={inputCls}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/\s/g, ''));
                    setUsernameError('');
                  }}
                  onBlur={checkUsername}
                  placeholder="e.g. abhay.singh"
                  autoComplete="username"
                />
              </Field>
              {usernameError ? (
                <p className="text-[11px] text-red-500 mt-1">{usernameError}</p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">This is what you'll sign in with.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Email</label>
              <Field icon={Mail}>
                {/* Verified already — via Google, or via OTP on the login page.
                    Editing it here would silently unverify the account. */}
                <input className={`${inputCls} bg-gray-100 text-gray-500 cursor-not-allowed`} value={email} disabled readOnly />
              </Field>
              <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Verified
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Contact Number *</label>
              <Field icon={Phone}>
                <input
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
                  placeholder="Your phone number"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Date of Birth *</label>
              <Field icon={CalendarIcon}>
                <input type="date" className={inputCls} value={dob} max={todayStr()} onChange={(e) => setDob(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2.5">
            {PROFILE_TYPES.map((p) => (
              <ChoiceCard
                key={p.value}
                selected={profileType === p.value}
                onClick={() => {
                  setProfileType(p.value);
                  setOrgName('');
                  setOrgRole('');
                }}
                icon={p.icon}
                label={p.label}
                hint={p.hint}
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {profileFields.nameLabel && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{profileFields.nameLabel} *</label>
                <Field icon={Building2}>
                  <input className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={profileFields.nameLabel} />
                </Field>
              </div>
            )}
            {profileFields.roleLabel && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{profileFields.roleLabel} *</label>
                <Field icon={Briefcase}>
                  <input className={inputCls} value={orgRole} onChange={(e) => setOrgRole(e.target.value)} placeholder={profileFields.roleLabel} />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2.5">
            {GOALS.map((g) => (
              <ChoiceCard key={g.value} selected={goal === g.value} onClick={() => setGoal(g.value)} icon={Target} label={g.label} hint={g.hint} />
            ))}
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="p-4 rounded-2xl bg-green-50 border border-green-100 mb-4 flex gap-3">
              <FrogLogo className="w-8 h-8 shrink-0" />
              <p className="text-xs text-green-800 leading-relaxed">
                Your <strong>Frog</strong> is the one task you least want to do but that matters most. Do it first, and the rest of the day gets easier.
              </p>
            </div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Today's most important task *</label>
            <textarea
              className="block w-full px-3 py-3 text-sm bg-gray-50/60 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:border-green-400 focus:bg-white transition-all shadow-sm resize-none"
              rows={3}
              value={firstFrog}
              onChange={(e) => setFirstFrog(e.target.value)}
              placeholder="e.g. Complete the client proposal"
            />
            <p className="text-[11px] text-gray-400 mt-1">We'll add this to today's planner.</p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Password *</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-500 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className={`${inputCls} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1 flex-1 rounded-full ${n <= strength.score ? strength.cls.split(' ')[0] : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <span className={`text-[11px] font-bold ${strength.cls.split(' ')[1]}`}>{strength.label}</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1">Minimum 8 characters. Mix in numbers and symbols for a stronger password.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Confirm Password *</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-500 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className={inputCls}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
              </div>
              {confirm && confirm !== password && <p className="text-[11px] text-red-500 mt-1">Passwords don't match.</p>}
            </div>
          </div>
        )}

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-8">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="grid place-items-center w-12 h-12 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition disabled:opacity-50"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!stepValid() || submitting}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-green-500 to-green-700 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Setting up…
              </>
            ) : isLastStep ? (
              <>
                {mode === 'email' ? 'Create Account & Start' : 'Finish & Start'} <FrogLogo className="w-4 h-4" />
              </>
            ) : step === 5 ? (
              <>
                Set as My First Frog <FrogLogo className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
