# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Import Externe (Waalaxy + Dropcontact)',
    'version': '17.0.1.0.0',
    'summary': 'Import leads Waalaxy LinkedIn via n8n : validation, déduplication, création crm.lead',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_ia_pipeline'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_external_import_views.xml',
        'data/galacs_external_import_data.xml',
    ],
    'installable': True,
    'auto_install': False,
}
