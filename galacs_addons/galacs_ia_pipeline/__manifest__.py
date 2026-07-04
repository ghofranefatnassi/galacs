# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Pipeline IA (n8n + Gemma 4)',
    'version': '17.0.1.0.0',
    'summary': 'Interface Odoo ↔ n8n ↔ Gemma 4 auto-hébergé VPS Infomaniak',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_leads'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_ia_pipeline_views.xml',
        'data/galacs_ia_pipeline_data.xml',
    ],
    'installable': True,
    'auto_install': False,
}
