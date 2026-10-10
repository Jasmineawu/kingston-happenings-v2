'use client';

import { useState, useRef, useCallback, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  Upload,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import type { Event, EventCategory } from '@/types/event';
import { categoryLabels, categoryTagStyles } from '@/constants/categories';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents } from '@/contexts/EventsContext';
import { DatePicker, VenueSelector } from '@/components';
import { addDays, parseISO, format } from 'date-fns';
import { compressImage } from '@/utils/compression';
import { generateId, normalizeUrl } from '@/utils/formatting';
import { Tag, formatTime } from '@/components/brand';

type PriceType = 'na' | 'free' | 'amount';
type RecurrencePattern = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
type FormType = 'event' | 'special';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Monday-first for the day picker
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

// Categories organizers can pick for events (19+ is handled by the age-limit control)
const eventCategoryOptions: EventCategory[] = [
  'live-music',
  'activity-nights',
  'daytime',
  'sports',
  'theatre',
  'market',
  'workshop',
  'family',
  'concert',
  'trivia',
  'festival',
  'nightlife',
  'community',
];

interface EventFormData {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  newVenueName: string;
  newVenueAddress: string;
  categories: EventCategory[];
  priceType: PriceType;
  priceAmount: string;
  ticketUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  recurrenceEndDate: string;
  customDates: string[];
  isAllDay: boolean;
}

interface SpecialFormData {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  newVenueName: string;
  newVenueAddress: string;
  categories: ('food' | 'drink')[];
  price: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrencePattern: 'none' | 'weekly' | 'days';
  recurrenceEndDate: string;
  recurringDays: string[];
  is19Plus: boolean;
}

const createEmptyForm = (): EventFormData => ({
  id: generateId(),
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  venueId: '',
  newVenueName: '',
  newVenueAddress: '',
  categories: [],
  priceType: 'na',
  priceAmount: '',
  ticketUrl: '',
  imageFile: null,
  imagePreview: '',
  isRecurring: false,
  recurrencePattern: 'none',
  recurrenceEndDate: '',
  customDates: [],
  isAllDay: false,
});

const createEmptySpecialForm = (): SpecialFormData => ({
  id: generateId(),
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  venueId: '',
  newVenueName: '',
  newVenueAddress: '',
  categories: ['food'],
  price: '',
  isAllDay: false,
  isRecurring: true,
  recurrencePattern: 'days',
  recurrenceEndDate: '',
  recurringDays: [],
  is19Plus: false,
});

const MAX_DESCRIPTION_LENGTH = 500;

/* ---------------- UI helpers ---------------- */

function Section({
  number,
  title,
  children,
  sectionRef,
}: {
  number: number;
  title: string;
  children: ReactNode;
  sectionRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <section ref={sectionRef} className="card p-5 sm:p-7">
      <h3 className="flex items-center gap-3 text-[20px] font-bold text-navy">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">
          {number}
        </span>
        {title}
      </h3>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <button type="button" className="switch mt-0.5" data-on={on} onClick={() => onChange(!on)} aria-pressed={on} aria-label={label}>
        <span />
      </button>
      <div>
        <p className="text-[14px] font-medium text-navy">{label}</p>
        {hint && <p className="field-hint">{hint}</p>}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" data-active={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TimeInput({ id, value, onChange, required }: { id: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="relative">
      <Clock size={16} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-link" />
      <input type="time" id={id} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="field pl-10" />
    </div>
  );
}

