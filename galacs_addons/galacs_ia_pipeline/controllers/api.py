# -*- coding: utf-8 -*-
# Galacs.io – galacs_ia_pipeline/controllers/api.py
# Endpoint REST : POST /api/leads/import_ia
# Reçoit le score Gemma 4 retourné par n8n (réseau local VPS)

import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class GalacsIaPipelineController(http.Controller):
    """
    Controller REST pour la réception des scores Gemma 4.

    Ce endpoint est appelé par n8n (sur le même VPS, réseau local).
    Il NE doit PAS être exposé sur internet → protection via Nginx
    (allow 127.0.0.1 uniquement dans la config Nginx).
    """

    @http.route(
        '/api/leads/import_ia',
        type='json',
        auth='public',   # n8n appelle sans session Odoo
        methods=['POST'],
        csrf=False,       # Appel interne VPS
    )
    def import_ia_score(self, **kwargs):
        """
        Reçoit le résultat du scoring Gemma 4 depuis n8n.

        Payload JSON attendu (envoyé par n8n) :
        {
            "lead_id": <int>,
            "score": <float 0-100>,
            "category": "hot" | "warm" | "cold",
            "justification": <str>,
            "model_version": <str>,       // optionnel
            "fallback": <bool>,           // True si Gemma 4 était indisponible
            "duration_ms": <int>,         // durée inférence Gemma 4 en ms
            "raw_response": <str>         // réponse brute Gemma 4 (pour audit)
        }

        Retourne :
        {
            "success": true,
            "lead_id": <int>
        }

        SÉCURITÉ :
        - Vérification du token partagé n8n ↔ Odoo (header X-Galacs-Token)
        - Rate limiting géré par Nginx (cf. configuration VPS)
        """
        try:
            # Vérification du token partagé (secret entre n8n et Odoo)
            token_header = request.httprequest.headers.get('X-Galacs-Token', '')
            expected_token = request.env['ir.config_parameter'].sudo().get_param(
                'galacs.n8n_shared_token', ''
            )
            if expected_token and token_header != expected_token:
                _logger.warning("Galacs IA Pipeline | Token invalide sur /api/leads/import_ia")
                return {'success': False, 'error': 'Token invalide.'}

            data = request.get_json_data() or {}
            lead_id = data.get('lead_id')
            score = data.get('score', 50.0)
            category = data.get('category', 'warm')
            justification = data.get('justification', '')
            version = data.get('model_version', '')
            fallback = bool(data.get('fallback', False))
            duration_ms = int(data.get('duration_ms', 0))
            raw_response = data.get('raw_response', '')

            if not lead_id:
                return {'success': False, 'error': 'lead_id manquant.'}

            pipeline = request.env['galacs.ia.pipeline'].sudo()
            ok = pipeline._process_n8n_response(
                lead_id=lead_id,
                score=score,
                category=category,
                justification=justification,
                version=version,
                fallback=fallback,
                duration_ms=duration_ms,
                raw_response=raw_response,
            )
            return {'success': ok, 'lead_id': lead_id}

        except Exception as e:
            _logger.exception("Galacs IA Pipeline | Erreur import_ia")
            return {'success': False, 'error': str(e)}
