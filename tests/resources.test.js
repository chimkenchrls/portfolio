const test = require('node:test');
const assert = require('node:assert/strict');
const { postDate, validateData } = require('../script.js');
const data = require('../assets/data.js');

test('dates reject impossible days and format without a local-time shift', () => {
  assert.equal(postDate('2024-02-29'), 'Feb 29, 2024');
  assert.equal(postDate('2026-10-14'), 'Oct 14, 2026');
  for (const value of ['2026-02-30', '2026-13-01', '14-10-2026', '', null]) assert.equal(postDate(value), null);
});

test('resources: every item has a name, a note, a safe link or none, and an icon', () => {
  assert.deepEqual(validateData(data), []);
  assert.deepEqual(data.resources.map((group) => group.category), ['Tools I use', 'Skills I use', 'Plugins I use', 'How this site is built']);
  const fs = require('node:fs');
  const path = require('node:path');
  for (const group of data.resources) {
    if (group.icon) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'icons', `${group.icon}.svg`)), group.icon);
    for (const item of group.items) {
      if (item.icon) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'icons', 'stack', `${item.icon}.svg`)), item.icon);
      if (item.href) assert.match(item.href, /^https:\/\//, item.name);
    }
  }
});

test('resources validation catches missing text, unsafe links and missing icons', () => {
  const copy = structuredClone(data);
  const [tools, skills] = copy.resources;
  tools.items[0].note = '';
  tools.items[1].href = 'javascript:alert(1)';
  skills.icon = null;
  const errors = validateData(copy);
  assert.ok(errors.includes('resources[0].items[0]: name and note text required'), errors.join('\n'));
  assert.ok(errors.some((error) => error.startsWith('resources[0].items[1].href')), errors.join('\n'));
  assert.ok(errors.some((error) => error.startsWith('resources[1].items[0].icon')), errors.join('\n'));
});
