# -*- coding: utf-8 -*-
# Galacs.io – galacs_encheres/controllers/api.py
# Endpoint REST : POST /api/encheres/placer

import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class GalacsEncheresController(http.Controller):
    """
    Controller REST pour les enchères Galacs.io.
    Consommé par le frontend ReactJS.
    """

    @http.route(
        '/api/encheres/placer',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def placer_enchere(self, **kwargs):
        """
        Enregistre une mise d'un agent sur une enchère.

        Payload JSON attendu :
        {
            "enchere_id": <int>,
            "bid_percent": <float>
        }

        Retourne :
        {
            "success": true,
            "bid_id": <int>,
            "current_bid": <float>
        }
        """
        try:
            data = request.get_json_data() or {}
            enchere_id = int(data.get('enchere_id', 0))
            bid_percent = float(data.get('bid_percent', 0))

            if not enchere_id or bid_percent <= 0:
                return {'success': False, 'error': 'Paramètres invalides.'}

            enchere = request.env['galacs.enchere'].browse(enchere_id)
            if not enchere.exists():
                return {'success': False, 'error': 'Enchère introuvable.'}

            agent_id = request.env.uid
            bid = enchere.action_place_bid(agent_id, bid_percent)

            return {
                'success': True,
                'bid_id': bid.id,
                'current_bid': enchere.current_bid_percent,
            }
        except Exception as e:
            _logger.exception("Galacs Enchères API | Erreur placer_enchere")
            return {'success': False, 'error': str(e)}
