const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateData } = require('../script.js');
const data = require('../assets/data.js');

test('certifications distinguish study in progress from completed awards', () => {
  assert.deepEqual(data.certifications.map(({ title, issuer, status, date }) => ({ title, issuer, status, date })), [
    { title: 'AI Engineer for Developers', issuer: 'DataCamp', status: 'in-progress', date: null },
    { title: 'Champion in Local Codefest Competition', issuer: 'STI College Lucena', status: 'completed', date: '2026' },
    { title: 'Certificate of Participation on AppBuildersPH Hackathon', issuer: 'AppBuildersPH', status: 'completed', date: '2026' },
  ]);
});

test('certificate assets, when supplied, exist on disk', () => {
  for (const cert of data.certifications) {
    for (const key of ['photo', 'logo']) {
      if (cert[key] === null) continue;
      assert.ok(fs.existsSync(path.join(__dirname, '..', cert[key])), `${cert.title}: missing ${key}`);
    }
  }
});

test('certificate validation accepts pending assets and requires dates for completed entries', () => {
  const copy = structuredClone(data);
  assert.deepEqual(validateData(copy), []);
  copy.certifications[1].date = null;
  assert.ok(validateData(copy).some((e) => e.startsWith('certifications[1].date')));
  copy.certifications[1].date = '2026';
  copy.certifications[0].status = 'earned';
  assert.ok(validateData(copy).some((e) => e.startsWith('certifications[0].status')));
});

test('certificate validation rejects external, traversing, and unsupported image paths', () => {
  const copy = structuredClone(data);
  for (const [key, good, bad] of [
    ['photo', './assets/certifications/codefest.jpg', ['https://example.com/photo.jpg', './assets/certifications/../profile.jpg', './assets/certifications/cert.pdf', '']],
    ['logo', './assets/certifications/sti.svg', ['javascript:alert(1)', './assets/certifications/../../logo.svg', './assets/icons/certifications.svg', '']],
  ]) {
    copy.certifications[1][key] = good;
    assert.deepEqual(validateData(copy), []);
    for (const value of bad) {
      copy.certifications[1][key] = value;
      assert.ok(validateData(copy).some((e) => e.startsWith(`certifications[1].${key}`)), `${key}: ${value}`);
    }
    copy.certifications[1][key] = null;
  }
});

test('certificate crops reject invalid geometry while allowing original photos without a crop', () => {
  const copy = structuredClone(data);
  copy.certifications[1].photoCrop = null;
  assert.deepEqual(validateData(copy), []);
  for (const photoCrop of [
    { aspectRatio: 0, positionY: 25 },
    { aspectRatio: 4, positionY: 25 },
    { aspectRatio: 1, positionY: -1 },
    { aspectRatio: 1, positionY: 101 },
    { aspectRatio: '1', positionY: 25 },
    { aspectRatio: 1, positionY: NaN },
  ]) {
    copy.certifications[1].photoCrop = photoCrop;
    assert.ok(validateData(copy).some((e) => e.startsWith('certifications[1].photoCrop')));
  }
});
