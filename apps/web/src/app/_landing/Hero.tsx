import { SignupForm } from './SignupForm'

export function Hero() {
  return (
    <div className="wrap">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <h1 className="display">
              The job search is <span className="ital">messy</span>.
              <br />
              Your <span className="under">tracker</span> shouldn&apos;t be.
            </h1>
            <p className="lede">
              Jobric quietly reads your inbox for job-related email:
              applications, replies, interviews, rejections. It keeps a gentle,
              up-to-date record of where you stand. No spreadsheets. No nagging.
            </p>
            <SignupForm />
          </div>
          <HeroArt />
        </div>
      </header>
    </div>
  )
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="v1-letter">
        <div className="from">FROM: recruiting@northwind.co</div>
        <div className="subj">Thanks for applying to Northwind: next steps</div>
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
            <div className="co">Northwind</div>
          </div>
        </div>
        <div className="job-card">
          <div className="logo">◎</div>
          <div className="meta">
            <div className="role">Product Manager, Growth</div>
            <div className="co">Lumen Labs</div>
          </div>
        </div>
        <div className="job-card">
          <div className="logo">✦</div>
          <div className="meta">
            <div className="role">Design Engineer</div>
            <div className="co">Fieldnote</div>
          </div>
        </div>
      </div>
    </div>
  )
}
