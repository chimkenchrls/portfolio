const test = require('node:test');
const assert = require('node:assert/strict');
const { profileLink, validateData } = require('../script.js');
const data = require('../assets/data.js');

test('Links uses existing profile destinations, with a mail link and local PDF', () => {
  assert.equal(profileLink(data.profile, 'linkedin').href, data.profile.linkedin);
  assert.equal(profileLink(data.profile, 'github').href, data.profile.github);
  assert.equal(profileLink(data.profile, 'email').href, `mailto:${data.profile.email}`);
  assert.equal(profileLink(data.profile, 'resume').href, './assets/resume.pdf');
});

test('Discord copies the username until a profile URL is provided', () => {
  assert.equal(profileLink({ discord: 'ck' }, 'discord').copy, 'ck');
  const linked = profileLink({ discord: 'ck', discordUrl: 'https://discord.com/users/123' }, 'discord');
  assert.equal(linked.href, 'https://discord.com/users/123');
  assert.equal(linked.copy, null);
});

test('missing destinations stay unavailable and unsafe destinations never become links', () => {
  for (const key of ['tiktok', 'facebook', 'email', 'resume']) assert.equal(profileLink({}, key).href, null);
  for (const value of ['javascript:alert(1)', 'http://facebook.com/example', 'not a URL']) {
    assert.equal(profileLink({ facebook: value }, 'facebook').href, null);
  }
  assert.equal(profileLink({ resume: '../private.pdf' }, 'resume').href, null);
  assert.equal(profileLink(null, 'discord').copy, null);
});

test('Links has only the requested Social and Work entries; invalid configuration is caught', () => {
  assert.deepEqual(data.linksPage.groups.map((group) => [group.title, group.items.map((item) => item.key)]), [
    ['Social', ['discord', 'tiktok', 'facebook']], ['Work', ['linkedin', 'github', 'email', 'resume']],
  ]);
  assert.deepEqual(validateData(data), []);
  const bad = structuredClone(data);
  bad.profile.tiktok = 'javascript:alert(1)';
  bad.linksPage.groups[0].items.push({ key: 'discord', label: 'Duplicate' });
  const errors = validateData(bad);
  assert.ok(errors.some((error) => error.startsWith('profile.tiktok')));
  assert.ok(errors.some((error) => error.includes('unique profile link key')));
});
