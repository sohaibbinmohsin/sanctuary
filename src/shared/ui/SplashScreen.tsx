type SplashScreenProps = {
  message?: string
  showSpinner?: boolean
}

export function SplashScreen({
  message,
  showSpinner = true,
}: SplashScreenProps) {
  return (
    <main className="boot-screen" aria-busy="true" aria-live="polite">
      <div className="boot-screen__content">
        <div className="boot-screen__brand-lockup">
          <div className="boot-screen__logo-wrap">
            {showSpinner ? (
              <div className="boot-screen__spinner-ring" aria-hidden="true" />
            ) : null}
            <img
              className="boot-screen__logo"
              src="/sanctuary-mark.svg"
              alt=""
              width={80}
              height={80}
            />
          </div>
          <div className="boot-screen__brand-text">
            <h1 className="brand">Sanctuary</h1>
            <p className="subheading">Animal welfare platform</p>
          </div>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>
      <div className="boot-screen__footer">
        <span>Free software by The Mohsin Project</span>
        <img src="/mohsin-project-logo-white.svg" alt="" height={18} />
      </div>
    </main>
  )
}
