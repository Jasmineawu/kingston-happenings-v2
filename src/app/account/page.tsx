'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { User, Mail, Trash2, Loader2, LogOut, Store, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components';

const roleLabels = { user: 'Event-goer', organizer: 'Organizer', admin: 'Admin' } as const;

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/account');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated!' });
        window.location.reload();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        await logout();
        window.location.href = '/';
      } else {
        const errorMsg = data.details
          ? `${data.error || 'Failed to delete account'}. ${data.details}`
          : data.error || 'Failed to delete account';
        setMessage({ type: 'error', text: errorMsg });
        setDeleting(false);
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Delete account error:', error);
      setMessage({ type: 'error', text: 'An error occurred. Please try again or contact support.' });
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push('/');
  };

  const organizerRequest = `mailto:kingstonhappenings.ca@gmail.com?subject=${encodeURIComponent(
    'Organizer access request'
  )}&body=${encodeURIComponent(`Hi! I'd like organizer access for my account (${user.email}).\n\nVenue / organization: `)}`;

  return (
    <div className="page-container pb-24 pt-10">
      <p className="eyebrow mb-3.5">— Account</p>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display-section">
          Your
          <br />
          account
        </h1>
        <button onClick={handleSignOut} className="btn-outline self-start sm:self-auto sm:mb-2">
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      {message && (
        <div
          className={`mt-8 flex items-center gap-3 rounded-[14px] p-4 text-[14px] ${
            message.type === 'success' ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_440px] lg:items-start">
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSave} className="card p-6 sm:p-7">
            <p className="eyebrow-sm">Profile information</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sun text-[20px] font-bold text-navy">
                {initials || <User size={22} />}
              </span>
              <div>
                <p className="text-[20px] font-bold text-navy">{user.name}</p>
                {user.createdAt && (
                  <p className="text-[13px] text-ink-muted">Member since {format(parseISO(user.createdAt), 'MMMM yyyy')}</p>
                )}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="field-label">
                  Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-link" />
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field field-with-icon"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-link" />
                  <input id="email" value={user.email} readOnly className="field field-with-icon bg-sky-soft text-ink-muted" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="submit" disabled={saving || name.trim() === user.name || !name.trim()} className="btn-sun">
                {saving && <Loader2 size={15} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </form>

          <div className="rounded-[22px] bg-danger-tint p-6 sm:p-7">
            <p className="eyebrow-bold text-navy">Danger zone</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[20px] font-bold text-navy">Delete account</p>
                <p className="mt-1 max-w-[420px] text-[13px] text-ink-muted">
                  Permanently remove your account, saved events and submissions. This can&rsquo;t be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn shrink-0 border-[1.5px] border-danger text-danger font-medium hover:bg-danger hover:text-white"
              >
                <Trash2 size={15} />
                Delete account
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] bg-navy p-6 text-white sm:p-7">
          <p className="eyebrow-bold text-sun">Account status</p>
          <div className="mt-5 flex items-center justify-between border-b border-white/15 pb-4">
            <span className="text-[15px] text-on-dark-muted">Role</span>
            <span className="tag bg-sun text-navy gap-1.5">
              {user.role === 'admin' ? <Shield size={12} /> : user.role === 'organizer' ? <Store size={12} /> : <User size={12} />}
              {roleLabels[user.role]}
            </span>
          </div>
          {user.venueName && (
            <div className="flex items-center justify-between border-b border-white/15 py-4">
              <span className="text-[15px] text-on-dark-muted">Venue</span>
              <span className="text-[14px] font-bold">{user.venueName}</span>
            </div>
          )}
          {user.role === 'user' ? (
            <>
              <p className="mt-5 text-[20px] font-bold">Want to become an organizer?</p>
              <p className="mt-2 text-[13px] leading-[1.5] text-on-dark-muted">
                Organizers can post events and specials for their venue. Request access and we&rsquo;ll get back to you within a
                day.
              </p>
              <a href={organizerRequest} className="btn-sun mt-5 w-full">
                <Store size={15} />
                Request organizer access
              </a>
            </>
          ) : (
            <>
              <p className="mt-5 text-[20px] font-bold">
                {user.role === 'admin' ? 'You have admin access' : 'You can post events & specials'}
              </p>
              <p className="mt-2 text-[13px] leading-[1.5] text-on-dark-muted">
                Track everything you&rsquo;ve submitted from My Events.
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Link href="/submit" className="btn-sun w-full">
                  Submit an event →
                </Link>
                {user.role === 'admin' ? (
                  <Link href="/admin" className="btn w-full border-[1.5px] border-white text-white font-medium hover:bg-white hover:text-navy">
                    Admin dashboard
                  </Link>
                ) : (
                  <Link
                    href="/my-events?tab=submitted"
                    className="btn w-full border-[1.5px] border-white text-white font-medium hover:bg-white hover:text-navy"
                  >
                    Your submissions
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
        type="warning"
        confirmText={deleting ? 'Deleting...' : 'Delete account'}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
