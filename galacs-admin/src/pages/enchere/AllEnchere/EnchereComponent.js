import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../../assets/styles/style.css';
import './Enchere.css';
import { useNavigate } from 'react-router-dom';
import { callModel } from '../../../services/odooApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountdown(dateEnd) {
  const [timeLeft, setTimeLeft] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!dateEnd) { setTimeLeft(''); return; }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(dateEnd + 'Z') - Date.now()) / 1000));
      if (diff === 0) { setTimeLeft('Terminée'); clearInterval(timerRef.current); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [dateEnd]);

  return timeLeft;
}

// Individual card — each has its own countdown
function EnchereCard({ enchere, navigate, onStop, onExtend }) {
  const timeLeft = useCountdown(enchere.date_end);

  const score     = enchere.score_maturity || 0;
  const category  = enchere.ia_category || 'cold';
  const leadName  = enchere.lead_id?.[1] || '—';
  const isFirst   = enchere._isFirst;

  const badgeClass = category === 'hot'
    ? 'bdg-hot'
    : category === 'warm'
    ? 'bdg-warm'
    : 'bdg-cold';
  const badgeIcon  = category === 'hot' ? '🔥' : category === 'warm' ? '🌡' : '❄️';
  const winnerName = enchere.winner_id?.[1] || '—';

  // Format date_start for display
  const startLabel = enchere.date_start
    ? new Date(enchere.date_start).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div
      className={isFirst ? 'enchereS4' : 'enchereS22'}
      onClick={() => navigate('/enchere/enchere-detail', { state: { enchereId: enchere.id } })}
    >
      {/* Row 1 — lead info + countdown */}
      <div className="enchereS5">
        <div>
          <div className="syn enchereS6">
            {leadName}
            <span className="enchereS7">
              #{String(enchere.id).padStart(5, '0').replace(/^0+/, 'GL-')} · {enchere.zone_chalandise || '—'}
            </span>
          </div>
          <div className="enchereS8">
            Depuis le {startLabel} · {enchere.bid_count || 0} mise{enchere.bid_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="enchereS9">
          <span className="live-tag">🔴 LIVE</span>
          <div className="syn enchereS10">
            ⏱ {timeLeft || '…'}
          </div>
        </div>
      </div>

      {/* Row 2 — stats */}
      <div className="enchereS11">
        {/* IA Score */}
        <div>
          <div className="enchereS12">Score IA</div>
          <div className="enchereS13">
            <div className="enchereS14">
              <div
                className="enchereS15"
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="syn enchereS16">{score}%</div>
            <span className={`bdg ${badgeClass}`} style={{ fontSize: '10px' }}>{badgeIcon}</span>
          </div>
        </div>

        {/* Best bid */}
        <div>
          <div className="enchereS17">Meilleure offre</div>
          <div className="syn enchereS18">
            {enchere.current_bid_percent != null
              ? `${enchere.current_bid_percent}%`
              : `${enchere.min_bid_percent || 0}% min`}
          </div>
        </div>

        {/* Participants */}
        <div>
          <div className="enchereS17">Participants</div>
          <div className="syn enchereS19">{enchere.bid_count || 0}</div>
        </div>

        {/* Current winner */}
        <div>
          <div className="enchereS17">Gagnant actuel</div>
          <div className="enchereS20">{winnerName}</div>
        </div>

        {/* Actions */}
        <div className="enchereS21">
          <button
            className="btn btn-ko btn-sm"
            onClick={(e) => { e.stopPropagation(); onStop(enchere.id); }}
          >
            ⏹ Stop
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onExtend(enchere.id); }}
          >
            +30 min
          </button>
          <button
            className="btn btn-gold btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/enchere/enchere-detail', { state: { enchereId: enchere.id } });
            }}
          >
            Détail →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Past / attributed auction row (compact) ─────────────────────────────────
