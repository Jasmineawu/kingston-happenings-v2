'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, MapPin, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvents } from '@/contexts/EventsContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Event, EventCategory } from '@/types/event';
import {
  CategoryTag,
  DowntownTag,
  SaveButton,
  formatTime,
  formatTimeShort,
  isAllDayEvent,
  isDowntown,
  primaryCategory,
} from '@/components/brand';

type Filter = 'all' | 'festival' | 'concert' | 'market' | 'sports' | 'family' | 'downtown';

const filters: { id: Filter; label: string; categories?: EventCategory[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'festival', label: 'Festivals', categories: ['festival'] },
  { id: 'concert', label: 'Concerts', categories: ['concert', 'live-music'] },
  { id: 'market', label: 'Markets', categories: ['market'] },
  { id: 'sports', label: 'Sports', categories: ['sports'] },
  { id: 'family', label: 'Family', categories: ['family'] },
  { id: 'downtown', label: 'Downtown Kingston' },
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
// Display the week Monday-first, like the design
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function timeRange(event: Event) {
  if (isAllDayEvent(event)) return 'All day';
  return event.endTime ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}` : formatTime(event.startTime);
}

function BigDateRow({ event, saved, onSave }: { event: Event; saved: boolean; onSave: () => void }) {
  const d = parseISO(event.date);
  const cat = primaryCategory(event);
  return (
    <div className="card group relative flex items-center gap-5 p-4 sm:p-5 hover:border-navy/30">
      <Link href={`/events/${event.id}`} className="absolute inset-0 rounded-[22px]" aria-label={event.title} />
      <div className="flex h-[72px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-sky text-navy pointer-events-none">
        <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">{format(d, 'd')}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">{format(d, 'EEE')}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pointer-events-none">
        <div className="flex flex-wrap gap-1.5">
          {cat ? <CategoryTag category={cat} /> : isDowntown(event.venue?.neighborhood) && <DowntownTag />}
        </div>
        <p className="truncate text-[20px] font-bold tracking-[-0.01em] text-navy group-hover:underline">{event.title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <MapPin size={13} className="text-link" />
            {event.venue?.name}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-link" />
            {timeRange(event)}
          </span>
        </div>
        <p className="line-clamp-1 text-[13px] text-ink-muted">{event.description}</p>
      </div>
      <SaveButton saved={saved} onClick={onSave} variant="circle" size={16} className="relative z-10 h-10 w-10" />
    </div>
  );
}

function FeaturedBigDate({ event }: { event: Event }) {
  const d = parseISO(event.date);
  return (
    <div className="relative flex flex-col gap-4 rounded-[22px] border-2 border-sun bg-navy p-6 sm:p-8 shadow-[0_18px_40px_-8px_rgba(27,42,65,0.35),0_0_36px_0_rgba(255,181,71,0.35)]">
      <div>
        <span className="tag bg-sun text-navy gap-1.5 pl-2.5 pr-3 py-1.5 tracking-[0.12em]">
          <Star size={12} className="fill-current" />
          Featured
        </span>
      </div>
      <p className="eyebrow-bold text-sun">
        {format(d, 'EEE, MMM d')}
        {!isAllDayEvent(event) && ` · ${formatTimeShort(event.startTime)}`}
      </p>
      <p className="max-w-[460px] text-[32px] sm:text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-white">
        {event.title}
      </p>
      <p className="max-w-[560px] text-[14px] leading-[1.5] text-on-dark-muted line-clamp-3">{event.description}</p>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {isDowntown(event.venue?.neighborhood) ? (
          <DowntownTag />
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] text-on-dark-muted">
            <MapPin size={13} className="text-sun" />
            {event.venue?.name}
          </span>
        )}
        <Link href={`/events/${event.id}`} className="btn-sun">
          View event →
        </Link>
      </div>
    </div>
  );
}

export default function ComingUpPage() {
  const { getUpcomingEvents, isLiked, toggleLike, isLoading } = useEvents();
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [weekday, setWeekday] = useState<number>(new Date().getDay());

  const upcoming = getUpcomingEvents();

  // Big dates are one-off events — recurring weekly listings live on Browse
  const bigDates = useMemo(() => {
    const active = filters.find((f) => f.id === filter);
    return upcoming
      .filter((e) => !e.categories.includes('food-deal') && !e.isRecurring)
      .filter((e) => {
        if (filter === 'all') return true;
        if (filter === 'downtown') return isDowntown(e.venue?.neighborhood);
        return e.categories.some((c) => active?.categories?.includes(c));
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [upcoming, filter]);

  const featured =
    bigDates.find((e) => e.venue?.promotionTier === 'featured') ?? bigDates.find((e) => e.featured);

  const byMonth = useMemo(() => {
    const map = new Map<string, Event[]>();
    bigDates
      .filter((e) => e.id !== featured?.id)
      .forEach((e) => {
        const key = e.date.slice(0, 7);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      });
    return [...map.entries()];
  }, [bigDates, featured]);

  // Weekly specials: recurring food & drink specials, one per series, for the chosen weekday
  const weeklySpecials = useMemo(() => {
    const seen = new Set<string>();
    return upcoming
      .filter((e) => e.categories.includes('food-deal') && e.isRecurring)
      .filter((e) => parseISO(e.date).getDay() === weekday)
      .filter((e) => {
        const key = e.seriesId || e.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [upcoming, weekday]);

  const handleSave = (id: string) => (user ? toggleLike(id) : router.push('/login'));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— Coming up</p>
      <h1 className="display-section">
        Big dates
        <br />
        in Kingston
      </h1>
      <p className="mt-2.5 text-[14px] text-ink-muted">some things to look forward to this {season()}…</p>

      <div className="mt-8 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {filters.map((f) => (
          <button key={f.id} className="chip h-10" data-active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-10 lg:flex-row">
        <div className="min-w-0 flex-1 flex flex-col gap-12">
          {featured && <FeaturedBigDate event={featured} />}

          {byMonth.length === 0 && !featured && (
            <div className="card p-8">
              <p className="text-[22px] font-bold text-navy">No big dates on the books yet.</p>
              <p className="mt-2 text-ink-muted">Check back soon, or browse what&rsquo;s on this week.</p>
              <Link href="/events" className="btn-outline mt-5">
                Browse events →
              </Link>
            </div>
          )}

          {byMonth.map(([month, items]) => (
            <section key={month}>
              <div className="flex items-baseline justify-between border-b-[1.5px] border-navy pb-3">
                <h2 className="text-[24px] font-bold text-navy">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</h2>
                <span className="text-[13px] text-ink-muted">
                  {items.length} big date{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {items.map((e) => (
                  <BigDateRow key={e.id} event={e} saved={isLiked(e.id)} onSave={() => handleSave(e.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0 lg:sticky lg:top-24 self-start w-full">
          <div className="rounded-[22px] bg-sky p-6">
            <p className="eyebrow-sm">Weekly specials</p>
            <p className="mt-2 text-[24px] font-bold leading-tight text-navy">Every week, on repeat</p>
            <div className="mt-4 flex justify-between gap-1">
              {WEEK_ORDER.map((d) => (
                <button
                  key={d}
                  onClick={() => setWeekday(d)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                    weekday === d ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-white/70'
                  }`}
                  aria-label={WEEKDAY_NAMES[d]}
                >
                  {WEEKDAYS[d]}
                </button>
              ))}
            </div>
            <p className="mt-5 eyebrow-bold text-navy">{WEEKDAY_NAMES[weekday]}</p>
            <div className="mt-1">
              {weeklySpecials.length === 0 ? (
                <p className="py-4 text-[13px] text-ink-muted">No weekly specials listed for {WEEKDAY_NAMES[weekday]}.</p>
              ) : (
                weeklySpecials.map((s) => (
                  <Link key={s.id} href={`/events/${s.id}`} className="group block border-b border-navy/15 py-3 last:border-b-0">
                    <p className="text-[15px] font-bold text-navy group-hover:underline">{s.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {s.venue?.name}{' '}
                      <span className="ml-1 font-bold uppercase tracking-[0.08em] text-link">
                        {isAllDayEvent(s)
                          ? 'All day'
                          : s.endTime
                          ? `${formatTimeShort(s.startTime)} – ${formatTimeShort(s.endTime)}`
                          : `From ${formatTimeShort(s.startTime)}`}
                      </span>
                    </p>
                  </Link>
                ))
              )}
            </div>
            <Link href="/events?tab=deals" className="mt-4 inline-block text-[13px] font-bold text-navy hover:underline">
              All specials →
            </Link>
          </div>

          <div className="rounded-[22px] bg-sun p-6">
            <p className="eyebrow-bold text-navy/70">For venues &amp; organizers</p>
            <p className="mt-2 text-[24px] font-bold leading-tight text-navy">Got a big date?</p>
            <p className="mt-2 text-[13px] text-navy/80">
              Feature your event at the top of Coming Up and on the homepage.
            </p>
            <a href="mailto:kingstonhappenings.ca@gmail.com?subject=Featuring%20an%20event" className="btn-navy mt-5">
              Get featured →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function season() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}
