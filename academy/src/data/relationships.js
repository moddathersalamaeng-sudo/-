/**
 * Typed cross-type relationships (ADD-17). Every content entity can point to
 * entities of other types so a learner never hits a dead end.
 */
export const ENTITY_TYPES = [
  'ecosystem', 'platform_module', 'article', 'library_resource', 'course', 'lesson', 'program',
  'assessment', 'lab', 'template', 'competency', 'certification', 'career_role', 'standard_family', 'learning_path'
];
export const RELATIONS = [
  'related_to', 'prerequisite_of', 'part_of', 'practices', 'assesses', 'develops',
  'prepares_for', 'links_to_tool', 'references', 'leads_to_course', 'develops_competency', 'uses_resource'
];

export function validateRelationship(r) {
  const v = [];
  if (!r || typeof r !== 'object') return ['not_an_object'];
  for (const f of ['fromType', 'fromId', 'relation', 'toType', 'toId']) if (typeof r[f] !== 'string' || !r[f]) v.push('missing_' + f);
  if (r.fromType && !ENTITY_TYPES.includes(r.fromType)) v.push('unknown_fromType');
  if (r.toType && !ENTITY_TYPES.includes(r.toType)) v.push('unknown_toType');
  if (r.relation && !RELATIONS.includes(r.relation)) v.push('unknown_relation');
  if (r.fromType === r.toType && r.fromId === r.toId) v.push('self_reference');
  return v;
}

export const relKey = r => `${r.fromType}:${r.fromId}|${r.relation}|${r.toType}:${r.toId}`;

export class RelationshipIndex {
  constructor(list = []) { this.items = []; this.keys = new Set(); list.forEach(r => this.add(r)); }
  add(r) {
    const v = validateRelationship(r);
    if (v.length) throw new Error(`Invalid relationship: ${v.join(', ')}`);
    const k = relKey(r);
    if (this.keys.has(k)) return false;
    this.keys.add(k); this.items.push({ ...r }); return true;
  }
  from(type, id) { return this.items.filter(r => r.fromType === type && r.fromId === id); }
  to(type, id) { return this.items.filter(r => r.toType === type && r.toId === id); }
  /** Number of distinct *other* entity types linked (both directions) — ADD-17 publish rule. */
  crossTypeCount(type, id) {
    const types = new Set();
    for (const r of this.from(type, id)) if (r.toType !== type) types.add(r.toType);
    for (const r of this.to(type, id)) if (r.fromType !== type) types.add(r.fromType);
    return types.size;
  }
  /** Dangling references: relationships whose endpoints are not in the known-entity set. */
  dangling(known) {
    return this.items.filter(r => !known.has(`${r.fromType}:${r.fromId}`) || !known.has(`${r.toType}:${r.toId}`));
  }
}
