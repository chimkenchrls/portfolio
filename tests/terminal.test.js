const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TERMINAL_COMMANDS, runCommand, completeCommand, historyStep, mailtoLink,
} = require('../script.js');
const data = require('../assets/data.js');

const ctx = {
  data,
  identity: {
    name: 'Kenneth Charles Valdez',
    title: 'Aspiring DevOps Engineer | Cloud Engineer',
    location: 'Sariaya, Quezon, Philippines',
    status: 'Open to OJT / Internship',
    bio: ['I’m a 4th-year BS Computer Science student.', 'Right now, I’m just building side projects.'],
  },
  history: ['contact', 'whoami'],
  now: Date.UTC(2026, 9, 1, 10, 0, 0),
};
const run = (input, context = ctx) => runCommand(input, context);
const texts = (result) => result.lines.map((l) => `${l.label ? `${l.label} ` : ''}${l.text}`);
const EMAIL = 'charleskenneth129@gmail.com';

test('mailtoLink encodes the subject and body', () => {
  assert.equal(mailtoLink(EMAIL), `mailto:${EMAIL}`);
  assert.equal(
    mailtoLink(EMAIL, 'OJT / Internship opportunity', 'hi & hello?'),
    `mailto:${EMAIL}?subject=OJT%20%2F%20Internship%20opportunity&body=hi%20%26%20hello%3F`,
  );
});

test('contact lists every way to reach ck with real links', () => {
  const { lines } = run('contact');
  const byLabel = Object.fromEntries(lines.filter((l) => l.label).map((l) => [l.label, l]));
  assert.equal(byLabel.email.text, EMAIL);
  assert.equal(byLabel.email.href, `mailto:${EMAIL}`);
  assert.equal(byLabel.github.href, 'https://github.com/chimkenchrls');
  assert.equal(byLabel.github.text, 'github.com/chimkenchrls');
  assert.equal(byLabel.discord.text, 'de4dicated');
  assert.equal(byLabel.discord.copy, 'de4dicated');
  assert.equal(byLabel.linkedin.text, 'linkedin.com/in/kennethcharlesvaldez');
  assert.equal(byLabel.linkedin.href, 'https://www.linkedin.com/in/kennethcharlesvaldez');
  assert.equal(byLabel.status.text, 'Open to OJT / Internship');
});

test('linkedin is a real link, and falls back to "coming soon" when unset', () => {
  const line = run('linkedin').lines[0];
  assert.equal(line.href, 'https://www.linkedin.com/in/kennethcharlesvaldez');
  assert.equal(line.text, 'linkedin.com/in/kennethcharlesvaldez');
  const without = { ...ctx, data: { ...data, profile: { ...data.profile, linkedin: null } } };
  assert.equal(run('linkedin', without).lines[0].text, 'linkedin: coming soon');
  const row = run('contact', without).lines.find((l) => l.label === 'linkedin');
  assert.equal(row.text, 'coming soon');
  assert.equal(row.href, undefined, 'no link while linkedin is null');
});

test('email copies the address and offers a mail link', () => {
  const result = run('email');
  assert.deepEqual(result.action, { type: 'copy', text: EMAIL });
  assert.ok(result.lines.some((l) => l.href === `mailto:${EMAIL}`));
});

test('discord copies the username; github prints its link', () => {
  assert.deepEqual(run('discord').action, { type: 'copy', text: 'de4dicated' });
  assert.equal(run('github').lines[0].href, 'https://github.com/chimkenchrls');
  assert.equal(run('github').action, undefined, 'never auto-opens a new tab');
});

test('whoami describes ck from the page and current education', () => {
  const out = texts(run('whoami')).join('\n');
  assert.match(out, /Kenneth Charles Valdez/);
  assert.match(out, /Aspiring DevOps Engineer \| Cloud Engineer/);
  assert.match(out, /Sariaya, Quezon, Philippines/);
  assert.match(out, /Bachelor of Science in Computer Science.*STI College Lucena/);
});

test('projects, stack, and education summarise data.js and link to their sections', () => {
  const projects = run('projects');
  for (const { title } of data.projects) assert.ok(texts(projects).some((t) => t.includes(title)), `projects is missing ${title}`);
  assert.equal(projects.lines.at(-1).jump, 'projects');
  const stack = run('stack');
  assert.ok(stack.lines.some((l) => l.label === 'DevOps & Cloud' && /Docker \+ Compose/.test(l.text)));
  assert.equal(stack.lines.at(-1).jump, 'stack');
  const education = run('education');
  assert.ok(texts(education).some((t) => /STI College Lucena/.test(t)));
  assert.equal(education.lines.at(-1).jump, 'about');
});

