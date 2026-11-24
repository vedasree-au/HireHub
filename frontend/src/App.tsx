import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Bookmark, BriefcaseBusiness, Building2,
  Check, CheckCircle2, ChevronDown, CircleUserRound, Clock3, FileText, Filter, LayoutDashboard,
  LogOut, MapPin, Menu, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, Users,
  X,
} from 'lucide-react';
import { api } from './lib/api';

type Job = {
  id: number;
  title: string;
  company: string;
  description: string;
  location: string;
  employment_type: string;
  workplace_type: string;
  required_skills: string;
  preferred_skills?: string;
  min_experience?: number;
  max_experience?: number;
  salary_min?: number | null;
  salary_max?: number | null;
  status?: string;
  created_at?: string;
};
type User = { id: number; name: string; email: string; role: string };
type Profile = {
  phone: string;
  location: string;
  summary: string;
  skills: string;
  education: string;
  experience: string;
  linkedin_url: string;
  portfolio_url: string;
  github_url: string;
};
type ApplicationDetail = {
  id: number;
  status: string;
  created_at: string;
  job: Pick<Job, 'id' | 'title' | 'company' | 'location'>;
  resume: { id: number; filename: string } | null;
};
type RecruiterApplication = {
  application: { id: number; status: string; created_at: string; resume_id: number | null };
  job: { id: number; title: string };
  candidate: { id: number; name: string; email: string };
};
type MatchResult = {
  score: number;
  matching_keywords?: string[];
  missing_keywords?: string[];
  job_keywords_not_found_in_resume?: string[];
  explanation?: string;
  notice?: string;
  method?: string;
};
type Resume = { id: number; filename: string; is_default: boolean; created_at: string };
type Feedback = { message: string; kind: 'success' | 'error' } | null;

const emptyProfile: Profile = {
  phone: '', location: '', summary: '', skills: '', education: '', experience: '',
  linkedin_url: '', portfolio_url: '', github_url: '',
};

function getUser(): User | null {
  try {
    const user = JSON.parse(localStorage.getItem('hirehub_user') || 'null') as User | null;
    return user && typeof user.id === 'number' && typeof user.role === 'string' ? user : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === 'string') return response.data.detail;
  }
  return fallback;
}

function formatDate(value?: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatSalary(job: Pick<Job, 'salary_min' | 'salary_max'>): string | null {
  if (job.salary_min == null && job.salary_max == null) return null;
  const format = (amount: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
  if (job.salary_min != null && job.salary_max != null) return `${format(job.salary_min)} – ${format(job.salary_max)}`;
  return job.salary_min != null ? `From ${format(job.salary_min)}` : `Up to ${format(job.salary_max!)}`;
}

function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return { feedback, setFeedback };
}

function FeedbackBanner({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  if (!feedback) return null;
  return (
    <div className={`feedback feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      {feedback.kind === 'success' ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
      <span>{feedback.message}</span>
      <button className="icon-button" aria-label="Dismiss notification" onClick={onClose}><X size={16} /></button>
    </div>
  );
}

function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}…</div>;
}

function EmptyState({ icon: Icon = Search, title, description, action }: {
  icon?: typeof Search; title: string; description: string; action?: ReactNode;
}) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function Header() {
  const navigate = useNavigate();
  const user = getUser();
  const [open, setOpen] = useState(false);
  const signOut = () => {
    localStorage.removeItem('hirehub_token');
    localStorage.removeItem('hirehub_user');
    navigate('/');
  };
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="HireHub home"><span className="brand-mark">H</span><span>hire<span className="brand-accent">hub</span></span></Link>
        <button className="mobile-menu icon-button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        <nav className={`main-nav ${open ? 'nav-open' : ''}`} aria-label="Main navigation">
          <Link to="/" onClick={() => setOpen(false)}>Home</Link>
          <Link to="/jobs" onClick={() => setOpen(false)}>Find jobs</Link>
          {user && <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>}
          <a href="/#about" onClick={() => setOpen(false)}>About</a>
          <a href="/#contact" onClick={() => setOpen(false)}>Contact</a>
          {user && <Link className="nav-mobile-only" to="/notifications" onClick={() => setOpen(false)}>Notifications</Link>}
          {user && <button className="nav-mobile-only nav-signout" onClick={() => { setOpen(false); signOut(); }}><LogOut size={15} /> Sign out</button>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link className="header-user" to="/dashboard"><CircleUserRound size={17} /> {user.name}</Link>
              <Link className="button button-quiet header-desktop" to="/notifications" aria-label="Notifications"><Bell size={17} /></Link>
              <button className="button button-outline header-desktop" onClick={signOut}><LogOut size={16} /> Sign out</button>
            </>
          ) : (
            <>
              <Link className="header-login" to="/login">Log in</Link>
              <Link className="button button-primary button-small" to="/register">Create account <ArrowUpRight size={15} /></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-inner">
        <div><Link className="brand" to="/"><span className="brand-mark">H</span><span>hire<span className="brand-accent">hub</span></span></Link><p>Better connections between people and opportunity.</p></div>
        <div className="footer-links"><Link to="/jobs">Find jobs</Link><Link to="/register/candidate">For candidates</Link><Link to="/register/recruiter">For recruiters</Link><a href="/#about">About HireHub</a></div>
        <span className="copyright">© {new Date().getFullYear()} HireHub</span>
      </div>
    </footer>
  );
}

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const user = getUser();
  if (!user || !localStorage.getItem('hirehub_token')) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function JobCard({ job, action, saved, onSave, applicationStatus }: {
  job: Job; action?: ReactNode; saved?: boolean; onSave?: () => void; applicationStatus?: string;
}) {
  const salary = formatSalary(job);
  const skills = (job.required_skills || '').split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean).slice(0, 3);
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className="company-mark" aria-hidden="true">{job.company?.trim().charAt(0).toUpperCase() || <Building2 size={18} />}</div>
        <span className="pill pill-neutral">{job.employment_type}</span>
        {applicationStatus && <StatusBadge status={applicationStatus} />}
        {onSave && <button className={`icon-button save-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remove saved job' : 'Save job'} onClick={onSave}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button>}
      </div>
      <Link className="job-title-link" to={`/jobs/${job.id}`}><h3>{job.title}</h3></Link>
      <p className="job-company">{job.company}</p>
      <div className="job-attributes">
        <span><MapPin size={14} />{job.location || 'Location not specified'}</span>
        <span><BriefcaseBusiness size={14} />{job.workplace_type}</span>
        {job.min_experience || job.max_experience ? <span><Clock3 size={14} />{job.min_experience || 0}{job.max_experience ? `–${job.max_experience}` : '+'} yrs experience</span> : null}
      </div>
      {salary && <p className="job-salary">{salary}<span> · salary range</span></p>}
      {skills.length > 0 && <div className="skill-list">{skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div>}
      <div className="job-card-footer">
        {job.created_at && <span className="posted-date">Posted {formatDate(job.created_at)}</span>}
        {action || <Link className="text-link" to={`/jobs/${job.id}`}>View details <ArrowRight size={15} /></Link>}
      </div>
    </article>
  );
}

function Home() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<{ published_jobs: number; candidates: number; recruiters: number } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.get<Job[]>('/jobs', { params: { limit: 3 } }), api.get('/public/stats')])
      .then(([jobResponse, statsResponse]) => { setJobs(jobResponse.data); setStats(statsResponse.data); })
      .catch((cause: unknown) => setError(errorMessage(cause, 'Featured opportunities are temporarily unavailable.')))
      .finally(() => setLoading(false));
  }, []);
  const search = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (location.trim()) params.set('location', location.trim());
    if (employmentType) params.set('employment_type', employmentType);
    navigate(`/jobs${params.size ? `?${params.toString()}` : ''}`);
  };
  const statsItems = stats ? [
    { value: stats.published_jobs, label: 'Published opportunities' },
    { value: stats.candidates, label: 'Active candidates' },
    { value: stats.recruiters, label: 'Hiring teams' },
  ] : [];
  return (
    <>
      <main>
        <section className="hero-section">
          <div className="hero-layout content-width">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> A more thoughtful way to find work</span>
              <h1>Find the work that<br /><span>moves you forward.</span></h1>
              <p className="hero-description">Discover opportunities that match your skills and ambitions. HireHub brings candidates and hiring teams together with clarity at every step.</p>
              <form className="hero-search" onSubmit={search}>
                <label><Search size={18} /><span className="sr-only">Keyword</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Job title or keyword" /></label>
                <label><MapPin size={18} /><span className="sr-only">Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" /></label>
                <label className="hero-search-type"><BriefcaseBusiness size={18} /><span className="sr-only">Employment type</span><select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="">All job types</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label>
                <button className="button button-primary" type="submit">Find jobs <ArrowRight size={16} /></button>
              </form>
              <div className="hero-trust"><span><ShieldCheck size={16} /> Candidate-first experience</span><span><Sparkles size={16} /> Explainable AI assistance</span></div>
            </div>
            <div className="hero-aside" aria-label="HireHub benefits">
              <div className="hero-aside-card"><span className="aside-icon"><Target size={19} /></span><div><strong>Find your fit</strong><p>Explore roles aligned with your skills and goals.</p></div><ArrowUpRight size={17} className="aside-arrow" /></div>
              <div className="hero-aside-card"><span className="aside-icon teal"><Sparkles size={19} /></span><div><strong>Make informed decisions</strong><p>See transparent, advisory resume match insights.</p></div><ArrowUpRight size={17} className="aside-arrow" /></div>
              <div className="hero-aside-card"><span className="aside-icon green"><CheckCircle2 size={19} /></span><div><strong>Keep the process clear</strong><p>Track applications and updates in one place.</p></div><ArrowUpRight size={17} className="aside-arrow" /></div>
              <div className="hero-aside-note"><ShieldCheck size={16} /><span>AI matching is an aid for review—not a hiring decision.</span></div>
            </div>
          </div>
        </section>

        {stats && <section className="trust-stats content-width" aria-label="HireHub platform statistics">{statsItems.map((item) => <div key={item.label}><strong>{item.value.toLocaleString()}</strong><span>{item.label}</span></div>)}</section>}

        <section className="section-block content-width" id="featured">
          <div className="section-heading"><div><span className="eyebrow">CURATED OPPORTUNITIES</span><h2>Featured roles</h2><p>Explore the latest openings from hiring teams on HireHub.</p></div><Link className="button button-outline" to="/jobs">Browse all jobs <ArrowRight size={16} /></Link></div>
          {error ? <div className="inline-error" role="alert">{error}</div> : loading ? <Loading label="Loading featured jobs" /> : jobs.length ? <div className="job-grid">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <EmptyState title="New opportunities are on the way" description="There are no published jobs to feature right now. Check back soon or explore all listings." action={<Link className="text-link" to="/jobs">Browse jobs <ArrowRight size={15} /></Link>} />}
        </section>

        <section className="how-section" id="about">
          <div className="content-width">
            <div className="section-heading centered"><div><span className="eyebrow">HOW HIREHUB WORKS</span><h2>Good hiring starts with clarity.</h2><p>A simpler path from discovery to the next step.</p></div></div>
            <div className="steps-grid">
              <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Search size={21} /></div><h3>Discover opportunities</h3><p>Search real listings by role, location, workplace, and employment type.</p></article>
              <article className="step-card"><span className="step-number">02</span><div className="step-icon"><FileText size={21} /></div><h3>Showcase your experience</h3><p>Build your profile, manage your resume, and apply to roles that fit.</p></article>
              <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Bell size={21} /></div><h3>Stay in the loop</h3><p>Follow application updates and keep your next steps in one place.</p></article>
            </div>
          </div>
        </section>

        <section className="section-block content-width">
          <div className="section-heading centered"><div><span className="eyebrow">BUILT FOR BOTH SIDES</span><h2>A better experience, end to end.</h2></div></div>
          <div className="audience-grid">
            <article className="audience-card candidate-audience"><span className="audience-icon"><Users size={20} /></span><span className="eyebrow">FOR CANDIDATES</span><h3>Your next move, made clearer.</h3><p>Find relevant roles, present your experience, and keep track of every application from a personal workspace.</p><ul><li><Check size={16} /> Personalized job recommendations</li><li><Check size={16} /> Resume and profile management</li><li><Check size={16} /> Application status updates</li></ul><Link className="text-link" to="/register/candidate">Create a candidate account <ArrowRight size={15} /></Link></article>
            <article className="audience-card recruiter-audience"><span className="audience-icon"><Building2 size={20} /></span><span className="eyebrow">FOR RECRUITERS</span><h3>Bring your hiring workflow together.</h3><p>Publish opportunities, review incoming applications, and manage candidate progress in one workspace.</p><ul><li><Check size={16} /> Job publishing and management</li><li><Check size={16} /> Applicant review and status updates</li><li><Check size={16} /> Advisory resume matching insights</li></ul><Link className="text-link" to="/register/recruiter">Create a recruiter account <ArrowRight size={15} /></Link></article>
          </div>
        </section>
        <section className="cta-section"><div className="content-width cta-inner"><div><span className="eyebrow">YOUR NEXT STEP STARTS HERE</span><h2>Find a role that feels like progress.</h2><p>Explore opportunities or create an account to make your search your own.</p></div><Link className="button button-primary" to="/jobs">Explore open roles <ArrowRight size={16} /></Link></div></section>
      </main>
    </>
  );
}

