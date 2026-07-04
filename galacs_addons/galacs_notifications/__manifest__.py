# -*- coding: utf-8 -*-
{
    'name': 'Galacs – Notifications',
    'version': '17.0.1.0.0',
    'summary': 'Notifications SSE/WebSocket et emails Galacs.io',
    'author': 'Galacs.io',
    'category': 'Real Estate',
    'license': 'LGPL-3',
    'depends': ['galacs_leads', 'mail', 'bus'],
    'data': [
        'security/ir.model.access.csv',
        'views/galacs_notification_views.xml',
        'data/galacs_notification_data.xml',
    ],
    'installable': True,
    'auto_install': False,
}