test('sudo hire-me opens a pre-filled email; other sudo is refused', () => {
  const result = run('sudo hire-me');
  assert.equal(result.action.type, 'open');
  assert.equal(result.action.href, mailtoLink(EMAIL, 'OJT / Internship opportunity'));
  assert.match(texts(result).join('\n'), /\[sudo\] password for recruiter/);
  const nope = run('sudo rm -rf /');
  assert.equal(nope.action, undefined);
  assert.match(texts(nope).join('\n'), /not in the sudoers file/);
});

test('message opens the mail app with the text as the body, keeping its case', () => {
  const result = run('message Hello Kenneth, we have an OJT slot');
  assert.deepEqual(result.action, { type: 'open', href: mailtoLink(EMAIL, 'Hello from your portfolio', 'Hello Kenneth, we have an OJT slot') });
  const empty = run('message');
  assert.equal(empty.action, undefined);
  assert.match(texts(empty).join('\n'), /usage: message <text>/);
});

test('chimken, theme, and clear trigger their actions', () => {
  assert.deepEqual(run('chimken').action, { type: 'game' });
  assert.deepEqual(run('theme').action, { type: 'theme' });
  const cleared = run('clear');
  assert.equal(cleared.clear, true);
  assert.deepEqual(cleared.lines, []);
});

test('help lists every command', () => {
  const out = texts(run('help')).join('\n');
  for (const name of TERMINAL_COMMANDS) assert.ok(out.includes(name), `help is missing ${name}`);
});

test('input is forgiving: case, extra spaces, empty lines', () => {
  assert.deepEqual(run('  CONTACT  ').lines, run('contact').lines);
  assert.deepEqual(run('SuDo   Hire-Me').action, run('sudo hire-me').action);
  assert.deepEqual(run('   ').lines, []);
});

test('unknown commands get a helpful error, shown as plain text', () => {
  const result = run('<img src=x onerror=alert(1)>');
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].kind, 'error');
  assert.equal(result.lines[0].text, 'command not found: <img — try help');
  assert.equal(result.lines[0].href, undefined);
});

test('commands survive missing data without throwing', () => {
  const bare = { data: { profile: {} }, identity: {} };
  for (const name of TERMINAL_COMMANDS) assert.doesNotThrow(() => runCommand(name, bare), name);
  assert.doesNotThrow(() => runCommand('sudo hire-me', bare));
  assert.equal(runCommand('email', bare).action, undefined, 'nothing to copy without an email');
});

test('completeCommand finishes a unique prefix and lists ambiguous ones', () => {
  assert.deepEqual(completeCommand('con'), { value: 'contact', options: ['contact'] });
  assert.deepEqual(completeCommand('gi'), { value: 'github', options: ['github'] });
  const c = completeCommand('c');
  assert.equal(c.value, 'c');
  assert.deepEqual(c.options, ['cat', 'cd', 'chimken', 'clear', 'contact']);
  assert.deepEqual(completeCommand('zzz'), { value: 'zzz', options: [] });
  assert.deepEqual(completeCommand(''), { value: '', options: [] });
});

test('historyStep walks back and forward through past commands', () => {
  const history = ['contact', 'whoami', 'help'];
  let i = history.length; // "new line" position
  i = historyStep(history, i, -1); assert.equal(i, 2);
  i = historyStep(history, i, -1); assert.equal(i, 1);
  i = historyStep(history, i, -1); i = historyStep(history, i, -1); assert.equal(i, 0, 'stops at the oldest');
  i = historyStep(history, i, 1); assert.equal(i, 1);
  i = historyStep(history, 2, 1); assert.equal(i, 3, 'past the newest = empty line');
  assert.equal(historyStep(history, 3, 1), 3);
  assert.equal(historyStep([], 0, -1), 0);
});

const { spriteToBlocks } = require('../script.js');

test('help also lists the shell aliases and neofetch', () => {
  const out = texts(run('help')).join('\n');
  for (const name of ['ls', 'cd <section>', 'cat <file>', 'pwd', 'date', 'echo <text>', 'history', 'neofetch']) {
    assert.ok(out.includes(name), `help is missing ${name}`);
  }
});

test('ls lists the sections as directories and the readable files', () => {
  const out = texts(run('ls')).join('\n');
  for (const dir of ['home/', 'about/', 'stack/', 'projects/', 'certifications/', 'outside/', 'contact/']) {
    assert.ok(out.includes(dir), `ls is missing ${dir}`);
  }
  assert.ok(out.includes('about.txt') && out.includes('contact.txt'));
});