function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [employmentType, setEmploymentType] = useState(searchParams.get('employment_type') || '');
  const [workplaceType, setWorkplaceType] = useState(searchParams.get('workplace_type') || '');
  const [sort, setSort] = useState('newest');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<number, string>>({});
  const user = getUser();
  const { feedback, setFeedback } = useFeedback();

  const load = async (nextSkip = 0, append = false) => {
    setLoading(true);
    setError('');
    const params: Record<string, string | number> = { skip: nextSkip, limit: 20, sort };
    if (keyword.trim()) params.q = keyword.trim();
    if (location.trim()) params.location = location.trim();
    if (employmentType) params.employment_type = employmentType;
    if (workplaceType) params.workplace_type = workplaceType;
    try {
      const { data } = await api.get<Job[]>('/jobs', { params });
      setJobs((current) => append ? [...current, ...data] : data);
      setHasMore(data.length === 20);
      setSkip(nextSkip);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load jobs. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.role === 'candidate') api.get<Job[]>('/saved-jobs').then(({ data }) => setSavedIds(data.map((job) => job.id))).catch((cause: unknown) => setFeedback({ message: errorMessage(cause, 'Saved jobs could not be loaded.'), kind: 'error' }));
    if (user?.role === 'candidate') api.get<Array<{ job_id: number; status: string }>>('/applications/me').then(({ data }) => setApplicationStatuses(Object.fromEntries(data.map((application) => [application.job_id, application.status])))).catch((cause: unknown) => setFeedback({ message: errorMessage(cause, 'Application statuses could not be loaded.'), kind: 'error' }));
  }, []);
  useEffect(() => { load(0); }, [searchParams, sort]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (location.trim()) params.set('location', location.trim());
    if (employmentType) params.set('employment_type', employmentType);
    if (workplaceType) params.set('workplace_type', workplaceType);
    setSearchParams(params);
  };
  const apply = async (job: Job) => {
    if (!user || user.role !== 'candidate') {
      setFeedback({ message: 'Sign in with a candidate account to apply for a role.', kind: 'error' });
      return;
    }
    try {
      await api.post(`/jobs/${job.id}/apply`, {});
      setApplicationStatuses((current) => ({ ...current, [job.id]: 'Applied' }));
      setFeedback({ message: `Your application for ${job.title} was submitted.`, kind: 'success' });
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not submit your application.'), kind: 'error' }); }
  };
  const save = async (job: Job) => {
    if (!user || user.role !== 'candidate') {
      setFeedback({ message: 'Sign in with a candidate account to save jobs.', kind: 'error' });
      return;
    }
    try {
      if (savedIds.includes(job.id)) {
        await api.delete(`/jobs/${job.id}/save`);
        setSavedIds((current) => current.filter((id) => id !== job.id));
        setFeedback({ message: 'Job removed from your saved list.', kind: 'success' });
      } else {
        await api.post(`/jobs/${job.id}/save`);
        setSavedIds((current) => [...current, job.id]);
        setFeedback({ message: 'Job saved to your list.', kind: 'success' });
      }
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not update your saved jobs.'), kind: 'error' }); }
  };
  return (
    <main className="page-shell content-width">
      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
      <div className="page-intro"><span className="eyebrow">OPPORTUNITIES</span><h1>Find your next role.</h1><p>Explore published jobs and filter for the opportunities that fit.</p></div>
      <div className="jobs-layout">
        <aside className="filter-panel">
          <div className="filter-heading"><SlidersHorizontal size={17} /><strong>Filters</strong><span><Filter size={14} /> Refine</span></div>
          <form onSubmit={submitSearch}>
            <label>Keywords<div className="input-with-icon"><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Role, skill, company" /></div></label>
            <label>Location<div className="input-with-icon"><MapPin size={16} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or region" /></div></label>
            <label>Employment type<select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="">All types</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label>
            <label>Workplace<select value={workplaceType} onChange={(event) => setWorkplaceType(event.target.value)}><option value="">All workplaces</option><option>Remote</option><option>Hybrid</option><option>Onsite</option></select></label>
            <button className="button button-primary filter-submit" type="submit">Show matching jobs</button>
          </form>
        </aside>
        <section className="results-section" aria-label="Job search results">
          <div className="results-toolbar"><div><h2>Open positions</h2><p>Listings are shown using your selected filters.</p></div><label className="sort-control">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Most recent</option><option value="oldest">Oldest</option></select><ChevronDown size={14} /></label></div>
          {error ? <div className="inline-error" role="alert">{error} <button className="text-link" onClick={() => load(skip)}>Try again</button></div> : loading && jobs.length === 0 ? <Loading label="Loading opportunities" /> : jobs.length === 0 ? <EmptyState title="No roles match those filters" description="Try a different keyword or broaden your search." action={<button className="button button-outline" onClick={() => { setKeyword(''); setLocation(''); setEmploymentType(''); setWorkplaceType(''); setSearchParams({}); }}>Clear filters</button>} /> : <div className="job-grid">{jobs.map((job) => {
            const applicationStatus = applicationStatuses[job.id];
            const action = applicationStatus
              ? <Link className="text-link" to="/applications">View application <ArrowRight size={15} /></Link>
              : user?.role === 'candidate'
                ? <button className="text-link" onClick={() => apply(job)}>Apply now <ArrowUpRight size={15} /></button>
                : !user ? <Link className="text-link" to="/login">Sign in to apply <ArrowRight size={15} /></Link> : undefined;
            return <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} applicationStatus={applicationStatus} onSave={user?.role === 'candidate' ? () => save(job) : undefined} action={action} />;
          })}</div>}
          {loading && jobs.length > 0 && <Loading label="Updating results" />}
          {!loading && hasMore && <div className="load-more"><button className="button button-outline" onClick={() => load(skip + 20, true)}>Load more opportunities <ArrowRight size={16} /></button></div>}
        </section>
      </div>
    </main>
  );
}

