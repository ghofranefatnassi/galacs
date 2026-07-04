# -*- coding: utf-8 -*-
# Galacs.io – galacs_notifications/models/galacs_notification.py
# Envoi des notifications web (Bus/SSE) et emails selon événements Odoo

from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

# Heure de début et fin du droit à la déconnexion (22h–7h)
QUIET_HOUR_START = 22
QUIET_HOUR_END = 7


class GalacsNotification(models.Model):
    """
    Gestionnaire central des notifications Galacs.io.
    Utilise le bus Odoo (longpolling) pour les notifications temps réel
    et mail.mail pour les emails.

    Droit à la déconnexion : les notifications non urgentes sont
    suspendues entre 22h et 7h.
    """
    _name = 'galacs.notification'
    _description = 'Notification Galacs.io'
    _order = 'create_date desc'

    # ------------------------------------------------------------------ #
    #  Champs log                                                          #
    # ------------------------------------------------------------------ #
    event_type = fields.Selection(
        selection=[
            ('new_lead', 'Nouveau lead scoré'),
            ('auction_start', 'Début enchère'),
            ('new_bid', 'Nouvelle surenchère'),
            ('auction_end', 'Fin enchère'),
            ('auction_won', 'Enchère gagnée'),
            ('no_bids', 'Enchère sans mise'),
            ('followup_72h', 'Rappel suivi 72h'),
            ('sale_pending', 'Vente en attente de validation'),
            ('sale_validated', 'Vente validée'),
            ('sale_rejected', 'Vente rejetée'),
        ],
        string='Type d\'événement',
    )
    recipient_id = fields.Many2one('res.users', string='Destinataire')
    payload = fields.Text(string='Payload JSON')
    sent_via_bus = fields.Boolean(string='Envoyé via Bus')
    sent_via_email = fields.Boolean(string='Envoyé par email')
    suppressed_quiet = fields.Boolean(
        string='Supprimé (droit déconnexion)',
        help='True si la notification a été bloquée entre 22h et 7h.',
    )

    # ------------------------------------------------------------------ #
    #  Méthodes privées                                                    #
    # ------------------------------------------------------------------ #
    def _is_quiet_hours(self):
        """Retourne True si l'heure actuelle est dans la plage 22h–7h."""
        import datetime
        now_hour = datetime.datetime.now().hour
        return now_hour >= QUIET_HOUR_START or now_hour < QUIET_HOUR_END

    def _send_bus(self, channel, message, urgent=False):
        """
        Envoie un message via le bus Odoo (longpolling/SSE).
        Respecte le droit à la déconnexion (sauf urgent=True).
        """
        if not urgent and self._is_quiet_hours():
            _logger.info("Galacs Notif | Bus bloqué (22h–7h) | canal %s", channel)
            return False
        self.env['bus.bus']._sendone(channel, 'galacs_notification', message)
        return True

    def _send_email(self, recipient_email, subject, body, urgent=False):
        """Envoie un email via Odoo mail."""
        if not urgent and self._is_quiet_hours():
            _logger.info("Galacs Notif | Email bloqué (22h–7h) | dest %s", recipient_email)
            return False
        mail = self.env['mail.mail'].sudo().create({
            'subject': subject,
            'body_html': body,
            'email_to': recipient_email,
        })
        mail.send()
        return True

    def _get_agents_for_zone(self, zone):
        """Récupère les agents actifs d'une zone de chalandise."""
        return self.env['res.users'].search([
            ('active', '=', True),
            ('groups_id', 'in', [self.env.ref('base.group_user').id]),
            # Filtre optionnel sur la zone – extensible via un champ dédié
        ])

    def _log_notification(self, event_type, recipient_id, payload, sent_bus, sent_email, suppressed=False):
        """Logue la notification pour audit."""
        import json
        self.create({
            'event_type': event_type,
            'recipient_id': recipient_id,
            'payload': json.dumps(payload) if isinstance(payload, dict) else payload,
            'sent_via_bus': sent_bus,
            'sent_via_email': sent_email,
            'suppressed_quiet': suppressed,
        })

    # ------------------------------------------------------------------ #
    #  API publique – appelée par les autres modules                       #
    # ------------------------------------------------------------------ #
    def _notify_new_auction(self, enchere):
        """Notifie les agents de la zone d'une nouvelle enchère."""
        agents = self._get_agents_for_zone(enchere.zone_chalandise)
        payload = {
            'type': 'auction_start',
            'enchere_id': enchere.id,
            'lead_id': enchere.lead_id.id,
            'lead_name': enchere.lead_id.name,
            'zone': enchere.zone_chalandise,
            'score': enchere.score_maturity,
            'ia_category': enchere.ia_category,
            'date_end': fields.Datetime.to_string(enchere.date_end),
            'min_bid': enchere.min_bid_percent,
        }
        for agent in agents:
            channel = f'galacs_agent_{agent.id}'
            sent = self._send_bus(channel, payload)
            self._log_notification('auction_start', agent.id, payload, sent, False, not sent)

    def _notify_new_bid(self, enchere, bid):
        """Notifie les agents d'une surenchère."""
        agents = self._get_agents_for_zone(enchere.zone_chalandise)
        payload = {
            'type': 'new_bid',
            'enchere_id': enchere.id,
            'new_bid': bid.bid_percent,
            'current_bid': enchere.current_bid_percent,
        }
        for agent in agents:
            if agent.id == bid.agent_id.id:
                continue  # Pas de notification au surenchérisseur lui-même
            sent = self._send_bus(f'galacs_agent_{agent.id}', payload)
            self._log_notification('new_bid', agent.id, payload, sent, False, not sent)

    def _notify_auction_won(self, enchere, winning_bid):
        """Notifie l'agent gagnant et ferme pour les autres."""
        payload_winner = {
            'type': 'auction_won',
            'enchere_id': enchere.id,
            'lead_id': enchere.lead_id.id,
            'commission': winning_bid.bid_percent,
        }
        # Notification urgente au gagnant (passe le droit à la déconnexion)
        sent_bus = self._send_bus(
            f'galacs_agent_{winning_bid.agent_id.id}',
            payload_winner,
            urgent=True,
        )
        sent_email = self._send_email(
            winning_bid.agent_id.email,
            f"[Galacs.io] Vous avez remporté le lead : {enchere.lead_id.name}",
            f"<p>Félicitations ! Vous avez remporté le lead <b>{enchere.lead_id.name}</b> "
            f"avec une commission de <b>{winning_bid.bid_percent:.2f}%</b>.</p>",
            urgent=True,
        )
        self._log_notification('auction_won', winning_bid.agent_id.id, payload_winner, sent_bus, sent_email)

    def _notify_no_bids(self, enchere):
        """Alerte admin : enchère clôturée sans aucune mise."""
        admin_users = self.env['res.users'].search([('groups_id', 'in', [
            self.env.ref('base.group_system').id
        ])])
        payload = {'type': 'no_bids', 'enchere_id': enchere.id}
        for admin in admin_users:
            sent = self._send_bus(f'galacs_admin_{admin.id}', payload, urgent=True)
            self._log_notification('no_bids', admin.id, payload, sent, False, not sent)

    def _notify_followup_72h(self, lead):
        """Rappel 72h de suivi à l'agent assigné."""
        if not lead.user_id:
            return
        payload = {
            'type': 'followup_72h',
            'lead_id': lead.id,
            'lead_name': lead.name,
            'current_stage': lead.galacs_stage,
        }
        sent_bus = self._send_bus(f'galacs_agent_{lead.user_id.id}', payload)
        sent_email = self._send_email(
            lead.user_id.email,
            f"[Galacs.io] Rappel suivi 72h – {lead.name}",
            f"<p>Rappel : le lead <b>{lead.name}</b> nécessite une mise à jour de statut.</p>",
        )
        self._log_notification('followup_72h', lead.user_id.id, payload, sent_bus, sent_email)

    def _notify_sale_pending(self, vente):
        """Alerte les admins qu'une vente est en attente de validation."""
        admins = self.env['res.users'].search([('groups_id', 'in', [
            self.env.ref('base.group_system').id
        ])])
        payload = {
            'type': 'sale_pending',
            'vente_id': vente.id,
            'lead_id': vente.lead_id.id,
            'agent': vente.agent_id.name,
        }
        for admin in admins:
            sent = self._send_bus(f'galacs_admin_{admin.id}', payload, urgent=True)
            self._log_notification('sale_pending', admin.id, payload, sent, False, not sent)

    def _notify_sale_result(self, vente, validated=True):
        """Notifie l'agent du résultat de validation de sa vente."""
        if not vente.agent_id:
            return
        event = 'sale_validated' if validated else 'sale_rejected'
        payload = {
            'type': event,
            'vente_id': vente.id,
            'lead_id': vente.lead_id.id,
        }
        sent_bus = self._send_bus(f'galacs_agent_{vente.agent_id.id}', payload, urgent=True)
        subject = (
            f"[Galacs.io] Vente {'validée' if validated else 'rejetée'} – {vente.lead_id.name}"
        )
        body =(
            f"<p>Votre déclaration de vente pour le lead <b>{vente.lead_id.name}</b> "
            f"a été <b>{'validée' if validated else 'rejetée'}</b>.</p>"
            + (f"<p>Commentaire : {vente.admin_comment}</p>" if vente.admin_comment else "")
        )
        sent_email = self._send_email(vente.agent_id.email, subject, body, urgent=True)
        self._log_notification(event, vente.agent_id.id, payload, sent_bus, sent_email)
