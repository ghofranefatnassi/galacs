# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Contacts Privés',
    'version': '17.0.1.0.0',
    'summary': 'CRM privé agent Galacs.io – isolation stricte, chiffrement client AES-GCM',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_leads', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'security/galacs_contact_prive_rules.xml',
        'views/galacs_contact_prive_views.xml',
    ],
    'installable': True,
    'auto_install': False,
}
