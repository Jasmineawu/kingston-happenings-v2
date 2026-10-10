'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvents } from '@/contexts/EventsContext';
import { useAuth } from '@/contexts/AuthContext';
import { categoryLabels } from '@/constants/categories';
import type { Event } from '@/types/event';
import {
  SaveButton,
  SectionHeader,
  SpecialRow,
  TimeCard,
  formatTime,
  isAllDayEvent,
  primaryCategory,
} from '@/components/brand';

function FeatureCard({ event }: { event: Event }) {
  const { isLiked, toggleLike } = useEvents();
  const { user } = useAuth();
  const router = useRouter();
  const isToday = event.date === format(new Date(), 'yyyy-MM-dd');
  const cat = primaryCategory(event);
  const kicker = isToday
    ? isAllDayEvent(event) || event.startTime < '17:00'
      ? 'Today’s event'
      : 'Tonight’s event'
    : format(parseISO(event.date), 'EEEE, MMM d');

  return (
    <div className="relative flex w-full max-w-[440px] flex-col gap-4 rounded-[22px] border-2 border-sun bg-navy p-6 shadow-[0_18px_40px_-8px_rgba(27,42,65,0.35),0_0_36px_0_rgba(255,181,71,0.45)]">
      <div>
        <span className="tag bg-sun text-navy gap-1.5 pl-2.5 pr-3 py-1.5 tracking-[0.12em]">
          <Star size={12} className="fill-current" />
          Featured
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="eyebrow-bold text-sun">{kicker}</p>
        <p className="text-[26px] sm:text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-white">{event.title}</p>
        <p className="text-[14px] leading-[1.45] text-on-dark-muted line-clamp-3">{event.description}</p>
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-3 border-t border-white pt-4 uppercase">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold text-white">
            {isAllDayEvent(event) ? 'All day' : formatTime(event.startTime)}
          </span>
          <span className="text-[12px] font-medium tracking-[0.14em] text-on-dark-muted">Time</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-bold text-white">{event.venue?.name}</span>
          <span className="text-[12px] font-medium tracking-[0.14em] text-on-dark-muted">Venue</span>
        </div>
        {cat && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-white">{categoryLabels[cat]}</span>
            <span className="text-[12px] font-medium tracking-[0.14em] text-on-dark-muted">Type</span>
          </div>
        )}
      </div>
      <div className="flex gap-2.5 pt-1">
        <Link href={`/events/${event.id}`} className="btn-sun h-[46px] flex-1">
          View event →
        </Link>
        <SaveButton
          variant="circle-dark"
          saved={isLiked(event.id)}
          onClick={() => (user ? toggleLike(event.id) : router.push('/login'))}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { getTodaysEvents, getFeaturedEvents, getUpcomingEvents, isLoading } = useEvents();

  const todaysEvents = getTodaysEvents();
  const today = new Date();

  // getTodaysEvents() is already sorted by promotion tier, then time
  const todayEvents = todaysEvents
    .filter((e) => !e.categories.includes('food-deal'))
    .slice(0, 9)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Featured/promoted venues get one special each; standard venues show all
  const seenPromotedVenues = new Set<string>();
  const todayDeals = todaysEvents
    .filter((e) => e.categories.includes('food-deal'))
    .filter((deal) => {
      const tier = deal.venue?.promotionTier;
      if (tier !== 'featured' && tier !== 'promoted') return true;
      const venueId = deal.venue?.id || 'unknown';
      if (seenPromotedVenues.has(venueId)) return false;
      seenPromotedVenues.add(venueId);
      return true;
    })
    .slice(0, 6);

  // Featured placement: a featured-tier venue's next event, else the most-liked upcoming event
  const upcomingNonDeals = getUpcomingEvents().filter((e) => !e.categories.includes('food-deal'));
  const featured =
    upcomingNonDeals.find((e) => e.venue?.promotionTier === 'featured') ?? getFeaturedEvents()[0];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="page-container flex flex-col gap-10 pt-10">
        <div className="flex flex-col gap-[15px]">
          <h1 className="display-hero">
            What&rsquo;s
            <br />
            Happening
            <br />
            in <span className="text-sun">Kingston</span>?
          </h1>
          <p className="text-[16px] font-medium text-ink-muted">
            fill your life with experiences and cool stories to tell.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[28px] p-4 sm:p-[25px] min-h-[382px] flex items-end sm:items-start">
          <Image
            src="/hero.png"
            alt="Sunset over the Kingston waterfront"
            fill
            priority
            sizes="(max-width: 1440px) 100vw, 1280px"
            className="object-cover object-bottom"
          />
          {featured && (
            <div className="relative w-full">
              <FeatureCard event={featured} />
            </div>
          )}
        </div>
      </section>

      {/* Happening today */}
      <section className="page-container pb-24 pt-10">
        <SectionHeader
          eyebrow={`Today · ${format(today, 'EEEE, MMMM d')}`}
          title={
            <>
              Happening
              <br />
              today
            </>
          }
          aside={
            <>
              <p className="text-[12px] text-ink-subtle sm:text-right">try something new today :)</p>
              <Link href="/events" className="btn-outline">
                View all events →
              </Link>
            </>
          }
        />
        <div className="mt-12">
          {todayEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {todayEvents.map((event) => (
                <TimeCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="card flex flex-col items-start gap-4 p-8">
              <p className="text-[22px] font-bold text-navy">Nothing listed for today yet.</p>
              <p className="text-ink-muted">Check what&rsquo;s coming up this week instead.</p>
              <Link href="/coming-up" className="btn-outline">
                See what&rsquo;s coming up →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Specials */}
      <section className="bg-sky py-24">
        <div className="page-container">
          <SectionHeader
            eyebrow="Food & drink"
            title={
              <>
                {format(today, 'EEEE')}
                <br />
                specials
              </>
            }
            aside={
              <Link href="/events?tab=deals" className="btn-outline">
                All specials →
              </Link>
            }
          />
          <div className="mt-12 border-t border-navy">
            {todayDeals.length > 0 ? (
              todayDeals.map((deal) => <SpecialRow key={deal.id} event={deal} />)
            ) : (
              <p className="border-b border-navy py-8 text-[18px] text-ink-muted">No specials listed for today.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
