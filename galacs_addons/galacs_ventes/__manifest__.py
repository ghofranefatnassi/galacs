# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Ventes',
    'version': '17.0.1.0.0',
    'summary': 'Vérification des ventes : API notariale simulée + validation admin',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_leads', 'galacs_notifications', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_vente_views.xml',
    ],
    'installable': True,
    'auto_install': False,
}
