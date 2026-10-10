'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Check, 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Users,
  FileText,
  AlertTriangle,
  Loader2,
  Building,
  Trash2,
  Ban,
  Repeat,
  Edit,
  Upload,
  Image as ImageIcon,
  Utensils,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents } from '@/contexts/EventsContext';
import { categoryLabels, EventCategory } from '@/types/event';
import { Modal, Toast } from '@/components';
import { compressImage } from '@/utils/compression';
import { formatPrice } from '@/utils/price';
import SmartImage from '@/components/ui/SmartImage';

interface PendingVenue {
  id: string;
  name: string;
  address: string;
  status: string;
  createdAt: string;
}

interface PublishedVenue {
  id: string;
  name: string;
  address: string;
  neighborhood?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  eventCount?: number;
  promotionTier?: string;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'confirm' | 'warning';
  confirmText: string;
  onConfirm: () => void;
  secondaryConfirmText?: string;
  onSecondaryConfirm?: () => void;
}

interface ToastState {
  isVisible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

type ListSort = 'date' | 'venue';

const initialModalState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'confirm',
  confirmText: 'Confirm',
  onConfirm: () => {},
};

function matchesSearch(
  event: { title: string; venue: { name: string } },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    event.title.toLowerCase().includes(q) ||
    event.venue.name.toLowerCase().includes(q)
  );
}

function sortEvents<T extends { date: string; venue: { name: string } }>(
  list: T[],
  sortBy: ListSort
): T[] {
  return [...list].sort((a, b) => {
    if (sortBy === 'venue') {
      const byVenue = a.venue.name.localeCompare(b.venue.name);
      if (byVenue !== 0) return byVenue;
      return a.date.localeCompare(b.date);
    }
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.venue.name.localeCompare(b.venue.name);
  });
}

