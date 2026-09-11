export function Privacy() {
  return (
    <section className="section" id="privacy">
      <div className="wrap">
        <div className="privacy">
          <div className="privacy-inner">
            <div>
              <h2>
                Your inbox is yours.{' '}
                <em>We&apos;re just reading the job parts.</em>
              </h2>
              <p className="sub">
                Letting an AI look at your email deserves a real answer, not a
                checkbox. Here&apos;s exactly what Jobric does, and, more
                importantly, what it never does.
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
                    <span className="mono">gmail.readonly</span>). We can&apos;t
                    send, reply, delete, or draft. Ever.
                  </>
                }
              />
              <PrivacyCard
                icon={<path d="M3 12h4l3-9 4 18 3-9h4" />}
                title="Only job-related mail is processed."
                body="We filter by sender reputation and subject patterns before anything is read. Your bank, your family, your newsletters stay invisible to us."
              />
              <PrivacyCard
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                }
                title="Your data, your escape hatch."
                body="Disconnect anytime. We delete everything within 24 hours. No cold storage, no backups, no exceptions."
              />
              <PrivacyCard
                icon={
                  <>
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 018 0v3" />
                  </>
                }
                title="Never sold. Never used to train AI."
                body="Your email is not a dataset. We don't sell it, share it with recruiters, or use it to train anything."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PrivacyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
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
          aria-hidden="true"
          focusable="false"
        >
          {icon}
        </svg>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  )
}
