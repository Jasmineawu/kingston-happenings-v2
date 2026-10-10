'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CONTACT_EMAIL = 'kingstonhappenings.ca@gmail.com';

const footerLinks = [
  { href: '/', label: 'Today' },
  { href: '/events', label: 'Browse' },
  { href: '/coming-up', label: 'Coming up' },
  { href: '/venues', label: 'Venues' },
  { href: '/submit', label: 'Submit an event' },
  { href: '/about', label: 'About' },
];

export default function Footer() {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const currentYear = new Date().getFullYear();

  // Auth screens are full-bleed split layouts without the footer
  if (pathname === '/login' || pathname === '/register') return null;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const subject = encodeURIComponent('Subscribe me to Kingston Happenings');
    const body = encodeURIComponent(`Please add ${email.trim()} to the Kingston Happenings mailing list.`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <footer className="mt-auto bg-navy text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-14 px-4 pb-8 pt-24 sm:px-8 lg:px-20">
        <h2 className="display-section !text-white">
          Never miss
          <br />
          what&rsquo;s on<span className="text-coral">.</span>
        </h2>

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-5">
            <p className="max-w-[360px] text-[16px] leading-[1.5] text-on-dark-muted">
              Subscribe to always keep up to date with Kingston&rsquo;s Happenings!
            </p>
            <form
              onSubmit={handleSubscribe}
              className="flex w-full max-w-[440px] items-center gap-2 rounded-full border border-white p-1.5"
            >
              <label htmlFor="footer-email" className="sr-only">
                Your email
              </label>
              <input
                id="footer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="h-11 min-w-0 flex-1 bg-transparent pl-4 text-[16px] text-white placeholder:text-on-dark-muted outline-none"
              />
              <button type="submit" className="btn-sun px-[22px]">
                Subscribe
              </button>
            </form>
          </div>

          <ul className="flex flex-col gap-[18px] md:items-end">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[12px] uppercase tracking-[0.1em] text-white hover:text-sun transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-white pt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-on-dark-muted sm:flex-row sm:justify-between">
          <p>© {currentYear} Kingston Happenings</p>
          <p>Made in Kingston, ON</p>
        </div>
      </div>
    </footer>
  );
}
