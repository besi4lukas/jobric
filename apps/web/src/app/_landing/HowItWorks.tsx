export function HowItWorks() {
  return (
    <div className="wrap">
      <section className="section" id="how">
        <div className="section-head">
          <div>
            <h2>
              Three small steps. <em>Then nothing.</em>
            </h2>
            <p className="sub">
              Most tracking tools want you to keep updating them. Jobric is the
              opposite. Once it&apos;s set up, the updating happens on its own.
            </p>
          </div>
        </div>

        <div className="steps">
          <Step num={1} title="Connect Gmail">
            <p>
              One tap, read-only. We ask for the narrowest scope Google offers:
              no sending, no drafting, no contacts.
            </p>
            <div className="illus">
              <span className="pill">gmail.readonly</span>
              <div className="line a" />
              <div className="line b" />
              <div className="line c" />
            </div>
          </Step>
          <Step num={2} title="We spot the signals">
            <p>
              Application confirmations, recruiter replies, scheduled
              interviews, polite rejections. All of it, in all its templates.
            </p>
            <div className="illus">
              <span className="pill green">interview </span>
              <div className="line b" />
              <div className="line a" />
              <div className="line b" />
            </div>
          </Step>
          <Step num={3} title="You see the whole picture">
            <p>
              A calm dashboard. A timeline per company. Reminders before each
              interview. Nothing pushier than that.
            </p>
            <div className="illus">
              <div className="pill-row">
                <span className="pill">47 applied</span>
                <span className="pill green">11 interviewing</span>
              </div>
              <div className="line c" />
              <div className="line a" />
            </div>
          </Step>
        </div>
      </section>
    </div>
  )
}

function Step({
  num,
  title,
  children,
}: {
  num: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="step">
      <div className="num">{num}.</div>
      <h3>{title}</h3>
      {children}
    </div>
  )
}