function ReportDialog({ jobId, onClose, onFeedback }: { jobId: number; onClose: () => void; onFeedback: (feedback: Feedback) => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post(`/jobs/${jobId}/report`, null, { params: { reason } });
      onFeedback({ message: 'Thank you. The report was submitted for review.', kind: 'success' });
      onClose();
    } catch (cause) { onFeedback({ message: errorMessage(cause, 'Could not submit the report.'), kind: 'error' }); }
    finally { setLoading(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="report-title"><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X /></button><span className="eyebrow">JOB LISTING</span><h2 id="report-title">Report this opportunity</h2><p>Tell us why this listing should be reviewed. Reports are sent to the HireHub administrator.</p><form onSubmit={submit}><label>Reason<textarea required minLength={5} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit report'}</button></div></form></section></div>;
}

function JobDetail() {
  const { jobId } = useParams();
  const user = getUser();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const { feedback, setFeedback } = useFeedback();
  useEffect(() => {
    api.get<Job>(`/jobs/${jobId}`).then(({ data }) => setJob(data)).catch((cause: unknown) => setError(errorMessage(cause, 'This job could not be loaded.'))).finally(() => setLoading(false));
    if (user?.role === 'candidate') api.get<Job[]>('/saved-jobs').then(({ data }) => setSaved(data.some((item) => item.id === Number(jobId)))).catch((cause: unknown) => setFeedback({ message: errorMessage(cause, 'Saved jobs could not be loaded.'), kind: 'error' }));
    if (user?.role === 'candidate') api.get<Array<{ job_id: number; status: string }>>('/applications/me').then(({ data }) => setApplicationStatus(data.find((item) => item.job_id === Number(jobId))?.status || '')).catch((cause: unknown) => setFeedback({ message: errorMessage(cause, 'Application status could not be loaded.'), kind: 'error' }));
  }, [jobId]);
  const apply = async () => {
    if (!job) return;
    if (!user || user.role !== 'candidate') { setFeedback({ message: 'Sign in with a candidate account to apply for a role.', kind: 'error' }); return; }
    if (applicationStatus) { setFeedback({ message: `You have already applied. Current status: ${applicationStatus}.`, kind: 'error' }); return; }
    try { await api.post(`/jobs/${job.id}/apply`, {}); setApplicationStatus('Applied'); setFeedback({ message: 'Your application was submitted.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not submit your application.'), kind: 'error' }); }
  };
  const save = async () => {
    if (!job || user?.role !== 'candidate') { setFeedback({ message: 'Sign in with a candidate account to save jobs.', kind: 'error' }); return; }
    try {
      if (saved) await api.delete(`/jobs/${job.id}/save`);
      else await api.post(`/jobs/${job.id}/save`);
      setSaved(!saved);
      setFeedback({ message: saved ? 'Job removed from your saved list.' : 'Job saved to your list.', kind: 'success' });
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not update your saved jobs.'), kind: 'error' }); }
  };
  const getMatch = async () => {
    if (!job || user?.role !== 'candidate') { setFeedback({ message: 'Sign in with a candidate account to compare your resume.', kind: 'error' }); return; }
    try { const { data } = await api.post<MatchResult>(`/ai/match-job/${job.id}`); setMatch(data); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Upload a default resume before requesting a match.'), kind: 'error' }); }
  };
  if (loading) return <main className="page-shell content-width"><Loading label="Loading job details" /></main>;
  if (error || !job) return <main className="page-shell content-width"><div className="inline-error">{error || 'Job not found.'}</div><Link className="button button-outline" to="/jobs">Back to jobs</Link></main>;
  const skills = (job.required_skills || '').split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean);
  const preferred = (job.preferred_skills || '').split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean);
  return (
    <main className="page-shell content-width">
      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
      <Link to="/jobs" className="back-link">← Back to jobs</Link>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-heading"><div className="company-mark company-mark-large">{job.company.charAt(0).toUpperCase()}</div><div><span className="eyebrow">OPEN OPPORTUNITY</span><h1>{job.title}</h1><p>{job.company} <span>·</span> {job.location}</p></div></div>
          <div className="detail-pills"><span className="pill pill-neutral">{job.employment_type}</span><span className="pill pill-neutral">{job.workplace_type}</span>{applicationStatus && <StatusBadge status={applicationStatus} />}{job.created_at && <span className="posted-date">Posted {formatDate(job.created_at)}</span>}</div>
          <section className="detail-section"><h2>About the role</h2><p className="description-copy">{job.description}</p></section>
          {skills.length > 0 && <section className="detail-section"><h2>Required skills</h2><div className="skill-list">{skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div></section>}
          {preferred.length > 0 && <section className="detail-section"><h2>Preferred skills</h2><div className="skill-list">{preferred.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div></section>}
          {(job.min_experience || job.max_experience) && <section className="detail-section"><h2>Experience</h2><p>{job.min_experience || 0}{job.max_experience ? `–${job.max_experience}` : '+'} years</p></section>}
          <section className="detail-section"><h2>About the company</h2><p>{job.company}</p><p className="muted-copy">Company details are provided by the recruiter who published this role.</p></section>
        </article>
        <aside className="detail-sidebar">
          <div className="detail-action-card"><h2>Role overview</h2><div className="overview-item"><MapPin size={17} /><div><span>Location</span><strong>{job.location || 'Not specified'}</strong></div></div><div className="overview-item"><BriefcaseBusiness size={17} /><div><span>Employment</span><strong>{job.employment_type}</strong></div></div>{formatSalary(job) && <div className="overview-item"><Building2 size={17} /><div><span>Salary range</span><strong>{formatSalary(job)}</strong></div></div>}{(job.min_experience || job.max_experience) && <div className="overview-item"><Clock3 size={17} /><div><span>Experience</span><strong>{job.min_experience || 0}{job.max_experience ? `–${job.max_experience}` : '+'} years</strong></div></div>}{applicationStatus ? <Link className="button button-primary button-full" to="/applications">View application status <ArrowRight size={16} /></Link> : user?.role === 'candidate' ? <button className="button button-primary button-full" onClick={apply}>Apply for this role <ArrowRight size={16} /></button> : !user ? <Link className="button button-primary button-full" to="/login">Sign in to apply <ArrowRight size={16} /></Link> : <p className="muted-copy">Candidate accounts can apply to this role.</p>}{user?.role === 'candidate' && <><button className="button button-outline button-full" onClick={save}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save role'}</button><button className="button button-quiet button-full" onClick={getMatch}><Sparkles size={16} />Check resume match</button></>}</div>
          <p className="privacy-note"><ShieldCheck size={16} /> Resume matching is advisory and does not determine hiring outcomes.</p>
          {user && <button className="text-link report-link" onClick={() => setReportOpen(true)}>Report this listing</button>}
        </aside>
      </div>
      {match && <MatchDialog result={match} onClose={() => setMatch(null)} />}
      {reportOpen && <ReportDialog jobId={job.id} onClose={() => setReportOpen(false)} onFeedback={setFeedback} />}
    </main>
  );
}

function MatchDialog({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  const matching = result.matching_keywords || [];
  const missing = result.missing_keywords || result.job_keywords_not_found_in_resume || [];
  const score = Math.max(0, Math.min(100, result.score));
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card match-modal" role="dialog" aria-modal="true" aria-labelledby="match-title">
        <button className="icon-button modal-close" aria-label="Close match details" onClick={onClose}><X /></button>
        <span className="eyebrow"><Sparkles size={14} /> RESUME INSIGHT</span><h2 id="match-title">Your resume match</h2>
        <div className="match-score-row"><div className="match-score" aria-label={`${score}% similarity score`}>{score}<span>%</span></div><div><strong>Text similarity</strong><p>Advisory comparison with this job description</p></div></div>
        <div className="progress-track"><span style={{ width: `${score}%` }} /></div>
        {result.explanation && <p className="match-explanation">{result.explanation}</p>}
        {matching.length > 0 && <section className="match-keywords"><h3><CheckCircle2 size={16} /> Detected matching terms</h3><div className="skill-list">{matching.map((skill) => <span className="skill-chip skill-match" key={skill}>{skill}</span>)}</div></section>}
        {missing.length > 0 && <section className="match-keywords"><h3><Target size={16} /> Terms not detected in the resume</h3><div className="skill-list">{missing.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div></section>}
        {result.method && <p className="match-method">Method: {result.method}</p>}
        {result.notice && <p className="match-notice"><ShieldCheck size={16} />{result.notice}</p>}
        <button className="button button-primary button-full" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

function Auth({ register = false, initialRole }: { register?: boolean; initialRole?: 'candidate' | 'recruiter' }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: initialRole || 'candidate' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(register ? '/auth/register' : '/auth/login', form);
      localStorage.setItem('hirehub_token', data.access_token);
      localStorage.setItem('hirehub_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (cause) { setError(errorMessage(cause, 'We could not complete your request. Please try again.')); }
    finally { setLoading(false); }
  };
  return (
    <main className="auth-page">
      <div className="auth-aside"><Link className="brand brand-light" to="/"><span className="brand-mark">H</span><span>hire<span className="brand-accent">hub</span></span></Link><div><span className="eyebrow">A MORE THOUGHTFUL WAY TO HIRE</span><h1>Build the next chapter of your career.</h1><p>Explore opportunities, manage applications, and make informed decisions with HireHub.</p></div><div className="auth-aside-foot"><ShieldCheck size={17} /> Your account and resume remain under your control.</div></div>
      <div className="auth-form-wrap"><form className="auth-card" onSubmit={submit}>
        <Link className="auth-back" to="/">← Back to HireHub</Link>
        <span className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span>
        <h2>{register ? 'Start with HireHub' : 'Sign in to your account'}</h2>
        <p>{register ? 'Set up your workspace to get started.' : 'Continue your job search or hiring workflow.'}</p>
        {register && <div className="role-choice" role="group" aria-label="Account type"><button type="button" className={form.role === 'candidate' ? 'selected' : ''} onClick={() => setForm({ ...form, role: 'candidate' })}><Users size={17} />Candidate</button><button type="button" className={form.role === 'recruiter' ? 'selected' : ''} onClick={() => setForm({ ...form, role: 'recruiter' })}><Building2 size={17} />Recruiter</button></div>}
        {register && <label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your full name" /></label>}
        <label>Email address<input autoComplete="email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
        <label htmlFor="auth-password">Password</label><div className="password-field"><input id="auth-password" autoComplete={register ? 'new-password' : 'current-password'} required type={showPassword ? 'text' : 'password'} minLength={register ? 8 : undefined} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={register ? 'At least 8 characters' : 'Enter your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-full auth-submit" disabled={loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button>
        <p className="auth-switch">{register ? 'Already have an account?' : 'New to HireHub?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
        <p className="auth-privacy"><ShieldCheck size={14} /> Your information is only used to support your HireHub workflow.</p>
      </form></div>
    </main>
  );
}

function DashboardLayout({ user, children }: { user: User; children: ReactNode }) {
  const links = user.role === 'candidate'
    ? [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { to: '/applications', label: 'My applications', icon: FileText }, { to: '/jobs', label: 'Browse jobs', icon: Search }, { to: '/profile', label: 'My profile & resume', icon: CircleUserRound }]
    : user.role === 'recruiter'
      ? [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { to: '/manage-jobs', label: 'Manage jobs', icon: BriefcaseBusiness }, { to: '/applications', label: 'Applicants', icon: Users }, { to: '/profile', label: 'Company profile', icon: Building2 }]
      : [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard }];
  return (
    <div className="workspace content-width">
      <aside className="workspace-nav"><div className="workspace-label">WORKSPACE</div><div className="workspace-person"><span className="avatar">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.role}</span></div></div><nav aria-label="Workspace navigation">{links.map(({ to, label, icon: Icon }) => <Link className={location.pathname === to ? 'active' : ''} key={to} to={to}><Icon size={17} />{label}</Link>)}<Link to="/notifications"><Bell size={17} />Notifications</Link></nav><Link className="workspace-browse" to="/jobs"><Search size={17} />Explore opportunities</Link></aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'blue', footnote }: { icon: typeof Users; label: string; value: number | string; tone?: string; footnote?: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-label">{label}</span><strong>{value}</strong>{footnote && <span className="stat-footnote">{footnote}</span>}</article>;
}

function CandidateDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<{ applications: number; saved_jobs: number; resumes: number; statuses: Record<string, number> } | null>(null);
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [recommended, setRecommended] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.get('/candidate/dashboard'), api.get<ApplicationDetail[]>('/applications/me/details'), api.get<Job[]>('/recommendations/jobs'), api.get('/candidate/profile')])
      .then(([dashboard, applicationData, recommendationData, profileData]) => { setStats(dashboard.data); setApplications(applicationData.data); setRecommended(recommendationData.data.slice(0, 3)); setProfile({ ...emptyProfile, ...(profileData.data || {}) }); })
      .catch((cause: unknown) => setError(errorMessage(cause, 'Your dashboard could not be loaded.')))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <DashboardLayout user={user}><Loading label="Loading your dashboard" /></DashboardLayout>;
  if (error || !stats) return <DashboardLayout user={user}><div className="inline-error" role="alert">{error || 'Dashboard data is unavailable.'}</div></DashboardLayout>;
  const pending = (stats.statuses.Applied || 0) + (stats.statuses['Under Review'] || 0);
  const shortlisted = (stats.statuses.Shortlisted || 0) + (stats.statuses['Interview Scheduled'] || 0);
  const completedFields = [user.name, user.email, profile.phone, profile.location, profile.summary, profile.skills, profile.education, profile.experience, profile.linkedin_url, profile.portfolio_url, profile.github_url, stats.resumes > 0 ? 'resume' : ''].filter((value) => Boolean(value?.trim())).length;
  const profileCompletion = Math.round(completedFields / 12 * 100);
  return (
    <DashboardLayout user={user}>
      <div className="workspace-heading"><div><span className="eyebrow">CANDIDATE WORKSPACE</span><h1>Good to see you, {user.name.split(' ')[0]}.</h1><p>Here is a snapshot of your job search and next steps.</p></div><Link className="button button-primary" to="/jobs">Browse jobs <ArrowRight size={16} /></Link></div>
      <div className="candidate-overview">
        <StatCard icon={FileText} label="Applications" value={stats.applications} footnote="Across all roles" />
        <StatCard icon={Clock3} label="In progress" value={pending} tone="amber" footnote="Applied or under review" />
        <StatCard icon={CheckCircle2} label="Shortlisted" value={shortlisted} tone="green" footnote="Shortlisted or interviewing" />
        <StatCard icon={X} label="Rejected" value={stats.statuses.Rejected || 0} tone="red" footnote="Applications declined" />
        <StatCard icon={Bookmark} label="Saved jobs" value={stats.saved_jobs} tone="teal" footnote={`${stats.resumes} resume${stats.resumes === 1 ? '' : 's'} on file`} />
      </div>
      <section className="workspace-card profile-progress-card"><div className="progress-copy"><span className="progress-icon"><Target size={19} /></span><div><strong>Profile completeness · {profileCompletion}%</strong><p>Add skills and experience to help recruiters understand your background.</p><div className="completion-track dashboard-completion"><span style={{ width: `${profileCompletion}%` }} /></div></div></div><Link to="/profile" className="text-link">{profileCompletion === 100 ? 'Review profile' : 'Complete profile'} <ArrowRight size={15} /></Link></section>
      <div className="dashboard-columns">
        <section className="workspace-card"><div className="card-heading"><div><h2>Recommended jobs</h2><p>Suggestions based on your profile and available roles.</p></div><Link className="text-link" to="/jobs">See all <ArrowRight size={15} /></Link></div>
          {recommended.length ? <div className="compact-job-list">{recommended.map((job) => <Link className="compact-job" to={`/jobs/${job.id}`} key={job.id}><span className="company-mark">{job.company.charAt(0).toUpperCase()}</span><span><strong>{job.title}</strong><small>{job.company} · {job.location}</small></span><ArrowUpRight size={16} /></Link>)}</div> : <EmptyState title="No recommendations yet" description="New published opportunities will appear here as they become available." action={<Link className="text-link" to="/jobs">Browse jobs <ArrowRight size={15} /></Link>} />}
        </section>
        <section className="workspace-card"><div className="card-heading"><div><h2>Recent applications</h2><p>Track your latest application updates.</p></div><Link className="text-link" to="/applications">View all <ArrowRight size={15} /></Link></div>
          {applications.length ? <div className="activity-list">{applications.slice(0, 4).map((application) => <div className="activity-item" key={application.id}><span className="activity-dot" /><div><strong>{application.job.title}</strong><p>{application.job.company} · Applied {formatDate(application.created_at)}</p></div><StatusBadge status={application.status} /></div>)}</div> : <EmptyState icon={FileText} title="No applications yet" description="When you apply to a role, its progress will show up here." />}
        </section>
      </div>
    </DashboardLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['Shortlisted', 'Selected'].includes(status) ? 'success' : status === 'Rejected' ? 'danger' : status === 'Withdrawn' ? 'neutral' : status === 'Interview Scheduled' ? 'info' : 'warning';
  return <span className={`status-badge status-${tone}`}><span />{status}</span>;
}

function RecruiterDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<RecruiterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.get('/recruiter/dashboard'), api.get<Job[]>('/recruiter/jobs'), api.get<RecruiterApplication[]>('/recruiter/applications')])
      .then(([dashboard, jobData, applicationData]) => { setStats(dashboard.data); setJobs(jobData.data); setApplications(applicationData.data); })
      .catch((cause: unknown) => setError(errorMessage(cause, 'Your recruiter dashboard could not be loaded.')))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <DashboardLayout user={user}><Loading label="Loading your dashboard" /></DashboardLayout>;
  if (error || !stats) return <DashboardLayout user={user}><div className="inline-error" role="alert">{error || 'Dashboard data is unavailable.'}</div></DashboardLayout>;
  const pending = applications.filter(({ application }) => ['Applied', 'Under Review'].includes(application.status)).length;
  const shortlisted = applications.filter(({ application }) => application.status === 'Shortlisted').length;
  const jobPerformance = jobs.slice(0, 5).map((job) => ({ job, count: applications.filter((application) => application.job.id === job.id).length }));
  const maxApplications = Math.max(1, ...jobPerformance.map((item) => item.count));
  return (
    <DashboardLayout user={user}>
      <div className="workspace-heading"><div><span className="eyebrow">RECRUITER WORKSPACE</span><h1>Welcome back, {user.name.split(' ')[0]}.</h1><p>Review your hiring activity and keep your roles moving.</p></div><Link className="button button-primary" to="/manage-jobs#post-job"><Plus size={17} /> Post a job</Link></div>
      <div className="candidate-overview">
        <StatCard icon={BriefcaseBusiness} label="Total jobs" value={stats.total_jobs || 0} />
        <StatCard icon={CheckCircle2} label="Active listings" value={stats.active_jobs || 0} tone="green" />
        <StatCard icon={Users} label="Applications" value={stats.total_applications || 0} tone="teal" />
        <StatCard icon={Clock3} label="Awaiting review" value={pending} tone="amber" />
      </div>
      <div className="dashboard-columns">
        <section className="workspace-card"><div className="card-heading"><div><h2>Job performance</h2><p>Applications received for your recent postings.</p></div><Link className="text-link" to="/manage-jobs">Manage jobs <ArrowRight size={15} /></Link></div>
          {jobPerformance.length ? <div className="performance-list">{jobPerformance.map(({ job, count }) => <div className="performance-row" key={job.id}><div><strong>{job.title}</strong><span>{count} application{count === 1 ? '' : 's'}</span></div><div className="performance-track"><span style={{ width: `${Math.max(count ? 8 : 0, count / maxApplications * 100)}%` }} /></div></div>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No job posts yet" description="Post a role to begin receiving applications." action={<Link to="/manage-jobs#post-job" className="button button-primary">Post a job</Link>} />}
        </section>
        <section className="workspace-card"><div className="card-heading"><div><h2>Recent applicants</h2><p>Latest activity across your roles.</p></div><Link to="/applications" className="text-link">View applicants <ArrowRight size={15} /></Link></div>
          {applications.length ? <div className="activity-list">{applications.slice(0, 5).map(({ application, candidate, job }) => <div className="activity-item" key={application.id}><span className="avatar avatar-small">{candidate.name.charAt(0).toUpperCase()}</span><div><strong>{candidate.name}</strong><p>{job.title} · {formatDate(application.created_at)}</p></div><StatusBadge status={application.status} /></div>)}</div> : <EmptyState icon={Users} title="No applications received" description="New candidates will appear here when they apply." />}
        </section>
      </div>
      <section className="workspace-card shortlist-summary"><span className="stat-icon green"><CheckCircle2 size={19} /></span><div><strong>{shortlisted} shortlisted candidate{shortlisted === 1 ? '' : 's'}</strong><p>Across your current applicant pipeline.</p></div><Link className="text-link" to="/applications">Review candidates <ArrowRight size={15} /></Link></section>
    </DashboardLayout>
  );
}

function AdminDashboard({ user }: { user: User }) {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string; role: string; is_active: boolean }>>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<Array<{ id: number; job_id: number; reason: string; status: string }>>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/users'), api.get<Job[]>('/admin/jobs'), api.get('/admin/reports')])
      .then(([dashboard, userData, jobData, reportData]) => { setData(dashboard.data); setUsers(userData.data); setJobs(jobData.data); setReports(reportData.data); })
      .catch((cause: unknown) => setError(errorMessage(cause, 'Administration data could not be loaded.')));
  }, []);
  if (error) return <DashboardLayout user={user}><div className="inline-error" role="alert">{error}</div></DashboardLayout>;
  if (!data) return <DashboardLayout user={user}><Loading label="Loading administration overview" /></DashboardLayout>;
  return <DashboardLayout user={user}><div className="workspace-heading"><div><span className="eyebrow">PLATFORM ADMINISTRATION</span><h1>Platform overview</h1><p>Review platform activity and moderation queues.</p></div></div>
    <div className="candidate-overview">{Object.entries(data).filter(([, value]) => typeof value === 'number').map(([key, value]) => <StatCard key={key} icon={Users} label={key.replace(/_/g, ' ')} value={value} />)}</div>
    <section className="workspace-card"><div className="card-heading"><h2>Accounts</h2></div>{users.map((account) => <div className="admin-row" key={account.id}><div><strong>{account.name}</strong><p>{account.email} · {account.role}</p></div><button className="button button-outline button-small" onClick={async () => { try { await api.patch(`/admin/users/${account.id}/status`, null, { params: { active: !account.is_active } }); setUsers((current) => current.map((item) => item.id === account.id ? { ...item, is_active: !item.is_active } : item)); } catch (cause) { setError(errorMessage(cause, 'Could not update this account.')); } }}>{account.is_active ? 'Disable account' : 'Enable account'}</button></div>)}</section>
    <section className="workspace-card"><div className="card-heading"><h2>Job moderation</h2></div>{jobs.map((job) => <div className="admin-row" key={job.id}><div><strong>{job.title}</strong><p>{job.company} · {job.status}</p></div><select aria-label={`Moderation status for ${job.title}`} value={job.status} onChange={async (event) => { try { await api.patch(`/admin/jobs/${job.id}/status`, null, { params: { status: event.target.value } }); setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: event.target.value } : item)); } catch (cause) { setError(errorMessage(cause, 'Could not update job status.')); } }}><option>published</option><option>closed</option><option>draft</option><option>flagged</option></select></div>)}</section>
    <section className="workspace-card"><div className="card-heading"><h2>Reported listings</h2></div>{reports.map((report) => <div className="admin-row" key={report.id}><div><strong>Job #{report.job_id} · {report.status}</strong><p>{report.reason}</p></div><select aria-label={`Status for report ${report.id}`} value={report.status} onChange={async (event) => { try { await api.patch(`/admin/reports/${report.id}`, null, { params: { status: event.target.value } }); setReports((current) => current.map((item) => item.id === report.id ? { ...item, status: event.target.value } : item)); } catch (cause) { setError(errorMessage(cause, 'Could not update report status.')); } }}><option>open</option><option>resolved</option><option>dismissed</option></select></div>)}</section>
  </DashboardLayout>;
}

function Dashboard() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'candidate') return <CandidateDashboard user={user} />;
  if (user.role === 'recruiter') return <RecruiterDashboard user={user} />;
  if (user.role === 'admin') return <AdminDashboard user={user} />;
  return <Navigate to="/" replace />;
}

function ProfilePage() {
  const user = getUser()!;
  const candidate = user.role === 'candidate';
  const [profile, setProfile] = useState<Profile & { company_name?: string; website?: string; description?: string }>({ ...emptyProfile });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [recruiterJobs, setRecruiterJobs] = useState<Job[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { feedback, setFeedback } = useFeedback();
  const fetchProfile = async () => {
    setLoading(true);
    try {
      if (candidate) {
        const [profileResponse, resumeResponse] = await Promise.all([api.get('/candidate/profile'), api.get<Resume[]>('/resumes')]);
        setProfile({ ...emptyProfile, ...(profileResponse.data || {}) });
        setResumes(resumeResponse.data);
      } else {
        const [profileResponse, jobsResponse] = await Promise.all([api.get('/recruiter/profile'), api.get<Job[]>('/recruiter/jobs')]);
        setProfile({ ...emptyProfile, company_name: '', website: '', description: '', ...(profileResponse.data || {}) });
        setRecruiterJobs(jobsResponse.data);
      }
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Profile information could not be loaded.'), kind: 'error' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchProfile(); }, []);
  const filled = candidate
    ? [user.name, user.email, profile.phone, profile.location, profile.summary, profile.skills, profile.education, profile.experience, profile.linkedin_url, profile.portfolio_url, profile.github_url, resumes.length > 0 ? 'resume' : ''].filter((value) => Boolean(value?.trim())).length
    : [user.name, user.email, profile.company_name, profile.website, profile.description].filter((value) => Boolean(value?.trim())).length;
  const completion = Math.round(filled / (candidate ? 12 : 5) * 100);
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = candidate ? Object.fromEntries(Object.entries(profile).filter(([key]) => key in emptyProfile)) : { company_name: profile.company_name || '', website: profile.website || '', description: profile.description || '' };
      await api.put(candidate ? '/candidate/profile' : '/recruiter/profile', payload);
      setFeedback({ message: 'Profile changes saved.', kind: 'success' });
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not save your profile.'), kind: 'error' }); }
    finally { setSaving(false); }
  };
  const uploadResume = async () => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setFeedback({ message: 'Choose a PDF or DOCX file no larger than 5 MB.', kind: 'error' }); return; }
    const body = new FormData();
    body.append('file', file);
    try { await api.post('/resumes', body); setFile(null); await fetchProfile(); setFeedback({ message: 'Resume uploaded successfully.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Resume upload failed.'), kind: 'error' }); }
  };
  const downloadResume = async (resume: Resume) => {
    try {
      const { data } = await api.get(`/resumes/${resume.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = resume.filename; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not download this resume.'), kind: 'error' }); }
  };
  const deleteResume = async (resume: Resume) => {
    if (!window.confirm(`Delete "${resume.filename}"? This cannot be undone.`)) return;
    try { await api.delete(`/resumes/${resume.id}`); setResumes((current) => current.filter((item) => item.id !== resume.id)); setFeedback({ message: 'Resume deleted.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not delete this resume.'), kind: 'error' }); }
  };
  if (loading) return <DashboardLayout user={user}><Loading label="Loading your profile" /></DashboardLayout>;
  return <DashboardLayout user={user}>
    <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
    <div className="workspace-heading"><div><span className="eyebrow">{candidate ? 'CANDIDATE PROFILE' : 'RECRUITER PROFILE'}</span><h1>{candidate ? 'Your profile' : 'Company profile'}</h1><p>Keep your information current and ready for the next step.</p></div></div>
    <section className="workspace-card completion-card"><div><span className="eyebrow">PROFILE COMPLETION</span><strong>{completion}%</strong><p>{candidate ? 'A complete profile helps recruiters understand your experience.' : 'A complete company profile gives candidates more context.'}</p></div><div className="completion-track"><span style={{ width: `${completion}%` }} /></div></section>
    <section className="workspace-card"><form className="profile-form" onSubmit={saveProfile}>
      <div className="card-heading"><div><h2>{candidate ? 'Personal information' : 'Organization details'}</h2><p>Only enter information you want to share through your HireHub account.</p></div></div>
      {candidate ? <>
        <div className="form-grid"><label>Full name<input value={user.name} disabled /></label><label>Email address<input value={user.email} disabled /></label><label>Phone<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label><label>Location<input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="City or region" /></label><label className="form-span">Skills<input value={profile.skills} onChange={(event) => setProfile({ ...profile, skills: event.target.value })} placeholder="Separate skills with commas" /></label><label className="form-span">Professional summary<textarea rows={4} value={profile.summary} onChange={(event) => setProfile({ ...profile, summary: event.target.value })} /></label><label className="form-span">Education<textarea rows={3} value={profile.education} onChange={(event) => setProfile({ ...profile, education: event.target.value })} /></label><label className="form-span">Experience<textarea rows={4} value={profile.experience} onChange={(event) => setProfile({ ...profile, experience: event.target.value })} /></label><label>LinkedIn URL<input type="url" value={profile.linkedin_url} onChange={(event) => setProfile({ ...profile, linkedin_url: event.target.value })} /></label><label>Portfolio URL<input type="url" value={profile.portfolio_url} onChange={(event) => setProfile({ ...profile, portfolio_url: event.target.value })} /></label><label className="form-span">GitHub URL<input type="url" value={profile.github_url} onChange={(event) => setProfile({ ...profile, github_url: event.target.value })} /></label></div>
      </> : <>
        <div className="form-grid"><label>Recruiter name<input value={user.name} disabled /></label><label>Account email<input value={user.email} disabled /></label><label>Company name<input value={profile.company_name || ''} onChange={(event) => setProfile({ ...profile, company_name: event.target.value })} /></label><label>Company website<input type="url" value={profile.website || ''} onChange={(event) => setProfile({ ...profile, website: event.target.value })} /></label><label className="form-span">About the company<textarea rows={5} value={profile.description || ''} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></label></div>
      </>}
      <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={16} /></button>
    </form></section>
    {candidate && <section className="workspace-card"><div className="card-heading"><div><h2>Resume library</h2><p>Upload a PDF or DOCX resume, up to 5 MB. The default resume is used for applications and AI matching.</p></div></div>
      <div className="upload-row"><input type="file" accept=".pdf,.docx" aria-label="Choose a PDF or DOCX resume" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button className="button button-primary" disabled={!file} onClick={uploadResume}>Upload resume <ArrowUpRight size={16} /></button></div>
      {resumes.length ? <div className="resume-list">{resumes.map((resume) => <div className="resume-item" key={resume.id}><span className="resume-icon"><FileText size={18} /></span><div><strong>{resume.filename}</strong><p>{resume.is_default ? 'Default resume' : 'Uploaded'} · {formatDate(resume.created_at)}</p></div><div className="resume-actions"><button className="icon-button" aria-label={`Download ${resume.filename}`} onClick={() => downloadResume(resume)}><ArrowDownToLine size={17} /></button><button className="icon-button" aria-label={`Delete ${resume.filename}`} onClick={() => deleteResume(resume)}><X size={17} /></button></div></div>)}</div> : <EmptyState icon={FileText} title="No resumes uploaded" description="Add a resume to use matching insights and attach it to your applications." />}
    </section>}
    {!candidate && <section className="workspace-card"><div className="card-heading"><div><h2>Posted jobs</h2><p>Roles associated with your recruiter account.</p></div><Link className="text-link" to="/manage-jobs">Manage jobs <ArrowRight size={15} /></Link></div>{recruiterJobs.length ? <div className="managed-job-list">{recruiterJobs.map((job) => <div className="managed-job" key={job.id}><span className="company-mark">{job.company.charAt(0).toUpperCase()}</span><div><h3>{job.title}</h3><p>{job.company} · {job.location}</p><span className={`pill ${job.status === 'published' ? 'pill-success' : 'pill-neutral'}`}>{job.status}</span></div></div>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No jobs posted yet" description="Your published and draft roles will be listed here." action={<Link className="button button-primary" to="/manage-jobs#post-job">Post a job</Link>} />}</section>}
  </DashboardLayout>;
}

function ApplicationsPage() {
  const user = getUser()!;
  const candidate = user.role === 'candidate';
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [recruiterApplications, setRecruiterApplications] = useState<RecruiterApplication[]>([]);
  const [searchParams] = useSearchParams();
  const [filterJob, setFilterJob] = useState(searchParams.get('job_id') || '');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { feedback, setFeedback } = useFeedback();
  const reload = async () => {
    setLoading(true);
    try {
      if (candidate) {
        const { data } = await api.get<ApplicationDetail[]>('/applications/me/details');
        setApplications(data);
      } else {
        const [applicationData, jobData] = await Promise.all([api.get<RecruiterApplication[]>('/recruiter/applications'), api.get<Job[]>('/recruiter/jobs')]);
        setRecruiterApplications(applicationData.data); setJobs(jobData.data);
      }
      setError('');
    } catch (cause) { setError(errorMessage(cause, 'Applications could not be loaded.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);
  const withdraw = async (application: ApplicationDetail) => {
    if (!window.confirm(`Withdraw your application for ${application.job.title}?`)) return;
    try { await api.post(`/applications/${application.id}/withdraw`); setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status: 'Withdrawn' } : item)); setFeedback({ message: 'Application withdrawn.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not withdraw this application.'), kind: 'error' }); }
  };
  const setStatus = async (application: RecruiterApplication, status: string) => {
    if (status === 'Rejected' && !window.confirm(`Reject ${application.candidate.name}'s application? They will be notified.`)) return;
    try {
      await api.patch(`/applications/${application.application.id}/status`, { status });
      setRecruiterApplications((current) => current.map((item) => item.application.id === application.application.id ? { ...item, application: { ...item.application, status } } : item));
      setFeedback({ message: `Application updated to ${status}.`, kind: 'success' });
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not update the application status.'), kind: 'error' }); }
  };
  const downloadApplicantResume = async (application: RecruiterApplication) => {
    if (!application.application.resume_id) { setFeedback({ message: 'This candidate did not attach a resume.', kind: 'error' }); return; }
    try {
      const { data } = await api.get(`/resumes/${application.application.resume_id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${application.candidate.name.replace(/[^\w.-]+/g, '-')}-resume`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not download this resume.'), kind: 'error' }); }
  };
  const showMatch = async (application: RecruiterApplication) => {
    try { const { data } = await api.get<MatchResult>(`/applications/${application.application.id}/resume-match`); setMatch(data); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'A resume match is not available for this application.'), kind: 'error' }); }
  };
  const filteredRecruiterApplications = useMemo(() => filterJob ? recruiterApplications.filter((item) => String(item.job.id) === filterJob) : recruiterApplications, [filterJob, recruiterApplications]);
  return <DashboardLayout user={user}>
    <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
    <div className="workspace-heading"><div><span className="eyebrow">{candidate ? 'CANDIDATE WORKSPACE' : 'RECRUITMENT PIPELINE'}</span><h1>{candidate ? 'My applications' : 'Applicants'}</h1><p>{candidate ? 'Follow each application and its latest status.' : 'Review applications for your published roles.'}</p></div></div>
    {!candidate && <label className="pipeline-filter">Filter by job<select value={filterJob} onChange={(event) => setFilterJob(event.target.value)}><option value="">All job postings</option>{jobs.map((job) => <option value={job.id} key={job.id}>{job.title}</option>)}</select></label>}
    {loading ? <Loading label="Loading applications" /> : error ? <div className="inline-error" role="alert">{error} <button className="text-link" onClick={reload}>Try again</button></div> : candidate ? applications.length ? <div className="application-list">{applications.map((application) => <article className="application-card" key={application.id}><div className="application-card-head"><span className="company-mark">{application.job.company.charAt(0).toUpperCase()}</span><div><h2>{application.job.title}</h2><p>{application.job.company} · {application.job.location}</p></div><StatusBadge status={application.status} /></div><div className="application-meta"><span><Clock3 size={15} /> Applied {formatDate(application.created_at)}</span><span><FileText size={15} /> {application.resume?.filename || 'No resume attached'}</span></div><div className="application-card-actions"><Link className="text-link" to={`/jobs/${application.job.id}`}>View job <ArrowUpRight size={15} /></Link>{!['Withdrawn', 'Rejected', 'Selected'].includes(application.status) && <button className="text-link text-danger" onClick={() => withdraw(application)}>Withdraw application</button>}</div></article>)}</div> : <EmptyState icon={FileText} title="Your applications will appear here" description="When you apply to a role, you can follow its progress from this page." action={<Link className="button button-primary" to="/jobs">Browse jobs <ArrowRight size={16} /></Link>} /> : filteredRecruiterApplications.length ? <div className="applicant-list">{filteredRecruiterApplications.map((item) => <article className="applicant-card" key={item.application.id}><div className="applicant-primary"><span className="avatar">{item.candidate.name.charAt(0).toUpperCase()}</span><div><h2>{item.candidate.name}</h2><a href={`mailto:${item.candidate.email}`}>{item.candidate.email}</a><p>Applied for <strong>{item.job.title}</strong> · {formatDate(item.application.created_at)}</p></div><StatusBadge status={item.application.status} /></div><div className="applicant-actions"><button className="button button-outline button-small" onClick={() => downloadApplicantResume(item)}><ArrowDownToLine size={15} /> Resume</button><button className="button button-outline button-small" onClick={() => showMatch(item)}><Sparkles size={15} /> AI match</button><label className="status-select">Update status<select value={item.application.status} onChange={(event) => setStatus(item, event.target.value)}><option>Applied</option><option>Under Review</option><option>Shortlisted</option><option>Interview Scheduled</option><option>Selected</option><option>Rejected</option></select></label></div></article>)}</div> : <EmptyState icon={Users} title="No applicants for this filter" description="New applications will appear here as candidates apply." />}
    {match && <MatchDialog result={match} onClose={() => setMatch(null)} />}
  </DashboardLayout>;
}

function ManageJobs() {
  const user = getUser()!;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { feedback, setFeedback } = useFeedback();
  const initialJob = { title: '', company: '', description: '', location: '', employment_type: 'Full-time', workplace_type: 'Onsite', required_skills: '', preferred_skills: '', min_experience: 0, max_experience: 0, salary_min: null as number | null, salary_max: null as number | null, openings: 1, status: 'published' };
  const [job, setJob] = useState(initialJob);
  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get<Job[]>('/recruiter/jobs'); setJobs(data); setError(''); }
    catch (cause) { setError(errorMessage(cause, 'Your job postings could not be loaded.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const publish = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/jobs', job); setJob(initialJob); await load(); setFeedback({ message: 'Job published successfully.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not publish the job.'), kind: 'error' }); }
    finally { setSaving(false); }
  };
  const closeJob = async (item: Job) => {
    if (!window.confirm(`Close "${item.title}"? It will no longer appear in public job search.`)) return;
    try { await api.delete(`/jobs/${item.id}`); setJobs((current) => current.map((jobItem) => jobItem.id === item.id ? { ...jobItem, status: 'closed' } : jobItem)); setFeedback({ message: 'Job listing closed.', kind: 'success' }); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not close the job listing.'), kind: 'error' }); }
  };
  return <DashboardLayout user={user}>
    <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
    <div className="workspace-heading"><div><span className="eyebrow">RECRUITER WORKSPACE</span><h1>Manage jobs</h1><p>Publish new opportunities and manage your existing listings.</p></div></div>
    <section className="workspace-card" id="post-job"><div className="card-heading"><div><h2>Post a new role</h2><p>Provide clear, accurate details so candidates can decide if the role is right for them.</p></div></div>
      <form className="form-grid" onSubmit={publish}><label>Job title<input required minLength={2} maxLength={180} value={job.title} onChange={(event) => setJob({ ...job, title: event.target.value })} /></label><label>Company<input required minLength={2} maxLength={180} value={job.company} onChange={(event) => setJob({ ...job, company: event.target.value })} /></label><label>Location<input value={job.location} onChange={(event) => setJob({ ...job, location: event.target.value })} placeholder="City or region" /></label><label>Employment type<select value={job.employment_type} onChange={(event) => setJob({ ...job, employment_type: event.target.value })}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label><label>Workplace type<select value={job.workplace_type} onChange={(event) => setJob({ ...job, workplace_type: event.target.value })}><option>Onsite</option><option>Hybrid</option><option>Remote</option></select></label><label>Minimum experience (years)<input type="number" min="0" value={job.min_experience} onChange={(event) => setJob({ ...job, min_experience: Number(event.target.value) })} /></label><label>Maximum experience (years)<input type="number" min="0" value={job.max_experience} onChange={(event) => setJob({ ...job, max_experience: Number(event.target.value) })} /></label><label>Minimum salary<input type="number" min="0" value={job.salary_min ?? ''} onChange={(event) => setJob({ ...job, salary_min: event.target.value ? Number(event.target.value) : null })} /></label><label>Maximum salary<input type="number" min="0" value={job.salary_max ?? ''} onChange={(event) => setJob({ ...job, salary_max: event.target.value ? Number(event.target.value) : null })} /></label><label className="form-span">Required skills<input value={job.required_skills} onChange={(event) => setJob({ ...job, required_skills: event.target.value })} placeholder="Separate skills with commas" /></label><label className="form-span">Preferred skills<input value={job.preferred_skills} onChange={(event) => setJob({ ...job, preferred_skills: event.target.value })} placeholder="Optional" /></label><label className="form-span">Job description<textarea required minLength={20} rows={6} value={job.description} onChange={(event) => setJob({ ...job, description: event.target.value })} /></label><div className="form-span"><button className="button button-primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish job'} <ArrowUpRight size={16} /></button></div></form>
    </section>
    <section className="workspace-card"><div className="card-heading"><div><h2>Your job postings</h2><p>Only published opportunities appear in candidate job search.</p></div></div>
      {loading ? <Loading label="Loading your job postings" /> : error ? <div className="inline-error" role="alert">{error} <button className="text-link" onClick={load}>Try again</button></div> : jobs.length ? <div className="managed-job-list">{jobs.map((item) => <article className="managed-job" key={item.id}><span className="company-mark">{item.company.charAt(0).toUpperCase()}</span><div><h3>{item.title}</h3><p>{item.company} · {item.location}</p><span className={`pill ${item.status === 'published' ? 'pill-success' : 'pill-neutral'}`}>{item.status}</span></div><div className="managed-job-actions"><Link className="text-link" to={`/applications?job_id=${item.id}`}>View applicants <ArrowRight size={15} /></Link>{item.status !== 'closed' && <button className="text-link text-danger" onClick={() => closeJob(item)}>Close listing</button>}</div></article>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No job listings yet" description="Publish your first role to start connecting with candidates." />}
    </section>
  </DashboardLayout>;
}

function Notifications() {
  const user = getUser()!;
  const [items, setItems] = useState<Array<{ id: number; message: string; is_read: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { feedback, setFeedback } = useFeedback();
  const load = async () => {
    try { const { data } = await api.get('/notifications'); setItems(data); setError(''); }
    catch (cause) { setError(errorMessage(cause, 'Notifications could not be loaded.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const markRead = async (id: number) => {
    try { await api.patch(`/notifications/${id}/read`); setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item)); }
    catch (cause) { setFeedback({ message: errorMessage(cause, 'Could not update this notification.'), kind: 'error' }); }
  };
  return <DashboardLayout user={user}><FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} /><div className="workspace-heading"><div><span className="eyebrow">UPDATES</span><h1>Notifications</h1><p>Stay informed about activity on your HireHub account.</p></div></div>{loading ? <Loading label="Loading notifications" /> : error ? <div className="inline-error" role="alert">{error} <button className="text-link" onClick={load}>Try again</button></div> : items.length ? <section className="workspace-card notification-list">{items.map((item) => <article className={`notification-item ${item.is_read ? '' : 'unread'}`} key={item.id}><span className="notification-icon"><Bell size={17} /></span><div><p>{item.message}</p><span>{formatDate(item.created_at)}</span></div>{!item.is_read && <button className="button button-outline button-small" onClick={() => markRead(item.id)}>Mark read</button>}</article>)}</section> : <EmptyState icon={Bell} title="You're all caught up" description="New application and recruiter updates will appear here." />}</DashboardLayout>;
}

export default function App() {
  return <>
    <Header />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/jobs" element={<Jobs />} />
      <Route path="/jobs/:jobId" element={<JobDetail />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />
      <Route path="/register/candidate" element={<Auth register initialRole="candidate" />} />
      <Route path="/register/recruiter" element={<Auth register initialRole="recruiter" />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute roles={['candidate', 'recruiter']}><ApplicationsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute roles={['candidate', 'recruiter']}><ProfilePage /></ProtectedRoute>} />
      <Route path="/manage-jobs" element={<ProtectedRoute roles={['recruiter']}><ManageJobs /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="*" element={<main className="page-shell content-width"><EmptyState title="Page not found" description="The page you are looking for may have moved." action={<Link className="button button-primary" to="/">Go to HireHub home</Link>} /></main>} />
    </Routes>
    <Footer />
  </>;
}
