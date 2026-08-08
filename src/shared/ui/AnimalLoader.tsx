type AnimalLoaderProps = {
  label?: string
  /** Fill the available content area (centered). */
  fill?: boolean
}

export function AnimalLoader({
  label = 'Loading…',
  fill = true,
}: AnimalLoaderProps) {
  return (
    <div
      className={fill ? 'animal-loader animal-loader--fill' : 'animal-loader'}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <svg
        className="animal-loader__svg"
        viewBox="0 0 120 120"
        width="96"
        height="96"
        aria-hidden="true"
      >
        {/* Soft ground shadow */}
        <ellipse
          className="animal-loader__shadow"
          cx="60"
          cy="102"
          rx="28"
          ry="6"
          fill="currentColor"
          opacity="0.12"
        />
        {/* Body */}
        <g className="animal-loader__critter">
          <ellipse cx="60" cy="72" rx="26" ry="20" fill="#2F5D3A" />
          {/* Head */}
          <circle cx="60" cy="48" r="22" fill="#3F6B4D" />
          {/* Ears */}
          <path
            d="M42 38 L36 18 L52 30 Z"
            fill="#2F5D3A"
          />
          <path
            d="M78 38 L84 18 L68 30 Z"
            fill="#2F5D3A"
          />
          <path
            d="M43 36 L39 22 L50 30 Z"
            fill="#F7FAF8"
            opacity="0.85"
          />
          <path
            d="M77 36 L81 22 L70 30 Z"
            fill="#F7FAF8"
            opacity="0.85"
          />
          {/* Eyes */}
          <circle className="animal-loader__eye" cx="52" cy="46" r="3.2" fill="#1A2E22" />
          <circle className="animal-loader__eye" cx="68" cy="46" r="3.2" fill="#1A2E22" />
          <circle cx="53.2" cy="45" r="1" fill="#F7FAF8" />
          <circle cx="69.2" cy="45" r="1" fill="#F7FAF8" />
          {/* Nose */}
          <ellipse cx="60" cy="53" rx="3.5" ry="2.5" fill="#B45309" />
          {/* Smile */}
          <path
            d="M54 58 Q60 64 66 58"
            fill="none"
            stroke="#1A2E22"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Cheeks */}
          <circle cx="46" cy="52" r="4" fill="#B45309" opacity="0.25" />
          <circle cx="74" cy="52" r="4" fill="#B45309" opacity="0.25" />
          {/* Front paws */}
          <ellipse cx="48" cy="88" rx="7" ry="5" fill="#2F5D3A" />
          <ellipse cx="72" cy="88" rx="7" ry="5" fill="#2F5D3A" />
          {/* Tail */}
          <path
            className="animal-loader__tail"
            d="M84 70 Q104 58 98 42"
            fill="none"
            stroke="#2F5D3A"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <p className="animal-loader__label">{label}</p>
    </div>
  )
}
