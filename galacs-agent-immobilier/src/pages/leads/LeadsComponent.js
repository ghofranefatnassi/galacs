// LeadsComponent.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Leads.css';
import { useAgentAuth } from '../../contexts/AgentAuthContext';
import { callModel } from '../../services/odooApi';

const LeadsComponent = () => {
  const navigate = useNavigate();
  const { user } = useAgentAuth();
  
  // ── State ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeLeftMap, setTimeLeftMap] = useState({});
  
  // ── Helper: Format time ──────────────────────────────────────────────────
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // ── Load leads data ──────────────────────────────────────────────────────
  useEffect(() => {
    const loadLeads = async () => {
      setLoading(true);
      try {
        const currentUserId = user?.uid;
        
        // ── 1. Get all imported leads from galacs.external.import ───────────
        const importedLeads = await callModel('galacs.external.import', 'search_read',
          [[]],
          { 
            fields: ['lead_id', 'source', 'email', 'linkedin_url', 'create_date'],
            order: 'create_date desc'
          }
        );
        
        // Extract lead IDs
        const leadIds = importedLeads.map(imp => imp.lead_id?.[0]).filter(id => id);
        
        if (leadIds.length === 0) {
          setLeads([]);
          setLoading(false);
          return;
        }
        
        // ── 2. Fetch lead details from crm.lead ─────────────────────────────
        const leadsData = await callModel('crm.lead', 'search_read',
          [[['id', 'in', leadIds]]],
          { 
            fields: [
              'id', 'name', 'contact_name', 'street', 'city', 'expected_revenue',
              'probability', 'user_id', 'active', 'create_date', 'description', 'priority'
            ]
          }
        );
        
        // ── 3. Fetch active auctions for these leads ────────────────────────
        const auctions = await callModel('galacs.enchere', 'search_read',
          [[['lead_id', 'in', leadIds], ['state', '=', 'open']]],
          { 
            fields: [
              'id', 'lead_id', 'state', 'date_end', 'current_bid_percent',
              'bid_count', 'score_maturity', 'ia_category', 'min_bid_percent'
            ]
          }
        );
        
        // Create a map of lead_id -> auction
        const auctionMap = {};
        auctions.forEach(auction => {
          const leadId = auction.lead_id?.[0];
          if (leadId) auctionMap[leadId] = auction;
        });
        
        // ── 4. Fetch won auctions (sales) for these leads ────────────────────
       const sales = await callModel('galacs.vente', 'search_read',
       [[['lead_id', 'in', leadIds], ['state', '=', 'validated']]],
        { fields: ['lead_id', 'prix_vente', 'date_signature'] }
        );
        
        const wonLeadIds = new Set(sales.map(sale => sale.lead_id?.[0]).filter(id => id));
        
        // ── 5. Build complete leads list with auction info ───────────────────
        const completeLeads = leadsData.map(lead => {
          const auction = auctionMap[lead.id];
          const isWon = wonLeadIds.has(lead.id);
          
          // Determine category based on probability/score
          let category = 'cold';
          const probability = lead.probability || 0;
          if (isWon) category = 'won';
          else if (auction?.score_maturity >= 70 || probability >= 70) category = 'hot';
          else if (auction?.score_maturity >= 40 || probability >= 40) category = 'warm';
          else category = 'cold';
          
          // Calculate time left if auction exists
          let timeLeft = null;
          if (auction?.date_end) {
            const end = new Date(auction.date_end);
            const now = new Date();
            const diff = Math.max(0, Math.floor((end - now) / 1000));
            timeLeft = diff;
          }
          
          return {
            id: lead.id,
            name: lead.contact_name || lead.name || 'Lead',
            reference: `GL-${String(lead.id).slice(-4)}`,
            city: lead.city || 'Ville',
            propertyType: 'Bien immobilier',
            budget: lead.expected_revenue || 0,
            horizon: lead.description?.substring(0, 50) || '',
            category: category,
            probability: probability,
            scoreMaturity: auction?.score_maturity || probability,
            currentBidPercent: auction?.current_bid_percent || null,
            bidCount: auction?.bid_count || 0,
            hasLiveAuction: !!auction,
            auctionId: auction?.id,
            timeLeft: timeLeft,
            isNew: (new Date() - new Date(lead.create_date)) < (7 * 24 * 60 * 60 * 1000),
            assignedToMe: lead.user_id?.[0] === currentUserId,
            source: importedLeads.find(imp => imp.lead_id?.[0] === lead.id)?.source || 'Import'
          };
        });
        
        // Sort leads: live auctions first, then by probability desc
        completeLeads.sort((a, b) => {
          if (a.hasLiveAuction && !b.hasLiveAuction) return -1;
          if (!a.hasLiveAuction && b.hasLiveAuction) return 1;
          return (b.scoreMaturity || 0) - (a.scoreMaturity || 0);
        });
        
        setLeads(completeLeads);
        
        // ── 6. Set up countdown timers ──────────────────────────────────────
        const initialTimeMap = {};
        completeLeads.forEach(lead => {
          if (lead.hasLiveAuction && lead.timeLeft > 0) {
            initialTimeMap[lead.id] = lead.timeLeft;
          }
        });
        setTimeLeftMap(initialTimeMap);
        
      } catch (err) {
        console.error('Error loading leads:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.uid) {
      loadLeads();
    }
  }, [user]);
  
  // ── Countdown timer effect ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftMap(prev => {
        const newMap = { ...prev };
        let hasChanges = false;
        
        Object.keys(newMap).forEach(leadId => {
          if (newMap[leadId] > 0) {
            newMap[leadId] = newMap[leadId] - 1;
            hasChanges = true;
          }
        });
        
        return hasChanges ? newMap : prev;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // ── Filter logic ─────────────────────────────────────────────────────────
  const getFilteredLeads = () => {
    switch (activeFilter) {
      case 'hot':
        return leads.filter(lead => lead.category === 'hot');
      case 'warm':
        return leads.filter(lead => lead.category === 'warm');
      case 'cold':
        return leads.filter(lead => lead.category === 'cold');
      case 'won':
        return leads.filter(lead => lead.category === 'won');
      case 'auction':
        return leads.filter(lead => lead.hasLiveAuction);
      default:
        return leads;
    }
  };
  
  const filteredLeads = getFilteredLeads();
  
  const counts = {
    all: leads.length,
    hot: leads.filter(l => l.category === 'hot').length,
    warm: leads.filter(l => l.category === 'warm').length,
    cold: leads.filter(l => l.category === 'cold').length,
    won: leads.filter(l => l.category === 'won').length,
    auction: leads.filter(l => l.hasLiveAuction).length,
  };
  
  // ── Helper functions ─────────────────────────────────────────────────────
  const formatCurrency = (amount) => {
    if (!amount) return '—';
    if (amount >= 1000) return Math.round(amount / 1000) + 'k€';
    return amount.toLocaleString() + '€';
  };
  
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };
  
  const getCategoryBadge = (category, hasLiveAuction) => {
    if (hasLiveAuction) {
      return { class: 'bdg-live', text: '⚡ Live', icon: '⚡' };
    }
    switch (category) {
      case 'hot': return { class: 'bdg-hot', text: '🔥 Chaud', icon: '🔥' };
      case 'warm': return { class: 'bdg-warm', text: '🌡 Tiède', icon: '🌡' };
      case 'cold': return { class: 'bdg-cold', text: '❄ Froid', icon: '❄' };
      case 'won': return { class: 'bdg-ok', text: '✓ Gagné', icon: '✓' };
      default: return { class: 'bdg', text: '📋 Lead', icon: '📋' };
    }
  };
  
  const getScoreColor = (score) => {
    if (score >= 70) return 'var(--green)';
    if (score >= 40) return 'var(--orange)';
    return 'var(--red)';
  };
  
  // ── Navigation handlers - UPDATED to match your route structure ─────────
  const handleRowClick = (lead) => {
    navigate('/leads/fichier_leads', { state: { leadId: lead.id } });
  };
  
  const handleBidClick = (e, lead) => {
    e.stopPropagation();
    // Navigate to the live auction page using your existing route
    navigate('/leads/enchère_live', { 
      state: { 
        leadId: lead.id,
        auctionId: lead.auctionId,
        hasLiveAuction: lead.hasLiveAuction
      } 
    });
  };
  
  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page active">
        <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '100px' }}>
          <div>Chargement des leads...</div>
        </div>
      </div>
    );
  }
  
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="page-inner fade-in">
        
        {/* Header */}
        <div className="leadsS1">
          <div>
            <h1>Leads & Enchères</h1>
            <p className="page-subtitle">
              {leads.length} leads · {counts.auction} enchères en cours
            </p>
          </div>
          <div className="leadsS2">
            <span className="bdg bdg-live">⚡ {counts.auction} enchères live</span>
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="filter-bar">
          <div
            className={`ftag ${activeFilter === 'all' ? 'on' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tous ({counts.all})
          </div>
          <div
            className={`ftag ${activeFilter === 'hot' ? 'on' : ''}`}
            onClick={() => setActiveFilter('hot')}
          >
            🔥 Chauds ({counts.hot})
          </div>
          <div
            className={`ftag ${activeFilter === 'warm' ? 'on' : ''}`}
            onClick={() => setActiveFilter('warm')}
          >
            🌡 Tièdes ({counts.warm})
          </div>
          <div
            className={`ftag ${activeFilter === 'cold' ? 'on' : ''}`}
            onClick={() => setActiveFilter('cold')}
          >
            ❄ Froids ({counts.cold})
          </div>
          <div
            className={`ftag ${activeFilter === 'won' ? 'on' : ''}`}
            onClick={() => setActiveFilter('won')}
          >
            ✓ Gagnés ({counts.won})
          </div>
          <div
            className={`ftag ${activeFilter === 'auction' ? 'on' : ''}`}
            onClick={() => setActiveFilter('auction')}
          >
            ⚡ En enchère ({counts.auction})
          </div>
        </div>
        
        {/* Leads List */}
        <div className="leadsS3">
          {filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
              Aucun lead dans cette catégorie
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const categoryBadge = getCategoryBadge(lead.category, lead.hasLiveAuction);
              const timeDisplay = lead.hasLiveAuction && timeLeftMap[lead.id] 
                ? formatTime(timeLeftMap[lead.id]) 
                : null;
              const showBidInfo = lead.hasLiveAuction && lead.currentBidPercent !== null;
              
              return (
                <div
                  key={lead.id}
                  className={`lead-row ${lead.category}`}
                  onClick={() => handleRowClick(lead)}
                >
                  {/* Avatar */}
                  <div className="lav">{getInitials(lead.name)}</div>
                  
                  {/* Lead Info */}
                  <div className="linfo">
                    <div className="lname">{lead.name}</div>
                    <div className="lmeta">
                      {lead.reference} · {lead.city} · {lead.propertyType} · 
                      Budget {formatCurrency(lead.budget)}
                      {lead.horizon && ` · ${lead.horizon}`}
                    </div>
                  </div>
                  
                  {/* Category Badge */}
                  <div className="leadsS4">
                    <span className={categoryBadge.class} style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                      {categoryBadge.icon} {categoryBadge.text}
                    </span>
                  </div>
                  
                  {/* Score */}
                  <div className="syn" style={{ 
                    fontSize: '20px', 
                    fontWeight: '800', 
                    color: getScoreColor(lead.scoreMaturity || lead.probability),
                    width: '56px', 
                    textAlign: 'right' 
                  }}>
                    {lead.scoreMaturity || lead.probability || 0}%
                  </div>
                  
                  {/* Current Bid / Status */}
                  <div style={{ width: '100px' }}>
                    {showBidInfo ? (
                      <>
                        <div className="leadsS5">Offre max</div>
                        <div className="syn" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--orange)' }}>
                          {lead.currentBidPercent}%
                        </div>
                      </>
                    ) : lead.category === 'won' ? (
                      <>
                        <div className="leadsS5">Vente</div>
                        <div className="syn" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)' }}>
                          ✓ Confirmée
                        </div>
                      </>
                    ) : lead.isNew ? (
                      <>
                        <div className="leadsS5">Statut</div>
                        <div className="leadsS8">🔔 Nouveau</div>
                      </>
                    ) : (
                      <>
                        <div className="leadsS5">Statut</div>
                        <div className="leadsS10">{categoryBadge.text}</div>
                      </>
                    )}
                  </div>
                  
                  {/* Timer */}
                  <div className={lead.hasLiveAuction ? 'leadsS6' : 'leadsS9'}>
                    {timeDisplay && `⏱ ${timeDisplay}`}
                  </div>
                  
                  {/* Action Button */}
                  <button 
                    className={`btn ${lead.hasLiveAuction ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={(e) => handleBidClick(e, lead)}
                    disabled={lead.category === 'cold' && !lead.hasLiveAuction}
                  >
                    {lead.hasLiveAuction ? '⚡ Enchérir' : (lead.category === 'won' ? '✓ Voir' : 'Enchérir')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadsComponent;