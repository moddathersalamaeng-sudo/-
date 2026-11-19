/**
 * Published content the server needs, read from the Academy's own data folder (the same files the static site serves):
 * lab definitions (re-scoring), the competency framework (share validation), certifications (verification center),
 * and CMS listings. Read once and cached; reload() after a deploy.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateGovernance } from '../../src/data/governance.js';
import { CMS_COLLECTIONS } from '../../src/domain/production.mjs';

export function createContent(dataDir) {
  let cache = null;
  const readJson = async rel => JSON.parse(await readFile(path.join(dataDir, rel), 'utf8'));
  const items = async rel => { try { const d = await readJson(rel); return Array.isArray(d) ? d : (d.items || []); } catch { return []; } };

  async function load() {
    const [labs, competencies, certifications, courses] = await Promise.all([items('seed/labs.json'), items('seed/competency/competencies.json'), items('seed/certifications.json'), items('seed/courses.json')]);
    cache = {
      labs: new Map(labs.filter(l => validateGovernance(l).length === 0).map(l => [l.id, l])),
      competencyIds: competencies.filter(c => validateGovernance(c).length === 0 && c.governance.content_status === 'published').map(c => c.id),
      certifications: certifications.filter(c => validateGovernance(c).length === 0),
      /* Phase 16: published courses, for issuing certificates (completion is checked with the site's own rule). */
      courses: new Map(courses.filter(c => validateGovernance(c).length === 0 && c.governance.content_status === 'published').map(c => [c.id, c]))
    };
    return cache;
  }
  const get = async () => cache || load();

  return {
    reload: load,
    async lab(id) { return (await get()).labs.get(id) || null; },
    async competencyIds() { return (await get()).competencyIds; },
    async certifications() { return (await get()).certifications; },
    async course(id) { return (await get()).courses.get(id) || null; },
    /** A CMS listing of one collection: id, title, status, version (never the whole file to the browser). */
    async list(collection) {
      if (!CMS_COLLECTIONS.includes(collection)) return null;
      const rows = await items(`seed/${collection}.json`);
      return rows.map(r => ({ id: r.id, title: r.title || r.name || r.label || r.question || null, status: r.governance?.content_status || null,
        version: r.governance?.version || null, source: r.governance?.content_source || null, reviewer: r.governance?.reviewer || null, review_date: r.governance?.review_date || null }));
    },
    async record(collection, id) {
      if (!CMS_COLLECTIONS.includes(collection)) return null;
      return (await items(`seed/${collection}.json`)).find(r => r.id === id) || null;
    }
  };
}
