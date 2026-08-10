const APPLY_URL = 'https://www.themohsinproject.org/#apply?type=partner'

export function PlaygroundBanner() {
  return (
    <div className="playground-banner" role="status">
      <span className="playground-banner__text">
        Playground · dummy data
      </span>
      <div className="playground-banner__actions">
        <a
          className="playground-banner__access"
          href={APPLY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Request access
        </a>
        <a className="playground-banner__exit" href="/">
          Exit
        </a>
      </div>
    </div>
  )
}
