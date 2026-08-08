import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'

export function LandingScreen() {
  return (
    <main className="landing-screen">
      <header className="landing-screen__top">
        <div className="landing-screen__brand">Sanctuary</div>
        <Link className="landing-screen__signin" to="/login">
          Sign in
        </Link>
      </header>

      <div className="landing-screen__hero">
        <img
          className="landing-screen__logo"
          src="/favicon.svg"
          alt=""
          width={72}
          height={72}
        />
        <h1>Shelter records, offline and on the go.</h1>
        <p className="landing-screen__lede">
          Run daily care and money for animal rescues, even without signal.
        </p>
        <div className="landing-screen__actions">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              window.location.assign('/playground')
            }}
          >
            Try playground
          </Button>
          <Button to="/login" variant="secondary">
            Sign in
          </Button>
        </div>
      </div>

      <footer className="landing-screen__foot">
        <a
          className="mohsin-credit"
          href="https://themohsinproject.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Nonprofit software by</span>
          <span className="mohsin-credit__name">The Mohsin Project</span>
          <img
            src="/mohsin-project-logo.svg"
            alt=""
            width={88}
            height={50}
          />
        </a>
      </footer>
    </main>
  )
}
