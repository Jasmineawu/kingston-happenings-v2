'use client';

import { useState, useMemo, Suspense, useRef, useEffect, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  X,
  Calendar,
  Loader2,
  ChevronDown,
  ListFilter,
  SlidersHorizontal,
  Music,
  PartyPopper,
  Ticket,
  Sun,
  Trophy,
  Star,
  Store,
  Pencil,
  Users,
  Wine,
  Check,
  Utensils,
  Smile,
} from 'lucide-react';
import { format, parseISO, addDays, startOfDay, isWithinInterval, isToday, isTomorrow, subDays, subMonths } from 'date-fns';
import { DatePicker, Toast } from '@/components';
import { useEvents } from '@/contexts/EventsContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Event, EventCategory } from '@/types/event';
import { categoryLabels, categoryDotColors } from '@/constants/categories';
import { formatPrice } from '@/utils/price';
import { getRecurrenceLabel } from '@/utils/recurrenceLabel';
import { getPromotionTierPriority } from '@/utils/events';
import { DKMark, SaveButton, formatTime, formatTimeShort, isAllDayEvent, isDowntown, primaryCategory } from '@/components/brand';

type TabType = 'all' | 'events' | 'deals';
type DateWindow =
  | { kind: 'day'; date: string }
  | { kind: 'week' }
  | { kind: 'any' }
  | { kind: 'range'; start: string; end: string };
type PastRange = 'none' | 'week' | 'month' | '3months';
type SpecialFilter = 'all' | 'food' | 'drink' | 'now' | 'happy';
type SortMode = 'time' | 'popular' | 'free';

const DOWNTOWN = 'downtown' as const;
type RailFilter = EventCategory | typeof DOWNTOWN;

const railCategories: { id: RailFilter; label: string; tile: string; icon: ReactNode }[] = [
  { id: DOWNTOWN, label: 'Downtown Kingston', tile: 'bg-[#db3247]', icon: <DKMark size={20} /> },
  { id: 'live-music', label: 'Live music', tile: 'bg-[#ff6b4a] text-white', icon: <Music size={17} /> },
  { id: 'activity-nights', label: 'Activity nights', tile: 'bg-[#1b2a41] text-white', icon: <PartyPopper size={17} /> },
  { id: 'concert', label: 'Concerts', tile: 'bg-[#3e8ed0] text-white', icon: <Ticket size={17} /> },
  { id: 'daytime', label: 'Daytime events', tile: 'bg-[#ffb547] text-[#1b2a41]', icon: <Sun size={17} /> },
  { id: 'sports', label: 'Sports', tile: 'bg-[#3e7ca6] text-white', icon: <Trophy size={17} /> },
  { id: 'theatre', label: 'Theatre & Arts', tile: 'bg-[#ffe1da] text-[#b3412a]', icon: <Star size={17} /> },
  { id: 'market', label: 'Markets', tile: 'bg-[#fff1d6] text-[#8a5a00]', icon: <Store size={17} /> },
  { id: 'workshop', label: 'Workshops & classes', tile: 'bg-[#ddebf7] text-[#1f5f94]', icon: <Pencil size={17} /> },
  { id: 'family', label: 'Family activities', tile: 'bg-[#ffe8d6] text-[#a84a12]', icon: <Users size={17} /> },
  { id: '19plus', label: '19+', tile: 'bg-[#c4452b] text-white', icon: <Wine size={17} /> },
];

const popularCategories: { label: string; category?: EventCategory; tab?: TabType }[] = [
  { label: 'Live music', category: 'live-music' },
  { label: 'Trivia', category: 'trivia' },
  { label: 'Activity nights', category: 'activity-nights' },
  { label: 'Food & drink', tab: 'deals' },
  { label: 'Family', category: 'family' },
  { label: 'Markets', category: 'market' },
];

/* ---------------- helpers ---------------- */

function matchesQuery(event: Event, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    event.title.toLowerCase().includes(q) ||
    event.description.toLowerCase().includes(q) ||
    event.venue.name.toLowerCase().includes(q)
  );
}

function bandFor(event: Event): string {
  if (isAllDayEvent(event)) return 'All day';
  const hour = parseInt(event.startTime.slice(0, 2), 10);
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 22) return 'Evening';
  return 'Late night';
}
const BAND_ORDER = ['All day', 'Morning', 'Afternoon', 'Evening', 'Late night'];

