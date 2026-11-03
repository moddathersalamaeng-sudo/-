import test from 'node:test'; import assert from 'node:assert/strict';
import { normalize, resolve, canAccess } from '../../src/core/router.js';
const routes = [{ path: '/' }, { path: '/me' }, { path: '/dev/components', roles: ['admin'] }, { path: '/course/:id' }];
test('normalize', () => {
  assert.equal(normalize(''), '/'); assert.equal(normalize('#'), '/'); assert.equal(normalize('#/me/'), '/me');
  assert.equal(normalize('#me'), '/me'); assert.equal(normalize('#/me?x=1'), '/me');
});
test('resolve known, params and 404', () => {
  assert.equal(resolve(routes, '#/me').route.path, '/me');
  assert.deepEqual(resolve(routes, '#/course/iso%209001').params, { id: 'iso 9001' });
  assert.equal(resolve(routes, '#/nope').route, null);
  assert.equal(resolve(routes, '#m=iso9001').route, null, 'hub-style hash never matches an Academy route');
});
test('role guard', () => {
  assert.equal(canAccess(routes[2], ['learner']), false); assert.equal(canAccess(routes[2], ['admin']), true);
  assert.equal(canAccess(routes[1], []), true);
});