function SubmitSidebar({ formType, instant }: { formType: FormType; instant: boolean }) {
  const noun = formType === 'event' ? 'event' : 'special';
  const steps = instant
    ? [
        ['Fill in the details', 'Tell us what, when and where.'],
        ['Publish', 'Listings go live right away.'],
        ['It goes live', 'On Today, Browse and in your venue.'],
      ]
    : [
        ['Fill in the details', 'Tell us what, when and where.'],
        ['We review it', 'Usually within 24 hours.'],
        ['It goes live', 'On Today, Browse and in your venue.'],
      ];
  const tips =
    formType === 'event'
      ? ['Use a short, specific title', 'Set it as recurring if it repeats', 'Add a photo — listings with images get more saves']
      : ['Lead with the deal: “$5 pints”', 'Add a photo of the actual dish or drink', 'Say if it’s dine-in only or 19+', 'Set every day it runs — not just today'];
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-24 self-start w-full">
      <div className="rounded-[22px] bg-navy p-6 text-white">
        <p className="eyebrow-bold text-sun">Post your {noun}</p>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun text-[12px] font-bold text-navy">
                {i + 1}
              </span>
              <span>
                <span className="block text-[14px] font-bold">{t}</span>
                <span className="block text-[12px] text-on-dark-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-[22px] bg-sky p-6">
        <p className="eyebrow-sm">Tips for a great listing</p>
        <ul className="mt-3 flex flex-col gap-2">
          {tips.map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13px] text-navy">
              <Check size={14} className="mt-0.5 shrink-0 text-link" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ---------------- Page ---------------- */

interface SubmittedSummary {
  formType: FormType;
  count: number;
  title: string;
  venueName: string;
  when: string;
  time: string;
  tags: EventCategory[];
  submittedAt: Date;
  eventId?: string;
}

function SubmitContent() {
  const searchParams = useSearchParams();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { submitEvent, venues } = useEvents();

  const [formType, setFormType] = useState<FormType>(searchParams.get('type') === 'special' ? 'special' : 'event');
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [eventForms, setEventForms] = useState<EventFormData[]>([createEmptyForm()]);
  const [specialForms, setSpecialForms] = useState<SpecialFormData[]>([createEmptySpecialForm()]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const registerFieldRef = (key: string) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el;
  };

  // Scroll the offending field/section into view and focus its first control
  const scrollToField = (key: string) => {
    requestAnimationFrame(() => {
      const el = fieldRefs.current[key];
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = el.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button');
      (focusable || el).focus?.({ preventScroll: true });
    });
  };

  const updateForm = (formId: string, updates: Partial<EventFormData>) => {
    setEventForms((prev) => prev.map((form) => (form.id === formId ? { ...form, ...updates } : form)));
  };

  const updateSpecialForm = (formId: string, updates: Partial<SpecialFormData>) => {
    setSpecialForms((prev) => prev.map((form) => (form.id === formId ? { ...form, ...updates } : form)));
  };

  const handleCategoryToggle = (formId: string, category: EventCategory) => {
    setEventForms((prev) =>
      prev.map((form) =>
        form.id !== formId
          ? form
          : {
              ...form,
              categories: form.categories.includes(category)
                ? form.categories.filter((c) => c !== category)
                : [...form.categories, category],
            }
      )
    );
  };

  const handleImageSelect = async (formId: string, file: File) => {
    const compressed = await compressImage(file);
    updateForm(formId, { imageFile: file, imagePreview: compressed });
  };

  const handleImageDrop = useCallback((formId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageSelect(formId, file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeImage = (formId: string) => {
    updateForm(formId, { imageFile: null, imagePreview: '' });
    if (fileInputRefs.current[formId]) fileInputRefs.current[formId]!.value = '';
  };

  const resetForms = () => {
    setEventForms([createEmptyForm()]);
    setSpecialForms([createEmptySpecialForm()]);
    setError('');
  };

  const venueNameFor = (venueId: string, newName: string) =>
    venueId === 'new' ? newName : venues.find((v) => v.id === venueId)?.name || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formType === 'event') {
      for (const form of eventForms) {
        if (form.categories.filter((c) => c !== '19plus').length === 0) {
          setError(`Please select at least one category for "${form.title || 'untitled event'}"`);
          scrollToField(`categories-${form.id}`);
          return;
        }
        if (!form.date) {
          setError(`Please pick a date for "${form.title || 'untitled event'}"`);
          scrollToField(`date-${form.id}`);
          return;
        }
        if (!form.venueId) {
          setError(`Please select a venue or create a new one for "${form.title || 'untitled event'}"`);
          scrollToField(`venue-${form.id}`);
          return;
        }
        if (form.venueId === 'new' && (!form.newVenueName || !form.newVenueAddress)) {
          setError(`Please provide both venue name and address for "${form.title || 'untitled event'}"`);
          scrollToField(`venue-${form.id}`);
          return;
        }
        if (form.isRecurring && form.recurrencePattern === 'weekly' && !form.recurrenceEndDate) {
          setError(
            `Please select an end date for the recurring weekly event "${form.title || 'untitled event'}". Maximum duration is 52 weeks.`
          );
          scrollToField(`recurrenceEndDate-${form.id}`);
          return;
        }
        if (form.isRecurring && form.recurrencePattern === 'weekly' && form.recurrenceEndDate && form.date) {
          const weeksDiff = Math.ceil(
            (parseISO(form.recurrenceEndDate).getTime() - parseISO(form.date).getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          if (weeksDiff > 52) {
            setError(
              `The recurrence period for "${form.title || 'untitled event'}" cannot exceed 52 weeks. Please select an end date within 52 weeks from the start date.`
            );
            scrollToField(`recurrenceEndDate-${form.id}`);
            return;
          }
        }
      }

      setIsSubmitting(true);
      try {
        let first: Event | null = null;
        for (const form of eventForms) {
          let priceString: string | undefined;
          if (form.priceType === 'free') priceString = 'Free';
          else if (form.priceType === 'amount' && form.priceAmount) priceString = form.priceAmount.trim();

          const created = await submitEvent({
            title: form.title,
            description: form.description,
            date: form.date,
            startTime: form.isAllDay ? '00:00' : form.startTime,
            endTime: form.isAllDay ? undefined : form.endTime || undefined,
            venueId: form.venueId === 'new' ? 'new' : form.venueId || undefined,
            newVenueName: form.venueId === 'new' ? form.newVenueName : undefined,
            newVenueAddress: form.venueId === 'new' ? form.newVenueAddress : undefined,
            categories: form.categories,
            price: priceString,
            ticketUrl: normalizeUrl(form.ticketUrl) || undefined,
            imageUrl: form.imagePreview || undefined,
            isRecurring: form.isRecurring,
            recurrencePattern: form.isRecurring ? form.recurrencePattern : undefined,
            recurrenceEndDate: form.isRecurring ? form.recurrenceEndDate || undefined : undefined,
            isAllDay: form.isAllDay,
          });
          first = first ?? created;
        }
        const f = eventForms[0];
        setSubmitted({
          formType: 'event',
          count: eventForms.length,
          title: f.title,
          venueName: venueNameFor(f.venueId, f.newVenueName),
          when:
            f.isRecurring && f.recurrencePattern !== 'custom' && f.date
              ? `${f.recurrencePattern === 'monthly' ? 'Monthly' : f.recurrencePattern === 'biweekly' ? 'Every 2 weeks' : 'Every'} ${dayNames[parseISO(f.date).getDay()]}`
              : format(parseISO(f.date), 'EEEE, MMMM d'),
          time: f.isAllDay ? 'All day' : `${formatTime(f.startTime)}${f.endTime ? ` – ${formatTime(f.endTime)}` : ''}`,
          tags: f.categories.slice(0, 2),
          submittedAt: new Date(),
          eventId: first?.id,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('[Submit] Error submitting events:', err);
        setError(err instanceof Error ? err.message : 'Failed to submit event(s). Please try again.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Specials
    for (const form of specialForms) {
      if (form.categories.length === 0) {
        setError(`Please select Food, Drinks or both for "${form.title || 'untitled special'}"`);
        scrollToField(`special-categories-${form.id}`);
        return;
      }
      if (form.isRecurring && form.recurrencePattern === 'days' && form.recurringDays.length === 0) {
        setError(`Please pick which days "${form.title || 'untitled special'}" runs`);
        scrollToField(`special-days-${form.id}`);
        return;
      }
      if (!form.date) {
        setError(`Please pick a start date for "${form.title || 'untitled special'}"`);
        scrollToField(`special-date-${form.id}`);
        return;
      }
      if (!form.venueId) {
        setError(`Please select a venue or create a new one for "${form.title || 'untitled special'}"`);
        scrollToField(`special-venue-${form.id}`);
        return;
      }
      if (form.venueId === 'new' && (!form.newVenueName || !form.newVenueAddress)) {
        setError(`Please provide both venue name and address for "${form.title || 'untitled special'}"`);
        scrollToField(`special-venue-${form.id}`);
        return;
      }
      if (form.isRecurring && form.recurrenceEndDate && form.date) {
        const weeksDiff = Math.ceil(
          (parseISO(form.recurrenceEndDate).getTime() - parseISO(form.date).getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        if (weeksDiff > 52) {
          setError(`The run for "${form.title || 'untitled special'}" cannot exceed 52 weeks.`);
          scrollToField(`special-recurrenceEndDate-${form.id}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      let first: Event | null = null;
      for (const form of specialForms) {
        // Store 'food-deal' (general filtering) plus 'food'/'drink' (specific filtering)
        const categories: EventCategory[] = ['food-deal'];
        if (form.categories.includes('food')) categories.push('food');
        if (form.categories.includes('drink')) categories.push('drink');
        if (form.is19Plus) categories.push('19plus');

        const base = {
          title: form.title,
          description: form.description,
          date: form.date,
          startTime: form.isAllDay ? '00:00' : form.startTime,
          endTime: form.isAllDay ? undefined : form.endTime || undefined,
          venueId: form.venueId === 'new' ? 'new' : form.venueId || undefined,
          newVenueName: form.venueId === 'new' ? form.newVenueName : undefined,
          newVenueAddress: form.venueId === 'new' ? form.newVenueAddress : undefined,
          categories,
          price: form.price || undefined,
          ticketUrl: undefined,
          isAllDay: form.isAllDay,
        };

        const created =
          form.isRecurring && form.recurrencePattern === 'days' && form.recurringDays.length > 0
            ? await submitEvent({
                ...base,
                isRecurring: true,
                recurrencePattern: 'weekly',
                recurrenceEndDate: form.recurrenceEndDate || undefined,
                recurrenceDays: form.recurringDays.map((day) => dayNames.indexOf(day)).filter((d) => d >= 0),
              })
            : await submitEvent({ ...base, isRecurring: false });
        first = first ?? created;
      }
      const f = specialForms[0];
      const days = [...f.recurringDays].sort((a, b) => weekOrder.indexOf(dayNames.indexOf(a)) - weekOrder.indexOf(dayNames.indexOf(b)));
      setSubmitted({
        formType: 'special',
        count: specialForms.length,
        title: f.title,
        venueName: venueNameFor(f.venueId, f.newVenueName),
        when: f.isRecurring && days.length > 0 ? `Every ${days.join(' & ')}` : format(parseISO(f.date), 'EEEE, MMMM d'),
        time: f.isAllDay ? 'All day' : `${formatTime(f.startTime)}${f.endTime ? ` – ${formatTime(f.endTime)}` : ''}`,
        tags: f.categories.includes('food') ? ['food'] : ['drink'],
        submittedAt: new Date(),
        eventId: first?.id,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Failed to submit special(s). Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  /* ---------- Signed-out gate ---------- */
  if (!user) {
    return (
      <div className="bg-sky-soft px-4 py-16">
        <div className="mx-auto max-w-[440px] rounded-[22px] border border-line bg-white p-8 text-center">
          <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sky text-navy">
            <Lock size={20} />
          </div>
          <p className="eyebrow-sm mt-5">— Submit an event</p>
          <h1 className="mt-3 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-navy">
            Create an account
            <br />
            to post
          </h1>
          <p className="mt-4 text-[14px] leading-[1.5] text-ink-muted">
            Submitting events and specials requires an account. If you are associated with a venue or are an artist, you can
            create an Organizer account!
          </p>
          <ul className="mx-auto mt-5 flex w-fit flex-col gap-2 text-left">
            {['Track every submission in My Events', 'Edit or cancel a listing anytime', 'Get an email the moment it goes live'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-[13px] text-navy">
                <Check size={14} className="text-link" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link href="/login?redirect=/submit" className="btn-sun w-full">
              Sign in
            </Link>
            <Link href="/register" className="btn-outline w-full">
              Create account
            </Link>
          </div>
          <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-muted">
            Run a venue?{' '}
            <Link href="/become-organizer" className="font-medium text-link hover:underline">
              Become an organizer →
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-muted">
          Just looking around?{' '}
          <Link href="/events" className="font-medium text-navy underline">
            Browse what&rsquo;s on →
          </Link>
        </p>
      </div>
    );
  }

  /* ---------- Thank-you ---------- */
  if (submitted) {
    const noun = submitted.formType === 'event' ? 'event' : 'special';
    const plural = submitted.count > 1;
    return (
      <div className="page-container pb-24 pt-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sun text-navy">
              <Check size={26} strokeWidth={2.5} />
            </div>
            <p className="eyebrow mt-6">— {isAdmin ? 'Published' : 'Submitted'}</p>
            <h1 className="display-section mt-3">Thank you</h1>
            <p className="mt-4 text-[18px] text-ink-muted">
              {isAdmin
                ? `Your ${noun}${plural ? 's are' : ' is'} live now.`
                : `We’ve got your ${noun}${plural ? 's' : ''} and will review ${plural ? 'them' : 'it'} soon!`}
            </p>

            {!isAdmin && (
              <>
                <p className="eyebrow-sm mt-10">What happens next</p>
                <div className="card mt-3 px-5">
                  {[
                    ['We review it', 'Usually within 24 hours.'],
                    ['It shows in My Events', 'Check its status anytime under Submitted.'],
                    ['It goes live', `On Today, Browse and ${submitted.venueName ? `${submitted.venueName}’s` : 'the'} venue page.`],
                  ].map(([t, d], i) => (
                    <div key={t} className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>
                        <span className="block text-[15px] font-bold text-navy">{t}</span>
                        <span className="block text-[12px] text-ink-muted">{d}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSubmitted(null);
                  resetForms();
                }}
                className="btn-sun"
              >
                Submit another
              </button>
              <Link href="/my-events?tab=submitted" className="btn-outline">
                Go to My Events
              </Link>
            </div>
          </div>

          <div>
            <p className="eyebrow-sm">Your submission{plural ? 's' : ''}</p>
            <div className="card mt-3 p-5">
              <div className="flex flex-wrap gap-1.5">
                {submitted.tags.map((c) => (
                  <Tag key={c} className={categoryTagStyles[c]}>
                    {submitted.formType === 'special' ? (c === 'food' ? 'Food' : 'Drinks') : categoryLabels[c]}
                  </Tag>
                ))}
                {isAdmin ? (
                  <Tag className="bg-success-tint text-success gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live now
                  </Tag>
                ) : (
                  <Tag className="bg-[#fff1d6] text-[#8a5a00] gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sun" /> In review
                  </Tag>
                )}
              </div>
              <p className="mt-3 text-[20px] font-bold text-navy">{submitted.title}</p>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-ink-muted">
                {submitted.venueName && (
                  <li className="flex items-center gap-2">
                    <MapPin size={14} className="text-link" />
                    {submitted.venueName}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Calendar size={14} className="text-link" />
                  {submitted.when}
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={14} className="text-link" />
                  {submitted.time}
                </li>
              </ul>
              {plural && (
                <p className="mt-3 text-[12px] text-ink-muted">
                  + {submitted.count - 1} more {noun}
                  {submitted.count - 1 > 1 ? 's' : ''}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px]">
                <span className="text-ink-muted">Submitted {format(submitted.submittedAt, "MMM d, yyyy · h:mm a")}</span>
                {isAdmin && submitted.eventId ? (
                  <Link href={`/events/${submitted.eventId}`} className="font-medium text-link hover:underline">
                    View it live →
                  </Link>
                ) : submitted.eventId ? (
                  <Link href={`/events/${submitted.eventId}/edit`} className="font-medium text-link hover:underline">
                    Edit submission
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Form ---------- */
  const isEvent = formType === 'event';

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— Submit</p>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display-section">
          {isEvent ? (
            <>
              Share what&rsquo;s
              <br />
              happening
            </>
          ) : (
            <>
              Share a
              <br />
              special
            </>
          )}
        </h1>
        <div className="segmented self-start sm:self-auto sm:mb-2">
          <button
            type="button"
            className="segmented-item h-10 px-5"
            data-active={isEvent}
            onClick={() => {
              setFormType('event');
              setError('');
            }}
          >
            Event
          </button>
          <button
            type="button"
            className="segmented-item h-10 px-5"
            data-active={!isEvent}
            onClick={() => {
              setFormType('special');
              setError('');
            }}
          >
            Food &amp; drink special
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[14px] bg-[#fff1d6] px-4 py-3 text-[13px] text-navy">
          <span className="tag bg-sun text-navy gap-1">
            <Check size={12} strokeWidth={3} /> Approved organizer
          </span>
          Signed in as {user.name}. Your listings go live right away — no review needed.
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-[14px] bg-danger-tint p-4 text-[14px] text-danger">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {isEvent
            ? eventForms.map((formData, formIndex) => (
                <div key={formData.id} className="flex flex-col gap-4">
                  {eventForms.length > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[22px] font-bold text-navy">Event {formIndex + 1}</p>
                      <button
                        type="button"
                        onClick={() => setEventForms((prev) => prev.filter((f) => f.id !== formData.id))}
                        className="flex items-center gap-1 text-[13px] font-medium text-danger hover:underline"
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  )}

                  <Section number={1} title="Event details">
                    <div>
                      <label htmlFor={`title-${formData.id}`} className="field-label">
                        Event title
                      </label>
                      <input
                        id={`title-${formData.id}`}
                        required
                        value={formData.title}
                        onChange={(e) => updateForm(formData.id, { title: e.target.value })}
                        placeholder="e.g., Trivia Night at The Ale House"
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor={`description-${formData.id}`} className="field-label">
                        Description
                      </label>
                      <textarea
                        id={`description-${formData.id}`}
                        required
                        rows={4}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        value={formData.description}
                        onChange={(e) => updateForm(formData.id, { description: e.target.value })}
                        placeholder="Tell people what they can expect at your event..."
                        className="field"
                      />
                      <div className="mt-1 flex justify-between">
                        <span className="field-hint">The first line shows on the Browse page and event previews.</span>
                        <span className="field-hint">
                          {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="field-label">Photo (optional)</p>
                      {formData.imagePreview ? (
                        <div className="relative overflow-hidden rounded-[14px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={formData.imagePreview} alt="Event preview" className="h-48 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(formData.id)}
                            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white"
                            aria-label="Remove photo"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleImageDrop(formData.id, e)}
                          onClick={() => fileInputRefs.current[formData.id]?.click()}
                          className="cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-link/50 bg-sky-soft p-7 text-center transition-colors hover:bg-sky"
                        >
                          <Upload size={22} className="mx-auto text-link" />
                          <p className="mt-2 text-[14px] font-medium text-navy">Drag your photo here, or click to upload</p>
                          <p className="field-hint mt-1">PNG, JPG up to 5MB · Recommended 800×600</p>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={(el) => {
                          fileInputRefs.current[formData.id] = el;
                        }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(formData.id, file);
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </Section>

                  <Section number={2} title="Date & time">
                    <div className={`grid grid-cols-1 gap-4 ${formData.isAllDay ? '' : 'sm:grid-cols-3'}`}>
                      <div ref={registerFieldRef(`date-${formData.id}`)}>
                        <label htmlFor={`date-${formData.id}`} className="field-label">
                          Date
                        </label>
                        <DatePicker
                          id={`date-${formData.id}`}
                          value={formData.date}
                          onChange={(value) => updateForm(formData.id, { date: value })}
                          required
                          placeholder="Select date"
                        />
                      </div>
                      {!formData.isAllDay && (
                        <>
                          <div>
                            <label htmlFor={`startTime-${formData.id}`} className="field-label">
                              Start time
                            </label>
                            <TimeInput
                              id={`startTime-${formData.id}`}
                              required
                              value={formData.startTime}
                              onChange={(v) => updateForm(formData.id, { startTime: v })}
                            />
                          </div>
                          <div>
                            <label htmlFor={`endTime-${formData.id}`} className="field-label">
                              End time
                            </label>
                            <TimeInput
                              id={`endTime-${formData.id}`}
                              value={formData.endTime}
                              onChange={(v) => updateForm(formData.id, { endTime: v })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <Toggle
                      on={formData.isAllDay}
                      onChange={(v) => updateForm(formData.id, { isAllDay: v, startTime: v ? '00:00' : '', endTime: '' })}
                      label="This is an all-day event"
                    />
                    <Toggle
                      on={formData.isRecurring}
                      onChange={(v) =>
                        updateForm(formData.id, { isRecurring: v, recurrencePattern: v ? 'weekly' : 'none', recurrenceEndDate: '' })
                      }
                      label="This is a recurring event"
                    />
                    {formData.isRecurring && (
                      <div className="flex flex-col gap-4 rounded-[14px] bg-sky-soft p-4">
                        <ChipGroup
                          value={formData.recurrencePattern}
                          onChange={(v) => updateForm(formData.id, { recurrencePattern: v, customDates: [] })}
                          options={[
                            { id: 'weekly', label: 'Every week' },
                            { id: 'biweekly', label: 'Every 2 weeks' },
                            { id: 'monthly', label: 'Every month' },
                            { id: 'custom', label: 'Multiple specific dates' },
                          ]}
                        />
                        {formData.date && formData.recurrencePattern !== 'custom' && (
                          <p className="field-hint">
                            Repeats {formData.recurrencePattern === 'monthly' ? 'monthly on' : formData.recurrencePattern === 'biweekly' ? 'every other' : 'every'}{' '}
                            {dayNames[parseISO(formData.date).getDay()]}
                          </p>
                        )}
                        {formData.recurrencePattern !== 'custom' ? (
                          <div ref={registerFieldRef(`recurrenceEndDate-${formData.id}`)}>
                            <label className="field-label">Until{formData.recurrencePattern === 'weekly' ? '' : ' (optional)'}</label>
                            <DatePicker
                              value={formData.recurrenceEndDate}
                              onChange={(value) => updateForm(formData.id, { recurrenceEndDate: value })}
                              min={formData.date}
                              max={
                                formData.recurrencePattern === 'weekly' && formData.date
                                  ? format(addDays(parseISO(formData.date), 52 * 7), 'yyyy-MM-dd')
                                  : undefined
                              }
                              required={formData.recurrencePattern === 'weekly'}
                              placeholder="Pick an end date"
                            />
                            <p className="field-hint mt-1">
                              {formData.recurrencePattern === 'weekly'
                                ? 'Required. Up to 52 weeks from the start date.'
                                : 'Leave empty for no end date (max 52 weeks).'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="field-label">Additional dates</label>
                            {formData.customDates.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {formData.customDates.map((date, idx) => (
                                  <span key={date} className="chip h-8" data-active="true">
                                    {format(parseISO(date), 'EEE, MMM d')}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateForm(formData.id, { customDates: formData.customDates.filter((_, i) => i !== idx) })
                                      }
                                      aria-label="Remove date"
                                    >
                                      <X size={13} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <DatePicker
                              value=""
                              onChange={(value) => {
                                if (value && !formData.customDates.includes(value)) {
                                  updateForm(formData.id, { customDates: [...formData.customDates, value].sort() });
                                }
                              }}
                              min={formData.date}
                              placeholder="Click to add a date"
                            />
                            <p className="field-hint mt-1">The first date is set above.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Section>

                  <Section number={3} title="Location" sectionRef={registerFieldRef(`venue-${formData.id}`)}>
                    <VenueSelector
                      venues={venues}
                      selectedVenueId={formData.venueId}
                      newVenueName={formData.newVenueName}
                      newVenueAddress={formData.newVenueAddress}
                      onVenueSelect={(venueId) => updateForm(formData.id, { venueId })}
                      onNewVenueNameChange={(name) => updateForm(formData.id, { newVenueName: name })}
                      onNewVenueAddressChange={(address) => updateForm(formData.id, { newVenueAddress: address })}
                      required
                      id={`venue-${formData.id}`}
                    />
                    <p className="text-[12px] text-link">Can&rsquo;t find your venue? Add a new one and we&rsquo;ll review it with your event.</p>
                  </Section>

                  <Section number={4} title="Categories" sectionRef={registerFieldRef(`categories-${formData.id}`)}>
                    <div>
                      <p className="field-hint mb-3">Pick all that fit best.</p>
                      <div className="flex flex-wrap gap-2">
                        {eventCategoryOptions.map((category) => {
                          const selected = formData.categories.includes(category);
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => handleCategoryToggle(formData.id, category)}
                              aria-pressed={selected}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors ${
                                selected ? `${categoryTagStyles[category]} font-bold` : 'border border-line bg-white text-navy hover:border-navy'
                              }`}
                            >
                              {selected && <Check size={13} strokeWidth={3} />}
                              {categoryLabels[category]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="field-label mb-1">Age limit</p>
                      <p className="field-hint mb-3">Who can come? Shown as a tag on the listing.</p>
                      <ChipGroup
                        value={formData.categories.includes('19plus') ? '19' : 'all'}
                        onChange={(v) =>
                          updateForm(formData.id, {
                            categories:
                              v === '19'
                                ? [...formData.categories.filter((c) => c !== '19plus'), '19plus']
                                : formData.categories.filter((c) => c !== '19plus'),
                          })
                        }
                        options={[
                          { id: 'all', label: 'All ages' },
                          { id: '19', label: '19+' },
                        ]}
                      />
                    </div>
                  </Section>

                  <Section number={5} title="Pricing & tickets">
                    <ChipGroup
                      value={formData.priceType}
                      onChange={(v) => updateForm(formData.id, { priceType: v, priceAmount: v === 'amount' ? formData.priceAmount : '' })}
                      options={[
                        { id: 'free', label: 'Free' },
                        { id: 'amount', label: 'Paid' },
                        { id: 'na', label: 'Not sure / N/A' },
                      ]}
                    />
                    <div className={`grid grid-cols-1 gap-4 ${formData.priceType === 'amount' ? 'sm:grid-cols-2' : ''}`}>
                      {formData.priceType === 'amount' && (
                        <div>
                          <label htmlFor={`priceAmount-${formData.id}`} className="field-label">
                            Price ($)
                          </label>
                          <input
                            id={`priceAmount-${formData.id}`}
                            value={formData.priceAmount}
                            onChange={(e) => updateForm(formData.id, { priceAmount: e.target.value })}
                            placeholder="e.g., 15, 20-40"
                            className="field"
                          />
                        </div>
                      )}
                      <div>
                        <label htmlFor={`ticketUrl-${formData.id}`} className="field-label">
                          Ticket / registration link (optional)
                        </label>
                        <div className="relative">
                          <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-link" />
                          <input
                            id={`ticketUrl-${formData.id}`}
                            value={formData.ticketUrl}
                            onChange={(e) => updateForm(formData.id, { ticketUrl: e.target.value })}
                            placeholder="e.g., ticketmaster.com/event/abc"
                            className="field field-with-icon"
                          />
                        </div>
                      </div>
                    </div>
                  </Section>
                </div>
              ))
            : specialForms.map((formData, formIndex) => (
                <div key={formData.id} className="flex flex-col gap-4">
                  {specialForms.length > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[22px] font-bold text-navy">Special {formIndex + 1}</p>
                      <button
                        type="button"
                        onClick={() => setSpecialForms((prev) => prev.filter((f) => f.id !== formData.id))}
                        className="flex items-center gap-1 text-[13px] font-medium text-danger hover:underline"
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  )}

                  <Section number={1} title="The deal" sectionRef={registerFieldRef(`special-categories-${formData.id}`)}>
                    <div>
                      <label htmlFor={`special-title-${formData.id}`} className="field-label">
                        Special name
                      </label>
                      <input
                        id={`special-title-${formData.id}`}
                        required
                        value={formData.title}
                        onChange={(e) => updateSpecialForm(formData.id, { title: e.target.value })}
                        placeholder="e.g., Half-Price Wings"
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor={`special-price-${formData.id}`} className="field-label">
                        The deal
                      </label>
                      <input
                        id={`special-price-${formData.id}`}
                        value={formData.price}
                        onChange={(e) => updateSpecialForm(formData.id, { price: e.target.value })}
                        placeholder="e.g., $5 pints · Half-price wings · $12 burger & pint"
                        className="field"
                      />
                      <p className="field-hint mt-1">The price or discount — shown in bold on the listing.</p>
                    </div>
                    <div>
                      <label htmlFor={`special-description-${formData.id}`} className="field-label">
                        Description
                      </label>
                      <textarea
                        id={`special-description-${formData.id}`}
                        required
                        rows={3}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        value={formData.description}
                        onChange={(e) => updateSpecialForm(formData.id, { description: e.target.value })}
                        placeholder="Anything else people should know — what’s included, how to order..."
                        className="field"
                      />
                      <div className="mt-1 flex justify-end">
                        <span className="field-hint">
                          {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="field-label">Type</p>
                      <ChipGroup
                        value={
                          formData.categories.length === 2 ? 'both' : formData.categories[0] === 'drink' ? 'drink' : 'food'
                        }
                        onChange={(v) =>
                          updateSpecialForm(formData.id, {
                            categories: v === 'both' ? ['food', 'drink'] : [v as 'food' | 'drink'],
                          })
                        }
                        options={[
                          { id: 'food', label: 'Food' },
                          { id: 'drink', label: 'Drinks' },
                          { id: 'both', label: 'Food & drinks' },
                        ]}
                      />
                    </div>
                  </Section>

                  <Section number={2} title="When it runs">
                    <div>
                      <p className="field-label">How often?</p>
                      <ChipGroup
                        value={formData.isRecurring ? 'weekly' : 'once'}
                        onChange={(v) =>
                          updateSpecialForm(formData.id, {
                            isRecurring: v === 'weekly',
                            recurrencePattern: v === 'weekly' ? 'days' : 'none',
                            recurrenceEndDate: '',
                          })
                        }
                        options={[
                          { id: 'weekly', label: 'Every week' },
                          { id: 'once', label: 'One day only' },
                        ]}
                      />
                    </div>
                    {formData.isRecurring && (
                      <div ref={registerFieldRef(`special-days-${formData.id}`)}>
                        <p className="field-label mb-1">Which days?</p>
                        <p className="field-hint mb-3">Pick every day the special runs.</p>
                        <div className="flex flex-wrap gap-2">
                          {weekOrder.map((d) => {
                            const day = dayNames[d];
                            const active = formData.recurringDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                className="chip w-14 justify-center px-0"
                                data-active={active}
                                onClick={() =>
                                  updateSpecialForm(formData.id, {
                                    recurringDays: active
                                      ? formData.recurringDays.filter((x) => x !== day)
                                      : [...formData.recurringDays, day],
                                  })
                                }
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!formData.isAllDay && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`special-startTime-${formData.id}`} className="field-label">
                            Start time
                          </label>
                          <TimeInput
                            id={`special-startTime-${formData.id}`}
                            required
                            value={formData.startTime}
                            onChange={(v) => updateSpecialForm(formData.id, { startTime: v })}
                          />
                        </div>
                        <div>
                          <label htmlFor={`special-endTime-${formData.id}`} className="field-label">
                            End time
                          </label>
                          <TimeInput
                            id={`special-endTime-${formData.id}`}
                            value={formData.endTime}
                            onChange={(v) => updateSpecialForm(formData.id, { endTime: v })}
                          />
                        </div>
                      </div>
                    )}
                    <Toggle
                      on={formData.isAllDay}
                      onChange={(v) => updateSpecialForm(formData.id, { isAllDay: v, startTime: v ? '00:00' : '', endTime: '' })}
                      label="All day"
                    />
                    <div className={`grid grid-cols-1 gap-4 ${formData.isRecurring ? 'sm:grid-cols-2' : ''}`}>
                      <div ref={registerFieldRef(`special-date-${formData.id}`)}>
                        <label htmlFor={`special-date-${formData.id}`} className="field-label">
                          {formData.isRecurring ? 'Starts' : 'Date'}
                        </label>
                        <DatePicker
                          id={`special-date-${formData.id}`}
                          value={formData.date}
                          onChange={(value) => updateSpecialForm(formData.id, { date: value })}
                          required
                          placeholder="Select date"
                        />
                      </div>
                      {formData.isRecurring && (
                        <div ref={registerFieldRef(`special-recurrenceEndDate-${formData.id}`)}>
                          <label className="field-label">Runs until (optional)</label>
                          <DatePicker
                            value={formData.recurrenceEndDate}
                            onChange={(value) => updateSpecialForm(formData.id, { recurrenceEndDate: value })}
                            min={formData.date}
                            max={formData.date ? format(addDays(parseISO(formData.date), 52 * 7), 'yyyy-MM-dd') : undefined}
                            placeholder="Pick an end date"
                          />
                          <p className="field-hint mt-1">Leave empty to keep it running (up to 52 weeks).</p>
                        </div>
                      )}
                    </div>
                  </Section>

                  <Section number={3} title="Location" sectionRef={registerFieldRef(`special-venue-${formData.id}`)}>
                    <VenueSelector
                      venues={venues}
                      selectedVenueId={formData.venueId}
                      newVenueName={formData.newVenueName}
                      newVenueAddress={formData.newVenueAddress}
                      onVenueSelect={(venueId) => updateSpecialForm(formData.id, { venueId })}
                      onNewVenueNameChange={(name) => updateSpecialForm(formData.id, { newVenueName: name })}
                      onNewVenueAddressChange={(address) => updateSpecialForm(formData.id, { newVenueAddress: address })}
                      required
                      id={`special-venue-${formData.id}`}
                    />
                    <p className="text-[12px] text-link">Can&rsquo;t find your venue? Add a new one and we&rsquo;ll review it with your special.</p>
                  </Section>

                  <Section number={4} title="Fine print">
                    <div>
                      <p className="field-label mb-1">Age limit</p>
                      <p className="field-hint mb-3">Drink specials are usually 19+.</p>
                      <ChipGroup
                        value={formData.is19Plus ? '19' : 'all'}
                        onChange={(v) => updateSpecialForm(formData.id, { is19Plus: v === '19' })}
                        options={[
                          { id: 'all', label: 'All ages' },
                          { id: '19', label: '19+' },
                        ]}
                      />
                    </div>
                  </Section>
                </div>
              ))}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                isEvent ? setEventForms((p) => [...p, createEmptyForm()]) : setSpecialForms((p) => [...p, createEmptySpecialForm()])
              }
              className="text-[13px] font-medium text-link hover:underline"
            >
              + Add another {isEvent ? 'event' : 'special'}
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-sun h-12 px-7 text-[15px]">
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : isAdmin ? (
                'Publish now →'
              ) : (
                'Submit for review →'
              )}
            </button>
          </div>
        </div>

        <SubmitSidebar formType={formType} instant={isAdmin} />
      </form>
    </div>
  );
}

export default function SubmitEventPage() {
  return (
    <Suspense fallback={null}>
      <SubmitContent />
    </Suspense>
  );
}
