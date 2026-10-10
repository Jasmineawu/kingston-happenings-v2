'use client';

/**
 * Kingston Happenings brand primitives, built to the Figma design system:
 * logo, tags, section headers, event cards, specials rows and decorative rings.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, Clock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Event, EventCategory } from '@/types/event';
import { categoryLabels, categoryTagStyles } from '@/constants/categories';
import { format, parseISO } from 'date-fns';

/* ---------------- Logo ---------------- */

export function LogoMark({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" className={className} aria-hidden>
      <circle cx="13" cy="13" r="11.375" stroke="#1B2A41" strokeWidth="2.6" />
      <circle cx="13" cy="13" r="7.3125" stroke="#3E7CA6" strokeWidth="2.4375" />
      <circle cx="13" cy="13" r="3.7375" stroke="#FF894A" strokeWidth="2.275" />
      <circle cx="13" cy="13" r="1.5437" fill="#FFB547" />
    </svg>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <LogoMark />
      <span className={`font-bold uppercase text-[15px] sm:text-[17px] tracking-[0.01em] ${dark ? 'text-white' : 'text-navy'}`}>
        Kingston <span className="text-sun">Happenings</span>
      </span>
    </Link>
  );
}

/* ---------------- Tags ---------------- */

export function CategoryTag({ category, className = '' }: { category: EventCategory; className?: string }) {
  return (
    <span className={`tag ${categoryTagStyles[category] ?? 'bg-sky text-navy'} ${className}`}>
      {categoryLabels[category] ?? category}
    </span>
  );
}

export function Tag({ children, className = 'bg-sky text-navy' }: { children: ReactNode; className?: string }) {
  return <span className={`tag ${className}`}>{children}</span>;
}

export function DKMark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-white shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image src="/dk-logo.png" alt="" width={Math.round(size * 0.7)} height={Math.round(size * 0.7)} />
    </span>
  );
}

export function DowntownTag() {
  return (
    <span className="tag bg-[#db3247] text-white pl-1">
      <DKMark />
      Downtown Kingston
    </span>
  );
}

export function isDowntown(neighborhood?: string) {
  return !!neighborhood && /downtown/i.test(neighborhood);
}

/** Pick the first category that isn't the generic food-deal marker */
export function primaryCategory(event: Event): EventCategory | undefined {
  return event.categories.find((c) => c !== 'food-deal') ?? event.categories[0];
}

/* ---------------- Section header ---------------- */

export function SectionHeader({
  eyebrow,
  title,
  aside,
  className = '',
  titleClassName = 'display-section',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow mb-3.5">— {eyebrow}</p>}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h2 className={titleClassName}>{title}</h2>
        {aside && <div className="flex flex-col items-start gap-3.5 sm:items-end pb-2">{aside}</div>}
      </div>
    </div>
  );
}

/* ---------------- Time helpers ---------------- */

export function splitTime(time?: string): { clock: string; meridiem: string } {
  if (!time) return { clock: '', meridiem: '' };
  const d = parseISO(`2000-01-01T${time}`);
  return { clock: format(d, 'h:mm'), meridiem: format(d, 'a') };
}

export function formatTime(time?: string) {
  if (!time) return '';
  return format(parseISO(`2000-01-01T${time}`), 'h:mm a');
}

export function formatTimeShort(time?: string) {
  if (!time) return '';
  const d = parseISO(`2000-01-01T${time}`);
  return format(d, d.getMinutes() === 0 ? 'ha' : 'h:mma').toLowerCase();
}

export function isAllDayEvent(event: Pick<Event, 'isAllDay' | 'startTime'>) {
  return !!event.isAllDay || event.startTime === '00:00';
}

/* ---------------- Event card (grid) ---------------- */

