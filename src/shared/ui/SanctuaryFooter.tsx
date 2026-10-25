import { Link } from 'react-router-dom'
import {
  WhatsappLogo,
  EnvelopeSimple,
  LinkedinLogo,
  InstagramLogo,
} from '@phosphor-icons/react'
import './SanctuaryFooter.css'

export function SanctuaryFooter() {
  return (
    <footer className="sanctuary-footer">
      <div className="sanctuary-footer__wrap">
        <div className="sanctuary-footer__top-row">
          <Link to="/" className="sanctuary-footer__brand-lockup" aria-label="Sanctuary Home">
            <img
              className="sanctuary-footer__logo"
              src="/sanctuary-logo-light.svg"
              alt=""
              width={36}
              height={36}
            />
            <p className="sanctuary-footer__brand">Sanctuary</p>
          </Link>
          <div className="sanctuary-footer__socials" aria-label="Contact channels and social links">
            <a
              href="https://wa.me/923390008674"
              target="_blank"
              rel="noopener noreferrer"
              className="sanctuary-footer__social-btn"
              aria-label="Contact us on WhatsApp: 0339 000 8674 (TMPG)"
              title="WhatsApp: 0339 000 8674 (TMPG)"
            >
              <WhatsappLogo size={20} weight="fill" aria-hidden />
            </a>
            <a
              href="mailto:hello@themohsinproject.org"
              className="sanctuary-footer__social-btn"
              aria-label="Email: hello@themohsinproject.org"
              title="Email: hello@themohsinproject.org"
            >
              <EnvelopeSimple size={20} weight="fill" aria-hidden />
            </a>
            <a
              href="https://www.linkedin.com/company/themohsinproject/"
              target="_blank"
              rel="noopener noreferrer"
              className="sanctuary-footer__social-btn"
              aria-label="The Mohsin Project on LinkedIn"
              title="LinkedIn"
            >
              <LinkedinLogo size={20} weight="fill" aria-hidden />
            </a>
            <a
              href="https://www.instagram.com/themohsinproject/"
              target="_blank"
              rel="noopener noreferrer"
              className="sanctuary-footer__social-btn"
              aria-label="The Mohsin Project on Instagram"
              title="Instagram"
            >
              <InstagramLogo size={20} weight="fill" aria-hidden />
            </a>
          </div>
        </div>

        <p className="sanctuary-footer__tag">
          The animal welfare network connecting rescuers, shelters, clinics, and animal guardians.
        </p>

        <div className="sanctuary-footer__bottom">
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
  )
}