function EditVenueForm({ 
  venue, 
  onSave, 
  onCancel 
}: { 
  venue: PublishedVenue; 
  onSave: (venue: PublishedVenue) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<PublishedVenue>(venue);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState<'imageUrl' | 'coverImageUrl' | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(venue.imageUrl || '');
  const [coverImagePreview, setCoverImagePreview] = useState<string>(venue.coverImageUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Update formData when venue changes
  useEffect(() => {
    setFormData(venue);
    setImagePreview(venue.imageUrl || '');
    setCoverImagePreview(venue.coverImageUrl || '');
  }, [venue]);

  const handleImageSelect = async (file: File, field: 'imageUrl' | 'coverImageUrl') => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    const compressed = await compressImage(file);
    if (field === 'imageUrl') {
      setImagePreview(compressed);
      setFormData((prev) => ({ ...prev, imageUrl: compressed }));
    } else {
      setCoverImagePreview(compressed);
      setFormData((prev) => ({ ...prev, coverImageUrl: compressed }));
    }
  };

  const handleDragOver = (e: React.DragEvent, field: 'imageUrl' | 'coverImageUrl') => {
    e.preventDefault();
    setIsDragging(field);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(null);
  };

  const handleDrop = (e: React.DragEvent, field: 'imageUrl' | 'coverImageUrl') => {
    e.preventDefault();
    setIsDragging(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageSelect(file, field);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'imageUrl' | 'coverImageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file, field);
    }
  };

  const removeImage = (field: 'imageUrl' | 'coverImageUrl') => {
    if (field === 'imageUrl') {
      setImagePreview('');
      setFormData((prev) => ({ ...prev, imageUrl: undefined }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setCoverImagePreview('');
      setFormData((prev) => ({ ...prev, coverImageUrl: undefined }));
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const renderImageField = (
    field: 'imageUrl' | 'coverImageUrl',
    label: string,
    preview: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div>
      <label className="field-label">
        {label}
      </label>
      <div
        onDragOver={(e) => handleDragOver(e, field)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, field)}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging === field
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50'
          }
          ${preview ? 'p-2' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileInputChange(e, field)}
          className="hidden"
        />
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={`${label} preview`}
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(field);
              }}
              className="absolute top-2 right-2 p-1.5 bg-navy text-white rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click or drag and drop an image here
            </p>
            <p className="text-xs text-muted-foreground">
              Or enter a URL below
            </p>
          </div>
        )}
      </div>
      <input
        type="url"
        value={
          formData[field] && !formData[field]!.startsWith('data:')
            ? formData[field]!
            : ''
        }
        onChange={(e) => {
          setFormData({ ...formData, [field]: e.target.value });
          if (field === 'imageUrl') setImagePreview(e.target.value);
          else setCoverImagePreview(e.target.value);
        }}
        placeholder="Or enter image URL"
        className="field mt-2"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="field-label">
          Venue Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="field"
        />
      </div>
      <div>
        <label className="field-label">
          Address *
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
          className="field"
        />
      </div>
      <div>
        <label className="field-label">
          Neighborhood
        </label>
        <input
          type="text"
          value={formData.neighborhood || ''}
          onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
          className="field"
        />
      </div>
      <div>
        <label className="field-label">
          Website
        </label>
        <input
          type="url"
          value={formData.website || ''}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="field"
        />
      </div>
      <div>
        <label className="field-label">
          Promotion Tier
        </label>
        <select
          value={formData.promotionTier || 'standard'}
          onChange={(e) => setFormData({ ...formData, promotionTier: e.target.value })}
          className="field"
        >
          <option value="standard">Standard</option>
          <option value="promoted">Promoted</option>
          <option value="featured">Featured</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Promotion tier affects the priority order of events/specials in listings
        </p>
      </div>
      {renderImageField('imageUrl', 'Venue Thumbnail', imagePreview, fileInputRef)}
      {renderImageField('coverImageUrl', 'Cover Photo', coverImagePreview, coverFileInputRef)}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="btn-sun flex-1"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost flex-1"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { pendingEvents, events, approveEvent, rejectEvent, refreshPendingEvents, refreshEvents, refreshVenues, isLoading: eventsLoading } = useEvents();
  const [pendingVenues, setPendingVenues] = useState<PendingVenue[]>([]);
  const [publishedVenues, setPublishedVenues] = useState<PublishedVenue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);
  const [editingVenue, setEditingVenue] = useState<PublishedVenue | null>(null);
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [toast, setToast] = useState<ToastState>({ isVisible: false, message: '', type: 'success' });
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [clickedApproveId, setClickedApproveId] = useState<string | null>(null);
  const [clickedRejectId, setClickedRejectId] = useState<string | null>(null);
  const [publishedEventsPage, setPublishedEventsPage] = useState(1);
  const [publishedSpecialsPage, setPublishedSpecialsPage] = useState(1);
  const [pastEventsPage, setPastEventsPage] = useState(1);
  const [pastSpecialsPage, setPastSpecialsPage] = useState(1);
  const itemsPerPage = 20;
  const [activeSubTab, setActiveSubTab] = useState<'pending-published' | 'venues' | 'venue-promotions'>('pending-published');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'events' | 'specials'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [publishedEventsSort, setPublishedEventsSort] = useState<ListSort>('date');
  const [publishedSpecialsSort, setPublishedSpecialsSort] = useState<ListSort>('date');
  const [publishedEventsSearch, setPublishedEventsSearch] = useState('');
  const [publishedSpecialsSearch, setPublishedSpecialsSearch] = useState('');
  const [pastEventsSort, setPastEventsSort] = useState<ListSort>('date');
  const [pastSpecialsSort, setPastSpecialsSort] = useState<ListSort>('date');
  const [pastEventsSearch, setPastEventsSearch] = useState('');
  const [pastSpecialsSearch, setPastSpecialsSearch] = useState('');
  const [pastEventsOpen, setPastEventsOpen] = useState(false);
  const [pastSpecialsOpen, setPastSpecialsOpen] = useState(false);

  const fetchPendingVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const res = await fetch('/api/venues?status=pending');
      if (res.ok) {
        const data = await res.json();
        setPendingVenues(data.venues || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending venues:', error);
    } finally {
      setLoadingVenues(false);
    }
  }, []);

  const fetchPublishedVenues = useCallback(async () => {
    try {
      const res = await fetch('/api/venues?status=approved');
      if (res.ok) {
        const data = await res.json();
        setPublishedVenues(data.venues || []);
      }
    } catch (error) {
      console.error('Failed to fetch published venues:', error);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/login');
    }
  }, [isAdmin, authLoading, router]);

  // Refresh pending events and venues when admin loads the page
  useEffect(() => {
    if (isAdmin) {
      refreshPendingEvents();
      fetchPendingVenues();
      fetchPublishedVenues();
    }
  }, [isAdmin, refreshPendingEvents, fetchPendingVenues, fetchPublishedVenues]);

  // Group pending events by seriesId (one card per series or standalone event)
  // NOTE: This must be before any early returns to comply with Rules of Hooks
  const groupedPendingEvents = useMemo(() => {
    const seriesMap = new Map<string, typeof pendingEvents>();
    const standalone: typeof pendingEvents = [];

    for (const event of pendingEvents) {
      if (event.seriesId) {
        const list = seriesMap.get(event.seriesId) || [];
        list.push(event);
        seriesMap.set(event.seriesId, list);
      } else {
        standalone.push(event);
      }
    }

    const groups = [];
    for (const [, instances] of seriesMap) {
      instances.sort((a, b) => a.date.localeCompare(b.date));
      const representative = instances[0];
      groups.push({
        ...representative,
        totalInstances: instances.length,
      });
    }

    for (const event of standalone) {
      groups.push({
        ...event,
        totalInstances: 1,
      });
    }

    return groups;
  }, [pendingEvents]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const upcomingPublishedEvents = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        !event.categories.includes('food-deal') &&
        event.status === 'approved' &&
        event.date >= todayStr &&
        matchesSearch(event, publishedEventsSearch)
    );
    return sortEvents(filtered, publishedEventsSort);
  }, [events, todayStr, publishedEventsSearch, publishedEventsSort]);

  const upcomingPublishedSpecials = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        event.categories.includes('food-deal') &&
        event.status === 'approved' &&
        event.date >= todayStr &&
        matchesSearch(event, publishedSpecialsSearch)
    );
    return sortEvents(filtered, publishedSpecialsSort);
  }, [events, todayStr, publishedSpecialsSearch, publishedSpecialsSort]);

  const pastPublishedEvents = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        !event.categories.includes('food-deal') &&
        event.status === 'approved' &&
        event.date < todayStr &&
        matchesSearch(event, pastEventsSearch)
    );
    return sortEvents(filtered, pastEventsSort);
  }, [events, todayStr, pastEventsSearch, pastEventsSort]);

  const pastPublishedSpecials = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        event.categories.includes('food-deal') &&
        event.status === 'approved' &&
        event.date < todayStr &&
        matchesSearch(event, pastSpecialsSearch)
    );
    return sortEvents(filtered, pastSpecialsSort);
  }, [events, todayStr, pastSpecialsSearch, pastSpecialsSort]);

  if (authLoading || eventsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const closeModal = () => setModal(initialModalState);
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ isVisible: true, message, type });
  };

  // Double-click to approve: first click shows confirmation state, second click approves
  // eventId here is seriesId for recurring series, or the event id for standalones
  const handleApproveClick = async (eventId: string, isRecurringSeries?: boolean) => {
    if (clickedApproveId === eventId) {
      // Second click - actually approve
      setProcessingEventId(eventId);
      setClickedApproveId(null);
      
      // If this is a recurring series, approve all related events
      if (isRecurringSeries) {
        try {
          const res = await fetch(`/api/events/approve-recurring/${eventId}`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            showToast(`Approved ${data.count} recurring events`, 'success');
            await refreshPendingEvents();
            await refreshEvents();
          }
        } catch (error) {
          showToast('Failed to approve events', 'error');
        }
      } else {
        await approveEvent(eventId);
        showToast('Event approved', 'success');
      }
      setProcessingEventId(null);
    } else {
      // First click - show confirmation state
      setClickedApproveId(eventId);
      setClickedRejectId(null);
      // Reset after 3 seconds if not clicked again
      setTimeout(() => setClickedApproveId(prev => prev === eventId ? null : prev), 3000);
    }
  };

  // Double-click to reject
  const handleRejectClick = async (eventId: string, isRecurringSeries?: boolean) => {
    if (clickedRejectId === eventId) {
      // Second click - show modal for destructive action
      setModal({
        isOpen: true,
        title: 'Reject Event',
        message: isRecurringSeries 
          ? 'This will reject ALL instances of this recurring event. This action cannot be undone.'
          : 'This event will be permanently deleted. This action cannot be undone.',
        type: 'warning',
        confirmText: 'Reject',
        onConfirm: async () => {
          setProcessingEventId(eventId);
          if (isRecurringSeries) {
            try {
              const res = await fetch(`/api/events/reject-recurring/${eventId}`, { method: 'POST' });
              if (res.ok) {
                const data = await res.json();
                showToast(`Rejected ${data.count} recurring events`, 'info');
                await refreshPendingEvents();
              }
            } catch (error) {
              showToast('Failed to reject events', 'error');
            }
          } else {
            await rejectEvent(eventId);
            showToast('Event rejected', 'info');
          }
          setProcessingEventId(null);
        },
      });
      setClickedRejectId(null);
    } else {
      // First click - show confirmation state
      setClickedRejectId(eventId);
      setClickedApproveId(null);
      setTimeout(() => setClickedRejectId(prev => prev === eventId ? null : prev), 3000);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    setModal({
      isOpen: true,
      title: 'Cancel Event',
      message: 'This event will be marked as cancelled but not deleted. Users will see it as cancelled.',
      type: 'warning',
      confirmText: 'Cancel Event',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/events/${eventId}/cancel`, { method: 'POST' });
          if (res.ok) {
            showToast('Event marked as cancelled', 'success');
            await refreshEvents();
          }
        } catch (error) {
          showToast('Failed to cancel event', 'error');
        }
      },
    });
  };

  const deleteEventByScope = async (eventId: string, scope: 'this' | 'future') => {
    setDeletingEventId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}?scope=${scope}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(scope === 'future' ? 'Deleted this and future occurrences' : 'Event deleted', 'success');
        await refreshEvents();
        await refreshPendingEvents();
      } else {
        showToast('Failed to delete event', 'error');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      showToast('Failed to delete event', 'error');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleDeleteEvent = (event: {
    id: string;
    seriesId?: string;
    isRecurring?: boolean;
    categories: string[];
  }) => {
    const isSpecial = event.categories.includes('food-deal');
    const title = isSpecial ? 'Delete Food & Drink Special' : 'Delete Event';
    const isRecurring = Boolean(event.isRecurring && event.seriesId);

    if (isRecurring) {
      setModal({
        isOpen: true,
        title,
        message: 'Choose what to delete. This action cannot be undone.',
        type: 'warning',
        confirmText: 'This occurrence',
        onConfirm: () => {
          void deleteEventByScope(event.id, 'this');
        },
        secondaryConfirmText: 'This & all future',
        onSecondaryConfirm: () => {
          void deleteEventByScope(event.id, 'future');
        },
      });
      return;
    }

    setModal({
      isOpen: true,
      title,
      message: isSpecial
        ? 'This special will be permanently deleted. This action cannot be undone.'
        : 'This event will be permanently deleted. This action cannot be undone.',
      type: 'warning',
      confirmText: 'Delete',
      onConfirm: () => {
        void deleteEventByScope(event.id, 'this');
      },
    });
  };

  const handleApproveVenue = (venueId: string) => {
    setModal({
      isOpen: true,
      title: 'Approve Venue',
      message: 'This venue will be available for event submissions. Are you sure you want to approve it?',
      type: 'confirm',
      confirmText: 'Approve',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/venues/${venueId}/approve`, { method: 'POST' });
          if (res.ok) {
            await fetchPendingVenues();
            await fetchPublishedVenues();
          }
        } catch (error) {
          console.error('Failed to approve venue:', error);
        }
      },
    });
  };

  const handleRejectVenue = (venueId: string) => {
    setModal({
      isOpen: true,
      title: 'Reject Venue',
      message: 'This venue will be permanently deleted. This action cannot be undone.',
      type: 'warning',
      confirmText: 'Reject',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/venues/${venueId}/reject`, { method: 'POST' });
          if (res.ok) {
            await fetchPendingVenues();
          }
        } catch (error) {
          console.error('Failed to reject venue:', error);
        }
      },
    });
  };

  const handleDeleteVenue = (venueId: string) => {
    setModal({
      isOpen: true,
      title: 'Delete Venue',
      message: 'This venue will be permanently deleted. This action cannot be undone.',
      type: 'warning',
      confirmText: 'Delete',
      onConfirm: async () => {
        setDeletingVenueId(venueId);
        try {
          const res = await fetch(`/api/venues/${venueId}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Venue deleted successfully', 'success');
            await fetchPublishedVenues();
            await fetchPendingVenues();
          } else {
            showToast('Failed to delete venue', 'error');
          }
        } catch (error) {
          console.error('Failed to delete venue:', error);
          showToast('Failed to delete venue', 'error');
        } finally {
          setDeletingVenueId(null);
        }
      },
    });
  };

  const handleEditVenue = (venue: PublishedVenue) => {
    setEditingVenue(venue);
  };

  const handleSaveVenue = async (venueData: PublishedVenue) => {
    try {
      const requestBody: {
        name: string;
        address: string;
        neighborhood?: string;
        website?: string;
        imageUrl?: string;
        coverImageUrl?: string;
        promotionTier: string;
      } = {
        name: venueData.name,
        address: venueData.address,
        promotionTier: venueData.promotionTier || 'standard',
      };
      
      // Only include optional fields if they have actual string values (not null/undefined/empty)
      // This preserves existing values in the database for fields we don't include
      if (venueData.neighborhood && typeof venueData.neighborhood === 'string') {
        requestBody.neighborhood = venueData.neighborhood;
      }
      if (venueData.website && typeof venueData.website === 'string') {
        requestBody.website = venueData.website;
      }
      // Include imageUrl if it exists (including data URLs from file uploads)
      if (venueData.imageUrl && typeof venueData.imageUrl === 'string') {
        requestBody.imageUrl = venueData.imageUrl;
      }
      if (venueData.coverImageUrl && typeof venueData.coverImageUrl === 'string') {
        requestBody.coverImageUrl = venueData.coverImageUrl;
      }
      
      console.log('Updating venue with data:', requestBody);
      
      const res = await fetch(`/api/venues/${venueData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (res.ok) {
        showToast('Venue updated successfully', 'success');
        setEditingVenue(null);
        await fetchPublishedVenues();
        // Refresh venues in EventsContext so venue tab shows updated image
        await refreshVenues();
      } else {
        let errorMessage = 'Unknown error';
        try {
          const text = await res.text();
          console.error('API response status:', res.status, res.statusText);
          console.error('API response body:', text);
          
          if (text) {
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || errorData.message || errorData.details || JSON.stringify(errorData);
            } catch {
              errorMessage = text || `HTTP ${res.status}: ${res.statusText}`;
            }
          } else {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        } catch (parseError) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          console.error('Failed to parse error response:', parseError);
        }
        showToast(`Failed to update venue: ${errorMessage}`, 'error');
      }
    } catch (error) {
      console.error('Failed to update venue:', error);
      showToast(`Failed to update venue: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const reviewItems = groupedPendingEvents.filter((e) => {
    const isSpecial = e.categories.includes('food-deal');
    return reviewFilter === 'all' ? true : reviewFilter === 'specials' ? isSpecial : !isSpecial;
  });

  const tierOf = (v: PublishedVenue) => v.promotionTier || 'standard';

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— Admin</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display-section">Dashboard</h1>
        <p className="text-[12px] text-ink-muted sm:pb-2">Signed in as {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => setActiveSubTab('pending-published')}
          className="flex flex-col items-start rounded-[22px] bg-sun p-6 text-left text-navy"
        >
          <span className="text-[44px] font-bold leading-none tracking-[-0.03em]">{groupedPendingEvents.length}</span>
          <span className="eyebrow-bold mt-3">Listings to review</span>
        </button>
        <button
          onClick={() => setActiveSubTab('pending-published')}
          className="card flex flex-col items-start p-6 text-left text-navy"
        >
          <span className="text-[44px] font-bold leading-none tracking-[-0.03em]">{pendingVenues.length}</span>
          <span className="eyebrow-bold mt-3">Venues to verify</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="segmented mt-8">
        {(
          [
            ['pending-published', 'Review queue', groupedPendingEvents.length],
            ['venues', 'Venues', pendingVenues.length],
            ['venue-promotions', 'Promotions', 0],
          ] as [typeof activeSubTab, string, number][]
        ).map(([id, label, count]) => (
          <button key={id} className="segmented-item h-10 px-4 gap-2" data-active={activeSubTab === id} onClick={() => setActiveSubTab(id)}>
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${activeSubTab === id ? 'bg-sun text-navy' : 'bg-white text-navy'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeSubTab === 'pending-published' && (
          <>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
              {/* Review queue */}
              <section className="min-w-0">
                <div className="flex items-baseline justify-between border-b-[1.5px] border-navy pb-2.5">
                  <h2 className="text-[22px] font-bold text-navy">Waiting for review</h2>
                  <div className="flex gap-3 text-[12px]">
                    {(['all', 'events', 'specials'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setReviewFilter(f)}
                        className={`capitalize ${reviewFilter === f ? 'font-bold text-navy underline underline-offset-4' : 'text-ink-muted hover:text-navy'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {reviewItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-tint text-success">
                      <Check size={20} />
                    </div>
                    <p className="mt-4 text-[20px] font-bold text-navy">All caught up!</p>
                    <p className="mt-1 text-[14px] text-ink-muted">Nothing waiting for review.</p>
                  </div>
                ) : (
                  reviewItems.map((event) => {
                    const key = event.seriesId && event.totalInstances > 1 ? (event.seriesId as string) : event.id;
                    const isSeriesBatch = Boolean(event.seriesId && event.totalInstances > 1);
                    const isSpecial = event.categories.includes('food-deal');
                    const cat = event.categories.find((c) => c !== 'food-deal' && c !== 'food' && c !== 'drink') as EventCategory | undefined;
                    const previewing = previewId === key;
                    return (
                      <div key={key} className="border-b border-line py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`tag ${isSpecial ? 'bg-danger-tint text-danger' : 'bg-sky text-link-deep'}`}>
                                {isSpecial ? 'Special' : 'Event'}
                              </span>
                              <p className="truncate text-[16px] font-bold text-navy">{event.title}</p>
                              {isSeriesBatch && (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-link">
                                  <Repeat size={11} />
                                  {event.totalInstances} dates
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[12px] text-ink-muted">
                              {event.venue.name} · {format(parseISO(event.date), 'EEE, MMM d')} ·{' '}
                              {event.isAllDay || event.startTime === '00:00'
                                ? 'All day'
                                : format(parseISO(`2000-01-01T${event.startTime}`), 'h:mm a')}
                              {event.endTime && !(event.isAllDay || event.startTime === '00:00')
                                ? ` – ${format(parseISO(`2000-01-01T${event.endTime}`), 'h:mm a')}`
                                : ''}
                            </p>
                            <p className="mt-0.5 text-[12px] text-ink-muted">
                              Submitted by {event.submitterName || 'a member'}
                              {event.submitterRole && event.submitterRole !== 'user' ? ` (${event.submitterRole})` : ''}
                              {cat ? ` · ${categoryLabels[cat]}` : isSpecial ? ` · ${event.categories.includes('drink') ? 'Drink' : 'Food'}` : ''}
                              {event.price ? ` · ${formatPrice(event.price)}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button onClick={() => setPreviewId(previewing ? null : key)} className="btn-ghost btn-sm">
                              {previewing ? 'Hide' : 'Preview'}
                            </button>
                            <button
                              onClick={() => handleRejectClick(key, isSeriesBatch)}
                              disabled={processingEventId === key}
                              className={`btn-sm btn border-[1.5px] font-medium ${
                                clickedRejectId === key ? 'border-danger bg-danger text-white' : 'border-line text-navy hover:border-danger hover:text-danger'
                              }`}
                            >
                              {clickedRejectId === key ? 'Confirm reject' : isSeriesBatch ? `Reject all` : 'Reject'}
                            </button>
                            <button
                              onClick={() => handleApproveClick(key, isSeriesBatch)}
                              disabled={processingEventId === key}
                              className={`btn-sm btn font-bold text-white ${clickedApproveId === key ? 'bg-success' : 'bg-navy hover:bg-[#283b58]'}`}
                            >
                              {processingEventId === key ? <Loader2 size={14} className="animate-spin" /> : null}
                              {clickedApproveId === key ? 'Confirm' : isSeriesBatch ? `Approve all (${event.totalInstances})` : 'Approve'}
                            </button>
                          </div>
                        </div>
                        {previewing && (
                          <div className="mt-3 flex gap-4 rounded-[14px] bg-sky-soft p-4">
                            {event.imageUrl && (
                              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[10px] bg-sky">
                                <SmartImage src={event.imageUrl} alt={event.title} sizes="112px" />
                              </div>
                            )}
                            <div className="min-w-0 text-[13px] text-navy">
                              <p className="whitespace-pre-line">{event.description}</p>
                              <p className="mt-2 text-[12px] text-ink-muted">{event.venue.address}</p>
                              {event.ticketUrl && (
                                <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] text-link hover:underline">
                                  {event.ticketUrl}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>

              {/* Venues to verify */}
              <aside className="self-start rounded-[22px] bg-sky-soft p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[20px] font-bold text-navy">Venues to verify</h2>
                  <button onClick={() => setActiveSubTab('venues')} className="link-arrow">
                    See all →
                  </button>
                </div>
                {pendingVenues.length === 0 ? (
                  <p className="mt-4 text-[13px] text-ink-muted">No new venues waiting.</p>
                ) : (
                  pendingVenues.map((venue) => (
                    <div key={venue.id} className="border-b border-line py-4 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-navy">{venue.name}</p>
                          <p className="truncate text-[12px] text-ink-muted">{venue.address}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => handleRejectVenue(venue.id)} className="btn-ghost btn-sm h-8 px-3" aria-label={`Reject ${venue.name}`}>
                            <X size={13} />
                          </button>
                          <button onClick={() => handleApproveVenue(venue.id)} className="btn-navy btn-sm h-8 px-3">
                            Verify
                          </button>
                        </div>
                      </div>
                      <span className="tag mt-2 bg-[#fff1d6] text-[#8a5a00]">New · needs verification</span>
                    </div>
                  ))
                )}
              </aside>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Published Events Column */}
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-[22px] font-bold text-navy">
                  <FileText size={24} className="text-link" />
                  Published Events
                </h2>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={publishedEventsSearch}
                      onChange={(e) => {
                        setPublishedEventsSearch(e.target.value);
                        setPublishedEventsPage(1);
                      }}
                      placeholder="Search title or venue..."
                      className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13px] text-navy outline-none focus:border-navy"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground mr-1">Sort:</span>
                    <button
                      type="button"
                      onClick={() => { setPublishedEventsSort('date'); setPublishedEventsPage(1); }}
                      className={`h-8 px-3 rounded-full text-[12px] transition-colors ${publishedEventsSort === 'date' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPublishedEventsSort('venue'); setPublishedEventsPage(1); }}
                      className={`h-8 px-3 rounded-full text-[12px] transition-colors ${publishedEventsSort === 'venue' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                    >
                      Venue
                    </button>
                  </div>
                </div>

                {upcomingPublishedEvents.length === 0 ? (
                  <div className="rounded-[22px] bg-sky-soft p-8 text-center">
                    <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="mb-2 text-[18px] font-bold text-navy">No Upcoming Events</h3>
                    <p className="text-muted-foreground">Approved upcoming events will appear here.</p>
                  </div>
                ) : (() => {
                  const totalPages = Math.ceil(upcomingPublishedEvents.length / itemsPerPage);
                  const startIndex = (publishedEventsPage - 1) * itemsPerPage;
                  const paginatedEvents = upcomingPublishedEvents.slice(startIndex, startIndex + itemsPerPage);

                  return (
                    <>
                      <div className="space-y-3">
                        {paginatedEvents.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between gap-4 border-b border-line py-3"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                {event.imageUrl ? (
                                  <SmartImage
                                    src={event.imageUrl}
                                    alt={event.title}
                                    sizes="64px"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-sky">
                                    <Calendar size={16} className="text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-bold text-navy">{event.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(event.date), 'MMM d, yyyy')} • {event.venue.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Link
                                href={`/events/${event.id}`}
                                className="btn-ghost btn-sm"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => handleCancelEvent(event.id)}
                                className="btn-ghost btn-sm"
                              >
                                <Ban size={14} />
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event)}
                                disabled={deletingEventId === event.id}
                                className="btn btn-sm border-[1.5px] border-transparent text-danger font-medium hover:bg-danger-tint"
                              >
                                {deletingEventId === event.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <button
                            onClick={() => setPublishedEventsPage(prev => Math.max(1, prev - 1))}
                            disabled={publishedEventsPage === 1}
                            className="btn-ghost btn-sm"
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>
                          <span className="text-sm text-muted-foreground">
                            Page {publishedEventsPage} of {totalPages} ({upcomingPublishedEvents.length} total)
                          </span>
                          <button
                            onClick={() => setPublishedEventsPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={publishedEventsPage === totalPages}
                            className="btn-ghost btn-sm"
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>

              {/* Published Food & Drink Specials Column */}
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-[22px] font-bold text-navy">
                  <Utensils size={24} className="text-link" />
                  Published Food & Drink Specials
                </h2>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={publishedSpecialsSearch}
                      onChange={(e) => {
                        setPublishedSpecialsSearch(e.target.value);
                        setPublishedSpecialsPage(1);
                      }}
                      placeholder="Search title or venue..."
                      className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13px] text-navy outline-none focus:border-navy"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground mr-1">Sort:</span>
                    <button
                      type="button"
                      onClick={() => { setPublishedSpecialsSort('date'); setPublishedSpecialsPage(1); }}
                      className={`h-8 px-3 rounded-full text-[12px] transition-colors ${publishedSpecialsSort === 'date' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPublishedSpecialsSort('venue'); setPublishedSpecialsPage(1); }}
                      className={`h-8 px-3 rounded-full text-[12px] transition-colors ${publishedSpecialsSort === 'venue' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                    >
                      Venue
                    </button>
                  </div>
                </div>

                {upcomingPublishedSpecials.length === 0 ? (
                  <div className="rounded-[22px] bg-sky-soft p-8 text-center">
                    <Utensils size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="mb-2 text-[18px] font-bold text-navy">No Upcoming Specials</h3>
                    <p className="text-muted-foreground">Approved upcoming specials will appear here.</p>
                  </div>
                ) : (() => {
                  const totalPages = Math.ceil(upcomingPublishedSpecials.length / itemsPerPage);
                  const startIndex = (publishedSpecialsPage - 1) * itemsPerPage;
                  const paginatedSpecials = upcomingPublishedSpecials.slice(startIndex, startIndex + itemsPerPage);

                  return (
                    <>
                      <div className="space-y-3">
                        {paginatedSpecials.map((special) => (
                          <div
                            key={special.id}
                            className="flex items-center justify-between gap-4 border-b border-line py-3"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <div className="flex h-full w-full items-center justify-center bg-sky">
                                  <Utensils size={16} className="text-muted-foreground" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-bold text-navy">{special.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(special.date), 'MMM d, yyyy')} • {special.venue.name}
                                  {special.price && ` • ${formatPrice(special.price)}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Link
                                href={`/events/${special.id}`}
                                className="btn-ghost btn-sm"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => handleDeleteEvent(special)}
                                disabled={deletingEventId === special.id}
                                className="btn btn-sm border-[1.5px] border-transparent text-danger font-medium hover:bg-danger-tint"
                              >
                                {deletingEventId === special.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <button
                            onClick={() => setPublishedSpecialsPage(prev => Math.max(1, prev - 1))}
                            disabled={publishedSpecialsPage === 1}
                            className="btn-ghost btn-sm"
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>
                          <span className="text-sm text-muted-foreground">
                            Page {publishedSpecialsPage} of {totalPages} ({upcomingPublishedSpecials.length} total)
                          </span>
                          <button
                            onClick={() => setPublishedSpecialsPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={publishedSpecialsPage === totalPages}
                            className="btn-ghost btn-sm"
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>
            </div>

            {/* Past Events and Specials */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <section>
                <button
                  type="button"
                  onClick={() => setPastEventsOpen((open) => !open)}
                  className="w-full flex items-center justify-between mb-4 text-left"
                >
                  <h2 className="flex items-center gap-2 text-[22px] font-bold text-navy">
                    <FileText size={24} className="text-muted-foreground" />
                    Past Events
                    <span className="text-sm font-sans font-normal text-muted-foreground">
                      ({pastPublishedEvents.length})
                    </span>
                  </h2>
                  {pastEventsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {pastEventsOpen && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="search"
                          value={pastEventsSearch}
                          onChange={(e) => {
                            setPastEventsSearch(e.target.value);
                            setPastEventsPage(1);
                          }}
                          placeholder="Search title or venue..."
                          className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13px] text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground mr-1">Sort:</span>
                        <button
                          type="button"
                          onClick={() => { setPastEventsSort('date'); setPastEventsPage(1); }}
                          className={`h-8 px-3 rounded-full text-[12px] transition-colors ${pastEventsSort === 'date' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                        >
                          Date
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPastEventsSort('venue'); setPastEventsPage(1); }}
                          className={`h-8 px-3 rounded-full text-[12px] transition-colors ${pastEventsSort === 'venue' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                        >
                          Venue
                        </button>
                      </div>
                    </div>
                    {pastPublishedEvents.length === 0 ? (
                      <div className="rounded-[22px] bg-sky-soft p-6 text-center text-sm text-ink-muted">
                        No past events.
                      </div>
                    ) : (() => {
                      const totalPages = Math.ceil(pastPublishedEvents.length / itemsPerPage);
                      const startIndex = (pastEventsPage - 1) * itemsPerPage;
                      const pageItems = pastPublishedEvents.slice(startIndex, startIndex + itemsPerPage);
                      return (
                        <>
                          <div className="space-y-3">
                            {pageItems.map((event) => (
                              <div
                                key={event.id}
                                className="flex items-center justify-between gap-4 border-b border-line py-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <h3 className="truncate font-bold text-navy">{event.title}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {format(parseISO(event.date), 'MMM d, yyyy')} • {event.venue.name}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Link
                                    href={`/events/${event.id}`}
                                    className="btn-ghost btn-sm"
                                  >
                                    View
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteEvent(event)}
                                    disabled={deletingEventId === event.id}
                                    className="btn btn-sm border-[1.5px] border-transparent text-danger font-medium hover:bg-danger-tint"
                                  >
                                    {deletingEventId === event.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={14} />
                                    )}
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t border-border">
                              <button
                                onClick={() => setPastEventsPage((p) => Math.max(1, p - 1))}
                                disabled={pastEventsPage === 1}
                                className="btn-ghost btn-sm"
                              >
                                <ChevronLeft size={16} />
                                Previous
                              </button>
                              <span className="text-sm text-muted-foreground">
                                Page {pastEventsPage} of {totalPages}
                              </span>
                              <button
                                onClick={() => setPastEventsPage((p) => Math.min(totalPages, p + 1))}
                                disabled={pastEventsPage === totalPages}
                                className="btn-ghost btn-sm"
                              >
                                Next
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </section>

              <section>
                <button
                  type="button"
                  onClick={() => setPastSpecialsOpen((open) => !open)}
                  className="w-full flex items-center justify-between mb-4 text-left"
                >
                  <h2 className="flex items-center gap-2 text-[22px] font-bold text-navy">
                    <Utensils size={24} className="text-muted-foreground" />
                    Past Specials
                    <span className="text-sm font-sans font-normal text-muted-foreground">
                      ({pastPublishedSpecials.length})
                    </span>
                  </h2>
                  {pastSpecialsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {pastSpecialsOpen && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="search"
                          value={pastSpecialsSearch}
                          onChange={(e) => {
                            setPastSpecialsSearch(e.target.value);
                            setPastSpecialsPage(1);
                          }}
                          placeholder="Search title or venue..."
                          className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13px] text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground mr-1">Sort:</span>
                        <button
                          type="button"
                          onClick={() => { setPastSpecialsSort('date'); setPastSpecialsPage(1); }}
                          className={`h-8 px-3 rounded-full text-[12px] transition-colors ${pastSpecialsSort === 'date' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                        >
                          Date
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPastSpecialsSort('venue'); setPastSpecialsPage(1); }}
                          className={`h-8 px-3 rounded-full text-[12px] transition-colors ${pastSpecialsSort === 'venue' ? 'bg-navy text-white font-bold' : 'bg-sky text-navy hover:bg-[#cfe2f3]'}`}
                        >
                          Venue
                        </button>
                      </div>
                    </div>
                    {pastPublishedSpecials.length === 0 ? (
                      <div className="rounded-[22px] bg-sky-soft p-6 text-center text-sm text-ink-muted">
                        No past specials.
                      </div>
                    ) : (() => {
                      const totalPages = Math.ceil(pastPublishedSpecials.length / itemsPerPage);
                      const startIndex = (pastSpecialsPage - 1) * itemsPerPage;
                      const pageItems = pastPublishedSpecials.slice(startIndex, startIndex + itemsPerPage);
                      return (
                        <>
                          <div className="space-y-3">
                            {pageItems.map((special) => (
                              <div
                                key={special.id}
                                className="flex items-center justify-between gap-4 border-b border-line py-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <h3 className="truncate font-bold text-navy">{special.title}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {format(parseISO(special.date), 'MMM d, yyyy')} • {special.venue.name}
                                    {special.price && ` • ${formatPrice(special.price)}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Link
                                    href={`/events/${special.id}`}
                                    className="btn-ghost btn-sm"
                                  >
                                    View
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteEvent(special)}
                                    disabled={deletingEventId === special.id}
                                    className="btn btn-sm border-[1.5px] border-transparent text-danger font-medium hover:bg-danger-tint"
                                  >
                                    {deletingEventId === special.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={14} />
                                    )}
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t border-border">
                              <button
                                onClick={() => setPastSpecialsPage((p) => Math.max(1, p - 1))}
                                disabled={pastSpecialsPage === 1}
                                className="btn-ghost btn-sm"
                              >
                                <ChevronLeft size={16} />
                                Previous
                              </button>
                              <span className="text-sm text-muted-foreground">
                                Page {pastSpecialsPage} of {totalPages}
                              </span>
                              <button
                                onClick={() => setPastSpecialsPage((p) => Math.min(totalPages, p + 1))}
                                disabled={pastSpecialsPage === totalPages}
                                className="btn-ghost btn-sm"
                              >
                                Next
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </section>
            </div>

          </>
        )}

        {activeSubTab === 'venues' && (
          <div className="flex flex-col gap-12">
            {pendingVenues.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between border-b-[1.5px] border-navy pb-2.5">
                  <h2 className="text-[22px] font-bold text-navy">New venues to verify</h2>
                  <span className="text-[12px] text-ink-muted">{pendingVenues.length} waiting</span>
                </div>
                {pendingVenues.map((venue) => (
                  <div key={venue.id} className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-navy">{venue.name}</p>
                      <p className="flex items-center gap-1 text-[12px] text-ink-muted">
                        <MapPin size={12} className="text-link" />
                        {venue.address}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRejectVenue(venue.id)} className="btn-ghost btn-sm">
                        Reject
                      </button>
                      <button onClick={() => handleApproveVenue(venue.id)} className="btn-navy btn-sm">
                        Verify
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section>
              <div className="flex items-baseline justify-between border-b-[1.5px] border-navy pb-2.5">
                <h2 className="text-[22px] font-bold text-navy">Published venues</h2>
                <span className="text-[12px] text-ink-muted">{publishedVenues.length} venues</span>
              </div>
              {loadingVenues ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-navy" />
                </div>
              ) : publishedVenues.length === 0 ? (
                <p className="py-8 text-[14px] text-ink-muted">Venues will appear here once approved.</p>
              ) : (
                publishedVenues.map((venue) => (
                  <div key={venue.id} className="flex items-center justify-between gap-4 border-b border-line py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-sky text-link">
                        {venue.imageUrl ? <SmartImage src={venue.imageUrl} alt={venue.name} sizes="48px" /> : <Building size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-navy">{venue.name}</p>
                        <p className="truncate text-[12px] text-ink-muted">
                          {venue.address}
                          {venue.eventCount !== undefined && ` · ${venue.eventCount} event${venue.eventCount !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link href={`/venues/${venue.id}`} className="btn-ghost btn-sm">
                        View
                      </Link>
                      <button onClick={() => handleEditVenue(venue)} className="btn-outline btn-sm">
                        <Edit size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVenue(venue.id)}
                        disabled={deletingVenueId === venue.id}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-danger hover:bg-danger-tint disabled:opacity-50"
                        aria-label={`Delete ${venue.name}`}
                      >
                        {deletingVenueId === venue.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {activeSubTab === 'venue-promotions' && (
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[1.5px] border-navy pb-2.5">
              <h2 className="text-[22px] font-bold text-navy">Venue promotions</h2>
              <span className="text-[12px] text-ink-muted">Featured venues appear first on Today and Coming up</span>
            </div>
            {publishedVenues.length === 0 ? (
              <p className="py-8 text-[14px] text-ink-muted">Venues will appear here once approved.</p>
            ) : (
              [...publishedVenues]
                .sort((a, b) => {
                  const rank = (t: string) => (t === 'featured' ? 0 : t === 'promoted' ? 1 : 2);
                  return rank(tierOf(a)) - rank(tierOf(b)) || a.name.localeCompare(b.name);
                })
                .map((venue) => (
                  <div key={venue.id} className="flex flex-col gap-3 border-b border-line py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/venues/${venue.id}`} className="truncate text-[15px] font-bold text-navy hover:underline">
                      {venue.name}
                    </Link>
                    <div className="segmented self-start sm:self-auto">
                      {(['standard', 'promoted', 'featured'] as const).map((tier) => (
                        <button
                          key={tier}
                          onClick={() => tierOf(venue) !== tier && handleSaveVenue({ ...venue, promotionTier: tier })}
                          className={`segmented-item h-8 px-4 capitalize ${
                            tierOf(venue) === tier ? (tier === 'featured' ? '!bg-sun !text-navy font-bold' : 'bg-navy text-white font-bold') : ''
                          }`}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </section>
        )}
      </div>

      {/* Edit Venue Modal */}
      {editingVenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[22px] bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-bold text-navy">Edit Venue</h2>
              <button
                onClick={() => setEditingVenue(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <EditVenueForm
              venue={editingVenue}
              onSave={handleSaveVenue}
              onCancel={() => setEditingVenue(null)}
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        onConfirm={modal.onConfirm}
        secondaryConfirmText={modal.secondaryConfirmText}
        onSecondaryConfirm={modal.onSecondaryConfirm}
      />

      {/* Toast notifications */}
      <Toast
        isOpen={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
