/** Role model foundation (spec §3 role-aware navigation; ADD-13 company-admin placeholder). */
export const ROLES = ['learner', 'instructor', 'reviewer', 'admin', 'company_admin'];
export const PLACEHOLDER_ROLES = ['company_admin'];
export const isRole = r => ROLES.includes(r);