function specialBand(event: Event): string {
  if (isAllDayEvent(event)) return 'All day';
  const startHour = parseInt(event.startTime.slice(0, 2), 10);
  const endHour = event.endTime ? parseInt(event.endTime.slice(0, 2), 10) : 24;
  if (startHour < 17 && endHour <= 21 && endHour > 0) return 'Happy hour';
  return 'Evening';
}
const SPECIAL_BAND_ORDER = ['All day', 'Happy hour', 'Evening'];

function isOnNow(event: Event) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  if (event.date !== todayStr) return false;
  if (isAllDayEvent(event)) return true;
  const now = format(new Date(), 'HH:mm');
  const end = event.endTime && event.endTime > event.startTime ? event.endTime : '23:59';
  return event.startTime <= now && now <= end;
}

function specialKind(event: Event): 'food' | 'drink' | 'happy' {
  if (specialBand(event) === 'Happy hour') return 'happy';
  if (event.categories.includes('drink') && !event.categories.includes('food')) return 'drink';
  return 'food';
}

function groupBy<T>(items: T[], key: (item: T) => string, order?: string[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  });
  const entries = [...map.entries()];
  if (order) entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  else entries.sort(([a], [b]) => a.localeCompare(b));
  return entries;
}

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return `Today · ${format(d, 'EEEE, MMMM d')}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'EEEE, MMMM d')}`;
  return format(d, 'EEEE, MMMM d');
}

/* ---------------- small UI pieces ---------------- */

function Band({ label }: { label: string }) {
  return <p className="pt-7 pb-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</p>;
}

