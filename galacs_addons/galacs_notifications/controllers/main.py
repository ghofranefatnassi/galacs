from odoo import http
from odoo.http import request
import json

class GalacsNotificationController(http.Controller):

    def _check_token(self):
        token = request.httprequest.headers.get('X-Galacs-Token')
        expected = request.env['ir.config_parameter'].sudo().get_param('galacs.n8n_shared_token')
        return token == expected

    @http.route('/api/notifications/remind', type='http', auth='none', methods=['POST'], csrf=False)
    def remind(self, **kwargs):
        if not self._check_token():
            return request.make_response(json.dumps({'error': 'Unauthorized'}), status=401)
        data = json.loads(request.httprequest.data)
        lead_id = data.get('lead_id')
        lead = request.env['crm.lead'].sudo().browse(lead_id)
        if not lead.exists():
            return request.make_response(json.dumps({'error': 'Lead not found'}), status=404)
        request.env['galacs.notification'].sudo()._notify_followup_72h(lead)
        return request.make_response(
            json.dumps({'status': 'ok', 'lead_id': lead_id}),
            headers=[('Content-Type', 'application/json')]
        )

    @http.route('/api/notifications/escalate', type='http', auth='none', methods=['POST'], csrf=False)
    def escalate(self, **kwargs):
        if not self._check_token():
            return request.make_response(json.dumps({'error': 'Unauthorized'}), status=401)
        data = json.loads(request.httprequest.data)
        lead_id = data.get('lead_id')
        lead = request.env['crm.lead'].sudo().browse(lead_id)
        if not lead.exists():
            return request.make_response(json.dumps({'error': 'Lead not found'}), status=404)
        lead.message_post(body=f"🚨 Escalade administrative — {data.get('message', '')}")
        return request.make_response(
            json.dumps({'status': 'escalated', 'lead_id': lead_id}),
            headers=[('Content-Type', 'application/json')]
        )

    @http.route('/api/encheres/close', type='http', auth='none', methods=['POST'], csrf=False)
    def close_auction(self, **kwargs):
        if not self._check_token():
            return request.make_response(json.dumps({'error': 'Unauthorized'}), status=401)
        data = json.loads(request.httprequest.data)
        auction_id = data.get('auction_id')
        action = data.get('action', 'close_with_winner')
        enchere = request.env['galacs.enchere'].sudo().browse(auction_id)
        if not enchere.exists():
            return request.make_response(json.dumps({'error': 'Auction not found'}), status=404)
        if action == 'close_with_winner':
            enchere.action_close()
        else:
            enchere.write({'state': 'closed'})
        return request.make_response(
            json.dumps({'status': 'closed', 'auction_id': auction_id}),
            headers=[('Content-Type', 'application/json')]
        )
