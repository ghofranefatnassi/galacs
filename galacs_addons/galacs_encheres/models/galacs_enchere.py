# -*- coding: utf-8 -*-
# Galacs.io – galacs_encheres/models/galacs_enchere.py
# Gestion des enchères : démarrage, surenchères, clôture automatique, historique

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
import logging

_logger = logging.getLogger(__name__)

# Durée fixe d'une enchère en minutes (configurable via ir.config_parameter)
DEFAULT_AUCTION_DURATION_MINUTES = 60
# Commission minimale de départ (3%)
DEFAULT_MIN_BID_PERCENT = 3.0


class GalacsEnchere(models.Model):
    """
    Représente une enchère sur un lead Galacs.io.
    Une enchère est créée automatiquement après scoring Gemma 4.
    """
    _name = 'galacs.enchere'
    _description = 'Enchère Galacs.io'
    _order = 'date_start desc'
    _rec_name = 'lead_id'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    # ------------------------------------------------------------------ #
    #  Champs                                                              #
    # ------------------------------------------------------------------ #
    lead_id = fields.Many2one(
        'crm.lead', string='Lead', required=True,
        ondelete='cascade', tracking=True,
    )
    state = fields.Selection(
        selection=[
            ('pending', 'En attente'),
            ('open', 'En cours'),
            ('closed', 'Clôturée'),
            ('cancelled', 'Annulée'),
        ],
        string='État',
        default='pending',
        tracking=True,
    )
    date_start = fields.Datetime(string='Début enchère', tracking=True)
    date_end = fields.Datetime(string='Fin enchère', tracking=True)
    duration_minutes = fields.Integer(
        string='Durée (minutes)',
        default=DEFAULT_AUCTION_DURATION_MINUTES,
        help='Durée de l\'enchère en minutes. Par défaut 60 min.',
    )
    min_bid_percent = fields.Float(
        string='Commission minimale (%)',
        default=DEFAULT_MIN_BID_PERCENT,
        help='Enchère minimale de départ (3% selon CDC V7).',
    )
    current_bid_percent = fields.Float(
        string='Enchère actuelle (%)',
        compute='_compute_current_bid',
        store=True,
        help='Plus haute commission mise en jeu actuellement.',
    )
    winner_id = fields.Many2one(
        'res.users', string='Agent gagnant',
        readonly=True, tracking=True,
    )
    bid_count = fields.Integer(
        string='Nombre de mises',
        compute='_compute_bid_count',
    )
    bid_ids = fields.One2many(
        'galacs.enchere.bid', 'enchere_id', string='Historique des mises',
    )
    zone_chalandise = fields.Char(
        related='lead_id.zone_chalandise', store=True, string='Zone',
    )
    ia_category = fields.Selection(
        related='lead_id.ia_category', store=True, string='Catégorie IA',
    )
    score_maturity = fields.Float(
        related='lead_id.score_maturity', store=True, string='Score IA (%)',
    )

    # ------------------------------------------------------------------ #
    #  Compute                                                             #
    # ------------------------------------------------------------------ #
    @api.depends('bid_ids.bid_percent', 'bid_ids.state')
    def _compute_current_bid(self):
        for enc in self:
            active_bids = enc.bid_ids.filtered(lambda b: b.state == 'active')
            enc.current_bid_percent = max(active_bids.mapped('bid_percent'), default=0.0)

    @api.depends('bid_ids')
    def _compute_bid_count(self):
        for enc in self:
            enc.bid_count = len(enc.bid_ids)

    # ------------------------------------------------------------------ #
    #  Méthodes publiques                                                  #
    # ------------------------------------------------------------------ #
    def _trigger_auction(self, lead):
        """
        Crée et démarre automatiquement une enchère pour un lead scoré.
        Appelé par galacs_leads.action_update_ia_score après scoring Gemma 4.
        """
        # Vérifie qu'il n'existe pas déjà une enchère active pour ce lead
        existing = self.search([
            ('lead_id', '=', lead.id),
            ('state', 'in', ['pending', 'open']),
        ], limit=1)
        if existing:
            _logger.warning("Galacs Enchères | Enchère déjà active pour le lead %s", lead.id)
            return existing

        # Lecture de la durée depuis les paramètres système (update-friendly)
        duration = int(self.env['ir.config_parameter'].sudo().get_param(
            'galacs.auction_duration_minutes', DEFAULT_AUCTION_DURATION_MINUTES
        ))
        min_bid = float(self.env['ir.config_parameter'].sudo().get_param(
            'galacs.min_bid_percent', DEFAULT_MIN_BID_PERCENT
        ))

        now = fields.Datetime.now()
        enc = self.create({
            'lead_id': lead.id,
            'state': 'open',
            'date_start': now,
            'date_end': fields.Datetime.add(now, minutes=duration),
            'duration_minutes': duration,
            'min_bid_percent': min_bid,
        })
        _logger.info("Galacs Enchères | Nouvelle enchère #%s créée pour lead %s", enc.id, lead.id)

        # Déclenchement des notifications agents de la zone
        self.env['galacs.notification'].sudo()._notify_new_auction(enc)
        return enc

    def action_place_bid(self, agent_id, bid_percent):
        """
        Enregistre une nouvelle mise d'un agent.
        Appelé via l'API REST POST /api/encheres/placer.

        :param agent_id: int – ID res.users de l'agent
        :param bid_percent: float – commission proposée
        :raises ValidationError: si l'enchère est clôturée ou la mise trop basse
        """
        self.ensure_one()
        if self.state != 'open':
            raise UserError("Cette enchère n'est plus ouverte.")
        if fields.Datetime.now() > self.date_end:
            self._close_auction()
            raise UserError("L'enchère est expirée.")

        min_required = max(self.current_bid_percent + 0.1, self.min_bid_percent)
        if bid_percent < min_required:
            raise ValidationError(
                f"La mise doit être supérieure à {min_required:.2f}%. "
                f"Mise actuelle : {self.current_bid_percent:.2f}%."
            )

        agent = self.env['res.users'].browse(agent_id)
        bid = self.env['galacs.enchere.bid'].create({
            'enchere_id': self.id,
            'agent_id': agent_id,
            'bid_percent': bid_percent,
            'state': 'active',
        })
        # Désactive les mises précédentes de cet agent sur cette enchère
        old_bids = self.bid_ids.filtered(
            lambda b: b.agent_id.id == agent_id and b.id != bid.id
        )
        old_bids.write({'state': 'outbid'})

        _logger.info(
            "Galacs Enchères | Agent %s a misé %.2f%% sur enchère #%s",
            agent.name, bid_percent, self.id,
        )
        # Notification surenchère aux autres agents
        self.env['galacs.notification'].sudo()._notify_new_bid(self, bid)
        return bid

    def _close_auction(self):
        """Clôture l'enchère et attribue le lead au gagnant."""
        self.ensure_one()
        if self.state == 'closed':
            return
        winning_bid = self.bid_ids.filtered(
            lambda b: b.state == 'active'
        ).sorted('bid_percent', reverse=True)[:1]

        vals = {'state': 'closed'}
        if winning_bid:
            vals['winner_id'] = winning_bid.agent_id.id
            # Attribution du lead à l'agent gagnant
            self.lead_id.write({'user_id': winning_bid.agent_id.id})
            self.env['galacs.notification'].sudo()._notify_auction_won(self, winning_bid)
        else:
            # Pas de mise → remise aux enchères (notification admin)
            self.env['galacs.notification'].sudo()._notify_no_bids(self)

        self.write(vals)
        _logger.info("Galacs Enchères | Enchère #%s clôturée. Gagnant : %s", self.id, vals.get('winner_id'))

    def action_cancel(self):
        """Annulation manuelle par l'administrateur."""
        self.ensure_one()
        if self.state == 'closed':
            raise UserError("Impossible d'annuler une enchère déjà clôturée.")
        self.write({'state': 'cancelled'})


class GalacsEnchereBid(models.Model):
    """
    Représente une mise individuelle dans une enchère Galacs.io.
    L'historique complet est conservé (état : active / outbid / won).
    """
    _name = 'galacs.enchere.bid'
    _description = 'Mise Galacs.io'
    _order = 'create_date desc'

    enchere_id = fields.Many2one(
        'galacs.enchere', string='Enchère', required=True, ondelete='cascade',
    )
    agent_id = fields.Many2one(
        'res.users', string='Agent', required=True,
    )
    bid_percent = fields.Float(
        string='Commission proposée (%)', required=True, digits=(5, 2),
    )
    state = fields.Selection(
        selection=[
            ('active', 'Active (meilleure mise)'),
            ('outbid', 'Surenchérie'),
            ('won', 'Gagnante'),
        ],
        string='État',
        default='active',
    )
    create_date = fields.Datetime(string='Horodatage', readonly=True)
