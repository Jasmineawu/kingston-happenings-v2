'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, AtSign, Check, ChevronDown, Eye, Loader2, Pencil, Search, Store } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents } from '@/contexts/EventsContext';

const roles = ['Owner', 'Manager', 'Marketing / social media', 'Promoter / booker', 'Event Coordinator / Artist'];
const venueTypes = ['Restaurant', 'Bar / pub', 'Café', 'Brewery / winery', 'Music venue', 'Theatre / arts space', 'Gallery', 'Community space', 'Other'];
const accessibilityOptions = [
  'Step-free entrance',
  'Accessible washroom',
  'Elevator / everything on one level',
  'Accessible parking nearby',
  'Seating available',
  'Quiet or sensory-friendly space',
  'Service animals welcome',
  'Digital menu available',
];
const neighbourhoods = ['Downtown', 'Williamsville', 'Sydenham', 'Portsmouth', 'Queen’s area', 'Waterfront', 'West End', 'Other'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Hours = Record<string, { open: string; close: string; closed: boolean }>;

function Section({ number, title, hint, children, aside }: { number: number; title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <h3 className="flex items-center gap-3 text-[20px] font-bold text-navy">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{number}</span>
        {title}
        {aside}
      </h3>
      {hint && <p className="mt-4 text-[13px] text-ink-muted">{hint}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({ label, id, children, hint }: { label: string; id?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="field-hint mt-1.5">{hint}</p>}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-3 text-left text-[14px] text-navy">
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] ${
          checked ? 'border-navy bg-navy text-white' : 'border-line bg-white'
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function MultiChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button key={o} type="button" className="chip h-10" data-active={active} onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ApplicationReceived({ email, venueName }: { email: string; venueName: string }) {
  return (
    <div className="page-container pb-24 pt-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sun text-navy">
        <Check size={26} strokeWidth={2.5} />
      </div>
      <p className="eyebrow mt-6">— For venues &amp; organizers</p>
      <h1 className="display-section mt-3">
        Application
        <br />
        received
      </h1>
      <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-ink-muted">
        Thanks! We&rsquo;ll confirm you within 1–2 business days. Check your inbox at {email} to verify your email address.
      </p>

      <div className="card mt-10 grid grid-cols-1 gap-8 p-6 sm:p-8 md:grid-cols-3">
        {[
          { state: 'done', title: 'Application received', body: `Today at ${format(new Date(), 'h:mm a')}. Nothing else you need to do.` },
          { state: 'progress', title: 'We verify you', body: `We check you’re connected to ${venueName || 'your venue'}, usually by email.` },
          { state: 'next', title: 'Start posting', body: 'Once you’re approved, you can post events and specials for your venue.' },
        ].map((s, i) => (
          <div key={s.title}>
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                  s.state === 'done' ? 'bg-success-tint text-success' : s.state === 'progress' ? 'bg-sun text-navy' : 'border border-line text-navy'
                }`}
              >
                {s.state === 'done' ? <Check size={16} /> : i + 1}
              </span>
              {i < 2 && <span className={`hidden h-px flex-1 md:block ${s.state === 'done' ? 'bg-navy' : 'bg-line'}`} />}
            </div>
            <span
              className={`tag mt-4 gap-1 ${
                s.state === 'done' ? 'bg-success-tint text-success' : s.state === 'progress' ? 'bg-[#fff1d6] text-[#8a5a00]' : 'bg-sky text-navy'
              }`}
            >
              {s.state !== 'next' && <span className={`h-1.5 w-1.5 rounded-full ${s.state === 'done' ? 'bg-success' : 'bg-sun'}`} />}
              {s.state === 'done' ? 'Done' : s.state === 'progress' ? 'In progress' : 'Up next'}
            </span>
            <p className="mt-3 text-[18px] font-bold text-navy">{s.title}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow-sm mt-12">While you wait</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { icon: <Store size={15} />, title: 'Polish your venue page', body: 'See how venues show up on Kingston Happenings.', href: '/venues', cta: 'Browse venues →' },
          { icon: <Pencil size={15} />, title: 'Draft your first listing', body: 'Once you’re verified and signed in, submit an event or special.', href: '/submit', cta: 'Start a draft →' },
          { icon: <Eye size={15} />, title: 'See how others do it', body: 'Browse tonight’s listings to get a feel for what works in Kingston.', href: '/', cta: 'Browse Today →' },
        ].map((c) => (
          <div key={c.title} className="card p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky text-link">{c.icon}</span>
            <p className="mt-4 text-[16px] font-bold text-navy">{c.title}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">{c.body}</p>
            <Link href={c.href} className="link-arrow mt-3">
              {c.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/login" className="btn-sun">
          Go to sign in
        </Link>
        <Link href="/" className="btn-outline">
          Back to Today
        </Link>
      </div>
      <p className="mt-4 text-[12px] text-ink-muted">Questions? Reply to the confirmation email and a real person will get back to you.</p>
    </div>
  );
}

export default function BecomeOrganizerPage() {
  const router = useRouter();
  const { register, user } = useAuth();
  const { venues } = useEvents();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ email: string; venueName: string } | null>(null);

  const [account, setAccount] = useState({ name: '', phone: '', email: '', password: '', confirm: '', role: 'Owner' });
  const [claimQuery, setClaimQuery] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimedVenueId, setClaimedVenueId] = useState('');
  const [venue, setVenue] = useState({
    name: '',
    types: [] as string[],
    street: '',
    unit: '',
    city: 'Kingston',
    postal: '',
    neighbourhood: 'Downtown',
    phone: '',
    website: '',
    instagram: '',
    about: '',
  });
  const [hours, setHours] = useState<Hours>(() =>
    Object.fromEntries(days.map((d) => [d, { open: '11:00', close: '23:00', closed: d === 'Sun' }]))
  );
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [confirmMethod, setConfirmMethod] = useState<'email' | 'document'>('email');
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const [newsletter, setNewsletter] = useState(true);

  useEffect(() => {
    if (user && !done) router.push('/account');
  }, [user, done, router]);

  const claimMatches = useMemo(() => {
    const q = claimQuery.toLowerCase().trim();
    if (!q) return venues.slice(0, 6);
    return venues.filter((v) => v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q)).slice(0, 6);
  }, [venues, claimQuery]);

  const claimedVenue = venues.find((v) => v.id === claimedVenueId);

  if (done) return <ApplicationReceived email={done.email} venueName={done.venueName} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const pw = account.password;
    if (pw.length < 8 || !/\d/.test(pw) || !/[A-Z]/.test(pw)) {
      setError('Password needs at least 8 characters, a number and an uppercase letter.');
      return;
    }
    if (pw !== account.confirm) {
      setError('Passwords don’t match.');
      return;
    }
    const venueName = claimedVenue?.name || venue.name.trim();
    if (!venueName) {
      setError('Pick your venue or add a new one.');
      return;
    }
    if (!agree) {
      setError('Please agree to the Terms and Listing guidelines.');
      return;
    }

    setSubmitting(true);
    const result = await register({
      name: account.name,
      email: account.email,
      password: pw,
      role: 'organizer',
      venueName,
      organizerApplication: {
        phone: account.phone,
        role: account.role,
        claimedVenueId: claimedVenue?.id,
        venue: claimedVenue ? undefined : { ...venue, hours },
        accessibility,
        accessibilityNotes,
        confirmMethod,
        notes,
        newsletter,
        submittedAt: new Date().toISOString(),
      },
    });
    setSubmitting(false);
    if (result.success) {
      setDone({ email: account.email, venueName });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setError(result.error || 'Could not create your account. Please try again.');
    }
  };

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— For organizers &amp; artists</p>
      <h1 className="display-section">
        Become an
        <br />
        organizer
      </h1>

      {error && (
        <div className="mt-8 flex items-start gap-3 rounded-[14px] bg-danger-tint p-4 text-[14px] text-danger">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section number={1} title="Your account" hint="You’ll use this to sign in and post listings." aside={<span className="text-[12px] font-normal text-coral">* required</span>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" id="org-name">
                <input id="org-name" required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} placeholder="John Doe" className="field" />
              </Field>
              <Field label="Phone" id="org-phone">
                <input id="org-phone" type="tel" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} placeholder="123-456-7890" className="field" />
              </Field>
            </div>
            <Field label="Work email" id="org-email">
              <input id="org-email" type="email" required value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} placeholder="you@example.com" className="field" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Password" id="org-password">
                <input
                  id="org-password"
                  type="password"
                  required
                  value={account.password}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  placeholder="8+ characters, a number & a capital"
                  className="field"
                />
              </Field>
              <Field label="Confirm password" id="org-confirm">
                <input id="org-confirm" type="password" required value={account.confirm} onChange={(e) => setAccount({ ...account, confirm: e.target.value })} placeholder="Type it again" className="field" />
              </Field>
            </div>
            <div>
              <p className="field-label">Your role</p>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button key={r} type="button" className="chip h-10" data-active={account.role === r} onClick={() => setAccount({ ...account, role: r })}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section number={2} title="Your venue" hint="Add the place you post for. You’ll only type this once.">
            <Field label="Is your venue already on Kingston Happenings?" hint="Claiming links your account to its existing page.">
              <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-link" />
                <input
                  value={claimedVenue ? claimedVenue.name : claimQuery}
                  onChange={(e) => {
                    setClaimedVenueId('');
                    setClaimQuery(e.target.value);
                    setClaimOpen(true);
                  }}
                  onFocus={() => setClaimOpen(true)}
                  onBlur={() => setTimeout(() => setClaimOpen(false), 150)}
                  placeholder="Search venues to claim it…"
                  className="field field-with-icon pr-10"
                />
                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-navy" />
                {claimOpen && claimMatches.length > 0 && !claimedVenue && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[14px] border border-line bg-white py-1 shadow-lg">
                    {claimMatches.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setClaimedVenueId(v.id);
                          setClaimOpen(false);
                        }}
                        className="block w-full px-4 py-2.5 text-left hover:bg-sky-soft"
                      >
                        <span className="block text-[14px] font-bold text-navy">{v.name}</span>
                        <span className="block text-[12px] text-ink-muted">{v.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {claimedVenue && (
                <button type="button" onClick={() => setClaimedVenueId('')} className="mt-2 text-[12px] font-medium text-link hover:underline">
                  Not this one? Clear
                </button>
              )}
            </Field>

            {!claimedVenue && (
              <>
                <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  <span className="h-px flex-1 bg-line" />
                  or add a new venue
                  <span className="h-px flex-1 bg-line" />
                </div>
                <Field label="Venue name" id="venue-name">
                  <input id="venue-name" value={venue.name} onChange={(e) => setVenue({ ...venue, name: e.target.value })} placeholder="Merchant Tap House" className="field" />
                </Field>
                <div>
                  <p className="field-label mb-1">Venue type</p>
                  <p className="field-hint mb-3">Pick all that apply.</p>
                  <MultiChips options={venueTypes} value={venue.types} onChange={(types) => setVenue({ ...venue, types })} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_220px]">
                  <Field label="Street address" id="venue-street">
                    <input id="venue-street" value={venue.street} onChange={(e) => setVenue({ ...venue, street: e.target.value })} placeholder="123 Princess St." className="field" />
                  </Field>
                  <Field label="Unit / floor (optional)" id="venue-unit">
                    <input id="venue-unit" value={venue.unit} onChange={(e) => setVenue({ ...venue, unit: e.target.value })} placeholder="Second Floor" className="field" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="City" id="venue-city">
                    <input id="venue-city" value={venue.city} onChange={(e) => setVenue({ ...venue, city: e.target.value })} className="field" />
                  </Field>
                  <Field label="Postal code" id="venue-postal">
                    <input id="venue-postal" value={venue.postal} onChange={(e) => setVenue({ ...venue, postal: e.target.value })} placeholder="K7L 1A1" className="field" />
                  </Field>
                  <Field label="Neighbourhood" id="venue-hood">
                    <select id="venue-hood" value={venue.neighbourhood} onChange={(e) => setVenue({ ...venue, neighbourhood: e.target.value })} className="field">
                      {neighbourhoods.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Venue phone" id="venue-phone">
                    <input id="venue-phone" type="tel" value={venue.phone} onChange={(e) => setVenue({ ...venue, phone: e.target.value })} placeholder="123-456-7890" className="field" />
                  </Field>
                  <Field label="Website" id="venue-website">
                    <input id="venue-website" value={venue.website} onChange={(e) => setVenue({ ...venue, website: e.target.value })} placeholder="website.com" className="field" />
                  </Field>
                </div>
                <Field label="Instagram (optional)" id="venue-ig">
                  <div className="relative">
                    <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-link" />
                    <input id="venue-ig" value={venue.instagram} onChange={(e) => setVenue({ ...venue, instagram: e.target.value })} placeholder="instagramaccount" className="field field-with-icon" />
                  </div>
                </Field>
                <Field label="About the venue" id="venue-about">
                  <textarea
                    id="venue-about"
                    rows={3}
                    value={venue.about}
                    onChange={(e) => setVenue({ ...venue, about: e.target.value })}
                    placeholder="A sentence or two about what it’s like."
                    className="field"
                  />
                </Field>
                <div>
                  <p className="field-label">Opening hours</p>
                  <div className="overflow-hidden rounded-[14px] border border-line">
                    {days.map((d) => {
                      const h = hours[d];
                      return (
                        <div key={d} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                          <span className="w-10 text-[14px] font-medium text-navy">{d}</span>
                          <input
                            type="time"
                            disabled={h.closed}
                            value={h.open}
                            onChange={(e) => setHours({ ...hours, [d]: { ...h, open: e.target.value } })}
                            className="h-9 rounded-[10px] border border-line px-3 text-[13px] text-navy disabled:opacity-40"
                            aria-label={`${d} opening time`}
                          />
                          <span className="text-[13px] text-ink-muted">to</span>
                          <input
                            type="time"
                            disabled={h.closed}
                            value={h.close}
                            onChange={(e) => setHours({ ...hours, [d]: { ...h, close: e.target.value } })}
                            className="h-9 rounded-[10px] border border-line px-3 text-[13px] text-navy disabled:opacity-40"
                            aria-label={`${d} closing time`}
                          />
                          <span className="ml-auto flex items-center gap-2 text-[13px] text-navy">
                            <button
                              type="button"
                              className="switch"
                              data-on={h.closed}
                              onClick={() => setHours({ ...hours, [d]: { ...h, closed: !h.closed } })}
                              aria-label={`${d} closed`}
                            >
                              <span />
                            </button>
                            Closed
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </Section>

          <Section number={3} title="Accessibility" hint="Help people know what to expect before they arrive.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {accessibilityOptions.map((o) => (
                <Checkbox
                  key={o}
                  label={o}
                  checked={accessibility.includes(o)}
                  onChange={(v) => setAccessibility(v ? [...accessibility, o] : accessibility.filter((x) => x !== o))}
                />
              ))}
            </div>
            <Field label="Accessibility notes (optional)" id="a11y-notes">
              <textarea
                id="a11y-notes"
                rows={3}
                value={accessibilityNotes}
                onChange={(e) => setAccessibilityNotes(e.target.value)}
                placeholder="e.g., Ramp at the side door on Ontario St. Washroom is on the main floor."
                className="field"
              />
            </Field>
          </Section>

          <Section number={4} title="Confirm you’re connected to the venue" hint="We check every new organizer before their first listing goes up. Usually within 1–2 business days.">
            <div>
              <p className="field-label mb-1">How can we confirm?</p>
              <p className="field-hint mb-3">An email at the venue&rsquo;s website domain or an email listed on the website is fastest.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="chip h-10" data-active={confirmMethod === 'email'} onClick={() => setConfirmMethod('email')}>
                  Use my work email
                </button>
                <button type="button" className="chip h-10" data-active={confirmMethod === 'document'} onClick={() => setConfirmMethod('document')}>
                  Send a document by email
                </button>
              </div>
            </div>
            <Field label="Anything else we should know? (optional)" id="org-notes">
              <textarea id="org-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., I book the bands for both of our locations." className="field" />
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox checked={agree} onChange={setAgree} label="I agree to the Terms and Listing guidelines" />
              <Checkbox checked={newsletter} onChange={setNewsletter} label="Email me tips and news for venues (recommended)" />
            </div>
          </Section>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[14px] text-ink-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-link hover:underline">
                Sign in
              </Link>
            </p>
            <button type="submit" disabled={submitting} className="btn-sun h-[52px] px-7 text-[15px]">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Create organizer account →'}
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 self-start w-full">
          <div className="card p-6">
            <p className="text-[18px] font-bold text-navy">How organizer accounts work</p>
            <ol className="mt-4 flex flex-col gap-4">
              {[
                ['Create your account', 'Add yourself and your venue once.'],
                ['We confirm you', 'Every new organizer is checked by our team — usually 1–2 business days.'],
                ['Post events & specials', 'Pick your venue when you submit. Listings are reviewed before they go live.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky text-[13px] font-bold text-navy">{i + 1}</span>
                  <span>
                    <span className="block text-[14px] font-bold text-navy">{t}</span>
                    <span className="block text-[13px] leading-[1.45] text-ink-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[22px] bg-navy p-6 text-white">
            <span className="tag bg-sun text-navy gap-1">
              <Check size={12} strokeWidth={3} /> Approved organizer
            </span>
            <p className="mt-4 text-[18px] font-bold">Skip the wait</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-on-dark-muted">
              After a few accurate listings, our team can make you an Approved organizer. Your events and specials then go live
              straight away — no review needed.
            </p>
          </div>
          <div className="rounded-[22px] bg-sky p-6">
            <p className="text-[18px] font-bold text-navy">Run more than one place?</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
              Mention every venue you manage in the notes. When you post, just pick which one — and keep an eye on all your listings
              from My Events.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
