'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit,
  ImageIcon,
  Loader2,
  MapPin,
  MoreHorizontal,
  Ban,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents } from '@/contexts/EventsContext';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import type { Event } from '@/types/event';
import SmartImage from '@/components/ui/SmartImage';
import { getRecurrenceLabel } from '@/utils/recurrenceLabel';
import { SpecialRow, TimeCard, formatTime, isAllDayEvent } from '@/components/brand';

interface SubmittedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string;
  price?: string;
  imageUrl?: string;
  isAllDay?: boolean;
  status: string;
  submittedById?: string;
  createdAt: string;
  venue: { id: string; name: string; address: string };
  categories: string[];
  likeCount: number;
  isRecurring?: boolean;
  seriesId?: string;
  recurrencePattern?: string;
  recurrenceDays?: number[];
  recurrenceDay?: number;
  recurrenceEndDate?: string;
}

interface EventGroup {
  parentEvent: SubmittedEvent;
  instances: SubmittedEvent[];
}

type SavedView = 'all' | 'events' | 'specials';
type SavedRange = 'upcoming' | 'week' | 'past';

const isSpecial = (e: { categories: string[] }) =>
  e.categories.includes('food-deal') || e.categories.includes('food') || e.categories.includes('drink');

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-[#d6f2e6] text-[#1d6b4a]',
    pending: 'bg-sun text-navy',
    rejected: 'bg-danger-tint text-danger',
    cancelled: 'bg-[#e9ecf0] text-ink-muted',
  };
  return <span className={`tag tracking-[0.12em] ${styles[status] ?? 'bg-sky text-navy'}`}>{status}</span>;
}

function MyEventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { events, userLikes } = useEvents();
  const [activeTab, setActiveTab] = useState<'liked' | 'submitted'>(
    searchParams.get('tab') === 'submitted' ? 'submitted' : 'liked'
  );
  const [savedView, setSavedView] = useState<SavedView>('all');
  const [savedRange, setSavedRange] = useState<SavedRange>('upcoming');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [submittedEvents, setSubmittedEvents] = useState<SubmittedEvent[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const savedByDate = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const weekEnd = format(addDays(new Date(), 6), 'yyyy-MM-dd');
    const liked = events
      .filter((e) => userLikes.includes(e.id))
      .filter((e) => (savedView === 'events' ? !isSpecial(e) : savedView === 'specials' ? isSpecial(e) : true))
      .filter((e) =>
        savedRange === 'past' ? e.date < todayStr : savedRange === 'week' ? e.date >= todayStr && e.date <= weekEnd : e.date >= todayStr
      )
      .sort((a, b) =>
        savedRange === 'past'
          ? b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)
          : a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
      );
    const map = new Map<string, Event[]>();
    liked.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    return [...map.entries()];
  }, [events, userLikes, savedView, savedRange]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/my-events');
  }, [user, authLoading, router]);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    setLoadingSubmissions(true);
    try {
      const res = await fetch('/api/events/my-submissions');
      const data = await res.json();
      if (data.events) setSubmittedEvents(data.events);
    } catch (error) {
      console.error('[MyEvents] Error fetching submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'submitted') fetchSubmissions();
  }, [user, activeTab, fetchSubmissions]);

  const groupedSubmissions = useMemo((): (SubmittedEvent | EventGroup)[] => {
    if (submittedEvents.length === 0) return [];
    const seriesMap = new Map<string, SubmittedEvent[]>();
    const standalone: SubmittedEvent[] = [];
    for (const ev of submittedEvents) {
      if (ev.seriesId) {
        const list = seriesMap.get(ev.seriesId) || [];
        list.push(ev);
        seriesMap.set(ev.seriesId, list);
      } else {
        standalone.push(ev);
      }
    }
    const groups: (SubmittedEvent | EventGroup)[] = [];
    for (const [, instances] of seriesMap) {
      instances.sort((a, b) => a.date.localeCompare(b.date));
      groups.push(instances.length > 1 ? { parentEvent: instances[0], instances } : instances[0]);
    }
    return [...groups, ...standalone];
  }, [submittedEvents]);

  const toggleGroup = (seriesKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(seriesKey)) next.delete(seriesKey);
      else next.add(seriesKey);
      return next;
    });
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this listing?')) return;
    setActionLoading(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, { method: 'POST' });
      if (res.ok) await fetchSubmissions();
      else alert((await res.json()).error || 'Failed to cancel event');
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async (event: SubmittedEvent) => {
    let scope: 'this' | 'future' = 'this';
    if (event.seriesId) {
      if (!confirm('Permanently delete this occurrence? This cannot be undone.')) return;
      const deleteFuture = confirm(
        'Also delete this and all future occurrences in the series?\n\nOK = this & all future\nCancel = only this occurrence'
      );
      scope = deleteFuture ? 'future' : 'this';
    } else if (!confirm('Are you sure you want to permanently delete this listing? This cannot be undone.')) {
      return;
    }
    setActionLoading(event.id);
    try {
      const res = await fetch(`/api/events/${event.id}?scope=${scope}`, { method: 'DELETE' });
      if (res.ok) await fetchSubmissions();
      else alert((await res.json()).error || 'Failed to delete event');
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  const rangeLabels: Record<SavedRange, string> = { upcoming: 'Upcoming', week: 'This week', past: 'Past' };

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— My Events</p>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display-section">
          {activeTab === 'liked' ? (
            <>
              Your saved
              <br />
              plans
            </>
          ) : (
            <>
              Your
              <br />
              submissions
            </>
          )}
        </h1>
        <div className="segmented self-start sm:self-auto sm:mb-2">
          <button className="segmented-item h-10 px-5" data-active={activeTab === 'liked'} onClick={() => setActiveTab('liked')}>
            Saved
          </button>
          <button
            className="segmented-item h-10 px-5"
            data-active={activeTab === 'submitted'}
            onClick={() => setActiveTab('submitted')}
          >
            Submitted
          </button>
        </div>
      </div>

      {activeTab === 'liked' ? (
        <>
          <div className="mt-10 flex items-center justify-between gap-4">
            <div className="segmented">
              {(
                [
                  ['all', 'All'],
                  ['events', 'Events'],
                  ['specials', 'Specials'],
                ] as [SavedView, string][]
              ).map(([id, label]) => (
                <button key={id} className="segmented-item h-9 px-4" data-active={savedView === id} onClick={() => setSavedView(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setShowRangeMenu(!showRangeMenu)} className="chip h-11 px-5">
                <Calendar size={15} className="text-link" />
                {rangeLabels[savedRange]}
                <ChevronDown size={14} />
              </button>
              {showRangeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRangeMenu(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-[14px] border border-line bg-white py-1 shadow-lg">
                    {(Object.keys(rangeLabels) as SavedRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setSavedRange(r);
                          setShowRangeMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[13px] text-navy hover:bg-sky-soft ${savedRange === r ? 'font-bold' : ''}`}
                      >
                        {rangeLabels[r]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {savedByDate.length === 0 ? (
            <div className="mt-10 rounded-[22px] bg-sky-soft px-6 py-14 text-center">
              <p className="text-[24px] font-bold text-navy">Nothing saved {savedRange === 'past' ? 'in the past' : 'yet'}</p>
              <p className="mx-auto mt-3 max-w-[420px] text-[14px] text-ink-muted">
                Tap the bookmark on any event or special and it&rsquo;ll show up here, sorted by day.
              </p>
              <Link href="/events" className="btn-sun mt-6">
                Browse what&rsquo;s on →
              </Link>
            </div>
          ) : (
            <div className="mt-10 flex flex-col gap-10">
              {savedByDate.map(([date, items]) => {
                const d = parseISO(date);
                const prefix = isToday(d) ? 'Today · ' : isTomorrow(d) ? 'Tomorrow · ' : '';
                const evs = items.filter((e) => !isSpecial(e));
                const specials = items.filter(isSpecial);
                return (
                  <section key={date}>
                    <div className="flex items-baseline justify-between border-b-[1.5px] border-navy pb-2.5">
                      <p className="text-[14px] font-medium uppercase tracking-[0.14em] text-navy">
                        — {prefix}
                        {format(d, 'EEEE, MMMM d')}
                      </p>
                      <span className="text-[12px] text-ink-muted">{items.length} saved</span>
                    </div>
                    {evs.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {evs.map((e) => (
                          <TimeCard key={e.id} event={e} />
                        ))}
                      </div>
                    )}
                    {specials.length > 0 && (
                      <>
                        <p className="eyebrow-sm mt-4 pb-3">Saved specials</p>
                        <div className="border-t border-navy">
                          {specials.map((s) => (
                            <SpecialRow key={s.id} event={s} />
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-ink-muted">
              Events and specials you&rsquo;ve sent in. We review new submissions within 24 hours.
            </p>
            <Link href="/submit" className="btn-sun self-start">
              + Submit new
            </Link>
          </div>

          {loadingSubmissions ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-navy" />
            </div>
          ) : groupedSubmissions.length === 0 ? (
            <div className="mt-8 rounded-[22px] bg-sky-soft px-6 py-14 text-center">
              <p className="text-[24px] font-bold text-navy">No submissions yet</p>
              <p className="mx-auto mt-3 max-w-[420px] text-[14px] text-ink-muted">
                Share what&rsquo;s happening at your venue — submit your first event or special.
              </p>
              <Link href="/submit" className="btn-sun mt-6">
                Submit an event →
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-3">
              {groupedSubmissions.map((item) => {
                if ('instances' in item) {
                  const group = item;
                  const seriesKey = group.parentEvent.seriesId || group.parentEvent.id;
                  const expanded = expandedGroups.has(seriesKey);
                  const upcomingCount = group.instances.filter((i) => i.date >= format(new Date(), 'yyyy-MM-dd')).length;
                  return (
                    <div key={seriesKey} className="card overflow-hidden">
                      <SubmissionRow
                        event={group.parentEvent}
                        actionLoading={actionLoading}
                        onCancel={handleCancelEvent}
                        onDelete={handleDeleteEvent}
                        bare
                        footer={
                          <button
                            onClick={() => toggleGroup(seriesKey)}
                            className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-navy"
                          >
                            {group.instances.length} occurrences · {upcomingCount} upcoming
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        }
                      />
                      {expanded && (
                        <div className="border-t border-line bg-sky-soft/60">
                          {group.instances.map((inst) => (
                            <div key={inst.id} className="border-b border-line last:border-b-0 pl-6">
                              <SubmissionRow
                                event={inst}
                                actionLoading={actionLoading}
                                onCancel={handleCancelEvent}
                                onDelete={handleDeleteEvent}
                                bare
                                compact
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <SubmissionRow
                    key={item.id}
                    event={item}
                    actionLoading={actionLoading}
                    onCancel={handleCancelEvent}
                    onDelete={handleDeleteEvent}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SubmissionRow({
  event,
  actionLoading,
  onCancel,
  onDelete,
  bare = false,
  compact = false,
  footer,
}: {
  event: SubmittedEvent;
  actionLoading: string | null;
  onCancel: (id: string) => void;
  onDelete: (event: SubmittedEvent) => void;
  bare?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const loading = actionLoading === event.id;
  const isCancelled = event.status === 'cancelled';
  const special = isSpecial(event);
  const allDay = isAllDayEvent({ isAllDay: event.isAllDay, startTime: event.startTime });
  const recurrence = event.isRecurring
    ? getRecurrenceLabel({
        recurrencePattern: event.recurrencePattern,
        recurrenceDays: event.recurrenceDays,
        recurrenceDay: event.recurrenceDay,
      })
    : '';
  const when =
    compact || !event.isRecurring
      ? `${format(parseISO(event.date), 'EEE, MMM d')} · ${allDay ? 'all day' : formatTime(event.startTime)}`
      : `${recurrence.replace(/^Every /, '')} · ${allDay ? 'all day' : formatTime(event.startTime)}`;

  return (
    <div className={`${bare ? '' : 'card'} flex items-center gap-4 p-3 sm:p-4`}>
      {!compact && (
        <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-sky text-link">
          {event.imageUrl ? (
            <SmartImage src={event.imageUrl} alt={event.title} sizes="68px" />
          ) : (
            <ImageIcon size={20} />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={event.status === 'approved' ? `/events/${event.id}` : `/events/${event.id}/edit`}
          className={`block truncate font-bold text-navy hover:underline ${compact ? 'text-[14px]' : 'text-[18px]'}`}
        >
          {event.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-muted">
          <span>{when}</span>
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-link" />
            {event.venue?.name}
          </span>
        </p>
        {!compact &&
          (event.status === 'rejected' ? (
            <p className="mt-1 text-[12px] font-medium text-danger">Not approved — edit and resubmit</p>
          ) : event.isRecurring ? (
            <p className="mt-1 text-[12px] font-medium text-link">{recurrence}</p>
          ) : special ? (
            <p className="mt-1 text-[12px] font-medium text-link">Special</p>
          ) : null)}
        {footer}
      </div>
      <StatusPill status={event.status} />
      {!isCancelled && event.status !== 'rejected' ? (
        <Link href={`/events/${event.id}/edit`} className="btn-outline btn-sm">
          <Edit size={13} /> Edit
        </Link>
      ) : null}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sky-soft hover:text-navy"
          aria-label="More actions"
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-[14px] border border-line bg-white py-1 shadow-lg">
              {!isCancelled && event.status !== 'rejected' && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onCancel(event.id);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-navy hover:bg-sky-soft"
                >
                  <Ban size={14} /> Cancel listing
                </button>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(event);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-danger hover:bg-danger-tint"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MyEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      }
    >
      <MyEventsContent />
    </Suspense>
  );
}