export function TimeCard({
  event,
  subtitle,
  href,
}: {
  event: Event;
  subtitle?: string;
  href?: string;
}) {
  const allDay = isAllDayEvent(event);
  const { clock, meridiem } = splitTime(event.startTime);
  const cat = primaryCategory(event);
  return (
    <Link
      href={href ?? `/events/${event.id}`}
      className="card card-hover flex h-[200px] flex-col justify-between p-6 hover:border-navy/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1 text-navy">
          {allDay ? (
            <span className="text-[28px] font-bold tracking-[-0.03em]">All day</span>
          ) : (
            <>
              <span className="text-[34px] font-bold tracking-[-0.03em] leading-none">{clock}</span>
              <span className="text-[13px] font-medium">{meridiem}</span>
            </>
          )}
        </div>
        {cat && <CategoryTag category={cat} />}
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-[22px] font-bold tracking-[-0.01em] text-navy leading-tight line-clamp-2">{event.title}</p>
        <p className="text-[16px] text-ink-muted truncate">{subtitle ?? event.venue?.name}</p>
      </div>
    </Link>
  );
}

/* ---------------- Specials row (homepage list) ---------------- */

export function specialHoursLabel(event: Event) {
  if (isAllDayEvent(event)) return 'All day';
  const start = formatTimeShort(event.startTime);
  if (!event.endTime) return `From ${start}`;
  return `${start} – ${formatTimeShort(event.endTime)}`;
}

export function SpecialRow({ event, tone = 'navy' }: { event: Event; tone?: 'navy' | 'line' }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className={`group flex flex-col gap-3 py-6 px-1 sm:flex-row sm:items-center sm:gap-8 sm:h-[90px] sm:py-0 border-b ${
        tone === 'navy' ? 'border-navy' : 'border-line'
      }`}
    >
      <p className="flex-1 min-w-0 text-[24px] sm:text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-navy group-hover:underline decoration-2 underline-offset-4">
        {event.title}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 sm:w-[210px] text-ink-muted">
          <MapPin size={16} className="text-link shrink-0" />
          <span className="truncate text-[16px]">{event.venue?.name}</span>
        </div>
        <div className="flex sm:w-[130px] justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-3.5 py-[7px] text-[12px] font-bold uppercase tracking-[0.08em] text-navy">
            <Clock size={14} />
            {specialHoursLabel(event)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Save (bookmark) button ---------------- */

export function SaveButton({
  saved,
  onClick,
  variant = 'plain',
  size = 18,
  className = '',
}: {
  saved: boolean;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'plain' | 'circle' | 'circle-dark';
  size?: number;
  className?: string;
}) {
  const base =
    variant === 'circle'
      ? 'h-11 w-11 rounded-full border-[1.5px] border-navy text-navy hover:bg-navy hover:text-white'
      : variant === 'circle-dark'
      ? 'h-[46px] w-[46px] rounded-full border-[1.5px] border-white text-white hover:bg-white hover:text-navy'
      : 'h-8 w-8 rounded-full text-ink-muted hover:text-navy';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save'}
      title={saved ? 'Saved' : 'Save'}
      className={`inline-flex items-center justify-center shrink-0 transition-colors ${base} ${className}`}
    >
      <Bookmark size={size} className={saved ? 'fill-current' : ''} />
    </button>
  );
}

/* ---------------- Decorative concentric rings ---------------- */

export function Rings({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden>
      <circle cx="200" cy="200" r="185" fill="none" stroke="#3b4a60" strokeWidth="18" />
      <circle cx="200" cy="200" r="140" fill="none" stroke="#3e8fd6" strokeWidth="18" />
      <circle cx="200" cy="200" r="95" fill="none" stroke="#ff8a4a" strokeWidth="18" />
      <circle cx="200" cy="200" r="42" fill="#ffb547" />
    </svg>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyPanel({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[22px] bg-sky-soft px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-navy">
          {icon}
        </div>
      )}
      <p className="text-[22px] font-bold text-navy">{title}</p>
      {children && <div className="mt-3 text-[14px] text-ink-muted">{children}</div>}
    </div>
  );
}
