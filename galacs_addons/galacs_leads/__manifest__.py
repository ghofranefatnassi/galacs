# -*- coding: utf-8 -*-
# Galacs.io – Module galacs_leads
# Extension du CRM Odoo 17 avec scoring IA Gemma 4, statuts personnalisés et délais
{
    'name': 'Galacs – Leads IA',
    'version': '17.0.1.0.0',
    'summary': 'Extension CRM Galacs.io : score Gemma 4, statuts personnalisés, délais 72h',
    'author': 'Galacs.io',
    'website': 'https://galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['crm', 'mail', 'base'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_lead_views.xml',
        'views/galacs_agent_views.xml',
        'data/galacs_lead_data.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
