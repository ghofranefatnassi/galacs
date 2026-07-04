# -*- coding: utf-8 -*-
# Galacs.io – galacs_ia_pipeline/models/galacs_ia_pipeline.py
#
# Ce module est le PONT entre Odoo et le pipeline n8n + Gemma 4 auto-hébergé.
#

from odoo import models, fields, api, http
from odoo.http import request
from odoo.exceptions import ValidationError
import requests
import json
import logging
import time

_logger = logging.getLogger(__name__)

# URL du webhook n8n sur le VPS (non exposé sur internet)
DEFAULT_N8N_WEBHOOK_URL ='https://n8n.world-wild-web.fr/webhook/galacs-scoring'
# Timeout appel n8n (en secondes)
N8N_TIMEOUT_SECONDS = 90
# Score fallback si Gemma 4 indisponible (CDC V7 : 50%)
FALLBACK_SCORE = 50.0


class GalacsIaPipeline(models.Model):
    """
    Gestionnaire du pipeline IA Galacs.io.

    Responsabilités :
      1. Envoyer un lead à n8n pour scoring Gemma 4 (_send_to_n8n)
      2. Recevoir le score retourné par n8n et mettre à jour le lead (via controller REST)
      3. Journaliser chaque appel dans galacs.ia.log
      4. Gérer le fallback si Gemma 4 est indisponible
    """
    _name = 'galacs.ia.pipeline'
    _description = 'Pipeline IA Galacs.io (n8n + Gemma 4)'

    # ------------------------------------------------------------------ #
    #  Méthode centrale : envoi du lead à n8n                             #
    # ------------------------------------------------------------------ #
    def _send_to_n8n(self, lead):
        """
        Envoie un lead au webhook n8n pour scoring Gemma 4.
        Appelé par :
          - galacs_leads.action_update_ia_score (scoring initial)
          - galacs_leads.action_request_rescore (rescoring manuel)
          - ir.cron (rescoring périodique 7 jours)
          - galacs_contacts_prives (conversion contact → lead)

        :param lead: crm.lead record
        """
        n8n_url = self.env['ir.config_parameter'].sudo().get_param(
            'galacs.n8n_webhook_url', DEFAULT_N8N_WEBHOOK_URL
        )

        payload = self._build_payload(lead)
        start_ts = time.time()

        try:
            # 1. Récupération du token Base64 enregistré dans vos paramètres système Odoo
            shared_token = self.env['ir.config_parameter'].sudo().get_param('galacs.n8n_shared_token', '')

            # 2. Construction des en-têtes (Headers) pour contourner Cloudflare
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {shared_token}',
                # Ce User-Agent fait croire à Cloudflare que la requête provient d'un humain sur Windows
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }

            # 3. Envoi de la requête POST vers l'URL publique de n8n
            resp = requests.post(
                n8n_url,
                json=payload,
                timeout=N8N_TIMEOUT_SECONDS,
                headers=headers,
            )
            resp.raise_for_status()
            elapsed_ms = int((time.time() - start_ts) * 1000)
            _logger.info(
                "Galacs IA Pipeline | Lead %s | Payload envoyé à n8n | %dms",
                lead.id, elapsed_ms,
            )
        except requests.exceptions.Timeout:
            _logger.warning(
                "Galacs IA Pipeline | Timeout n8n pour lead %s → fallback 50%%", lead.id
            )
            self._apply_fallback(lead, reason='timeout_n8n')
        except requests.exceptions.RequestException as e:
            _logger.error(
                "Galacs IA Pipeline | Erreur réseau n8n pour lead %s : %s → fallback", lead.id, e
            )
            self._apply_fallback(lead, reason=str(e))

    def _build_payload(self, lead):
        """
        Construit le payload JSON envoyé à n8n.
        Ce payload sera normalisé puis transmis à Gemma 4 comme prompt structuré.
        """
        return {
            'lead_id': lead.id,
            'odoo_callback_url': self._get_callback_url(),
            'prospect': {
                'nom': lead.partner_name or lead.name,
                'zone': lead.zone_chalandise or '',
                'type_bien': lead.type_bien or '',
                'source': lead.source_lead or 'manuel',
                'budget_estime': lead.budget_estime or 0,
                'comportement_site': lead.comportement_site or '',
                'linkedin_url': lead.linkedin_url or '',
                'email': lead.email_from or '',
                'lead_type': lead.lead_type or 'buyer',
            },
            'context': {
                'timestamp': fields.Datetime.to_string(fields.Datetime.now()),
                'model_requested': 'gemma4:latest',
                'scoring_version': '7.0',
            },
        }

    def _get_callback_url(self):
        """Retourne l'URL du callback Odoo pour n8n (POST /api/leads/import_ia)."""
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        return f"{base_url}/api/leads/import_ia"

    def _apply_fallback(self, lead, reason='unknown'):
        """
        Applique le score de fallback (50%) si Gemma 4 / n8n est indisponible.
        Marque le lead ia_fallback=True pour rescoring ultérieur automatique.
        """
        lead.sudo().write({
            'score_maturity': FALLBACK_SCORE,
            'ia_justification': f'Fallback IA – Gemma 4 indisponible ({reason})',
            'ia_scored_at': fields.Datetime.now(),
            'ia_fallback': True,
        })
        # Log de l'incident
        self.env['galacs.ia.log'].sudo().create({
            'lead_id': lead.id,
            'score': FALLBACK_SCORE,
            'category': 'warm',
            'justification': f'Fallback : {reason}',
            'fallback': True,
        })
        _logger.warning(
            "Galacs IA Pipeline | Fallback appliqué sur lead %s | Raison : %s",
            lead.id, reason,
        )

    def _process_n8n_response(self, lead_id, score, category, justification,
                               version=None, fallback=False, duration_ms=None,
                               raw_response=None):
        """
        Traite la réponse JSON de n8n (qui contient le résultat Gemma 4).
        Appelée par le controller REST POST /api/leads/import_ia.

        Validation de plage : score forcé entre 0 et 100.
        """
        lead = self.env['crm.lead'].sudo().browse(int(lead_id))
        if not lead.exists():
            _logger.error("Galacs IA Pipeline | Lead %s introuvable pour mise à jour score", lead_id)
            return False

        # Validation de plage (CDC V7 exigence)
        safe_score = max(0.0, min(100.0, float(score)))

        # Mise à jour lead
        lead.action_update_ia_score(
            score=safe_score,
            category=category,
            justification=justification,
            version=version,
            fallback=fallback,
        )

        # Log auditabe
        self.env['galacs.ia.log'].sudo().create({
            'lead_id': lead.id,
            'score': safe_score,
            'category': category,
            'justification': justification,
            'model_version': version or '',
            'fallback': fallback,
            'duration_ms': duration_ms or 0,
            'raw_response': raw_response or '',
        })
        return True

    # ------------------------------------------------------------------ #
    #  Monitoring : taux d'erreur Gemma 4                                  #
    # ------------------------------------------------------------------ #
    def _check_error_rate(self):
        """
        Vérifie le taux d'erreur Gemma 4 sur la dernière heure glissante.
        Si > 5%, envoie une alerte aux administrateurs.
        Appelé par un cron toutes les heures.
        """
        from datetime import datetime, timedelta
        one_hour_ago = fields.Datetime.to_string(
            fields.Datetime.now() - timedelta(hours=1)
        )
        total = self.env['galacs.ia.log'].sudo().search_count([
            ('create_date', '>=', one_hour_ago),
        ])
        if total == 0:
            return
        fallbacks = self.env['galacs.ia.log'].sudo().search_count([
            ('create_date', '>=', one_hour_ago),
            ('fallback', '=', True),
        ])
        rate = (fallbacks / total) * 100
        threshold = float(self.env['ir.config_parameter'].sudo().get_param(
            'galacs.gemma4_error_rate_threshold', 5.0
        ))
        if rate > threshold:
            _logger.critical(
                "Galacs IA Pipeline | ALERTE : taux d'erreur Gemma 4 = %.1f%% (seuil %.1f%%)",
                rate, threshold,
            )
            # Notification email aux admins
            admins = self.env['res.users'].search([
                ('groups_id', 'in', [self.env.ref('base.group_system').id])
            ])
            for admin in admins:
                self.env['mail.mail'].sudo().create({
                    'subject': f'[Galacs.io ALERTE] Taux erreur Gemma 4 : {rate:.1f}%',
                    'body_html': (
                        f'<p>Le taux d\'erreur du pipeline Gemma 4 est de <b>{rate:.1f}%</b> '
                        f'sur la dernière heure ({fallbacks}/{total} appels en fallback).</p>'
                        f'<p>Vérifier le service Ollama sur le VPS Infomaniak.</p>'
                    ),
                    'email_to': admin.email,
                }).send()