function CategoryDot({ category }: { category?: EventCategory }) {
  return <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${category ? categoryDotColors[category] : 'bg-ink-muted'}`} />;
}

function TextTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[18px] pt-1 pb-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`text-[13px] text-navy ${
            value === o.id ? 'font-bold underline underline-offset-[6px] decoration-2' : 'text-ink-muted hover:text-navy'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Event rows ---------------- */

function CompactEventRow({ event }: { event: Event }) {
  const cat = primaryCategory(event);
  const price = formatPrice(event.price) || 'Free';
  return (
    <Link href={`/events/${event.id}`} className="group flex items-center gap-5 border-b border-line py-4">
      <span className="w-[72px] shrink-0 text-[14px] font-medium text-navy">
        {isAllDayEvent(event) ? 'All day' : formatTime(event.startTime)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-bold text-navy group-hover:underline">{event.title}</span>
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
          <CategoryDot category={cat} />
          <span className="truncate">
            {cat ? categoryLabels[cat] : 'Event'} · {event.venue.name}
          </span>
        </span>
      </span>
      <span className={`shrink-0 text-[14px] font-medium ${price === 'Free' ? 'text-link' : 'text-navy'}`}>{price}</span>
    </Link>
  );
}

function DetailedEventRow({
  event,
  saved,
  onSave,
}: {
  event: Event;
  saved: boolean;
  onSave: () => void;
}) {
  const cat = primaryCategory(event);
  const price = formatPrice(event.price) || 'Free';
  const sub = event.isRecurring
    ? getRecurrenceLabel({
        recurrencePattern: event.recurrencePattern,
        recurrenceDays: event.recurrenceDays,
        recurrenceDay: event.recurrenceDay,
      }).replace(/^Every /, 'Weekly · ')
    : event.ticketUrl
    ? 'Tickets →'
    : event.categories.includes('19plus')
    ? '19+ · ID required'
    : event.categories.includes('family')
    ? 'All ages'
    : '';
  return (
    <div className="group relative flex items-start gap-5 border-b border-line py-4">
      <Link href={`/events/${event.id}`} className="absolute inset-0" aria-label={event.title} />
      <span className="flex w-[72px] shrink-0 flex-col text-[13px] text-navy pointer-events-none">
        <span className="font-medium">{isAllDayEvent(event) ? 'All day' : formatTime(event.startTime)}</span>
        {event.endTime && !isAllDayEvent(event) && (
          <span className="text-ink-muted">– {formatTime(event.endTime)}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pointer-events-none">
        <span className="truncate text-[16px] font-bold text-navy group-hover:underline">{event.title}</span>
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
          <CategoryDot category={cat} />
          <span className="truncate">
            {cat ? categoryLabels[cat] : 'Event'} · {event.venue.name}
            {event.venue.neighborhood ? ` · ${event.venue.neighborhood}` : ''}
          </span>
        </span>
        <span className="line-clamp-1 text-[13px] text-ink-muted">{event.description}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-right pointer-events-none">
        <span className={`text-[14px] font-medium ${price === 'Free' ? 'text-link' : 'text-navy'}`}>{price}</span>
        {sub && <span className="text-[12px] text-ink-muted">{sub}</span>}
      </span>
      <SaveButton saved={saved} onClick={onSave} size={16} className="relative z-10 -mt-1" />
    </div>
  );
}

function SpecialListRow({ event, saved, onSave }: { event: Event; saved: boolean; onSave: () => void }) {
  const kind = specialKind(event);
  const onNow = isOnNow(event);
  const recurrence = event.isRecurring
    ? getRecurrenceLabel({
        recurrencePattern: event.recurrencePattern,
        recurrenceDays: event.recurrenceDays,
        recurrenceDay: event.recurrenceDay,
      })
    : format(parseISO(event.date), 'EEE, MMM d');
  return (
    <div className="group relative flex items-start gap-5 border-b border-line py-4">
      <Link href={`/events/${event.id}`} className="absolute inset-0" aria-label={event.title} />
      <span className="flex w-[72px] shrink-0 flex-col text-[13px] text-navy pointer-events-none">
        {isAllDayEvent(event) ? (
          <span className="font-medium">All day</span>
        ) : (
          <>
            <span className="font-medium">{formatTime(event.startTime)}</span>
            <span className="text-ink-muted">– {event.endTime ? formatTime(event.endTime) : 'close'}</span>
          </>
        )}
      </span>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] pointer-events-none ${
          kind === 'drink' ? 'bg-sky text-link-deep' : kind === 'happy' ? 'bg-[#fff1d6] text-[#8a5a00]' : 'bg-[#ffe8d6] text-[#a84a12]'
        }`}
      >
        {kind === 'drink' ? <Wine size={15} /> : kind === 'happy' ? <Smile size={15} /> : <Utensils size={15} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pointer-events-none">
        <span className="truncate text-[16px] font-bold text-navy group-hover:underline">{event.title}</span>
        <span className="truncate text-[13px] text-ink-muted">
          {event.venue.name}
          {event.venue.neighborhood ? ` · ${event.venue.neighborhood}` : ''}
        </span>
        <span className="line-clamp-1 text-[13px] text-ink-muted">{event.description}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-right pointer-events-none">
        {onNow && (
          <span className="tag bg-success-tint text-success normal-case tracking-normal font-medium gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> On now
          </span>
        )}
        <span className="text-[12px] text-ink-muted">{recurrence}</span>
      </span>
      <SaveButton saved={saved} onClick={onSave} size={16} className="relative z-10 -mt-1" />
    </div>
  );
}

/* ---------------- Category rail ---------------- */

function CategoryRail({
  selected,
  onToggle,
  onClear,
  moreFilters,
}: {
  selected: RailFilter[];
  onToggle: (id: RailFilter) => void;
  onClear: () => void;
  moreFilters: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);
  return (
    <aside className="lg:sticky lg:top-24 self-start">
      <div
        className={`flex rounded-[22px] border border-line bg-white px-3 py-3.5 gap-1.5 lg:flex-col ${
          expanded ? 'lg:w-[230px] lg:items-stretch' : 'lg:items-center'
        } overflow-x-auto no-scrollbar`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#f1f4f8] px-3 text-navy"
          title={expanded ? 'Collapse categories' : 'Show category names'}
        >
          <ListFilter size={18} />
          {expanded && <span className="hidden lg:inline text-[13px] font-bold">Categories</span>}
          {selected.length > 0 && (
            <span className="absolute -top-1 left-[30px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-coral text-[12px] font-bold text-navy">
              {selected.length}
            </span>
          )}
        </button>
        <div className="mx-auto my-1 hidden h-px w-8 bg-line lg:block" />
        {railCategories.map((c) => {
          const active = selected.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              title={c.label}
              aria-pressed={active}
              className={`relative flex h-11 shrink-0 items-center gap-3 rounded-[12px] ${
                expanded ? 'lg:justify-start lg:px-1.5' : 'justify-center'
              } min-w-11 ${active ? 'border-2 border-navy bg-[#eef5fb]' : 'border-2 border-transparent hover:bg-sky-soft'}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${c.tile} ${
                  active || selected.length === 0 ? '' : 'opacity-55'
                } ${expanded ? '' : 'mx-auto lg:mx-0'}`}
              >
                {c.icon}
              </span>
              {expanded && <span className="hidden lg:inline truncate pr-2 text-[13px] font-medium text-navy">{c.label}</span>}
              {active && (
                <span className="absolute -top-1.5 left-[30px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-navy text-white">
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
        <div className="mx-auto my-1 hidden h-px w-8 bg-line lg:block" />
        <div className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex h-11 min-w-11 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] text-navy hover:bg-sky-soft"
            title="More filters"
          >
            <SlidersHorizontal size={18} />
            {expanded && <span className="hidden lg:inline text-[13px] font-medium">More filters</span>}
          </button>
          {showMore && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMore(false)} />
              <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-[18px] border border-line bg-white p-4 shadow-[0_18px_40px_-12px_rgba(27,42,65,0.25)] lg:left-full lg:top-auto lg:bottom-0 lg:ml-3 lg:mt-0">
                {moreFilters}
                {selected.length > 0 && (
                  <button onClick={onClear} className="mt-3 text-[13px] font-medium text-link hover:underline">
                    Clear categories
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Page content ---------------- */

function EventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCategory = searchParams.get('category') as EventCategory | null;
  const initialDate = searchParams.get('date');
  const tabParam = searchParams.get('tab');
  const initialTab: TabType = tabParam === 'deals' ? 'deals' : tabParam === 'events' ? 'events' : 'all';

  const { events: allEvents, getUpcomingEvents, isLiked, toggleLike, getLikeCount, isLoading } = useEvents();
  const { user } = useAuth();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showToast, setShowToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<RailFilter[]>(initialCategory ? [initialCategory] : []);
  const [dateWindow, setDateWindow] = useState<DateWindow>(
    initialDate ? { kind: 'day', date: initialDate } : { kind: 'day', date: todayStr }
  );
  const [pastRange, setPastRange] = useState<PastRange>('none');
  const [freeOnly, setFreeOnly] = useState(false);
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>('all');
  const [sideSpecialFilter, setSideSpecialFilter] = useState<SpecialFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllSpecials, setShowAllSpecials] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [pickMode, setPickMode] = useState<'single' | 'range'>('single');
  const [pickDate, setPickDate] = useState('');
  const [pickStart, setPickStart] = useState('');
  const [pickEnd, setPickEnd] = useState('');
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDateMenu) return;
    const handle = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) setShowDateMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showDateMenu]);

  useEffect(() => {
    setShowAllEvents(false);
    setShowAllSpecials(false);
  }, [activeTab, dateWindow, selected, searchQuery]);

  const upcoming = getUpcomingEvents();

  const pool = useMemo(() => {
    if (pastRange === 'none') return upcoming;
    const now = new Date();
    const cutoff = pastRange === 'week' ? subDays(now, 7) : pastRange === 'month' ? subMonths(now, 1) : subMonths(now, 3);
    return allEvents.filter((e) => parseISO(e.date) >= startOfDay(cutoff));
  }, [allEvents, upcoming, pastRange]);

  const inWindow = (event: Event) => {
    switch (dateWindow.kind) {
      case 'day':
        return event.date === dateWindow.date;
      case 'week':
        return isWithinInterval(startOfDay(parseISO(event.date)), {
          start: startOfDay(new Date()),
          end: startOfDay(addDays(new Date(), 6)),
        });
      case 'range':
        return isWithinInterval(startOfDay(parseISO(event.date)), {
          start: startOfDay(parseISO(dateWindow.start)),
          end: startOfDay(parseISO(dateWindow.end)),
        });
      default:
        return true;
    }
  };

  const sortByTime = (a: Event, b: Event) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);

  const filteredEvents = useMemo(() => {
    const list = pool.filter((event) => {
      if (event.categories.includes('food-deal')) return false;
      if (!matchesQuery(event, searchQuery)) return false;
      if (!inWindow(event)) return false;
      if (selected.length > 0) {
        const hit = selected.some((s) =>
          s === DOWNTOWN ? isDowntown(event.venue?.neighborhood) : event.categories.includes(s)
        );
        if (!hit) return false;
      }
      if (freeOnly && formatPrice(event.price) && event.price?.toLowerCase() !== 'free') return false;
      return true;
    });
    if (sortMode === 'popular') {
      return list.sort(
        (a, b) =>
          (b.likeCount ?? getLikeCount(b.id)) - (a.likeCount ?? getLikeCount(a.id)) ||
          getPromotionTierPriority(b.venue?.promotionTier) - getPromotionTierPriority(a.venue?.promotionTier) ||
          sortByTime(a, b)
      );
    }
    if (sortMode === 'free') {
      const isFree = (e: Event) => (!e.price || e.price.toLowerCase() === 'free' ? 0 : 1);
      return list.sort((a, b) => isFree(a) - isFree(b) || sortByTime(a, b));
    }
    return list.sort(sortByTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, searchQuery, dateWindow, selected, freeOnly, sortMode]);

  const filteredDeals = useMemo(() => {
    return pool
      .filter((event) => {
        if (!event.categories.includes('food-deal')) return false;
        if (!matchesQuery(event, searchQuery)) return false;
        if (!inWindow(event)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime) ||
          getPromotionTierPriority(b.venue?.promotionTier) - getPromotionTierPriority(a.venue?.promotionTier)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, searchQuery, dateWindow]);

  const applySpecialFilter = (list: Event[], f: SpecialFilter) => {
    switch (f) {
      case 'food':
        return list.filter((e) => specialKind(e) !== 'drink');
      case 'drink':
        return list.filter((e) => e.categories.includes('drink'));
      case 'now':
        return list.filter(isOnNow);
      case 'happy':
        return list.filter((e) => specialBand(e) === 'Happy hour');
      default:
        return list;
    }
  };

  const handleSave = (eventId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    const wasSaved = isLiked(eventId);
    toggleLike(eventId);
    if (!wasSaved) setShowToast(true);
  };

  const toggleRail = (id: RailFilter) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const clearAll = () => {
    setSearchQuery('');
    setSelected([]);
    setFreeOnly(false);
    setPastRange('none');
    setSpecialFilter('all');
    setDateWindow({ kind: 'day', date: todayStr });
  };

  const singleDay = dateWindow.kind === 'day';
  const windowNoun =
    dateWindow.kind === 'day'
      ? isToday(parseISO(dateWindow.date))
        ? 'today'
        : isTomorrow(parseISO(dateWindow.date))
        ? 'tomorrow'
        : `on ${format(parseISO(dateWindow.date), 'EEE, MMM d')}`
      : dateWindow.kind === 'week'
      ? 'this week'
      : dateWindow.kind === 'range'
      ? `${format(parseISO(dateWindow.start), 'MMM d')} – ${format(parseISO(dateWindow.end), 'MMM d')}`
      : 'coming up';

  const stripDays = [0, 1, 2, 3].map((offset) => format(addDays(new Date(), offset), 'yyyy-MM-dd'));

  // The strip shows quick picks; the dropdown label only reflects custom dates/ranges
  const dateMenuLabel =
    dateWindow.kind === 'range'
      ? `${format(parseISO(dateWindow.start), 'MMM d')} – ${format(parseISO(dateWindow.end), 'MMM d')}`
      : dateWindow.kind === 'day' && !stripDays.includes(dateWindow.date)
      ? format(parseISO(dateWindow.date), 'EEE, MMM d')
      : 'Any date';
  const stripLabel = (dateStr: string, i: number) =>
    i === 0 ? `Today · ${format(parseISO(dateStr), 'EEE d')}` : i === 1 ? 'Tomorrow' : format(parseISO(dateStr), 'EEE');

  const moreFilters = (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-[13px] font-medium text-navy">
        Free only
        <button type="button" className="switch" data-on={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
          <span />
        </button>
      </label>
      <div>
        <p className="mb-2 text-[13px] font-medium text-navy">Include past events</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['none', 'No'],
              ['week', 'Past week'],
              ['month', 'Past month'],
              ['3months', '3 months'],
            ] as [PastRange, string][]
          ).map(([id, label]) => (
            <button key={id} className="chip h-8 px-3" data-active={pastRange === id} onClick={() => setPastRange(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) return <EventsLoading />;

  const noResults =
    (activeTab === 'all' && filteredEvents.length === 0 && filteredDeals.length === 0) ||
    (activeTab === 'events' && filteredEvents.length === 0) ||
    (activeTab === 'deals' && applySpecialFilter(filteredDeals, specialFilter).length === 0);

  const EVENTS_PREVIEW = 14;
  const SPECIALS_PREVIEW = 8;

  const renderEventGroups = (list: Event[], row: (e: Event) => ReactNode) => {
    if (singleDay) {
      return groupBy(list, bandFor, BAND_ORDER).map(([band, items]) => (
        <div key={band}>
          <Band label={band} />
          <div className="border-t border-line">{items.map(row)}</div>
        </div>
      ));
    }
    return groupBy(list, (e) => e.date).map(([date, items]) => (
      <div key={date}>
        <Band label={dayLabel(date)} />
        <div className="border-t border-line">{items.map(row)}</div>
      </div>
    ));
  };

  const emptyState = (
    <div className="rounded-[22px] bg-sky-soft px-6 py-14 text-center">
      <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-navy">
        <Search size={20} />
      </div>
      <p className="text-[24px] font-bold text-navy">
        {searchQuery ? <>No results for &ldquo;{searchQuery}&rdquo;</> : <>Nothing listed {windowNoun}</>}
      </p>
      <p className="mx-auto mt-3 max-w-[420px] text-[14px] text-ink-muted">
        We couldn&rsquo;t find any {activeTab === 'deals' ? 'food & drink specials' : 'events'} matching that{' '}
        {windowNoun}. Try loosening things up a little:
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <button onClick={clearAll} className="btn-outline">
          <X size={14} /> Clear search &amp; filters
        </button>
        {dateWindow.kind !== 'week' && (
          <button onClick={() => setDateWindow({ kind: 'week' })} className="btn-sun">
            <Calendar size={14} /> Try &ldquo;This week&rdquo;
          </button>
        )}
      </div>
      <p className="mt-8 eyebrow-sm">Popular categories</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {popularCategories.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => {
              setSearchQuery('');
              if (p.tab) {
                setActiveTab(p.tab);
              } else if (p.category) {
                setSelected([p.category]);
                if (activeTab === 'deals') setActiveTab('events');
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[12px] text-ink-muted">
        Tip: search by venue too, like <span className="font-bold text-navy">&ldquo;Merchant Tap House&rdquo;</span>
      </p>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="segmented self-start">
          {(
            [
              ['all', 'All'],
              ['events', 'Events'],
              ['deals', 'Food & Drink'],
            ] as [TabType, string][]
          ).map(([id, label]) => (
            <button key={id} className="segmented-item h-10 px-5" data-active={activeTab === id} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative sm:w-[340px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy" />
            <input
              type="text"
              placeholder={activeTab === 'deals' ? 'Search specials...' : 'Search events...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-[46px] w-full rounded-full border border-line bg-white pl-11 pr-10 text-[15px] text-navy placeholder:text-ink-muted outline-none focus:border-navy"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-navy"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative" ref={dateMenuRef}>
            <button
              onClick={() => setShowDateMenu(!showDateMenu)}
              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-[14px] font-medium text-navy hover:border-navy"
            >
              <Calendar size={18} className="text-link" />
              {dateMenuLabel}
              <ChevronDown size={16} />
            </button>
            {showDateMenu && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[300px] rounded-[18px] border border-line bg-white p-4 shadow-[0_18px_40px_-12px_rgba(27,42,65,0.25)]">
                <button
                  onClick={() => {
                    setDateWindow({ kind: 'any' });
                    setShowDateMenu(false);
                  }}
                  className="chip mb-3 w-full justify-center"
                  data-active={dateWindow.kind === 'any'}
                >
                  Any upcoming date
                </button>
                <div className="segmented mb-3 w-full">
                  <button className="segmented-item flex-1 justify-center" data-active={pickMode === 'single'} onClick={() => setPickMode('single')}>
                    Single date
                  </button>
                  <button className="segmented-item flex-1 justify-center" data-active={pickMode === 'range'} onClick={() => setPickMode('range')}>
                    Date range
                  </button>
                </div>
                {pickMode === 'single' ? (
                  <DatePicker value={pickDate} onChange={setPickDate} placeholder="Select date" className="text-sm" />
                ) : (
                  <div className="space-y-2">
                    <DatePicker value={pickStart} onChange={setPickStart} placeholder="Start date" className="text-sm" />
                    <DatePicker value={pickEnd} onChange={setPickEnd} placeholder="End date" className="text-sm" />
                  </div>
                )}
                <button
                  className="btn-navy btn-sm mt-3 w-full"
                  onClick={() => {
                    if (pickMode === 'single' && pickDate) setDateWindow({ kind: 'day', date: pickDate });
                    if (pickMode === 'range' && pickStart && pickEnd)
                      setDateWindow({ kind: 'range', start: pickStart <= pickEnd ? pickStart : pickEnd, end: pickStart <= pickEnd ? pickEnd : pickStart });
                    setShowDateMenu(false);
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-[18px]" />

      <div className={`flex flex-col gap-6 lg:flex-row ${activeTab === 'deals' ? '' : 'lg:gap-12'}`}>
        {activeTab !== 'deals' && (
          <CategoryRail selected={selected} onToggle={toggleRail} onClear={() => setSelected([])} moreFilters={moreFilters} />
        )}

        <div className="min-w-0 flex-1">
          {/* Date strip */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {stripDays.map((d, i) => (
              <button
                key={d}
                className="chip h-10"
                data-active={dateWindow.kind === 'day' && dateWindow.date === d}
                onClick={() => setDateWindow({ kind: 'day', date: d })}
              >
                {stripLabel(d, i)}
              </button>
            ))}
            <button className="chip h-10" data-active={dateWindow.kind === 'week'} onClick={() => setDateWindow({ kind: 'week' })}>
              This week
            </button>
            <button
              className="chip h-10"
              data-active={dateWindow.kind === 'range' || (dateWindow.kind === 'day' && !stripDays.includes(dateWindow.date))}
              onClick={() => {
                setPickMode('single');
                setShowDateMenu(true);
              }}
            >
              <Calendar size={14} className="text-link" />
              Pick a date
            </button>
          </div>

          <div className="mt-7">
            {noResults ? (
              emptyState
            ) : activeTab === 'all' ? (
              <div className="flex flex-col gap-10 xl:flex-row xl:gap-14">
                {/* Events column */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[24px] font-bold text-navy">Events {windowNoun}</h2>
                    <span className="text-[13px] text-ink-muted">
                      {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {filteredEvents.length === 0 ? (
                    <p className="mt-6 text-ink-muted">No events {windowNoun} with these filters.</p>
                  ) : (
                    renderEventGroups(
                      showAllEvents ? filteredEvents : filteredEvents.slice(0, EVENTS_PREVIEW),
                      (e) => <CompactEventRow key={e.id} event={e} />
                    )
                  )}
                  {filteredEvents.length > EVENTS_PREVIEW && !showAllEvents && (
                    <button onClick={() => setShowAllEvents(true)} className="link-arrow mt-5">
                      Show all {filteredEvents.length} →
                    </button>
                  )}
                </div>

                {/* Specials side panel */}
                <div className="self-start rounded-[22px] bg-sky-soft p-7 xl:w-[360px] xl:shrink-0">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[24px] font-bold text-navy">Specials {singleDay ? windowNoun : ''}</h2>
                    <span className="text-[13px] text-ink-muted">{applySpecialFilter(filteredDeals, sideSpecialFilter).length}</span>
                  </div>
                  <TextTabs
                    value={sideSpecialFilter}
                    onChange={setSideSpecialFilter}
                    options={[
                      { id: 'all', label: 'All' },
                      { id: 'food', label: 'Food' },
                      { id: 'drink', label: 'Drinks' },
                      { id: 'now', label: 'On now' },
                    ]}
                  />
                  {(() => {
                    const list = applySpecialFilter(filteredDeals, sideSpecialFilter);
                    if (list.length === 0) return <p className="py-6 text-[13px] text-ink-muted">No specials match.</p>;
                    return (
                      <>
                        {list.slice(0, SPECIALS_PREVIEW).map((deal) => (
                          <Link
                            key={deal.id}
                            href={`/events/${deal.id}`}
                            className="group block border-b border-line py-3.5 last:border-b-0"
                          >
                            <p className="text-[15px] font-bold text-navy group-hover:underline">{deal.title}</p>
                            <p className="mt-1 text-[13px] text-ink-muted">
                              {deal.venue.name} ·{' '}
                              {isAllDayEvent(deal)
                                ? 'All day'
                                : deal.endTime
                                ? `${formatTimeShort(deal.startTime)} – ${formatTimeShort(deal.endTime)}`
                                : `From ${formatTimeShort(deal.startTime)}`}
                              {!singleDay && ` · ${format(parseISO(deal.date), 'EEE')}`}
                            </p>
                          </Link>
                        ))}
                        <button onClick={() => setActiveTab('deals')} className="link-arrow mt-4">
                          All {list.length} specials →
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : activeTab === 'events' ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[24px] font-bold text-navy">Events {windowNoun}</h2>
                  <span className="text-[13px] text-ink-muted">
                    {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <TextTabs
                  value={sortMode}
                  onChange={setSortMode}
                  options={[
                    { id: 'time', label: 'Time' },
                    { id: 'popular', label: 'Popular' },
                    { id: 'free', label: 'Free first' },
                  ]}
                />
                {(() => {
                  const list = showAllEvents ? filteredEvents : filteredEvents.slice(0, EVENTS_PREVIEW);
                  const row = (e: Event) => (
                    <DetailedEventRow key={e.id} event={e} saved={isLiked(e.id)} onSave={() => handleSave(e.id)} />
                  );
                  return sortMode === 'time' ? (
                    renderEventGroups(list, row)
                  ) : (
                    <div className="mt-4 border-t border-line">{list.map(row)}</div>
                  );
                })()}
                {filteredEvents.length > EVENTS_PREVIEW && !showAllEvents && (
                  <button onClick={() => setShowAllEvents(true)} className="link-arrow mt-5">
                    Show all {filteredEvents.length} →
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-[22px] bg-sky-soft p-5 sm:p-8">
                {(() => {
                  const list = applySpecialFilter(filteredDeals, specialFilter);
                  const shown = showAllSpecials ? list : list.slice(0, 10);
                  const row = (e: Event) => (
                    <SpecialListRow key={e.id} event={e} saved={isLiked(e.id)} onSave={() => handleSave(e.id)} />
                  );
                  return (
                    <>
                      <div className="flex items-baseline justify-between">
                        <h2 className="text-[24px] font-bold text-navy">Food &amp; drink specials {windowNoun}</h2>
                        <span className="text-[13px] text-ink-muted">
                          {list.length} special{list.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <TextTabs
                        value={specialFilter}
                        onChange={setSpecialFilter}
                        options={[
                          { id: 'all', label: 'All' },
                          { id: 'food', label: 'Food' },
                          { id: 'drink', label: 'Drinks' },
                          { id: 'now', label: 'On now' },
                          { id: 'happy', label: 'Happy hour' },
                        ]}
                      />
                      {singleDay
                        ? groupBy(shown, specialBand, SPECIAL_BAND_ORDER).map(([band, items]) => (
                            <div key={band}>
                              <Band label={band} />
                              <div className="border-t border-line">{items.map(row)}</div>
                            </div>
                          ))
                        : groupBy(shown, (e) => e.date).map(([date, items]) => (
                            <div key={date}>
                              <Band label={dayLabel(date)} />
                              <div className="border-t border-line">{items.map(row)}</div>
                            </div>
                          ))}
                      {list.length > shown.length && (
                        <button onClick={() => setShowAllSpecials(true)} className="link-arrow mt-5">
                          Show all {list.length} →
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast isOpen={showToast} message="Saved to My Events" type="success" onClose={() => setShowToast(false)} />
    </>
  );
}

function EventsLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={32} className="animate-spin text-navy" />
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— Browse</p>
      <h1 className="display-section">
        Everything
        <br />
        happening
      </h1>
      <p className="mt-2.5 text-[14px] text-ink-muted">feeling spontaneous or planning your week?</p>
      <div className="h-10" />
      <Suspense fallback={<EventsLoading />}>
        <EventsContent />
      </Suspense>
    </div>
  );
}
