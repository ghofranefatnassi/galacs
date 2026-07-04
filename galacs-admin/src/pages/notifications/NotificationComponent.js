import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/styles/style.css';
import './Notification.css';
import { subscribeBus, callModel } from '../../services/odooApi';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  new_lead:       { icon: '🤖', colorClass: 'notifS12', label: 'Nouveau lead scoré',              page: '/leads' },
  auction_start:  { icon: '⚡', colorClass: 'notifS8',  label: 'Début enchère',                   page: '/encheres' },
  new_bid:        { icon: '⚡', colorClass: 'notifS8',  label: 'Nouvelle surenchère',             page: '/encheres' },
  auction_end:    { icon: '⚡', colorClass: 'notifS8',  label: 'Fin enchère',                     page: '/encheres' },
  auction_won:    { icon: '🏆', colorClass: 'notifS4',  label: 'Enchère gagnée',                  page: '/encheres' },
  no_bids:        { icon: '⚠️', colorClass: 'notifS9',  label: 'Enchère sans mise',               page: '/encheres' },
  followup_72h:   { icon: '⚠️', colorClass: 'notifS9',  label: 'Rappel suivi 72h',                page: '/agents' },
  sale_pending:   { icon: '💰', colorClass: 'notifS4',  label: 'Nouvelle déclaration de vente',   page: '/ventes' },
  sale_validated: { icon: '✅', colorClass: 'notifS4',  label: 'Vente validée',                   page: '/ventes' },
  sale_rejected:  { icon: '❌', colorClass: 'notifS9',  label: 'Vente rejetée',                   page: '/ventes' },
};
const FALLBACK = { icon: '🔔', colorClass: 'notifS11', label: 'Notification', page: '/' };

// ── localStorage read tracking ────────────────────────────────────────────────
const LS_KEY      = 'galacs_read_notif_ids';
const getReadIds  = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { return new Set(); } };
const saveReadIds = (set) => { localStorage.setItem(LS_KEY, JSON.stringify([...set])); };

// ── Time formatting ───────────────────────────────────────────────────────────
const formatTime = (dateStr) => {
  if (!dateStr) return '—';
  const date    = new Date(dateStr + 'Z'); // Odoo stores UTC
  const now     = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  const diffH   = Math.floor((now - date) / 3600000);
  const diffD   = Math.floor((now - date) / 86400000);
  if (diffMin < 1)   return "À l'instant";
  if (diffMin < 60)  return `Il y a ${diffMin} min`;
  if (diffH   < 24)  return `Il y a ${diffH}h`;
  if (diffD   === 1) return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
};

// ── Day grouping ──────────────────────────────────────────────────────────────
const isToday = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr + 'Z').toDateString() === new Date().toDateString();
};
const isYesterday = (dateStr) => {
  if (!dateStr) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  return new Date(dateStr + 'Z').toDateString() === y.toDateString();
};

