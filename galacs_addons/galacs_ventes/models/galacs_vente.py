# -*- coding: utf-8 -*-
# Galacs.io – galacs_ventes/models/galacs_vente.py
# Vérification des ventes : Mode A (API simulée MVP) + Mode B (validation admin)

from odoo import models, fields, api
from odoo.exceptions import UserError, ValidationError
import logging
import requests

_logger = logging.getLogger(__name__)


class GalacsVente(models.Model):
    """
    Déclaration de vente par un agent Galacs.io.
    Deux modes :
      - Mode A : vérification via API notariale simulée (MVP)
      - Mode B : validation manuelle par l'administrateur (opérationnel)
    """
    _name = 'galacs.vente'
    _description = 'Déclaration de vente Galacs.io'
    _order = 'create_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']


    #  Champs#

    lead_id = fields.Many2one(
        'crm.lead', string='Lead', required=True, ondelete='restrict', tracking=True,
    )
    agent_id = fields.Many2one(
        'res.users', string='Agent', default=lambda self: self.env.user,
        required=True, tracking=True,
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Soumise'),
            ('pending_admin', 'En attente validation admin'),
            ('validated', 'Validée'),
            ('rejected', 'Rejetée'),
        ],
        string='État',
        default='draft',
        tracking=True,
    )
    # Informations vente
    reference_bien = fields.Char(string='Référence du bien', required=True)
    date_signature = fields.Date(string='Date de signature', required=True)
    acheteur_nom = fields.Char(string='Nom acheteur')
    vendeur_nom = fields.Char(string='Nom vendeur')
    prix_vente = fields.Float(string='Prix de vente (€)')
    # Pièces justificatives
    attachment_ids = fields.One2many(
        'ir.attachment', 'res_id', string='Pièces justificatives',
        domain=lambda self: [('res_model', '=', self._name)],
        help='Compromis ou acte signé à joindre.',
    )
    # Mode de vérification
    verification_mode = fields.Selection(
        selection=[
            ('api', 'Mode A – API notariale simulée'),
            ('manual', 'Mode B – Validation manuelle admin'),
        ],
        string='Mode de vérification',
        default='manual',
    )
    admin_comment = fields.Text(string='Commentaire administrateur')
    api_response = fields.Text(string='Réponse API notariale (brute)', readonly=True)


    #  Contrainte : validation séquentielle Galacs                        #

    @api.constrains('lead_id')
    def _check_lead_stage(self):
        """L'agent ne peut déclarer une vente que si le lead est en 'devis'."""
        for vente in self:
            if vente.lead_id.galacs_stage not in ('devis', 'won'):
                raise ValidationError(
                    "Impossible de déclarer une vente : le lead doit être au stade "
                    "'Devis envoyé' avant de déclarer la vente (anti-triche Galacs.io)."
                )


    #  Action : soumettre la déclaration                                   #

    def action_submit(self):
        """
        Soumet la déclaration de vente.
        Choisit automatiquement le mode de vérification selon la config.
        """
        self.ensure_one()
        mode = self.env['ir.config_parameter'].sudo().get_param(
            'galacs.vente_verification_mode', 'manual'
        )
        self.verification_mode = mode
        if mode == 'api':
            self._verify_via_api()
        else:
            self.write({'state': 'pending_admin'})
            # Notifier les admins
            self.env['galacs.notification'].sudo()._notify_sale_pending(self)

    def _verify_via_api(self):
        """
        Mode A – Appel vers l'API notariale simulée (MVP).
        En production, remplacer l'URL par l'API réelle du partenaire notaire.
        """
        api_url = self.env['ir.config_parameter'].sudo().get_param(
            'galacs.notaire_api_url',
            'http://localhost:8069/api/ventes/verifier',  # endpoint local MVP
        )
        payload = {
            'reference_bien': self.reference_bien,
            'date_signature': str(self.date_signature),
            'acheteur': self.acheteur_nom,
            'vendeur': self.vendeur_nom,
        }
        try:
            resp = requests.post(api_url, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            self.api_response = str(data)
            if data.get('verified'):
                self._validate_sale()
            else:
                self.write({'state': 'rejected', 'admin_comment': data.get('reason', 'API: non vérifié')})
        except Exception as e:
            _logger.exception("Galacs Ventes | Erreur API notariale")
            self.write({'state': 'pending_admin'})  # Fallback mode B

    def _validate_sale(self):
        """Valide la vente et met à jour le lead Galacs."""
        self.write({'state': 'validated'})
        self.lead_id.write({'galacs_stage': 'won'})
        # Déclenchement calcul commission
        self.env['galacs.commission'].sudo()._compute_commission_for_sale(self)
        self.env['galacs.notification'].sudo()._notify_sale_result(self, validated=True)
        _logger.info("Galacs Ventes | Vente #%s validée pour lead %s", self.id, self.lead_id.id)


    #  Actions admin #

    def action_validate(self):
        """Validation manuelle par l'administrateur."""
        self.ensure_one()
        if self.state != 'pending_admin':
            raise UserError("Seules les ventes en attente peuvent être validées.")
        self._validate_sale()

    def action_reject(self):
        """Rejet par l'administrateur."""
        self.ensure_one()
        self.write({'state': 'rejected'})
        self.env['galacs.notification'].sudo()._notify_sale_result(self, validated=False)


class GalacsVentesApiController(models.AbstractModel):
    """
    Faux modèle pour exposer l'endpoint MVP de vérification notariale locale.
    (Remplacé en production par un vrai partenaire notaire.)
    """
    _name = 'galacs.ventes.api.mock'
    _description = 'Mock API notariale Galacs MVP'

