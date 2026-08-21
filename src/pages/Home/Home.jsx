import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';
import { useAuthStore } from '../../store/authStore';
import botivateLogo from '../../Assets/Botivate_logo.png';
import './Home.css';

const features = [
  {
    icon: ListChecks,
    title: 'Plan around one priority',
    copy: 'Choose the task that matters most, then give the rest of your day a realistic shape.',
  },
  {
    icon: CalendarDays,
    title: 'Keep your calendar in view',
    copy: 'Connect Google Calendar when you want tasks and events to share one clear timeline.',
  },
  {
    icon: Sparkles,
    title: 'Get practical planning help',
    copy: 'Use the AI assistant to break down work, clarify the next step, and keep momentum.',
  },
];

export default function Home() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isNavFloating, setIsNavFloating] = React.useState(false);
  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  React.useEffect(() => {
    let frameId = null;
    const updateNav = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        setIsNavFloating(window.scrollY > 1);
        frameId = null;
      });
    };

    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('hashchange', updateNav);
    return () => {
      window.removeEventListener('scroll', updateNav);
      window.removeEventListener('hashchange', updateNav);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="home-page">
      <div className="home-nav-shell">
        <header className={`home-nav${isNavFloating ? ' home-nav--island' : ''}`}>
          <Link to="/" className="home-brand" aria-label="Frog Planner home">
            <FrogLogo backgroundless />
            <span>
              <strong>Frog Planner</strong>
              <small>Tackle Your Frog First</small>
            </span>
          </Link>

          <nav className="home-nav__links" aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#calendar">Calendar</a>
            <a href="#get-the-app">Get the app</a>
            {isAuthenticated ? (
              <Link to="/dashboard" className="home-nav__button">
                Open planner <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="home-nav__signin">Sign in</Link>
                <Link to="/login?mode=signup" className="home-nav__button">
                  Create account <ArrowRight aria-hidden="true" />
                </Link>
              </>
            )}
          </nav>
        </header>
      </div>

      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <p className="home-eyebrow"><span /> A calmer way to plan the day</p>
            <h1 id="home-title">
              Make the important task <em>the obvious one.</em>
            </h1>
            <p className="home-hero__lede">
              Frog Planner brings priorities, projects, and calendar events into one focused daily plan—so you know what to tackle first and what can wait.
            </p>

            <div className="home-hero__actions">
              <Link to={isAuthenticated ? '/dashboard' : '/login?mode=signup'} className="home-button home-button--primary">
                {isAuthenticated ? 'Open your planner' : 'Start planning'}
                <ArrowRight aria-hidden="true" />
              </Link>
              {!isAuthenticated && (
                <Link to="/login" className="home-button home-button--quiet">I already have an account</Link>
              )}
            </div>

            <div className="home-trust-row" aria-label="Product assurances">
              <span><Check aria-hidden="true" /> Free to get started</span>
              <span><Check aria-hidden="true" /> Calendar connection is optional</span>
            </div>
          </div>

          <div className="home-planner-preview" aria-label="Example Frog Planner day">
            <div className="home-planner-preview__header">
              <div>
                <span>Today</span>
                <strong>{todayLabel}</strong>
              </div>
              <span className="home-day-status">Day mapped</span>
            </div>

            <div className="home-focus-card">
              <div className="home-focus-card__meta">
                <span>First frog</span>
                <span><Clock3 aria-hidden="true" /> 45 min</span>
              </div>
              <h2>Finish the proposal you keep moving to tomorrow.</h2>
              <div className="home-progress"><span /></div>
              <p>Protected focus · 9:00–9:45</p>
            </div>

            <div className="home-timeline" aria-label="Example schedule">
              <div className="home-timeline__item home-timeline__item--done">
                <span>08:30</span><i><Check aria-hidden="true" /></i><p>Review today&apos;s plan</p>
              </div>
              <div className="home-timeline__item home-timeline__item--active">
                <span>09:00</span><i /><p><strong>Deep work</strong><small>Proposal · 45 minutes</small></p>
              </div>
              <div className="home-timeline__item">
                <span>10:30</span><i /><p><strong>Team check-in</strong><small>Google Calendar</small></p>
              </div>
            </div>

            <div className="home-preview-foot">
              <span><CalendarDays aria-hidden="true" /> 1 calendar event</span>
              <span>3 tasks left</span>
            </div>
          </div>
        </section>

        <section className="home-principle" aria-label="Frog Planner principle">
          <p>One clear priority</p><span />
          <p>A plan that fits</p><span />
          <p>A day you can finish</p>
        </section>

        <section className="home-features" id="how-it-works">
          <div className="home-section-heading">
            <p className="home-eyebrow"><span /> Built for real working days</p>
            <h2>Enough structure to move. Not enough clutter to slow you down.</h2>
          </div>

          <div className="home-feature-grid">
            {features.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="home-feature-card">
                <span className="home-feature-card__icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-calendar" id="calendar">
          <div className="home-calendar__mark"><CalendarDays aria-hidden="true" /></div>
          <div>
            <p className="home-eyebrow"><span /> Optional Google Calendar connection</p>
            <h2>Your schedule and your tasks, finally speaking the same language.</h2>
          </div>
          <div className="home-calendar__copy">
            <p>
              Connect Google Calendar only when you choose. Frog Planner can display your events and create, update, or remove events for tasks you decide to sync.
            </p>
            <Link to="/privacy-policy">See how calendar data is handled <ArrowRight aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="home-download" id="get-the-app" aria-labelledby="home-download-title">
          <div className="home-download__copy">
            <p className="home-eyebrow"><span /> Available on iOS and Android</p>
            <h2 id="home-download-title">Take your plan wherever the day goes.</h2>
            <p>Download Frog Planner on your phone and keep priorities, projects, and daily plans close at hand.</p>
          </div>

          <div className="home-download__actions" aria-label="Download Frog Planner">
            <a
              className="home-store-badge home-store-badge--apple"
              href="https://apps.apple.com/in/app/frog-planner/id6801085399"
              target="_blank"
              rel="noreferrer"
              aria-label="Download Frog Planner on the App Store"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
              />
            </a>
            <a
              className="home-store-badge home-store-badge--play"
              href="https://play.google.com/store/apps/details?id=in.botivate.frogplanner&pcampaignid=web_share"
              target="_blank"
              rel="noreferrer"
              aria-label="Get Frog Planner on Google Play"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
              />
            </a>
          </div>
        </section>

      </main>

      <footer className="home-footer">
        <FrogLogo backgroundless className="home-footer__watermark" alt="" aria-hidden="true" />
        <div className="home-footer__top">
          <div className="home-footer__identity">
            <div>
              <strong>Frog Planner</strong>
            </div>
            <a
              className="home-footer__botivate"
              href="https://www.botivate.in/"
              target="_blank"
              rel="noreferrer"
              aria-label="Visit Botivate"
            >
              <img src={botivateLogo} alt="" />
              <span>Powered by <b>Botivate</b></span>
            </a>
          </div>
          <div className="home-footer__assurance">
            <ShieldCheck aria-hidden="true" />
            <span>
              <small>Your data, your choice</small>
              <strong>Calendar connection is optional</strong>
            </span>
          </div>
        </div>

        <p className="home-footer__statement">
          Plan what matters.<br />
          <span>Tackle Your Frog First.</span>
        </p>

        <div className="home-footer__bottom">
          <p className="home-footer__copyright">© Botivate 2026</p>
          <nav aria-label="Legal and support links" className="home-footer__legal">
            <Link to="/privacy-policy">Privacy policy</Link>
            <Link to="/terms-of-service">Terms</Link>
            <Link to="/delete-account">Delete account</Link>
            <a href="mailto:info@botivate.in">Contact</a>
          </nav>
          <nav aria-label="Footer navigation" className="home-footer__product">
            <a href="#how-it-works">How it works</a>
            <a href="#calendar">Calendar</a>
            <a href="#get-the-app">Get the app</a>
          </nav>
          <Link
            to={isAuthenticated ? '/dashboard' : '/login?mode=signup'}
            className="home-footer__button"
          >
            {isAuthenticated ? 'Open planner' : 'Start planning'} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
