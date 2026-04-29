import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { FunnelBar } from './_landing/FunnelBar'
import { SignupForm } from './_landing/SignupForm'

export default function HomePage() {
  return (
    <div className="landing">
      <div className="wrap">
        <nav className="top">
          <Link className="wordmark" href="/">
            <span className="plate">Jobric</span>
          </Link>
          <ul>
            <li>
              <a href="#how">How it works</a>
            </li>
            <li>
              <a href="#dashboard">Dashboard</a>
            </li>
            <li>
              <a href="#privacy">Privacy</a>
            </li>
          </ul>
          <SignedOut>
            <ul>
              <li>
                <Link className="nav-cta" href="/sign-up">
                  Sign up free
                </Link>
              </li>
              <li>
                <Link className="nav-cta" href="/sign-in">
                  Sign in
                </Link>
              </li>
            </ul>
          </SignedOut>
          <SignedIn>
            <Link className="nav-cta" href="/dashboard">
              Open dashboard
            </Link>
          </SignedIn>
        </nav>

        <header className="hero">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">
                <span className="dot" />
                <span>Works with Gmail</span>
              </span>
              <h1 className="display">
                The job search is <span className="ital">messy</span>.
                <br />
                Your <span className="under">tracker</span> shouldn&apos;t be.
              </h1>
              <p className="lede">
                Jobric quietly reads your inbox for job-related email —
                applications, replies, interviews, rejections — and keeps a
                gentle, up-to-date record of where you stand. No spreadsheets.
                No nagging.
              </p>
              <SignupForm />
            </div>

            <div className="hero-art" aria-hidden="true">
              <div className="v1-letter">
                <div className="from">FROM: recruiting@northwind.co</div>
                <div className="subj">
                  Thanks for applying to Northwind — next steps
                </div>
                <div className="body-lines">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
                <div className="stamp">
                  APPLIED
                  <br />
                  APR 14
                </div>
              </div>

              <svg className="v1-path" viewBox="0 0 120 260">
                <path d="M 10 20 C 60 40, 30 140, 110 200" />
              </svg>

              <div className="v1-cards">
                <div className="job-card">
                  <div className="logo">N</div>
                  <div className="meta">
                    <div className="role">Senior Product Designer</div>
                    <div className="co">Northwind · Remote</div>
                  </div>
                  <div className="status applied">Applied</div>
                </div>
                <div className="job-card">
                  <div className="logo">◎</div>
                  <div className="meta">
                    <div className="role">Product Manager, Growth</div>
                    <div className="co">Lumen Labs · Austin</div>
                  </div>
                  <div className="status interview">Interview</div>
                </div>
                <div className="job-card">
                  <div className="logo">✦</div>
                  <div className="meta">
                    <div className="role">Design Engineer</div>
                    <div className="co">Fieldnote · NYC</div>
                  </div>
                  <div className="status offer">Offer</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="section" id="how">
          <div className="section-head">
            <span className="section-num">01 / How it works</span>
            <div>
              <h2>
                Three small steps. <em>Then nothing.</em>
              </h2>
              <p className="sub">
                Most tracking tools want you to keep updating them. Jobric is
                the opposite — once it&apos;s set up, the updating happens on
                its own.
              </p>
            </div>
          </div>

          <div className="steps">
            <div className="step">
              <div className="num">i.</div>
              <h3>Connect Gmail</h3>
              <p>
                One tap, read-only. We ask for the narrowest scope Google offers
                — no sending, no drafting, no contacts.
              </p>
              <div className="illus">
                <span className="pill">gmail.readonly</span>
                <div className="line a" />
                <div className="line b" />
                <div className="line c" />
              </div>
            </div>
            <div className="step">
              <div className="num">ii.</div>
              <h3>We spot the signals</h3>
              <p>
                Application confirmations, recruiter replies, scheduled
                interviews, polite rejections — all of it, in all its templates.
              </p>
              <div className="illus">
                <span className="pill green">interview · apr 22</span>
                <div className="line b" />
                <div className="line a" />
                <div className="line b" />
              </div>
            </div>
            <div className="step">
              <div className="num">iii.</div>
              <h3>You see the whole picture</h3>
              <p>
                A calm dashboard. A timeline per company. Reminders before each
                interview. Nothing pushier than that.
              </p>
              <div className="illus">
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span className="pill">47 applied</span>
                  <span className="pill green">11 interviewing</span>
                </div>
                <div className="line c" />
                <div className="line a" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="section dash-section" id="dashboard">
        <div className="wrap">
          <div className="section-head">
            <span className="section-num">02 / The dashboard</span>
            <div>
              <h2>
                Everything you&apos;ve applied to,{' '}
                <em>without you keeping score</em>.
              </h2>
              <p className="sub">
                A snapshot of your search, the funnel you never had time to
                build, and the next thing you need to do — all in one place.
              </p>
            </div>
          </div>

          <div className="dashboard">
            <div className="dash-top">
              <div className="tabs">
                <button className="active">Overview</button>
                <button>Companies</button>
                <button>Timeline</button>
                <button>Reminders</button>
              </div>
              <span className="sync">Last sync · 2 min ago</span>
            </div>

            <div className="dash-grid">
              <div className="stats-panel">
                <div className="stats-grid">
                  <div className="stat-cell">
                    <div className="big">
                      47<span className="u">apps</span>
                    </div>
                    <div className="lbl">Applications</div>
                    <div className="trend">↑ 6 this week</div>
                  </div>
                  <div className="stat-cell">
                    <div className="big">11</div>
                    <div className="lbl">In conversation</div>
                    <div className="trend">↑ 2 this week</div>
                  </div>
                  <div className="stat-cell">
                    <div className="big">
                      28<span className="u">%</span>
                    </div>
                    <div className="lbl">Response rate</div>
                    <div className="trend">vs. 19% avg</div>
                  </div>
                  <div className="stat-cell">
                    <div className="big">3</div>
                    <div className="lbl">Offers</div>
                    <div className="trend">2 active</div>
                  </div>
                </div>

                <div className="funnel">
                  <h4>Your funnel</h4>
                  <FunnelBar label="Applied" value={47} width={100} />
                  <FunnelBar label="Replied" value={24} width={51} />
                  <FunnelBar label="Interviewing" value={13} width={28} />
                  <FunnelBar label="Final round" value={8} width={17} />
                  <FunnelBar label="Offer" value={3} width={6} />
                </div>
              </div>

              <div className="pipeline-panel">
                <div className="pipe-head">
                  <h4>Recent activity</h4>
                  <span className="filter">auto-detected</span>
                </div>
                <div className="pipe-list">
                  <PipeRow
                    logo="N"
                    role="Senior Product Designer"
                    co="Northwind Design"
                    statusLabel="Interview"
                    statusClass="interview"
                    when="Apr 18"
                  />
                  <PipeRow
                    logo="◎"
                    role="Product Manager, Growth"
                    co="Lumen Labs"
                    statusLabel="Applied"
                    statusClass="applied"
                    when="Apr 14"
                  />
                  <PipeRow
                    logo="✦"
                    role="Design Engineer"
                    co="Fieldnote"
                    statusLabel="Offer"
                    statusClass="offer"
                    when="Apr 12"
                  />
                  <PipeRow
                    logo="T"
                    role="Staff Designer"
                    co="Thorne & Co"
                    statusLabel="Applied"
                    statusClass="applied"
                    when="Apr 09"
                  />
                  <PipeRow
                    logo="H"
                    role="Senior UX Researcher"
                    co="Harbor"
                    statusLabel="Replied"
                    statusClass="applied"
                    when="Apr 07"
                  />
                  <PipeRow
                    logo="R"
                    role="Product Designer II"
                    co="Relay"
                    statusLabel="Interview"
                    statusClass="interview"
                    when="Apr 03"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="privacy">
        <div className="wrap">
          <div className="privacy">
            <div className="privacy-inner">
              <div>
                <span className="eyebrow">
                  <span className="dot" />
                  <span>Privacy first, always</span>
                </span>
                <h2>
                  Your inbox is yours.{' '}
                  <em>We&apos;re just reading the job parts.</em>
                </h2>
                <p className="sub">
                  Letting an AI look at your email deserves a real answer, not a
                  checkbox. Here&apos;s exactly what Jobric does — and, more
                  importantly, what it never does.
                </p>
                <p className="signoff">
                  — we&apos;d be uneasy too. so we built it the way we&apos;d
                  want.
                </p>
              </div>

              <div className="privacy-cards">
                <PrivacyCard
                  icon={
                    <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
                  }
                  title="Read-only. Nothing else."
                  body={
                    <>
                      Jobric uses the narrowest Gmail scope (
                      <span className="mono">gmail.readonly</span>). We
                      can&apos;t send, reply, delete, or draft. Ever.
                    </>
                  }
                  badge="Google-verified scope"
                />
                <PrivacyCard
                  icon={<path d="M3 12h4l3-9 4 18 3-9h4" />}
                  title="Only job-related mail is processed."
                  body="We filter by sender reputation and subject patterns before anything is read. Your bank, your family, your newsletters — invisible to us."
                  badge="~98% of your inbox, untouched"
                />
                <PrivacyCard
                  icon={
                    <>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </>
                  }
                  title="Your data, your ejector seat."
                  body="Disconnect anytime — we delete everything within 24 hours. No cold storage, no backups, no exceptions."
                  badge="SOC 2 Type II · in progress"
                />
                <PrivacyCard
                  icon={
                    <>
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 018 0v3" />
                    </>
                  }
                  title="Never sold. Never trained on."
                  body="Your email is not a dataset. We don't sell it, share it with recruiters, or use it to train anything."
                  badge="Written into our Terms"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section close" id="signup">
        <div className="wrap">
          <span
            className="eyebrow"
            style={{ justifyContent: 'center', display: 'inline-flex' }}
          >
            <span className="dot" />
            <span>Free while we&apos;re in beta</span>
          </span>
          <h2>
            Put the <em>spreadsheet</em>
            <br />
            down.
          </h2>
          <p className="lede">
            Connect Gmail in about ten seconds. We&apos;ll take it from there.
          </p>
          <SignupForm />
          <p className="fineprint">
            GMAIL · READ-ONLY · REVOCABLE · FREE IN BETA
          </p>
        </div>
      </section>

      <footer className="wrap site">
        <Link className="wordmark" href="/">
          <span className="plate" style={{ fontSize: 22 }}>
            Jobric
          </span>
        </Link>
        <span className="signoff">good luck out there.</span>
        <span>© 2026 · Privacy · Terms · hello@jobric.app</span>
      </footer>
    </div>
  )
}

function PipeRow({
  logo,
  role,
  co,
  statusLabel,
  statusClass,
  when,
}: {
  logo: string
  role: string
  co: string
  statusLabel: string
  statusClass: 'applied' | 'interview' | 'offer'
  when: string
}) {
  return (
    <div className="pipe-row">
      <div className="logo">{logo}</div>
      <div>
        <div className="role">{role}</div>
        <div className="co">{co}</div>
      </div>
      <div className={`status ${statusClass}`}>{statusLabel}</div>
      <div className="when">{when}</div>
    </div>
  )
}

function PrivacyCard({
  icon,
  title,
  body,
  badge,
}: {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  badge: string
}) {
  return (
    <div className="p-card">
      <div className="ic">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E0AE5A"
          strokeWidth={1.5}
        >
          {icon}
        </svg>
      </div>
      <div>
        <h5>{title}</h5>
        <p>{body}</p>
        <span className="badge">{badge}</span>
      </div>
    </div>
  )
}
