import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const FOOTER_LINKS: { label: string; to: string }[] = [
  { label: 'Privacy & Legal', to: '/legal/privacy' },
  { label: 'Vehicle Recalls', to: '/legal/recalls' },
  { label: 'Contact', to: '/contact' },
  { label: 'Careers', to: '/careers' },
  { label: 'News', to: '/news' },
  { label: 'Locations', to: '/locations' },
];

export default function Footer(): ReactElement {
  return (
    <footer className="vm-footer">
      <div className="vm-footer__inner">
        <span className="vm-footer__copy">© 2026 Vela Motors</span>
        {FOOTER_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="vm-footer__link">
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
