const test = require('node:test');
const assert = require('node:assert/strict');
const { postDate, publishedPost, validateData } = require('../script.js');
const data = require('../assets/data.js');

test('writing dates reject impossible dates and format without a local-time shift', () => {
  assert.equal(postDate('2024-02-29'), 'Feb 29, 2024');
  assert.equal(postDate('2026-10-14'), 'Oct 14, 2026');
  for (const value of [null, '', undefined, '2026-02-29', '2026-04-31', '2026-13-01', '14/10/2026']) {
    assert.equal(postDate(value), null);
  }
});

test('a post needs both a body and a valid publication date before it can open', () => {
  const post = { slug: 'keep-going', body: 'First paragraph.\n\nSecond paragraph.', date: '2026-10-14' };
  assert.equal(publishedPost(post), true);
  for (const change of [{ body: null }, { body: ' ' }, { date: null }, { date: '2026-02-30' }, { slug: '../keep-going' }]) {
    assert.equal(publishedPost({ ...post, ...change }), false);
  }
  assert.equal(publishedPost(null), false);
});

test('the first writing entry keeps the supplied title and remains unwritten', () => {
  assert.equal(data.writing[0].title, 'if (everythingFallsApart) print("keep going..");');
  assert.equal(data.writing[0].date, null);
  assert.equal(data.writing[0].body, null);
  assert.equal(publishedPost(data.writing[0]), false);
  assert.deepEqual(validateData(data), []);
});

test('content validation catches duplicate slugs, missing text, and unfinished publication data', () => {
  const copy = structuredClone(data);
  copy.writing.push({ ...copy.writing[0] });
  copy.writing[0].body = 'A finished post without a date.';
  copy.writing[1].excerpt = '';
  const errors = validateData(copy);
  assert.ok(errors.some((error) => error.startsWith('writing[1].slug')));
  assert.ok(errors.some((error) => error.includes('title and excerpt')));
  assert.ok(errors.some((error) => error.includes('publication date')));
});
