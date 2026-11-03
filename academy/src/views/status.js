/** 404 and 403 views. */
import { h } from '../core/dom.js';
import { LinkButton } from '../ui/components.js';
const view = (ctx, key, code) => h('div', { class: 'phead', dataset: { status: String(code) } },
  h('h1', null, ctx.t(key + '.title')), h('p', null, ctx.t(key + '.body')),
  LinkButton({ label: ctx.t(key + '.home'), href: '#/', variant: 'primary' }));
export const notFoundView = ctx => view(ctx, 'notFound', 404);
export const forbiddenView = ctx => view(ctx, 'forbidden', 403);
