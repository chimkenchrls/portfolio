const test = require('node:test');
const assert = require('node:assert/strict');
const { chatTokens, chatTiming, chatScript, validateData } = require('../script.js');
const data = require('../assets/data.js');

test('chatTokens splits a message into lines of plain, bold, and code pieces', () => {
  assert.deepEqual(chatTokens('hello amigo'), [[{ text: 'hello amigo' }]]);
  assert.deepEqual(chatTokens('**Study mode on.** Say `/study` again'), [[
    { text: 'Study mode on.', style: 'bold' },
    { text: ' Say ' },
    { text: '/study', style: 'code' },
    { text: ' again' },
  ]]);
  assert.deepEqual(chatTokens('one\n\n**two**'), [[{ text: 'one' }], [], [{ text: 'two', style: 'bold' }]]);
});

test('chatTokens never produces markup: odd or HTML-looking text stays text', () => {
  assert.deepEqual(chatTokens('a ** b'), [[{ text: 'a ** b' }]]);
  assert.deepEqual(chatTokens('<b>x</b> & `unclosed'), [[{ text: '<b>x</b> & `unclosed' }]]);
  assert.deepEqual(chatTokens(''), [[]]);
});

test('chatTiming: the bot "types" longer for longer replies, within sane limits', () => {
  const short = chatTiming({ from: 'bot', text: 'yo' });
  const long = chatTiming({ from: 'bot', text: 'x'.repeat(900) });
  assert.ok(short.typing >= 600 && short.typing < long.typing && long.typing <= 2400, JSON.stringify([short, long]));
  assert.equal(chatTiming({ from: 'user', text: 'hello' }).typing, 0);
  assert.equal(chatTiming({ from: 'system', text: 'ck used /study' }).typing, 0);
  assert.ok(chatTiming({ from: 'user', text: 'hello' }).delay > 0);
});

test('chatScript turns scenes into an ordered list of steps with a reading pause per scene', () => {
  const steps = chatScript([
    { messages: [{ from: 'user', text: 'hi' }, { from: 'bot', text: 'yo' }] },
    { messages: [{ from: 'bot', text: 'x'.repeat(600) }] },
  ]);
  assert.deepEqual(steps.map((s) => [s.scene, s.index]), [[0, 0], [0, 1], [1, 0]]);
  assert.equal(steps[0].last, false);
  assert.equal(steps[1].last, true);
  assert.ok(steps[1].hold >= 3000, 'short scene still pauses to be read');
  assert.ok(steps[2].hold > steps[1].hold, 'a long reply gets more reading time');
  assert.ok(steps[2].hold <= 20000);
  assert.deepEqual(chatScript([]), []);
  assert.deepEqual(chatScript(undefined), []);
});

test("AmIgo's replay uses the real conversation, word for word", () => {
  const amigo = data.projects.find((p) => p.title === 'AmIgo');
  assert.ok(amigo && amigo.chat, 'AmIgo has a chat replay');
  assert.equal(amigo.chat.bot, 'AmIgo');
  const all = amigo.chat.scenes.flatMap((s) => s.messages);
  const texts = all.map((m) => m.text);
  assert.ok(texts.includes('amigo explain how CI/CD works'));
  assert.ok(texts.includes('hello amigo'));
  assert.ok(texts.includes("yo, ano'ng ganap? ako lang ba 'yung 6'0 ft, family oriented, at marunong sumagot ng po at opo dito? haha, kamusta bro?"));
  assert.ok(texts.some((t) => t.startsWith('CI/CD (Continuous Integration / Continuous Delivery) automates the process of building, testing, and releasing software so you can push updates quickly and safely.')));
  assert.ok(texts.some((t) => t.endsWith('should the pipeline catch and stop the broken code?')));
  assert.equal(all.filter((m) => m.from === 'system' && m.text === 'ck used /study').length, 2);
  assert.ok(all.every((m) => ['user', 'bot', 'system'].includes(m.from)));
});

test("AmIgo's diagram states only what the code shows", () => {
  const amigo = data.projects.find((p) => p.title === 'AmIgo');
  assert.deepEqual(amigo.diagram.flow.map((n) => n.name), ['Discord', 'AmIgo', 'Gemini API']);
  assert.equal(amigo.diagram.store.name, 'SQLite');
  assert.doesNotMatch(JSON.stringify(amigo.diagram), /docker|vps|aws|azure|kubernetes/i, 'no hosting claims');
});

test('validateData checks chat and diagram shapes', () => {
  const copy = () => JSON.parse(JSON.stringify(data));
  const i = data.projects.findIndex((p) => p.title === 'AmIgo');
  let bad = copy(); bad.projects[i].chat.scenes[0].messages[0].from = 'admin';
  assert.ok(validateData(bad).some((e) => e.startsWith(`projects[${i}].chat`)));
  bad = copy(); bad.projects[i].chat.scenes = [];
  assert.ok(validateData(bad).some((e) => e.startsWith(`projects[${i}].chat`)));
  bad = copy(); bad.projects[i].diagram.flow = [{ name: '' }];
  assert.ok(validateData(bad).some((e) => e.startsWith(`projects[${i}].diagram`)));
  assert.deepEqual(validateData(data), []);
});

test('chat avatars: AmIgo has its picture, ck uses the chimken icon', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const amigo = data.projects.find((p) => p.title === 'AmIgo');
  assert.equal(amigo.chat.botAvatar, './assets/projects/amigo-avatar.jpg');
  const bytes = fs.readFileSync(path.join(__dirname, '..', amigo.chat.botAvatar));
  assert.ok(bytes.length < 20 * 1024, `avatar is ${Math.round(bytes.length / 1024)} KB`);
  assert.equal(bytes.indexOf(Buffer.from('Exif\0\0')), -1);
  assert.equal(amigo.chat.userIcon, 'chimken');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'icons', `${amigo.chat.userIcon}.svg`)));
});

test('the book emoji were removed from the study-mode messages', () => {
  const amigo = data.projects.find((p) => p.title === 'AmIgo');
  const texts = amigo.chat.scenes.flatMap((s) => s.messages).map((m) => m.text);
  assert.ok(texts.every((t) => !/[\u{1F4D5}\u{1F4DA}]/u.test(t)), 'no 📕 / 📚');
  assert.ok(texts.includes("**Study mode on.** Paste your notes or name a topic, then `@mention` me to have it explained, or say **quiz me** and I'll drill you on it. `/study` again to stop."));
  assert.ok(texts.includes('**Study mode off** — back to normal.'));
});

test('validateData only accepts a local avatar and a simple icon name', () => {
  const copy = () => JSON.parse(JSON.stringify(data));
  const i = data.projects.findIndex((p) => p.title === 'AmIgo');
  let bad = copy(); bad.projects[i].chat.botAvatar = 'https://evil.example/a.jpg';
  assert.ok(validateData(bad).some((e) => e.startsWith(`projects[${i}].chat.botAvatar`)));
  bad = copy(); bad.projects[i].chat.userIcon = 'x" onload="alert(1)';
  assert.ok(validateData(bad).some((e) => e.startsWith(`projects[${i}].chat.userIcon`)));
});
