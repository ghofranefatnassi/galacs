# -*- coding: utf-8 -*-
# Galacs.io – galacs_commissions/models/galacs_commission.py
# Calcul automatique des commissions agent / Galacs.io après validation vente

from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

# Répartition par défaut (configurable via ir.config_parameter)
DEFAULT_AGENT_SHARE = 70.0   # 70% à l'agent
DEFAULT_GALACS_SHARE = 30.0  # 30% à Galacs.io


class GalacsCommission(models.Model):
    """
    Enregistrement de commission calculé automatiquement après validation d'une vente.
    La répartition agent/Galacs.io est configurable dans les paramètres système.
    """
    _name = 'galacs.commission'
    _description = 'Commission Galacs.io'
    _order = 'create_date desc'
    _inherit = ['mail.thread']

    vente_id = fields.Many2one(
        'galacs.vente', string='Vente', required=True, ondelete='restrict',
    )
    lead_id = fields.Many2one(
        'crm.lead', string='Lead', related='vente_id.lead_id', store=True,
    )
    agent_id = fields.Many2one(
        'res.users', string='Agent', related='vente_id.agent_id', store=True,
    )
    # Montants
    prix_vente = fields.Float(
        string='Prix de vente (€)', related='vente_id.prix_vente', store=True,
    )
    bid_percent = fields.Float(
        string='Commission enchère (%)',
        help='Pourcentage remporté par l\'agent lors de l\'enchère.',
    )
    montant_total = fields.Float(
        string='Commission totale (€)',
        compute='_compute_montants', store=True,
    )
    agent_share_percent = fields.Float(
        string='Part agent (%)',
        default=DEFAULT_AGENT_SHARE,
    )
    galacs_share_percent = fields.Float(
        string='Part Galacs.io (%)',
        default=DEFAULT_GALACS_SHARE,
    )
    montant_agent = fields.Float(
        string='Montant agent (€)',
        compute='_compute_montants', store=True,
    )
    montant_galacs = fields.Float(
        string='Montant Galacs.io (€)',
        compute='_compute_montants', store=True,
    )
    state = fields.Selection(
        selection=[
            ('calculee', 'Calculée'),
            ('versee', 'Versée'),
        ],
        string='État',
        default='calculee',
        tracking=True,
    )

    # ------------------------------------------------------------------ #
    #  Compute                                                             #
    # ------------------------------------------------------------------ #
    @api.depends('prix_vente', 'bid_percent', 'agent_share_percent', 'galacs_share_percent')
    def _compute_montants(self):
        for com in self:
            com.montant_total = com.prix_vente * com.bid_percent / 100.0
            com.montant_agent = com.montant_total * com.agent_share_percent / 100.0
            com.montant_galacs = com.montant_total * com.galacs_share_percent / 100.0

    # ------------------------------------------------------------------ #
    #  Méthode publique – appelée par galacs_ventes                       #
    # ------------------------------------------------------------------ #
    def _compute_commission_for_sale(self, vente):
        """
        Calcule et enregistre la commission après validation d'une vente.
        Appelée par GalacsVente._validate_sale().
        """
        # Récupère le pourcentage de l'enchère gagnante
        enchere = self.env['galacs.enchere'].search([
            ('lead_id', '=', vente.lead_id.id),
            ('state', '=', 'closed'),
        ], limit=1, order='date_end desc')

        bid_percent = enchere.current_bid_percent if enchere else 0.0

        # Répartition depuis les paramètres système (update-friendly)
        agent_share = float(self.env['ir.config_parameter'].sudo().get_param(
            'galacs.commission_agent_share', DEFAULT_AGENT_SHARE
        ))
        galacs_share = float(self.env['ir.config_parameter'].sudo().get_param(
            'galacs.commission_galacs_share', DEFAULT_GALACS_SHARE
        ))

        commission = self.create({
            'vente_id': vente.id,
            'bid_percent': bid_percent,
            'agent_share_percent': agent_share,
            'galacs_share_percent': galacs_share,
        })
        _logger.info(
            "Galacs Commissions | Commission #%s créée | Agent %s | %.2f€",
            commission.id, vente.agent_id.name, commission.montant_agent,
        )
        return commission

    def action_marquer_versee(self):
        """Marque la commission comme versée."""
        self.write({'state': 'versee'})
