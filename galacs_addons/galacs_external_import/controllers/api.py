# -*- coding: utf-8 -*-
# Galacs.io – galacs_external_import/controllers/api.py
# Endpoint REST : POST /api/external_leads/import
# Reçoit les leads Waalaxy enrichis par n8n/Dropcontact

import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class GalacsExternalImportController(http.Controller):
    """
    Controller REST pour l'import de leads externes.
    Appelé exclusivement par n8n (réseau interne VPS Infomaniak).
    Protégé par token partagé + restriction IP Nginx.
    """

    @http.route(
        '/api/external_leads/import',
        type='json',
        auth='public',   # Appel depuis n8n (pas de session Odoo)
        methods=['POST'],
        csrf=False,       # Réseau interne VPS
    )
    def import_external_lead(self, **kwargs):
        """
        Reçoit un lead Waalaxy enrichi depuis n8n.

        Payload JSON (fourni par n8n après enrichissement Dropcontact) :
        {
            "firstName": "Jean",
            "lastName": "Dupont",
            "linkedinUrl": "https://linkedin.com/in/jeandupont",
            "company": "Dupont SARL",
            "zone": "Lyon 3",
            "email": "jean.dupont@dupont.fr",
            "dropcontact_found": true,
            "source": "waalaxy"
        }

        Retourne :
        {
            "success": bool,
            "lead_id": int | null,
            "dedup_blocked": bool,
            "message": str
        }

        SÉCURITÉ :
        - Vérification header X-Galacs-Token
        - IP autorisée : uniquement le serveur n8n (même VPS)
        - Rate limiting Nginx : 10 req/s sur ce endpoint
        """
        try:
            # Vérification token partagé n8n ↔ Odoo
            token_header = request.httprequest.headers.get('X-Galacs-Token', '')
            expected_token = request.env['ir.config_parameter'].sudo().get_param(
                'galacs.n8n_shared_token', ''
            )
            if expected_token and token_header != expected_token:
                _logger.warning(
                    "Galacs External Import | Token invalide sur /api/external_leads/import"
                )
                return {'success': False, 'error': 'Token invalide.'}

            data = request.get_json_data() or {}
            if not data:
                return {'success': False, 'error': 'Payload vide.'}

            result = request.env['galacs.external.import'].sudo().import_from_n8n(data)
            return result

        except Exception as e:
            _logger.exception("Galacs External Import | Erreur import_external_lead")
            return {'success': False, 'error': str(e), 'lead_id': None, 'dedup_blocked': False}
