# -*- coding: utf-8 -*-
# Galacs.io – galacs_contacts_prives/models/galacs_contact_prive.py
# CRM privé agent : isolation stricte via Record Rules Odoo
# Les données sensibles sont chiffrées côté client (Web Crypto API AES-GCM)
# Le backend ne stocke que les données chiffrées → souveraineté totale

from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError
import logging

_logger = logging.getLogger(__name__)


class GalacsContactPrive(models.Model):
    """
    Contact privé d'un agent Galacs.io.

    Isolation garantie par des Record Rules Odoo :
    - Un agent ne peut lire, écrire, créer ou supprimer que SES propres contacts.
    - Aucun administrateur ne peut accéder aux données chiffrées.
    - Les champs _encrypted stockent les données chiffrées AES-GCM (client-side).

    Architecture chiffrement :
      ReactJS ──(AES-GCM, clé dérivée PBKDF2)──► champ _encrypted (opaque pour Odoo)
    """
    _name = 'galacs.contact.prive'
    _description = 'Contact Privé Agent Galacs.io'
    _order = 'create_date desc'
    _inherit = ['mail.thread']

    # ------------------------------------------------------------------ #
    #  Champs non-sensibles (visibles admin pour support)                  #
    # ------------------------------------------------------------------ #
    agent_id = fields.Many2one(
        'res.users',
        string='Agent propriétaire',
        default=lambda self: self.env.user,
        required=True,
        readonly=True,  # Jamais modifiable après création
        index=True,
    )
    alias = fields.Char(
        string='Alias / Surnom',
        help='Identifiant non-sensible choisi par l\'agent (ex: "Client Lyon 3").',
    )
    zone_chalandise = fields.Char(string='Zone')
    type_bien = fields.Selection(
        selection=[
            ('appartement', 'Appartement'),
            ('maison', 'Maison'),
            ('terrain', 'Terrain'),
            ('commercial', 'Local commercial'),
            ('autre', 'Autre'),
        ],
        string='Type de bien recherché',
    )
    # Flag de conversion en lead d'enchère
    converted_to_lead = fields.Boolean(
        string='Converti en lead',
        default=False,
        readonly=True,
    )
    converted_lead_id = fields.Many2one(
        'crm.lead', string='Lead issu de la conversion',
        readonly=True,
    )

    # ------------------------------------------------------------------ #
    #  Champs chiffrés côté client (AES-GCM via Web Crypto API)           #
    # ------------------------------------------------------------------ #
    # Ces champs stockent les données chiffrées côté client.
    # Odoo ne voit jamais les données en clair.
    # Format : base64(iv + ciphertext)
    nom_encrypted = fields.Text(
        string='Nom (chiffré)',
        help='Nom du contact chiffré AES-GCM côté client.',
    )
    telephone_encrypted = fields.Text(
        string='Téléphone (chiffré)',
    )
    email_encrypted = fields.Text(
        string='Email (chiffré)',
    )
    linkedin_encrypted = fields.Text(
        string='LinkedIn (chiffré)',
    )
    notes_encrypted = fields.Text(
        string='Notes privées (chiffrées)',
        help='Notes confidentielles de l\'agent, chiffrées AES-GCM.',
    )

    # ------------------------------------------------------------------ #
    #  Méthodes                                                            #
    # ------------------------------------------------------------------ #
    @api.model
    def create(self, vals):
        """Force l'agent_id à l'utilisateur courant à la création."""
        vals['agent_id'] = self.env.uid
        return super().create(vals)

    def write(self, vals):
        """Empêche la modification de agent_id."""
        if 'agent_id' in vals and vals['agent_id'] != self.env.uid:
            raise AccessError("Vous ne pouvez pas modifier le propriétaire d'un contact privé.")
        return super().write(vals)

    def action_convert_to_lead(self):
        """
        Convertit un contact privé en lead d'enchère Galacs.io.
        L'agent accepte implicitement la commission appliquée.
        L'alias est utilisé comme nom de lead (les données chiffrées restent privées).
        """
        self.ensure_one()
        if self.converted_to_lead:
            raise ValidationError("Ce contact a déjà été converti en lead.")

        lead = self.env['crm.lead'].create({
            'name': self.alias or f'Contact Privé #{self.id}',
            'user_id': self.agent_id.id,
            'zone_chalandise': self.zone_chalandise,
            'type_bien': self.type_bien,
            'source_lead': 'manuel',
            'description': f'Converti depuis contact privé agent (id={self.id})',
        })
        self.write({
            'converted_to_lead': True,
            'converted_lead_id': lead.id,
        })
        # Déclenche le scoring Gemma 4 via n8n
        self.env['galacs.ia.pipeline'].sudo()._send_to_n8n(lead)

        _logger.info(
            "Galacs Contacts Privés | Contact #%s converti en lead #%s par agent %s",
            self.id, lead.id, self.agent_id.name,
        )
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'crm.lead',
            'res_id': lead.id,
            'view_mode': 'form',
        }
