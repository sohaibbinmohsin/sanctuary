import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './landing.css'

export function LandingScreen() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll('.landing .reveal'))
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    nodes.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="landing">
      <section className="hero" aria-label="Sanctuary">
        <div className="hero__media" aria-hidden="true">
          <img
            src="/landing/landing-care-desk.jpg"
            alt=""
            width={1600}
            height={900}
          />
          <div className="hero__scrim" />
        </div>

        <header className="topbar">
          <div className="wrap">
            <div className="brand">Sanctuary</div>
            <Link className="topbar__signin" to="/login">
              Sign in
            </Link>
          </div>
        </header>

        <div className="hero__content">
          <div className="wrap">
            <h1>Shelter records, offline and on the go.</h1>
            <p className="lede">
              Run daily care and money for animal rescues, even without signal.
            </p>
            <a
              className="btn btn--primary"
              href="/playground"
              onClick={(e) => {
                e.preventDefault()
                window.location.assign('/playground')
              }}
            >
              Try playground
            </a>
          </div>
        </div>
      </section>

      <section className="intro" id="product" aria-labelledby="intro-heading">
        <div className="wrap">
          <div className="intro__copy reveal">
            <h2 id="intro-heading">One field tool instead of notebooks and spreadsheets.</h2>
            <ul className="intro__points">
              <li>Animals, care, and money in one place</li>
              <li>Works offline in the field</li>
              <li>Export your records anytime</li>
            </ul>
          </div>
          <div className="intro__device reveal reveal--fade">
            <div className="intro__phone">
              <div className="intro__phone-screen">
                <img
                  src="/landing/sanctuary-animals-screen.png"
                  alt="Sanctuary animals list"
                  width={1170}
                  height={2532}
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features" aria-labelledby="features-heading">
        <div className="wrap">
          <div className="features__intro reveal">
            <h2 id="features-heading">What it does today</h2>
            <p>Built for daily shelter work: searchable, configurable, and exportable.</p>
          </div>

          <div className="bento reveal">
            <article className="tile tile--media tile--hero" aria-label="Intake at the care desk">
              <img
                src="/landing/landing-intake-desk.jpg"
                alt="Care desk with intake records and a phone"
              />
            </article>

            <article className="tile tile--soft tile--animal">
              <span className="tile__label">ID</span>
              <h3>Animal records</h3>
              <p>
                Intake with auto shelter IDs, photos, species and markings, notes including Urdu,
                and searchable photo grids for hundreds of animals.
              </p>
            </article>

            <article className="tile tile--status">
              <span className="tile__label">STATUS</span>
              <h3>Care status</h3>
              <p>
                Configurable stages from intake and quarantine to treatment and life in sanctuary.
              </p>
            </article>

            <article className="tile tile--surface tile--care">
              <span className="tile__label">CARE</span>
              <h3>Treatments</h3>
              <p>Care history on each animal so the next person sees what already happened.</p>
            </article>

            <article className="tile tile--soft tile--money">
              <span className="tile__label">MONEY</span>
              <h3>Ledger</h3>
              <p>
                Donations and expenses, optionally tied to an animal, with money in and out at a
                glance.
              </p>
            </article>

            <article className="tile tile--view">
              <span className="tile__label">VIEW</span>
              <h3>Dashboard</h3>
              <p>
                Headcount by status and a financial snapshot you can share or download for donors
                and boards.
              </p>
            </article>

            <article className="tile tile--surface tile--zip">
              <span className="tile__label">ZIP</span>
              <h3>Data ownership</h3>
              <p>
                Export animals, treatments, ledger, and photos as a ZIP anytime. Your records stay
                yours.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="offline" aria-labelledby="offline-heading">
        <div className="wrap">
          <div className="offline__visual reveal" aria-hidden="true">
            <img
              src="/landing/landing-field-offline.jpg"
              alt=""
              width={1600}
              height={900}
            />
          </div>
          <div className="offline__copy reveal">
            <h2 id="offline-heading">Reliable when connectivity is not.</h2>
            <p>
              Work continues in the yard, the clinic, and on the road. Sync when you are back
              online. A phone-first PWA for shelters that cannot wait on signal.
            </p>
          </div>
        </div>
      </section>

      <section className="mohsin" id="about" aria-labelledby="mohsin-heading">
        <div className="wrap">
          <article className="mohsin__panel reveal">
            <div className="mohsin__main">
              <h2 className="mohsin__heading" id="mohsin-heading">
                Built by The Mohsin Project
                <img
                  className="mohsin__logo mohsin__logo--mark"
                  src="/mohsin-project-logo.svg"
                  alt=""
                  width={72}
                  height={41}
                />
              </h2>
              <div className="mohsin__body">
                <p>
                  The Mohsin Project partners with nonprofits and independent changemakers to
                  design, engineer, and deploy digital solutions at no cost, so bad tech never
                  blocks the work that matters.
                </p>
                <p>
                  Sanctuary is one of those tools: offline-first shelter management for rescues that
                  work where signal fails.
                </p>
                <a
                  className="btn btn--solid"
                  href="https://themohsinproject.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit site
                </a>
              </div>
            </div>
            <img
              className="mohsin__logo mohsin__logo--aside"
              src="/mohsin-project-logo.svg"
              alt="The Mohsin Project"
              width={176}
              height={100}
            />
          </article>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <p className="footer__brand">Sanctuary</p>
          <p className="footer__tag">
            Shelter records, offline and on the go. Built for rescues that work in the field.
          </p>
          <div className="footer__bottom">
            <span>
              A nonprofit product by{' '}
              <a
                href="https://themohsinproject.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                The Mohsin Project
              </a>
            </span>
            <a href="mailto:hello@themohsinproject.org">hello@themohsinproject.org</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