function EncherePastRow({ enchere, navigate }) {
  const leadName   = enchere.lead_id?.[1] || '—';
  const winnerName = enchere.winner_id?.[1] || '—';
  const endDate    = enchere.date_end
    ? new Date(enchere.date_end).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';
  const stateLabel =
    enchere.state === 'closed'    ? { label: 'Clôturée',  cls: 'bdg-ok'   } :
    enchere.state === 'pending'   ? { label: 'En attente', cls: 'bdg-warn' } :
    enchere.state === 'cancelled' ? { label: 'Annulée',   cls: 'bdg-ko'   } :
                                    { label: enchere.state, cls: 'bdg-warn' };

  return (
    <div
      className="enchereS22"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate('/enchere/enchere-detail', { state: { enchereId: enchere.id } })}
    >
      <div className="enchereS5">
        <div>
          <div className="syn enchereS6">
            {leadName}
            <span className="enchereS7">
              #{String(enchere.id).padStart(5, '0').replace(/^0+/, 'GL-')} · {enchere.zone_chalandise || '—'}
            </span>
          </div>
          <div className="enchereS8">
            Clôturée le {endDate} · Gagnant : {winnerName}
          </div>
        </div>
        <div className="enchereS9">
          <span className={`bdg ${stateLabel.cls}`}>{stateLabel.label}</span>
          <div className="syn enchereS10">
            {enchere.current_bid_percent != null ? `${enchere.current_bid_percent}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const EnchereComponent = () => {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState('en-cours');
  const [loading,      setLoading]      = useState(true);
  const [encheres,     setEncheres]     = useState([]);   // open
  const [attributed,   setAttributed]   = useState([]);   // closed + pending
  const [historique,   setHistorique]   = useState([]);   // ALL records
  const [actionMsg,    setActionMsg]    = useState(null); // toast

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const FIELDS = [
        'lead_id', 'state', 'date_start', 'date_end',
        'duration_minutes', 'min_bid_percent', 'current_bid_percent',
        'winner_id', 'bid_count', 'zone_chalandise',
        'ia_category', 'score_maturity',
      ];

      const [open, all] = await Promise.all([
        callModel('galacs.enchere', 'search_read',
          [[['state', '=', 'open']]],
          { fields: FIELDS, order: 'date_end asc' }
        ),
        // Historique = every enchere ever created, no domain filter
        callModel('galacs.enchere', 'search_read',
          [[]],
          { fields: FIELDS, order: 'date_end desc' }
        ),
      ]);

      // Mark first card for styling
      if (open.length > 0) open[0]._isFirst = true;

      // Attribués = closed + pending (everything that is no longer open)
      const notOpen = all.filter(e => e.state !== 'open');

      setEncheres(open);
      setAttributed(notOpen.filter(e => ['closed', 'pending'].includes(e.state)));
      setHistorique(all);
    } catch (err) {
      console.error('EnchereComponent fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Refresh every 90s to catch new auctions / state changes
    const interval = setInterval(fetchAll, 90_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toast = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleStop = async (id) => {
    try {
      await callModel('galacs.enchere', 'write', [[id], { state: 'cancelled' }]);
      toast('Enchère arrêtée.');
      fetchAll();
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  };

  const handleExtend = async (id) => {
    try {
      // Find current date_end and add 30 min
      const record = encheres.find(e => e.id === id);
      if (!record?.date_end) return;
      const newEnd = new Date(new Date(record.date_end).getTime() + 30 * 60 * 1000);
      // Format as Odoo datetime string "YYYY-MM-DD HH:MM:SS"
      const pad = (n) => String(n).padStart(2, '0');
      const d = newEnd;
      const odooDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      await callModel('galacs.enchere', 'write', [[id], { date_end: odooDate }]);
      toast('+30 minutes appliquées.');
      fetchAll();
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  };

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const tabCounts = {
    'en-cours':  encheres.length,
    'attribues': attributed.length,
    'historique': historique.length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-encheres">
      <div className="pi fade-in">

        {/* Header */}
        <div className="enchereS1">
          <div>
            <h1>Gestion des Enchères</h1>
            <p className="subtitle">
              Supervision en temps réel ·{' '}
              {loading ? '…' : `${encheres.length} enchère${encheres.length !== 1 ? 's' : ''} active${encheres.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="enchereS2">
            <span className="bdg bdg-live">
              ⚡ {loading ? '…' : encheres.length} live
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={fetchAll}
              style={{ marginLeft: '8px' }}
              title="Rafraîchir"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Toast */}
        {actionMsg && (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--gold)',
            borderRadius: '8px', padding: '10px 16px',
            marginBottom: '12px', fontSize: '13px',
            color: 'var(--gold)', fontWeight: 600,
          }}>
            {actionMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="ftabs" style={{ width: 'auto' }}>
          {[
            { key: 'en-cours',   label: 'En cours'   },
            { key: 'attribues',  label: 'Attribués'  },
            { key: 'historique', label: 'Historique' },
          ].map(({ key, label }) => (
            <div
              key={key}
              className={`ftab ${activeTab === key ? 'on' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {!loading && tabCounts[key] > 0 && (
                <span style={{
                  marginLeft: '6px', fontSize: '11px',
                  background: activeTab === key ? 'var(--gold)' : 'var(--border)',
                  color: activeTab === key ? '#000' : 'var(--muted)',
                  borderRadius: '10px', padding: '1px 7px', fontWeight: 700,
                }}>
                  {tabCounts[key]}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="enchereS3">

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.5 }}>⏳</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Chargement des enchères…</div>
            </div>
          ) : (
            <>
              {/* ── En cours ── */}
              {activeTab === 'en-cours' && (
                encheres.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      Aucune enchère en cours
                    </div>
                  </div>
                ) : encheres.map((e) => (
                  <EnchereCard
                    key={e.id}
                    enchere={e}
                    navigate={navigate}
                    onStop={handleStop}
                    onExtend={handleExtend}
                  />
                ))
              )}

              {/* ── Attribués ── */}
              {activeTab === 'attribues' && (
                attributed.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Aucune enchère attribuée</div>
                  </div>
                ) : attributed.map((e) => (
                  <EncherePastRow key={e.id} enchere={e} navigate={navigate} />
                ))
              )}

              {/* ── Historique ── */}
              {activeTab === 'historique' && (
                historique.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Aucune enchère dans l'historique</div>
                  </div>
                ) : historique.map((e) => (
                  <EncherePastRow key={e.id} enchere={e} navigate={navigate} />
                ))
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default EnchereComponent;