// ── Message builder ───────────────────────────────────────────────────────────
const buildMessage = (eventType, payloadStr) => {
  let p = {};
  try { p = JSON.parse(payloadStr || '{}'); } catch {}
  switch (eventType) {
    case 'new_lead':
      return `Nouveau lead "${p.lead_name || '—'}" scoré — zone ${p.zone || '—'} · Score ${p.score ?? '—'}%`;
    case 'auction_start':
      return `Enchère démarrée pour "${p.lead_name || '—'}" — zone ${p.zone || '—'} · Mise min. ${p.min_bid ?? '—'}%`;
    case 'new_bid':
      return `Nouvelle surenchère à ${p.new_bid ?? '—'}% — offre max actuelle ${p.current_bid ?? '—'}%`;
    case 'auction_end':
      return `L'enchère #${p.enchere_id || '—'} est terminée.`;
    case 'auction_won':
      return `Lead #${p.lead_id || '—'} remporté avec ${p.commission ?? '—'}% de commission.`;
    case 'no_bids':
      return `L'enchère #${p.enchere_id || '—'} s'est fermée sans aucune mise. Action requise.`;
    case 'followup_72h':
      return `Rappel suivi 72h — Lead "${p.lead_name || '—'}" · Étape : ${p.current_stage || '—'}`;
    case 'sale_pending':
      // Admin notification: agent declared a sale, needs validation
      return `${p.agent || '—'} déclare la vente du lead #${p.lead_id || '—'}. Validation requise.`;
    case 'sale_validated':
      // Agent notification: admin validated the sale
      return `Vente du lead #${p.lead_id || '—'} confirmée. Commission calculée automatiquement.`;
    case 'sale_rejected':
      // Agent notification: admin rejected the sale
      return `Vente du lead #${p.lead_id || '—'} rejetée par l'administrateur.`;
    default:
      return p.message || payloadStr || 'Notification';
  }
};
// ── Deduplicate: group same event+payload into one row ────────────────────────
const deduplicateNotifications = (notifs) => {
  const seen = new Map();
  notifs.forEach(n => {
    // Key = event_type + lead/enchere id from payload (same event, same lead = same row)
    let p = {};
    try { p = JSON.parse(n.payload || '{}'); } catch {}
    const key = `${n.event_type}_${p.enchere_id || p.lead_id || p.vente_id || n.id}`;

    if (!seen.has(key)) {
      seen.set(key, { ...n, recipientCount: 1 });
    } else {
      seen.get(key).recipientCount += 1;
    }
  });
  return [...seen.values()];
};
// ── Component ─────────────────────────────────────────────────────────────────
const NotificationComponent = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [readIds, setReadIds]             = useState(getReadIds);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const result = await callModel(
        'galacs.notification',
        'search_read',
        [[]],
        {
          fields: ['id', 'event_type', 'recipient_id', 'payload', 'create_date', 'suppressed_quiet'],
          order: 'create_date desc',
          limit: 80,
        }
      );
      setNotifications(Array.isArray(result) ? result : []);
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('session') || msg.includes('expired') || msg.includes('auth')) {
        setSessionExpired(true);
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Live updates: bus subscription in prod, polling fallback in dev ───────
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('odoo_session') || '{}');
    const uid = session.uid;
    if (!uid) return;

    if (process.env.NODE_ENV === 'production') {
      // Production: real-time push via Odoo bus on galacs_admin_{uid}
      const stop = subscribeBus(uid, () => {
        // Any live event → simplest safe approach is to re-pull the full list
        // rather than try to merge/dedupe a single payload into local state.
        fetchNotifications();
      });
      return () => stop();
    } else {
      // Dev: subscribeBus is a no-op (longpolling proxy not available locally),
      // so fall back to periodic polling — same pattern as the agent app.
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications]);

  // ── Read tracking ─────────────────────────────────────────────────────────
  const markAsRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    saveReadIds(allIds);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const deduped       = deduplicateNotifications(notifications);
  const unreadCount    = deduped.filter(n => !readIds.has(n.id)).length;
  const todayItems     = deduped.filter(n => isToday(n.create_date));
  const yesterdayItems = deduped.filter(n => isYesterday(n.create_date));
  const olderItems     = deduped.filter(n => !isToday(n.create_date) && !isYesterday(n.create_date));

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderRow = (notif) => {
    const cfg      = EVENT_CONFIG[notif.event_type] || FALLBACK;
    const isUnread = !readIds.has(notif.id);
    const message  = buildMessage(notif.event_type, notif.payload);

    return (
      <div
        key={notif.id}
        className={`notif-row${isUnread ? ' unread' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => { markAsRead(notif.id); navigate(cfg.page); }}
      >
       <div className={`n-icon ${cfg.colorClass}`}>{cfg.icon}</div>
<div style={{ flex: 1 }}>
  <div className="notifS5">
    {cfg.label}
    {notif.recipientCount > 1 && (
      <span style={{
        marginLeft: '8px', fontSize: '10px', padding: '2px 7px',
        borderRadius: '10px', background: 'rgba(139,92,246,0.15)',
        color: '#a78bfa', fontWeight: 600,
      }}>
        {notif.recipientCount} agents
      </span>
    )}
  </div>
  <div className="notifS6">{message}</div>
  <div className="notifS7">{formatTime(notif.create_date)}</div>
</div>
        {isUnread && <div className="n-dot" />}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-notifs">
      <div className="pi fade-in">

        <div className="notifS1">
          <div>
            <h1>Notifications</h1>
            <p className="subtitle">
              {loading
                ? '...'
                : `${unreadCount} non lue${unreadCount !== 1 ? 's' : ''} · Alertes plateforme`}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || loading}
          >
            Tout marquer comme lu
          </button>
        </div>

        <div className="card notifS2">

          {/* Session expired */}
          {sessionExpired && (
            <div style={{
              textAlign: 'center', padding: '40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ fontSize: '32px' }}>🔒</div>
              <div style={{ color: '#fca5a5', fontWeight: 600 }}>Session expirée</div>
              <div style={{ opacity: 0.5, fontSize: '13px' }}>
                Veuillez vous reconnecter pour voir vos notifications.
              </div>
              <button className="btn btn-gold btn-sm" onClick={() => navigate('/login')}>
                Se reconnecter
              </button>
            </div>
          )}

          {/* Loading */}
          {!sessionExpired && loading && (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              ⏳ Chargement des notifications...
            </div>
          )}

          {/* Empty */}
          {!sessionExpired && !loading && notifications.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              Aucune notification pour le moment
            </div>
          )}

          {/* Grouped notifications — same structure as original design */}
          {!sessionExpired && !loading && notifications.length > 0 && (
            <>
              {todayItems.length > 0 && (
                <>
                  <div className="notifS3">Aujourd'hui</div>
                  {todayItems.map(renderRow)}
                </>
              )}
              {yesterdayItems.length > 0 && (
                <>
                  <div className="notifS10">Hier</div>
                  {yesterdayItems.map(renderRow)}
                </>
              )}
              {olderItems.length > 0 && (
                <>
                  <div className="notifS10">Plus ancien</div>
                  {olderItems.map(renderRow)}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default NotificationComponent;