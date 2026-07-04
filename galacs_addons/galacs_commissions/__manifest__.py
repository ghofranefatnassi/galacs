# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Commissions',
    'version': '17.0.1.0.0',
    'summary': 'Calcul automatique des commissions agent/agence Galacs.io',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_ventes'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_commission_views.xml',
        'data/galacs_commission_data.xml',
    ],
    'installable': True,
    'auto_install': False,
}
