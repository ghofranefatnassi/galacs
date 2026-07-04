# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Enchères',
    'version': '17.0.1.0.0',
    'summary': 'Système d\'enchères temps réel pour leads immobiliers Galacs.io',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_leads', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_enchere_views.xml',
        'data/galacs_enchere_data.xml',
    ],
    'installable': True,
    'auto_install': False,
}