test('cd jumps to a section, forgiving about slashes and case', () => {
  assert.deepEqual(run('cd projects').action, { type: 'jump', id: 'projects' });
  assert.deepEqual(run('cd Stack/').action, { type: 'jump', id: 'stack' });
  assert.deepEqual(run('cd outside').action, { type: 'jump', id: 'outside' });
  assert.deepEqual(run('cd').action, { type: 'jump', id: 'home' });
  assert.deepEqual(run('cd ~').action, { type: 'jump', id: 'home' });
  const bad = run('cd /etc');
  assert.equal(bad.action, undefined);
  assert.equal(bad.lines[0].kind, 'error');
  assert.match(bad.lines[0].text, /cd: no such section: \/etc — try ls/);
});

test('cat prints the bio or the contact block', () => {
  assert.deepEqual(texts(run('cat about.txt')), ctx.identity.bio);
  assert.deepEqual(texts(run('cat about')), ctx.identity.bio);
  assert.deepEqual(run('cat contact.txt').lines, run('contact').lines);
  assert.match(texts(run('cat')).join(), /usage: cat <file>/);
  const missing = run('cat secrets.env');
  assert.equal(missing.lines[0].kind, 'error');
  assert.match(missing.lines[0].text, /cat: secrets\.env: no such file — try ls/);
});

test('pwd, date, echo, and history behave like a shell', () => {
  assert.deepEqual(texts(run('pwd')), ['/home/chimkenchrls/portfolio']);
  assert.deepEqual(texts(run('date')), ['Thu, 01 Oct 2026 10:00:00 GMT']);
  assert.deepEqual(texts(run('echo Hello   World')), ['Hello   World']);
  assert.deepEqual(texts(run('echo')), ['']);
  assert.deepEqual(texts(run('history')), ['1  contact', '2  whoami']);
  assert.deepEqual(texts(runCommand('history', { data, identity: {} })), ['no commands yet']);
});

test('echo output is plain text even when it looks like HTML', () => {
  const line = run('echo <script>alert(1)</script>').lines[0];
  assert.equal(line.text, '<script>alert(1)</script>');
  assert.equal(line.href, undefined);
});

test('spriteToBlocks packs two pixel rows into one row of half-block characters', () => {
  assert.deepEqual(spriteToBlocks(['X.X.', 'XX..', '....', '...X']), ['█▄▀ ', '   ▄']);
  assert.deepEqual(spriteToBlocks(['X.', '.X', 'XX']), ['▀▄', '▀▀'], 'odd row count pads with an empty row');
});

test('neofetch shows the chimken art beside real facts from data.js', () => {
  const { lines } = run('neofetch');
  assert.ok(lines.every((l) => l.kind === 'art' && typeof l.label === 'string' && l.label.length === 12), 'art column is 12 chars wide');
  assert.ok(lines.slice(0, 6).every((l) => /[█▀▄]/.test(l.label)), 'six rows of pixel art');
  const info = lines.map((l) => l.text).join('\n');
  assert.match(info, /^chimkenchrls\n------------\n/);
  assert.doesNotMatch(info, /ck@portfolio/);
  assert.match(info, /role\s+Aspiring DevOps Engineer \| Cloud Engineer/);
  assert.match(info, /school\s+STI College Lucena/);
  assert.match(info, /location\s+Sariaya, Quezon, Philippines/);
  const tools = data.stack.reduce((n, group) => n + group.items.length, 0);
  assert.match(info, new RegExp(`stack\\s+${tools} tools in ${data.stack.length} groups`));
  assert.match(info, new RegExp(`projects\\s+${data.projects.length}\\b`));
  assert.match(info, /chimken\s+high score 3236/);
  assert.match(info, /contact\s+charleskenneth129@gmail\.com/);
});

test('neofetch only prints facts it actually has', () => {
  const { lines } = runCommand('neofetch', { data: { profile: {} }, identity: {} });
  const info = lines.map((l) => l.text).join('\n');
  assert.doesNotMatch(info, /undefined|null|NaN/);
  const facts = lines.map((l) => l.text).slice(2).join('\n'); // below the name + rule
  assert.doesNotMatch(facts, /role|school|chimken|contact/);
});

const { manilaClock, TERMINAL_PROMPT } = require('../script.js');

test('the prompt is a classic $, owned by chimkenchrls', () => {
  assert.deepEqual(TERMINAL_PROMPT, { user: 'chimkenchrls', path: '~', symbol: '$' });
  assert.equal(require('../script.js').windowTitle, undefined, 'tmux window naming was removed');
});

test('manilaClock shows Philippine time (UTC+8) as HH:MM', () => {
  assert.equal(manilaClock(Date.UTC(2026, 9, 1, 10, 0, 0)), '18:00');
  assert.equal(manilaClock(Date.UTC(2026, 9, 1, 16, 5, 0)), '00:05');
  assert.equal(manilaClock(Date.UTC(2026, 0, 1, 23, 59, 59)), '07:59');
});
