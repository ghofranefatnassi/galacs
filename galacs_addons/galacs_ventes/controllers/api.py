# -*- coding: utf-8 -*-
# Galacs.io – galacs_ventes/controllers/api.py
# Endpoints REST : POST /api/ventes/declarer et /api/ventes/verifier (MVP mock)

import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class GalacsVentesController(http.Controller):

    @http.route('/api/ventes/declarer', type='json', auth='user', methods=['POST'], csrf=True)
    def declarer_vente(self, **kwargs):
        """
        Soumet une déclaration de vente.

        Payload :
        {
            "lead_id": <int>,
            "reference_bien": <str>,
            "date_signature": "YYYY-MM-DD",
            "acheteur_nom": <str>,
            "vendeur_nom": <str>,
            "prix_vente": <float>
        }
        """
        try:
            data = request.get_json_data() or {}
            lead = request.env['crm.lead'].browse(int(data.get('lead_id', 0)))
            if not lead.exists():
                return {'success': False, 'error': 'Lead introuvable.'}

            vente = request.env['galacs.vente'].create({
                'lead_id': lead.id,
                'reference_bien': data.get('reference_bien', ''),
                'date_signature': data.get('date_signature'),
                'acheteur_nom': data.get('acheteur_nom', ''),
                'vendeur_nom': data.get('vendeur_nom', ''),
                'prix_vente': float(data.get('prix_vente', 0)),
            })
            vente.action_submit()
            return {'success': True, 'vente_id': vente.id, 'state': vente.state}
        except Exception as e:
            _logger.exception("Galacs Ventes API | Erreur declarer_vente")
            return {'success': False, 'error': str(e)}

    @http.route('/api/ventes/verifier', type='json', auth='public', methods=['POST'], csrf=False)
    def verifier_vente_mock(self, **kwargs):
        """
        Endpoint MVP mock de vérification notariale.
        En production, cet endpoint est remplacé par un vrai partenaire.
        Retourne toujours verified=True pour le MVP.
        """
        data = request.get_json_data() or {}
        _logger.info("Galacs Ventes MVP | Vérification mock : %s", data)
        return {
            'verified': True,
            'reason': 'Vérification simulée MVP Galacs.io',
            'reference': data.get('reference_bien', ''),
        }
