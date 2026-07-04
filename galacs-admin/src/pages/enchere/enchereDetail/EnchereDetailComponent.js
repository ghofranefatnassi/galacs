import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../../assets/styles/style.css';
import './EnchereDetail.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { callModel } from '../../../services/odooApi';

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(dateEnd) {
  const [timeLeft, setTimeLeft] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!dateEnd) { setTimeLeft(''); return; }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(dateEnd) - Date.now()) / 1000));
      if (diff === 0) {
        setTimeLeft('Terminée');
        clearInterval(timerRef.current);
        return;
      }
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

// ─── Initials helper ──────────────────────────────────────────────────────────
function initials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Bid row ──────────────────────────────────────────────────────────────────
function BidRow({ bid, rank, isWinner }) {
  const agentName = bid.agent_id?.[1] || '—';
  const zone      = bid.zone || '—';
  const perf      = bid.agent_perf != null ? `${bid.agent_perf}%` : '—';

  const rankColors = ['enchereDetailS15', 'enchereDetailS22', 'enchereDetailS24', 'enchereDetailS26'];
  const avatarClass = rankColors[rank] || 'enchereDetailS26';

  return (
    <div className={rank === 0 ? 'enchereDetailS14' : 'enchereDetailS20'}>
      <div className={avatarClass}>{initials(agentName)}</div>
      <div style={{ flex: 1 }}>
        <div className="enchereDetailS16">{agentName}</div>
        <div className="enchereDetailS17">{zone} · {perf} perf.</div>
      </div>
      {isWinner ? (
        <div style={{ textAlign: 'right' }}>
          <div className="syn enchereDetailS18">{bid.percent}%</div>
          <div className="enchereDetailS19">👑 Meilleure offre</div>
        </div>
      ) : (
        <div className="syn enchereDetailS23">{bid.percent}%</div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const EnchereDetailComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const enchereId = location.state?.enchereId ?? null;

  const [enchere,   setEnchere]   = useState(null);
  const [bids,      setBids]      = useState([]);   // sorted by percent desc
  const [journal,   setJournal]   = useState([]);   // activity log
  const [loading,   setLoading]   = useState(true);
  const [actionMsg, setActionMsg] = useState(null);

  const timeLeft = useCountdown(enchere?.date_end);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async () => {
    if (!enchereId) { setLoading(false); return; }
    try {
      // 1 — Enchere record
      const [enc] = await callModel('galacs.enchere', 'read', [[enchereId]], {
        fields: [
          'lead_id', 'state', 'date_start', 'date_end',
          'min_bid_percent', 'current_bid_percent',
          'winner_id', 'bid_count', 'bid_ids',
          'zone_chalandise', 'ia_category', 'score_maturity',
        ],
      });
      setEnchere(enc);

      // 2 — Bids (galacs.enchere.bid)
      if (enc.bid_ids?.length > 0) {
        const rawBids = await callModel('galacs.enchere.bid', 'read', [enc.bid_ids], {
          fields: ['agent_id', 'percent', 'create_date'],
        });

        // Enrich with agent stats (lead count + perf) from res.users
        const agentIds = [...new Set(rawBids.map(b => b.agent_id?.[0]).filter(Boolean))];
        let agentStats = {};
        if (agentIds.length > 0) {
          // galacs.commission gives us real performance data
          const comms = await callModel('galacs.commission', 'search_read',
            [[['agent_id', 'in', agentIds]]],
            { fields: ['agent_id', 'state', 'montant_agent'] }
          );
          agentIds.forEach(id => {
            const myComms = comms.filter(c => c.agent_id?.[0] === id);
            const done    = myComms.filter(c => c.state === 'done');
            const perf    = myComms.length > 0
              ? Math.round((done.length / myComms.length) * 100)
              : null;
            agentStats[id] = { perf, dealCount: done.length };
          });

          // Also get agent zone from res.partner
          const users = await callModel('res.users', 'read', [agentIds], {
            fields: ['partner_id'],
          });
          const partnerIds = users.map(u => u.partner_id?.[0]).filter(Boolean);
          if (partnerIds.length > 0) {
            const partners = await callModel('res.partner', 'read', [partnerIds], {
              fields: ['id', 'city'],
            });
            const cityMap = {};
            partners.forEach(p => { cityMap[p.id] = p.city; });
            users.forEach(u => {
              const city = cityMap[u.partner_id?.[0]];
              if (city && agentStats[u.id]) agentStats[u.id].city = city;
            });
          }
        }

        // Sort by percent desc, keep only latest bid per agent
        const latestPerAgent = {};
        rawBids.forEach(b => {
          const aid = b.agent_id?.[0];
          if (!aid) return;
          if (!latestPerAgent[aid] || b.percent > latestPerAgent[aid].percent) {
            latestPerAgent[aid] = {
              ...b,
              zone:       agentStats[aid]?.city || '—',
              agent_perf: agentStats[aid]?.perf ?? null,
            };
          }
        });
        const sorted = Object.values(latestPerAgent).sort((a, b) => b.percent - a.percent);
        setBids(sorted);

        // 3 — Build journal from all bids (chronological desc)
        const allSorted = [...rawBids].sort(
          (a, b) => new Date(b.create_date) - new Date(a.create_date)
        );
        const journalEntries = allSorted.map(b => ({
          time: b.create_date
            ? new Date(b.create_date).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit',
              })
            : '—',
          agent: b.agent_id?.[1] || '—',
          percent: b.percent,
          isOpen: false,
        }));

        // Append "enchère ouverte" entry at the end
        if (enc.date_start) {
          journalEntries.push({
            time: new Date(enc.date_start).toLocaleTimeString('fr-FR', {
              hour: '2-digit', minute: '2-digit',
            }),
            agent: null,
            percent: null,
            isOpen: true,
          });
        }
        setJournal(journalEntries);
      } else {
        setBids([]);
        // Journal with just the open event
        setJournal(enc.date_start ? [{
          time: new Date(enc.date_start).toLocaleTimeString('fr-FR', {
            hour: '2-digit', minute: '2-digit',
          }),
          agent: null, percent: null, isOpen: true,
        }] : []);
      }
    } catch (err) {
      console.error('EnchereDetail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [enchereId]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 15_000); // refresh bids every 15s
    return () => clearInterval(interval);
  }, [fetchDetail]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toast = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleStop = async () => {
    if (!enchere) return;
    try {
      await callModel('galacs.enchere', 'write', [[enchere.id], { state: 'cancelled' }]);
      toast('Enchère arrêtée.');
      fetchDetail();
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  };

  const handleExtend = async () => {
    if (!enchere?.date_end) return;
    try {
      const newEnd = new Date(new Date(enchere.date_end).getTime() + 30 * 60 * 1000);
      const pad = n => String(n).padStart(2, '0');
      const odooDate = `${newEnd.getFullYear()}-${pad(newEnd.getMonth()+1)}-${pad(newEnd.getDate())} ${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}:${pad(newEnd.getSeconds())}`;
      await callModel('galacs.enchere', 'write', [[enchere.id], { date_end: odooDate }]);
      toast('+30 minutes appliquées.');
      fetchDetail();
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const leadRef  = enchere
    ? `#${String(enchere.id).padStart(5, '0').replace(/^0+/, 'GL-')}`
    : '—';
  const leadName = enchere?.lead_id?.[1] || '—';
  const isLive   = enchere?.state === 'open';

  const stateLabel = !enchere ? '—'
    : enchere.state === 'open'      ? { text: '🔴 En cours',   cls: 'bdg-live' }
    : enchere.state === 'closed'    ? { text: '✅ Clôturée',   cls: 'bdg-ok'   }
    : enchere.state === 'pending'   ? { text: '⏳ En attente', cls: 'bdg-warn' }
    : enchere.state === 'cancelled' ? { text: '⛔ Annulée',    cls: 'bdg-ko'   }
    :                                 { text: enchere.state,   cls: 'bdg-warn' };

  // ── Loading / no ID ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page active" id="p-detail-enchere">
        <div className="pi fade-in" style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '32px', opacity: 0.4 }}>⏳</div>
          <div style={{ color: 'var(--muted)', marginTop: '12px' }}>Chargement de l'enchère…</div>
        </div>
      </div>
    );
  }

  if (!enchere) {
    return (
      <div className="page active" id="p-detail-enchere">
        <div className="pi fade-in" style={{ textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '32px', opacity: 0.4 }}>📭</div>
          <div style={{ color: 'var(--muted)', marginTop: '12px' }}>
            Enchère introuvable.{' '}
            <span
              style={{ color: 'var(--gold)', cursor: 'pointer' }}
              onClick={() => navigate('/enchere')}
            >
              Retour à la liste →
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-detail-enchere">
      <div className="pi fade-in">

        {/* Header */}
        <div className="enchereDetailS1">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/enchere')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Enchère {leadRef}</h1>
          <span className={`bdg ${stateLabel.cls}`}>{stateLabel.text}</span>
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

        <div className="g2" style={{ marginBottom: '20px' }}>

          {/* Left — enchere info */}
          <div className="enchereDetailS2">
            <div className="enchereDetailS3">
              <span className="live-tag">
                {isLive ? '🔴 ENCHÈRE EN COURS' : '⚫ ENCHÈRE CLÔTURÉE'}
              </span>
              <div className="syn enchereDetailS4" id="cd-de">
                {isLive ? (timeLeft || '…') : '—'}
              </div>
            </div>

            <div className="syn enchereDetailS5">{leadName}</div>

            <div className="enchereDetailS6">
              📍 {enchere.zone_chalandise || '—'} · Catégorie IA : {enchere.ia_category || '—'}
            </div>

            <div className="g2 enchereDetailS7">
              <div className="enchereDetailS8">
                <div className="enchereDetailS9">Score IA</div>
                <div className="syn enchereDetailS10" style={{ color: 'var(--green)' }}>
                  {enchere.score_maturity ?? '—'}%
                </div>
              </div>
              <div className="enchereDetailS8">
                <div className="enchereDetailS9">Meilleure offre</div>
                <div className="syn enchereDetailS10" style={{ color: 'var(--orange)' }}>
                  {enchere.current_bid_percent != null
                    ? `${enchere.current_bid_percent}%`
                    : '—'}
                </div>
              </div>
              <div className="enchereDetailS8">
                <div className="enchereDetailS9">Participants</div>
                <div className="syn enchereDetailS10">{enchere.bid_count || 0}</div>
              </div>
              <div className="enchereDetailS8">
                <div className="enchereDetailS9">Comm. min.</div>
                <div className="syn enchereDetailS11">
                  {enchere.min_bid_percent != null ? `${enchere.min_bid_percent}%` : '—'}
                </div>
              </div>
            </div>

            {isLive && (
              <div className="enchereDetailS12">
                <button
                  className="btn btn-ko enchereDetailS13"
                  onClick={handleStop}
                >
                  ⏹ Arrêter l'enchère
                </button>
                <button
                  className="btn btn-ghost enchereDetailS13"
                  onClick={handleExtend}
                >
                  ⏱ Prolonger +30 min
                </button>
              </div>
            )}
          </div>

          {/* Right — leaderboard + journal */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>
              Classement en temps réel
              {bids.length === 0 && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)', marginLeft: '8px' }}>
                  — aucune mise pour l'instant
                </span>
              )}
            </h3>

            {bids.slice(0, 5).map((bid, i) => (
              <BidRow
                key={bid.id || i}
                bid={bid}
                rank={i}
                isWinner={i === 0}
              />
            ))}

            {/* Journal */}
            <div className="enchereDetailS27">
              <h3 style={{ marginBottom: '12px' }}>Journal d'activité</h3>
              <div className="enchereDetailS28">
                {journal.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Aucune activité enregistrée
                  </div>
                ) : journal.map((entry, i) => (
                  <div key={i} className="enchereDetailS29">
                    <span className="enchereDetailS30">{entry.time}</span>
                    {entry.isOpen ? (
                      <span className="enchereDetailS33">⚡ Enchère ouverte</span>
                    ) : (
                      <span>
                        {entry.agent} enchérit à{' '}
                        <span className={i === 0 ? 'enchereDetailS31' : 'enchereDetailS32'}>
                          {entry.percent}%
                        </span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EnchereDetailComponent;