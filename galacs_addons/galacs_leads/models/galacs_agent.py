# -*- coding: utf-8 -*-
from odoo import models, fields


class GalacsZone(models.Model):
    _name = 'galacs.zone'
    _description = 'Zone de chalandise Galacs.io'
    _order = 'name'

    name = fields.Char(
        string='Nom de la zone',
        required=True,
        help="Nom de la zone de chalandise (ex: Paris 15e, Sousse Centre...).",
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('galacs_zone_name_uniq', 'unique(name)', 'Cette zone existe déjà.'),
    ]


class GalacsResUsers(models.Model):
    _inherit = 'res.users'

    galacs_linkedin_url = fields.Char(
        string='LinkedIn URL (Agent)',
        help="URL du profil LinkedIn de l'agent immobilier Galacs.io.",
    )
    galacs_zone_ids = fields.Many2many(
        'galacs.zone',
        string='Zones de chalandise (Agent)',
        help="Zones géographiques couvertes par l'agent. Utilisé pour le dispatch des leads et les enchères.",
    )
