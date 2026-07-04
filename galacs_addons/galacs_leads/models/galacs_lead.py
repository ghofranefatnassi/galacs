# -*- coding: utf-8 -*-
# Galacs.io – galacs_leads/models/galacs_lead.py
# Extension de crm.lead avec score Gemma 4 et statuts personnalisés

from odoo import models, fields, api
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)


class GalacsLead(models.Model):
    """
    Extension du modèle crm.lead pour Galacs.io.
    Ajoute le score IA Gemma 4, les statuts de suivi 72h et
    les métadonnées de la pipeline de scoring locale.
    """
    _inherit = 'crm.lead'

    # ------------------------------------------------------------------ #
    #  Champs IA – Gemma 4 auto-hébergé                                   #
    # ------------------------------------------------------------------ #
    score_maturity = fields.Float(
        string='Score de maturité (%)',
        default=0.0,
        digits=(5, 2),
        help='Score calculé par Gemma 4 local via pipeline n8n (0–100).',
    )
    ia_category = fields.Selection(
        selection=[
            ('hot', 'CHAUD – Prêt à acheter'),
            ('warm', 'TIÈDE – Potentiel à développer'),
            ('cold', 'FROID – Intérêt faible'),
        ],
        string='Catégorie IA',
        compute='_compute_ia_category',
        store=True,
        help='Catégorie calculée automatiquement depuis le score de maturité.',
    )
    ia_justification = fields.Text(
        string='Justification Gemma 4',
        help='Explication textuelle fournie par Gemma 4 lors du scoring.',
    )
    ia_scored_at = fields.Datetime(
        string='Dernière mise à jour IA',
        help='Horodatage du dernier appel de scoring Gemma 4.',
    )
    ia_fallback = fields.Boolean(
        string='Fallback IA actif',
        default=False,
        help='True si Gemma 4 était indisponible lors du scoring (score = 50%).',
    )
    ia_version = fields.Char(
        string='Version Gemma 4',
        help='Version du modèle Gemma 4 utilisé lors du scoring.',
    )

    # ------------------------------------------------------------------ #
    #  Champs Métier Galacs.io                                            #
    # ------------------------------------------------------------------ #
    zone_chalandise = fields.Char(
        string='Zone de chalandise',
        help='Zone géographique du lead pour le dispatch aux agents.',
    )
    type_bien = fields.Selection(
        selection=[
            ('appartement', 'Appartement'),
            ('maison', 'Maison'),
            ('terrain', 'Terrain'),
            ('commercial', 'Local commercial'),
            ('autre', 'Autre'),
        ],
        string="Type de bien",
    )
    budget_estime = fields.Float(
        string='Budget estimé (€)',
        help='Budget estimé du prospect, utilisé par Gemma 4 pour le scoring.',
    )
    comportement_site = fields.Text(
        string='Comportement site web',
        help='Données comportementales du prospect sur le site (pages vues, temps, etc.).',
    )
    source_lead = fields.Selection(
        selection=[
            ('waalaxy', 'Waalaxy LinkedIn'),
            ('manuel', 'Création manuelle'),
            ('site', 'Formulaire site web'),
            ('autre', 'Autre'),
        ],
        string='Source du lead',
        default='manuel',
    )
    linkedin_url = fields.Char(
        string='Profil LinkedIn',
        help='URL du profil LinkedIn (renseigné par Waalaxy).',
        
    )
    lead_type = fields.Selection(
    selection=[
        ('buyer', 'Acheteur'),
        ('seller', 'Vendeur'),
    ],
    string='Type de lead',
    required=True,
    default='buyer',
    help='Buyer : prospect cherchant à acquérir un bien. '
         'Seller : propriétaire avec intention de vendre.',
    )
    # ------------------------------------------------------------------ #
    #  Suivi obligatoire 72h – Anti-triche                               #
    # ------------------------------------------------------------------ #
    galacs_stage = fields.Selection(
        selection=[
            ('nouveau', 'Nouveau'),
            ('contacted', 'Contact établi'),
            ('meeting', 'Rendez-vous planifié'),
            ('devis', 'Devis envoyé'),
            ('won', 'Vente signée'),
            ('lost', 'Perdu'),
        ],
        string='Étape Galacs',
        default='nouveau',
        tracking=True,
        help='Étape de suivi Galacs.io. Validation séquentielle obligatoire (anti-triche).',
    )
    date_contacted = fields.Datetime(string='Date contact établi', readonly=True)
    date_meeting = fields.Datetime(string='Date rendez-vous planifié', readonly=True)
    date_devis = fields.Datetime(string='Date devis envoyé', readonly=True)
    date_won_galacs = fields.Datetime(string='Date vente signée', readonly=True)

    # ------------------------------------------------------------------ #
    #  Compute                                                             #
    # ------------------------------------------------------------------ #
    @api.depends('score_maturity')
    def _compute_ia_category(self):
        """Calcule la catégorie IA depuis le score de maturité."""
        for lead in self:
            score = lead.score_maturity
            if score > 70:
                lead.ia_category = 'hot'
            elif score >= 40:
                lead.ia_category = 'warm'
            else:
                lead.ia_category = 'cold'

    # ------------------------------------------------------------------ #
    #  Contraintes Anti-triche – Validation séquentielle                  #
    # ------------------------------------------------------------------ #
    @api.constrains('galacs_stage')
    def _check_stage_sequence(self):
        """
        Empêche de sauter une étape de suivi.
        Exemple : impossible de passer à 'won' sans avoir été en 'devis'.
        """
        SEQUENCE = {
            'nouveau': 0,
            'contacted': 1,
            'meeting': 2,
            'devis': 3,
            'won': 4,
            'lost': 5,
        }
        for lead in self:
            new_rank = SEQUENCE.get(lead.galacs_stage, 0)
            # Récupère l'ancien stage depuis le journal de tracking
            old_stage = lead._origin.galacs_stage or 'nouveau'
            old_rank = SEQUENCE.get(old_stage, 0)
            # On interdit un saut de plus d'un niveau (sauf 'lost' depuis n'importe où)
            if lead.galacs_stage != 'lost' and new_rank > old_rank + 1:
                raise ValidationError(
                    "Validation séquentielle obligatoire : vous ne pouvez pas passer "
                    f"de '{old_stage}' à '{lead.galacs_stage}' sans valider les étapes "
                    "intermédiaires (anti-triche Galacs.io)."
                )

    # ------------------------------------------------------------------ #
    #  Write – Horodatage automatique des transitions de stage            #
    # ------------------------------------------------------------------ #
    def write(self, vals):
        """Horodate automatiquement chaque transition de galacs_stage."""
        stage = vals.get('galacs_stage')
        if stage:
            now = fields.Datetime.now()
            if stage == 'contacted':
                vals['date_contacted'] = now
            elif stage == 'meeting':
                vals['date_meeting'] = now
            elif stage == 'devis':
                vals['date_devis'] = now
            elif stage == 'won':
                vals['date_won_galacs'] = now
        return super().write(vals)

    # ------------------------------------------------------------------ #
    #  Méthode publique : mise à jour du score IA (appelée par n8n)       #
    # ------------------------------------------------------------------ #
    def action_update_ia_score(self, score, category, justification, version=None, fallback=False):
        """
        Met à jour le score IA Gemma 4 sur le lead.
        Appelée par le module galacs_ia_pipeline après réception du webhook n8n.

        :param score: float – score de maturité (0–100)
        :param category: str – 'hot' | 'warm' | 'cold'
        :param justification: str – explication Gemma 4
        :param version: str – version du modèle
        :param fallback: bool – True si score de fallback
        """
        self.ensure_one()
        self.write({
            'score_maturity': max(0.0, min(100.0, float(score))),
            'ia_justification': justification or '',
            'ia_scored_at': fields.Datetime.now(),
            'ia_fallback': fallback,
            'ia_version': version or '',
        })
        _logger.info(
              "Galacs IA | Lead %s | Type %s | Score %.1f%% | Catégorie %s | Fallback %s",
               self.id, self.lead_type, score, category, fallback,
        )
        # Déclenchement de la mise aux enchères si le lead est nouveau
        if self.galacs_stage == 'nouveau':
            self.env['galacs.enchere'].sudo()._trigger_auction(self)

    # ------------------------------------------------------------------ #
    #  Action – Déclencher le rescoring manuel                            #
    # ------------------------------------------------------------------ #
    def action_request_rescore(self):
        """Demande un rescoring Gemma 4 via n8n (déclenche le webhook)."""
        self.ensure_one()
        pipeline = self.env['galacs.ia.pipeline'].sudo()
        pipeline._send_to_n8n(self)
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Rescoring demandé',
                'message': f'Le lead {self.name} a été envoyé au pipeline Gemma 4.',
                'type': 'info',
            },
        }


class GalacsIaLog(models.Model):
    """
    Journal d'audit des appels Gemma 4.
    Chaque appel de scoring est loggé ici (galacs.ia_log).
    """
    _name = 'galacs.ia.log'
    _description = 'Log des appels Gemma 4'
    _order = 'create_date desc'
    _rec_name = 'lead_id'

    lead_id = fields.Many2one(
        'crm.lead', string='Lead', required=True, ondelete='cascade',
    )
    score = fields.Float(string='Score (%)', digits=(5, 2))
    category = fields.Char(string='Catégorie')
    justification = fields.Text(string='Justification')
    model_version = fields.Char(string='Version modèle')
    fallback = fields.Boolean(string='Fallback')
    duration_ms = fields.Integer(string='Durée (ms)', help='Temps de réponse Gemma 4 en ms.')
    raw_response = fields.Text(string='Réponse brute JSON')
    create_date = fields.Datetime(string='Horodatage', readonly=True)
