import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Siren,
  MegaphoneSimple,
  Ambulance,
  HouseLine,
  FirstAid,
  ShieldCheck,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { ReportCaseModal } from '@/features/landing/components/ReportCaseModal'
import './landing.css'

export function LandingScreen() {
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false
    const nodes = Array.from(document.querySelectorAll('.landing .reveal'))
    if (reduce || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
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
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
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
            <div className="topbar__brand-lockup">
              <img
                className="topbar__logo"
                src="/sanctuary-logo.svg"
                alt=""
                width={48}
                height={48}
              />
              <div className="topbar__brand-text">
                <div className="brand">Sanctuary</div>
                <span className="topbar__subheading">
                  Animal welfare network
                </span>
              </div>
            </div>
            <Link className="topbar__signin" to="/login">
              Sign in
            </Link>
          </div>
        </header>

        <div className="hero__content">
          <div className="wrap">
            <h1>Connecting everyone who protects animals.</h1>
            <p className="lede">
              A shared digital backbone for rescuers, shelters, veterinarians, and animal guardians.
            </p>
            <div className="hero__actions">
              <button
                type="button"
                className="btn btn--emergency"
                onClick={() => setReportOpen(true)}
              >
                <Siren size={20} weight="bold" aria-hidden="true" />
                <span>Report a case</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="stakeholders" id="network" aria-labelledby="stakeholders-heading">
        <div className="wrap">
          <div className="stakeholders__intro reveal">
            <span className="section-eyebrow">The Network</span>
            <h2 id="stakeholders-heading">Built for everyone protecting animals</h2>
            <p>A shared operational layer connecting every role across animal welfare.</p>
          </div>

          <div className="stakeholders__grid reveal">
            <article className="stakeholder-card">
              <div className="stakeholder-card__icon-badge" aria-hidden="true">
                <MegaphoneSimple size={24} weight="duotone" />
              </div>
              <h3>Citizens and Advocates</h3>
              <p>
                Spot an animal in distress and submit a rescue report in seconds with photos and location. No lost chat threads or forgotten cases.
              </p>
            </article>

            <article className="stakeholder-card">
              <div className="stakeholder-card__icon-badge" aria-hidden="true">
                <Ambulance size={24} weight="duotone" />
              </div>
              <h3>Field Rescue Teams</h3>
              <p>
                Receive dispatched reports, capture GPS coordinates and field photos on the spot, and work seamlessly without cellular signal.
              </p>
            </article>

            <article className="stakeholder-card">
              <div className="stakeholder-card__icon-badge" aria-hidden="true">
                <HouseLine size={24} weight="duotone" />
              </div>
              <h3>Shelters and Sanctuaries</h3>
              <p>
                Manage animal profiles, track daily headcounts, run feeding and medical checklists, and maintain transparent expense records.
              </p>
            </article>

            <article className="stakeholder-card">
              <div className="stakeholder-card__icon-badge" aria-hidden="true">
                <FirstAid size={24} weight="duotone" />
              </div>
              <h3>Veterinarians and Clinics</h3>
              <p>
                Record treatments, vaccinations, and recovery milestones with a permanent health history that stays with the animal.
              </p>
            </article>

            <article className="stakeholder-card">
              <div className="stakeholder-card__icon-badge" aria-hidden="true">
                <ShieldCheck size={24} weight="duotone" />
              </div>
              <h3>Pet Guardians and Owners</h3>
              <p>
                Keep digital vaccination and medical records in one secure place, with rapid community alerts if a pet ever goes missing.
              </p>
            </article>
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
            <span className="section-eyebrow">Platform Strengths</span>
            <h2 id="features-heading">Built to work where you work</h2>
            <p>A grounded digital backbone designed for real-world field conditions.</p>
          </div>

          <div className="bento reveal">
            <article className="tile tile--media tile--hero" aria-label="Intake at the care desk">
              <img
                src="/landing/landing-intake-desk.jpg"
                alt="Care desk with intake records and a phone"
              />
            </article>

            <article className="tile tile--soft tile--animal">
              <span className="tile__label">FIELD AGILITY</span>
              <h3>Works offline anywhere</h3>
              <p>
                Local-first database that functions in basements, rural sanctuaries, and remote roads, syncing automatically when back online.
              </p>
            </article>

            <article className="tile tile--status">
              <span className="tile__label">CARE CHAIN</span>
              <h3>Connected care chain</h3>
              <p>
                Seamless handoffs from street report to clinic treatment, shelter rehabilitation, and adoption.
              </p>
            </article>

            <article className="tile tile--surface tile--care">
              <span className="tile__label">RECORDS</span>
              <h3>Animal health records</h3>
              <p>Permanent care history on each animal so responders, clinics, and caretakers see what already happened.</p>
            </article>

            <article className="tile tile--soft tile--money">
              <span className="tile__label">ACCOUNTABILITY</span>
              <h3>Auditable ledger</h3>
              <p>
                Transparent tracking of medicine costs, food supplies, and medical bills for trusted donor accountability.
              </p>
            </article>

            <article className="tile tile--view">
              <span className="tile__label">OVERVIEW</span>
              <h3>Live network view</h3>
              <p>
                Headcount by status and operational snapshot you can share or download for boards and supporters.
              </p>
            </article>

            <article className="tile tile--surface tile--zip">
              <span className="tile__label">SOVEREIGNTY</span>
              <h3>Your data stays yours</h3>
              <p>
                Export animals, treatments, ledger, and photos as a ZIP anytime. Free software with no vendor lock-in.
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
              online. A phone-first PWA for rescues that cannot wait on signal.
            </p>
          </div>
        </div>
      </section>

      <section className="partners" id="partners" aria-labelledby="partners-heading">
        <div className="wrap">
          <div className="partners__intro reveal">
            <span className="section-eyebrow">The Coalition</span>
            <h2 id="partners-heading">Rescues and shelters we build for.</h2>
            <p>
              Sanctuary is designed directly alongside frontline rescue networks, shelter
              caretakers, and campus animal welfare societies to solve daily field operations.
            </p>
          </div>

          <div className="dossier reveal">
            <div className="dossier__header">
              <div className="dossier__header-left">
                <h3>Operational Network</h3>
              </div>
              <div className="dossier__count">07 Active Partners</div>
            </div>

            <div className="dossier__list">
              <article className="dossier__row">
                <div className="dossier__index">01</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-tales-of-second-chances.png"
                      alt="Tales of Second Chances logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Tales of Second Chances</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Shelter</span>
                      <span>Karachi · 11+ Yrs</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Longstanding animal sanctuary caring for 300+ rescued cats and dogs with daily
                  nutrition, clinical treatment, and safe lifetime shelter.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/madeehakhatri/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">02</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-parc.png"
                      alt="Police Animal Rescue Center logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Police Animal Rescue Center</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Enforcement</span>
                      <span>Punjab Police</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Pioneering state-backed 24/7 rescue unit handling anti-cruelty enforcement, rapid
                  veterinary dispatch, and emergency trauma triage.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/parcpoliceanimalrescuecentre/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">03</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-whiskers-fccu.png"
                      alt="Whiskers FCCU logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Whiskers FCCU</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Campus</span>
                      <span>FCC University</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Grassroots collegiate rescue managing campus-wide TNR programs, injury
                  rehabilitation, regular feeding routes, and adoption placements.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/whiskers.fccu/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">04</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-aws-lums.png"
                      alt="Animal Welfare Society LUMS logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Animal Welfare Society LUMS</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Campus</span>
                      <span>LUMS Lahore</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Student-led organization maintaining health logs, medical vaccination drives,
                  active community feeding, and adoption for campus animals.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/aws_lums/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">05</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-gaza-animal-rescues.png"
                      alt="Gaza Animal Rescues logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Gaza Animal Rescues</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Shelter</span>
                      <span>Gaza · Frontline</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Direct emergency relief, feeding, and medical treatment for abandoned pets and
                  injured animals through severe crisis conditions across Gaza.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/gazaanimalrescues/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">06</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-chiragh-ghar.png"
                      alt="Chiragh Ghar Animal Rehab logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>Chiragh Ghar Animal Rehab</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Shelter</span>
                      <span>Lahore</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Foundation-supported rehabilitation centre in Lahore providing care and
                  rehabilitation for rescued animals, with access to veterinary services through
                  partner clinics.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/chiraghgharanimalrehab/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>

              <article className="dossier__row">
                <div className="dossier__index">07</div>
                <div className="dossier__org">
                  <div className="dossier__logo">
                    <img
                      src="/partners/partner-nsac.png"
                      alt="NUST Stray Animals Club logo"
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  </div>
                  <div className="dossier__org-info">
                    <h4>NUST Stray Animals Club (NSAC)</h4>
                    <div className="dossier__org-meta">
                      <span className="scope-tag">Campus</span>
                      <span>NUST Islamabad</span>
                    </div>
                  </div>
                </div>
                <div className="dossier__desc">
                  Student-run NUST club promoting animal welfare through rescue, advocacy, and
                  community engagement on and around the H-12 campus.
                </div>
                <div className="dossier__action">
                  <a
                    className="dossier__btn"
                    href="https://www.instagram.com/strayanimalsnust/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Follow work</span>
                    <ArrowSquareOut size={14} weight="bold" aria-hidden />
                  </a>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="mohsin" id="about" aria-labelledby="mohsin-heading">
        <div className="wrap">
          <article className="mohsin__panel reveal">
            <div className="mohsin__main">
              <h2 className="mohsin__heading" id="mohsin-heading">
                Built by{' '}
                <a
                  className="mohsin__heading-link"
                  href="https://themohsinproject.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  The Mohsin Project
                  <ArrowSquareOut
                    className="mohsin__link-icon"
                    size={24}
                    weight="bold"
                    aria-hidden
                  />
                </a>
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
                  The Mohsin Project builds public digital utilities for changemakers at zero cost.
                  Sanctuary is our animal welfare network: uniting frontline rescuers, shelters, and
                  communities on open, modern infrastructure so bad tech never blocks the work that
                  matters.
                </p>
                <p>
                  Free software with zero vendor lock-in, designed directly with field caretakers.
                </p>
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
          <div className="footer__brand-lockup">
            <img
              className="footer__logo"
              src="/sanctuary-logo-light.svg"
              alt=""
              width={36}
              height={36}
            />
            <p className="footer__brand">Sanctuary</p>
          </div>
          <p className="footer__tag">
            The animal welfare network connecting rescuers, shelters, clinics, and animal guardians.
          </p>
          <div className="footer__bottom">
            <span>
              A free software by{' '}
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

      <ReportCaseModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  )
}
