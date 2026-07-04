# -*- coding: utf-8 -*-
# Galacs.io – galacs_external_import/models/galacs_external_import.py
#
# Pipeline : Waalaxy (LinkedIn) → n8n → Dropcontact (email) → Odoo
#
# Ce module reçoit les leads enrichis de n8n et les crée dans Odoo.
# La déduplication empêche le double import sur une fenêtre de 30 jours.

from odoo import models, fields, api
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)

# Fenêtre de déduplication en jours (CDC V7 : 30 jours)
DEDUP_WINDOW_DAYS = 30


class GalacsExternalImport(models.Model):
    """
    Log d'import de leads externes Waalaxy.
    Permet de tracer chaque lead importé et de détecter les doublons.
    """
    _name = 'galacs.external.import'
    _description = 'Import Lead Externe Galacs.io (Waalaxy)'
    _order = 'create_date desc'

    lead_id = fields.Many2one(
        'crm.lead', string='Lead créé', ondelete='set null',
    )
    source = fields.Selection(
        selection=[('waalaxy', 'Waalaxy LinkedIn')],
        string='Source',
        default='waalaxy',
    )
    linkedin_url = fields.Char(string='URL LinkedIn')
    email = fields.Char(string='Email (Dropcontact)')
    raw_payload = fields.Text(string='Payload brut n8n')
    dedup_blocked = fields.Boolean(
        string='Bloqué (doublon)',
        default=False,
        help='True si ce lead a été bloqué par la déduplication 30 jours.',
    )
    dropcontact_found = fields.Boolean(
        string='Email trouvé via Dropcontact',
        default=False,
    )

    # ------------------------------------------------------------------ #
    #  Méthode principale : import depuis n8n                             #
    # ------------------------------------------------------------------ #
    @api.model
    def import_from_n8n(self, payload):
        """
        Crée un crm.lead depuis le payload Waalaxy enrichi par n8n/Dropcontact.

        Payload attendu (envoyé par n8n après enrichissement Dropcontact) :
        {
            "firstName": "Jean",
            "lastName": "Dupont",
            "linkedinUrl": "https://linkedin.com/in/jeandupont",
            "company": "Dupont SARL",
            "zone": "Lyon 3",
            "email": "jean.dupont@dupont.fr",    // fourni par Dropcontact
            "dropcontact_found": true,
            "source": "waalaxy"
        }

        Retourne :
        {
            "success": bool,
            "lead_id": int | None,
            "dedup_blocked": bool,
            "message": str
        }
        """
        linkedin_url = payload.get('linkedinUrl', '')
        email = payload.get('email', '')

        # ── Déduplication 30 jours ──────────────────────────────────── #
        if self._is_duplicate(linkedin_url=linkedin_url, email=email):
            log = self.create({
                'source': 'waalaxy',
                'linkedin_url': linkedin_url,
                'email': email,
                'raw_payload': str(payload),
                'dedup_blocked': True,
                'dropcontact_found': bool(payload.get('dropcontact_found', False)),
            })
            _logger.info(
                "Galacs External Import | DOUBLON bloqué | linkedin=%s email=%s",
                linkedin_url, email,
            )
            return {
                'success': False,
                'lead_id': None,
                'dedup_blocked': True,
                'message': f'Lead dupliqué bloqué (fenêtre 30 jours). Log #{log.id}',
            }

        # ── Validation payload ──────────────────────────────────────── #
        first_name = payload.get('firstName', '')
        last_name = payload.get('lastName', '')
        if not first_name and not last_name and not linkedin_url:
            return {
                'success': False,
                'lead_id': None,
                'dedup_blocked': False,
                'message': 'Payload insuffisant : nom ou LinkedIn obligatoire.',
            }

        # ── Création du lead Odoo ────────────────────────────────────── #
        lead_name = f"{first_name} {last_name}".strip() or linkedin_url
        lead = self.env['crm.lead'].sudo().create({
            'name': lead_name,
            'partner_name': f"{payload.get('company', '')}",
            'email_from': email,
            'zone_chalandise': payload.get('zone', ''),
            'linkedin_url': linkedin_url,
            'lead_type': payload.get('lead_type', 'buyer'),
            'source_lead': 'waalaxy',
            'galacs_stage': 'nouveau',
            'description': (
                f"Lead importé depuis Waalaxy LinkedIn.\n"
                f"Entreprise : {payload.get('company', 'N/A')}\n"
                f"Email Dropcontact : {email or 'Non trouvé'}\n"
                f"LinkedIn : {linkedin_url}"
            ),
        })

        # ── Log d'import ─────────────────────────────────────────────── #
        log = self.create({
            'lead_id': lead.id,
            'source': 'waalaxy',
            'linkedin_url': linkedin_url,
            'email': email,
            'raw_payload': str(payload),
            'dedup_blocked': False,
            'dropcontact_found': bool(payload.get('dropcontact_found', False)),
        })

        # ── Déclenchement scoring Gemma 4 via n8n ───────────────────── #
        self.env['galacs.ia.pipeline'].sudo()._send_to_n8n(lead)

        _logger.info(
            "Galacs External Import | Lead #%s créé depuis Waalaxy | %s",
            lead.id, lead_name,
        )
        return {
            'success': True,
            'lead_id': lead.id,
            'dedup_blocked': False,
            'message': f'Lead #{lead.id} créé et envoyé au pipeline Gemma 4.',
        }

    def _is_duplicate(self, linkedin_url='', email=''):
        """
        Vérifie si un lead avec le même email ou linkedin_url a été importé
        dans les 30 derniers jours.
        """
        from datetime import datetime, timedelta
        cutoff = fields.Datetime.to_string(
            fields.Datetime.now() - timedelta(days=DEDUP_WINDOW_DAYS)
        )
        domain = [
            ('create_date', '>=', cutoff),
            ('dedup_blocked', '=', False),
        ]
        if linkedin_url:
            domain_linkedin = domain + [('linkedin_url', '=', linkedin_url)]
            if self.search_count(domain_linkedin):
                return True
        if email:
            domain_email = domain + [('email', '=', email)]
            if self.search_count(domain_email):
                return True
        return False
