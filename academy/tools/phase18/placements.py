# -*- coding: utf-8 -*-
"""Phase 18: where each owner video appears. Lesson ids are given as (course id, lesson number); None = the course page only.
ISO 9001:2026 clause videos are also placed automatically on every lesson of the ISO 9001 requirements guide (CRS-G-9001)
whose clause starts with the video's clause (see build_phase18.py). Reviewed by the owner in deliverables/phase-18/VIDEO_PLACEMENTS.md."""
P = {
  'iso-ep01': [('CRS-ISO-101', 1), ('CRS-ISO-9001-F', 1)],
  'iso-ep02': [('CRS-ISO-READ', 1)],
  'iso-ep03': [('CRS-ISO-101', 3), ('CRS-QMS-201', 2)],
  'iso-overview': [('CRS-ISO-101', 3), ('CRS-ISO-9001-F', 1)],
  'iso-practical': [('CRS-ISO-9001-IMP', 1)],
  'iso-system': [('CRS-ISO-9001-IMP', None), ('CRS-ISO-9001-AUD', None)],
  'iso26-4-1': [('CRS-ISO-101', 4), ('CRS-M-SWOT', 3), ('CRS-M-PESTLE', 4)],
  'iso26-4-2': [('CRS-ISO-101', 4), ('CRS-M-STAKE', 1)],
  'iso26-4-3': [('CRS-ISO-101', 4), ('CRS-ISO-9001-IMP', 2)],
  'iso26-4-4': [('CRS-ISO-9001-IMP', 2), ('CRS-QMS-201', 2)],
  'iso26-5-1': [('CRS-ISO-101', 5), ('CRS-ISO-9001-AUD', 3)],
  'iso26-5-2': [], 'iso26-5-3': [('CRS-PM-STAKE', 3)],
  'iso26-6-1': [('CRS-ISO-101', 5), ('CRS-ISO-9001-AUD', 3)],
  'iso26-6-2': [('CRS-ISO-9001-IMP', 4), ('CRS-QMS-201', 4)], 'iso26-6-3': [],
  'iso26-7-1': [], 'iso26-7-2': [('CRS-ISO-9001-IMP', 5)], 'iso26-7-3': [('CRS-ISO-9001-IMP', 5)], 'iso26-7-4': [], 'iso26-7-5': [('CRS-ISO-9001-IMP', 3)],
  'iso26-8-1': [('CRS-ISO-9001-F', 3), ('CRS-ISO-101', 6)], 'iso26-8-2': [('CRS-ISO-9001-F', 2), ('CRS-QMS-201', 3), ('CRS-ISO-9001-AUD', 2)],
  'iso26-8-3': [], 'iso26-8-4': [], 'iso26-8-5-1': [('CRS-ISO-9001-F', 3)], 'iso26-8-5-2': [], 'iso26-8-5-3': [], 'iso26-8-5-4': [], 'iso26-8-5-5': [], 'iso26-8-5-6': [],
  'iso26-8-6': [], 'iso26-8-7': [('CRS-M-CAPA', 1)],
  'iso26-9-1-1': [('CRS-ISO-9001-AUD', 4)], 'iso26-9-1-2': [('CRS-ISO-9001-F', 4)], 'iso26-9-1-3': [('CRS-Q-TOOLS', 1)],
  'iso26-9-2': [('CRS-ISO-9001-IMP', 6), ('CRS-ISO-9001-AUD', 1)], 'iso26-9-3': [('CRS-ISO-9001-IMP', 6)],
  'iso26-10-1': [('CRS-ISO-9001-F', 4), ('CRS-ISO-101', 6)], 'iso26-10-2': [('CRS-Q-CAPA', 3), ('CRS-M-CAPA', 3), ('CRS-ISO-9001-AUD', 4)],
  'joda-ep00': [], 'joda-ep01': [('CRS-Q-SPC', 2)], 'joda-ep02': [('CRS-M-PDCA', 1), ('CRS-ISO-101', 3)], 'joda-ep03': [('CRS-EFQM-101', 1)],
  'joda-ep04': [('CRS-QMS-201', 4)], 'joda-ep05': [('CRS-M-PARETO', 1), ('CRS-Q-TOOLS', 2)], 'joda-ep06': [('CRS-Q-COQ', 1)],
  'joda-ep08': [('CRS-M-FISH', 1), ('CRS-Q-CAPA', 2)], 'joda-ep09': [('CRS-LSS-GB', None)], 'joda-ep10': [('CRS-Q-COQ', 3)], 'joda-ep11': [('CRS-Q-CAPA', 3)],
  'joda-ep12': [('CRS-M-WHY5', 1), ('CRS-Q-CAPA', 2)], 'joda-ep13': [('CRS-LSS-GB', 1)], 'joda-ep14': [('CRS-LSS-GB', 1)],
  'masaa-ep01': [('CRS-M-PDCA', None)], 'masaa-ep02': [('CRS-EFQM-101', 1)], 'masaa-ep03': [('CRS-G-37000', 1)], 'masaa-ep04': [('CRS-EFQM-101', 2)], 'masaa-ep05': [],
  'masaa-ep06': [('CRS-Q-COQ', 1)], 'masaa-ep07': [('CRS-EFQM-101', 4)], 'masaa-ep08': [('CRS-G-37000', 4)], 'masaa-ep09': [('CRS-M-SWOT', 1)], 'masaa-ep10': [],
  'masaa-ep11': [('CRS-ISO-9001-IMP', 3)], 'masaa-ep12': [('CRS-EX-RADAR', 1)], 'masaa-ep13': [('CRS-PM-STAKE', 3)], 'masaa-ep14': [('CRS-ISO-9001-IMP', 4)],
  'masaa-ep15': [], 'masaa-ep16': [('CRS-ISO-9001-F', 4)],
  'short-hazard-risk': [('CRS-G-45001', 10)], 'short-qa-qc': [('CRS-QMS-201', 1)], 'short-root-cause': [('CRS-M-RCA', 1), ('CRS-Q-CAPA', 2)],
}
SERIES = {
  'iso9001-start': {'en': 'ISO 9001 — getting started', 'ar': 'ISO 9001 — البداية'},
  'iso9001-2026': {'en': 'ISO 9001:2026 — clause by clause', 'ar': 'ISO 9001:2026 — بندًا بندًا'},
  'joda': {'en': 'Quality in a minute', 'ar': 'جودة في دقيقة'},
  'masaa': {'en': 'Excellence evening', 'ar': 'مساء التميّز'},
  'shorts': {'en': 'Shorts', 'ar': 'مقاطع قصيرة'},
}
SERIES_ABOUT = {
  'iso9001-start': {'en': 'What a quality management system is, how to read a clause, and how a customer order travels through the system.', 'ar': 'ما نظام إدارة الجودة، وكيف تقرأ البند، وكيف يمر طلب العميل عبر النظام.'},
  'iso9001-2026': {'en': 'Each clause of ISO 9001:2026 explained with a worked example from a business, and a worksheet to apply it.', 'ar': 'كل بند من ISO 9001:2026 بمثال عملي من منشأة، مع ورقة تطبيق.'},
  'joda': {'en': 'The pioneers and theories of quality, one minute or so each.', 'ar': 'رواد الجودة ونظرياتها، في دقيقة تقريبًا لكل حلقة.'},
  'masaa': {'en': 'How to apply quality, governance and excellence ideas in your organisation.', 'ar': 'كيف تطبّق أفكار الجودة والحوكمة والتميّز في منظمتك.'},
  'shorts': {'en': 'Short explainers.', 'ar': 'شروحات قصيرة.'},
}
