import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {validateCourse,validateProgram,courseProgress,prerequisiteState,searchCourses} from '../../src/domain/courses.mjs';
const base=new URL('../../data/seed/',import.meta.url);const courses=JSON.parse(fs.readFileSync(new URL('courses.json',base))).items;const programs=JSON.parse(fs.readFileSync(new URL('programs.json',base))).items;
test('Phase 4 courses share valid schema and certificate taxonomy',()=>{assert.ok(courses.length>=3);courses.forEach(c=>assert.deepEqual(validateCourse(c),[]));});
test('program stages resolve to existing courses',()=>{assert.ok(programs.length>=1);programs.forEach(p=>assert.deepEqual(validateProgram(p,courses.map(c=>c.id)),[]));});
test('progress tracks ordered lesson completion',()=>{const c=courses[0],id=c.modules[0].lessons[0].id,p=courseProgress(c,[id]);assert.equal(p.done,1);assert.ok(p.percent>0);});
test('prerequisites report missing course dependencies',()=>{const c=courses.find(x=>x.id==='CRS-QMS-201');assert.equal(prerequisiteState(c,[]).eligible,false);assert.equal(prerequisiteState(c,['CRS-ISO-101']).eligible,true);});
test('course search and filters',()=>{assert.ok(searchCourses(courses,'ISO').length);assert.ok(searchCourses(courses,'',{level:1}).every(c=>c.level===1));});
