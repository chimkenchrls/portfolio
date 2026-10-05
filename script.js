/**
 * Kenneth Charles Valdez — Portfolio
 * Vanilla ES2020 in a single IIFE; adds nothing to the global scope.
 * Content comes from PORTFOLIO_DATA (./assets/data.js).
 * Section 1 is pure (no DOM) and unit-tested: node --test tests/*.test.js
 */
(() => {
  'use strict';

  /* ==========================================================================
     1. Constants & pure helpers
     ========================================================================== */

  const SECTIONS = [
    { id: 'home', label: 'Home', key: '1' },
    { id: 'about', label: 'About', key: '2' },
    { id: 'projects', label: 'Projects', key: '3' },
    { id: 'stack', label: 'Stack', key: '4' },
    { id: 'certifications', label: 'Certifications', key: '5' },
    { id: 'contact', label: 'Contact', key: '6' },
  ];

  const PROJECT_STATUSES = ['done', 'in-progress', 'coming-soon'];

  // A project's screenshots as [{ kind, src, label }], desktop first. Only local
  // files in ./assets/projects/ are accepted.
  const SHOT_PATH = /^\.\/assets\/projects\/[\w.-]+\.(jpe?g|png|webp)$/;
  const ICON_NAME = /^[a-z][a-z0-9-]*$/;
  const projectShots = (project) => ['desktop', 'mobile']
    .map((kind) => ({ kind, src: project && project.media ? project.media[kind] : null, label: `${project.title} on ${kind}` }))
    .filter((shot) => typeof shot.src === 'string' && SHOT_PATH.test(shot.src));

  /* Chat replay (pure). A project's `chat` holds real conversations as scenes of
     { from: 'user' | 'bot' | 'system', text }. Text may use **bold** and `code`;
     everything else is shown literally. */
  const chatTokens = (text) => String(text == null ? '' : text).split('\n').map((line) => {
    const tokens = [];
    let rest = line;
    const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/;
    while (rest) {
      const match = pattern.exec(rest);
      if (!match) { tokens.push({ text: rest }); break; }
      if (match.index > 0) tokens.push({ text: rest.slice(0, match.index) });
      tokens.push(match[1] !== undefined ? { text: match[1], style: 'bold' } : { text: match[2], style: 'code' });
      rest = rest.slice(match.index + match[0].length);
    }
    return tokens;
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // How long before a message appears, and how long the bot "types" first (ms).
  const chatTiming = (message) => {
    const length = String((message && message.text) || '').length;
    if (message && message.from === 'bot') return { delay: 400, typing: clamp(600 + length * 2, 600, 2400) };
    return { delay: message && message.from === 'system' ? 600 : 900, typing: 0 };
  };

  // Flattens scenes into ordered steps; the last step of a scene holds long
  // enough to read what the bot said before the next scene starts.
  const chatScript = (scenes) => (Array.isArray(scenes) ? scenes : []).flatMap((scene, sceneIndex) => {
    const messages = (scene && scene.messages) || [];
    const botChars = messages.filter((m) => m.from === 'bot').reduce((n, m) => n + String(m.text || '').length, 0);
    return messages.map((message, index) => {
      const last = index === messages.length - 1;
      return { scene: sceneIndex, index, message, ...chatTiming(message), last, hold: last ? clamp(2500 + botChars * 25, 3000, 20000) : 0 };
    });
  });

  const safeLocalVideo = (src) => typeof src === 'string' && /^\.\/assets\/outside\/[\w.-]+\.mp4$/.test(src);

  const padCount = (value, width = 4) => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return null;
    return String(Math.max(0, n)).padStart(width, '0');
  };

  const safeUrl = (url) => {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    return /^(https?:\/\/|mailto:)\S+$/i.test(trimmed) ? trimmed : null;
  };

  // Slices one image across a grid×grid set of tiles while replicating
  // `object-fit: cover` (uniform scale, centred crop) for a square box.
  const computeTiles = (grid, imageWidth, imageHeight) => {
    const scale = 1 / Math.min(imageWidth, imageHeight);
    const renderedW = imageWidth * scale;
    const renderedH = imageHeight * scale;
    const leftEdge = -(renderedW - 1) / 2;
    const topEdge = -(renderedH - 1) / 2;
    const size = 1 / grid;
    const tiles = [];
    for (let i = 0; i < grid * grid; i += 1) {
      const top = Math.floor(i / grid) * size;
      const left = (i % grid) * size;
      tiles.push({
        top: top * 100,
        left: left * 100,
        size: size * 100,
        bgSize: [renderedW * grid * 100, renderedH * grid * 100],
        bgPos: [
          ((leftEdge - left) / (size - renderedW)) * 100 + 0,
          ((topEdge - top) / (size - renderedH)) * 100 + 0,
        ],
      });
    }
    return tiles;
  };

  // Shuffled reveal order → delay (ms) for each tile index.
  const revealDelays = (count, stepMs, random = Math.random) => {
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const delays = new Array(count);
    order.forEach((tileIndex, position) => { delays[tileIndex] = position * stepMs; });
    return delays;
  };

  const isTypingTarget = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  };

  /* "Get in touch" terminal (pure). runCommand turns typed input into output
     lines plus an optional action; the DOM module only prints and performs.
     A line is { text, label?, href?, jump?, copy?, kind? } — always plain text. */
  // chimken's 12x12 frames — drawn by the game, the hero yard and `neofetch`.
  // K = outline, W = body, S = shaded belly, A = comb, beak and legs.
  const CHIMKEN_BODY = [
    '........A...', '.......KAK..', '.KK...KWWWK.', 'KWWK..KWKWAA', 'KWWWKKWWWWA.',
    'KWWWWWWWWWK.', 'KSWWWWWWWWK.', 'KSSWWWWWWK..', '.KSSSWWWK...', '..KKKKKK....',
  ];
  const CHIMKEN_SPRITE = [...CHIMKEN_BODY, '...A..A.....', '..AA.AA.....'];
  const CHIMKEN_WALK_B = [...CHIMKEN_BODY, '....AA......', '...AA.AA....'];
  const CHIMKEN_AIR = [...CHIMKEN_BODY, '..AA.AA.....', '............'];
  // Head down, pecking (the hero yard).
  const CHIMKEN_PECK = [
    '............', '............', '.KK.........', 'KWWK........', 'KWWWKKKK....', 'KWWWWWWWKKA.',
    'KSWWWWWWWWKA', 'KSSWWWWWKWWK', '.KSSSWWWWWWK', '..KKKKKKKAAK', '...A..A...A.', '..AA.AA.....',
  ];
  // Which colour token each sprite letter is painted with.
  const CHIMKEN_INK = { K: '--chimken-line', W: '--chimken-body', S: '--chimken-shade', A: '--chimken-accent' };

  // Two pixel rows become one text row of half blocks, so the art stays square.
  const spriteToBlocks = (rows) => {
    const out = [];
    for (let r = 0; r < rows.length; r += 2) {
      const top = rows[r];
      const bottom = rows[r + 1] || '';
      let line = '';
      for (let c = 0; c < top.length; c += 1) {
        const up = top[c] !== '.';
        const down = c < bottom.length && bottom[c] !== '.';
        line += up && down ? '█' : up ? '▀' : down ? '▄' : ' ';
      }
      out.push(line);
    }
    return out;
  };

  const TERMINAL_COMMANDS = [
    'help', 'contact', 'email', 'github', 'linkedin', 'discord', 'whoami',
    'projects', 'stack', 'education', 'message', 'sudo', 'chimken', 'theme', 'clear',
    'ls', 'cd', 'cat', 'pwd', 'date', 'echo', 'history', 'neofetch',
  ];

  const TERMINAL_DIRS = [...SECTIONS.map((section) => section.id).slice(0, -1), 'outside', 'contact'];
  const TERMINAL_FILES = ['about.txt', 'contact.txt'];

  const TERMINAL_HELP = [
    ['contact', 'every way to reach me'],
    ['email', 'copy my email address'],
    ['github', 'my GitHub profile'],
    ['linkedin', 'my LinkedIn profile'],
    ['discord', 'copy my Discord username'],
    ['whoami', 'who I am, in four lines'],
    ['projects', 'what I have built'],
    ['stack', 'the tools I use'],
    ['education', 'where I study'],
    ['message <text>', 'email me that text'],
    ['sudo hire-me', 'you know you want to'],
    ['chimken', 'play the game'],
    ['theme', 'toggle light / dark'],
    ['clear', 'clear the screen'],
    ['neofetch', 'me, as a system summary'],
    ['ls', 'list the sections and files'],
    ['cd <section>', 'go to a section'],
    ['cat <file>', 'read about.txt or contact.txt'],
    ['pwd', 'where you are'],
    ['date', 'the current date'],
    ['echo <text>', 'say it back'],
    ['history', 'commands you ran'],
    ['help', 'this list'],
  ];

  const TERMINAL_PROMPT = { user: 'chimkenchrls', path: '~', symbol: '$' };

  // Philippine time has no DST, so UTC+8 is exact.
  const manilaClock = (ms) => {
    const local = new Date(ms + 8 * 60 * 60 * 1000);
    return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  };

  const mailtoLink = (email, subject, body) => {
    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
  };

  const runCommand = (input, context) => {
    const raw = String(input || '').trim();
    if (!raw) return { lines: [] };
    const [first, ...rest] = raw.split(/\s+/);
    const command = first.toLowerCase();
    const argText = raw.slice(first.length).trim();
    const data = (context && context.data) || {};
    const identity = (context && context.identity) || {};
    const profile = data.profile || {};
    const email = typeof profile.email === 'string' && safeUrl(`mailto:${profile.email.trim()}`) ? profile.email.trim() : null;
    const github = safeUrl(profile.github);
    const linkedin = safeUrl(profile.linkedin);
    const discord = typeof profile.discord === 'string' && profile.discord.trim() ? profile.discord.trim() : null;
    const pretty = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    const muted = (text) => ({ text, kind: 'muted' });
    const jumpLine = (id, text) => ({ text, jump: id });

    switch (command) {
      case 'help':
        return { lines: TERMINAL_HELP.map(([name, about]) => ({ label: name, text: about })) };

      case 'contact': {
        const lines = [];
        if (email) lines.push({ label: 'email', text: email, href: mailtoLink(email) });
        if (github) lines.push({ label: 'github', text: pretty(github), href: github });
        if (discord) lines.push({ label: 'discord', text: discord, copy: discord });
        lines.push(linkedin
          ? { label: 'linkedin', text: pretty(linkedin), href: linkedin }
          : { label: 'linkedin', text: 'coming soon', kind: 'muted' });
        if (identity.status) lines.push({ label: 'status', text: identity.status });
        return { lines };
      }

      case 'email':
        if (!email) return { lines: [muted('no email configured')] };
        return {
          lines: [{ text: email, href: mailtoLink(email) }, muted('copied — or click the address to open your mail app')],
          action: { type: 'copy', text: email },
        };

      case 'github':
        return { lines: [github ? { text: pretty(github), href: github } : muted('github: coming soon')] };

      case 'linkedin':
        return { lines: [linkedin ? { text: pretty(linkedin), href: linkedin } : muted('linkedin: coming soon')] };

      case 'discord':
        if (!discord) return { lines: [muted('discord: coming soon')] };
        return { lines: [{ text: discord, copy: discord }, muted('copied to clipboard')], action: { type: 'copy', text: discord } };

      case 'whoami': {
        const current = (data.education || []).find((entry) => entry && entry.current);
        const lines = [identity.name, identity.title, identity.location]
          .filter((text) => typeof text === 'string' && text.trim())
          .map((text) => ({ text }));
        if (current) lines.push({ text: joinParts([current.degree, current.school], ' @ ') });
        if (identity.status) lines.push(muted(identity.status));
        return { lines: lines.length ? lines : [muted('nothing to say yet')] };
      }

      case 'projects': {
        const lines = (data.projects || []).map((project) => ({ label: joinParts([project.title]), text: joinParts([project.meta]) }));
        lines.push(jumpLine('projects', '→ open the projects section'));
        return { lines };
      }

      case 'stack': {
        const lines = (data.stack || []).map((group) => ({
          label: joinParts([group.category]),
          text: (group.items || []).map((item) => item && item.name).filter(Boolean).join(', '),
        }));
        lines.push(jumpLine('stack', '→ open the stack section'));
        return { lines };
      }

      case 'education': {
        const lines = (data.education || []).map((entry) => ({
          label: joinParts([entry.dates]),
          text: joinParts([entry.degree, entry.school], ' @ '),
        }));
        lines.push(jumpLine('about', '→ open the about section'));
        return { lines };
      }

      case 'message': {
        if (!argText) return { lines: [muted('usage: message <text>   e.g. message hi, are you free for a call?')] };
        if (!email) return { lines: [muted('no email configured')] };
        const href = mailtoLink(email, 'Hello from your portfolio', argText);
        return { lines: [{ text: 'opening your mail app…', href }], action: { type: 'open', href } };
      }

      case 'sudo': {
        if (rest.join(' ').toLowerCase() !== 'hire-me') {
          return { lines: [{ text: 'ck is not in the sudoers file. try `sudo hire-me`', kind: 'error' }] };
        }
        const lines = [muted('[sudo] password for recruiter: ********'), { text: 'access granted.' }];
        if (!email) return { lines };
        const href = mailtoLink(email, 'OJT / Internship opportunity');
        lines.push({ text: 'opening an email to ck…', href });
        return { lines, action: { type: 'open', href } };
      }

      case 'ls':
        return { lines: [{ text: TERMINAL_DIRS.map((dir) => `${dir}/`).join('  ') }, { text: TERMINAL_FILES.join('  ') }] };

      case 'cd': {
        const target = String(rest[0] || '~').toLowerCase().replace(/^\.\//, '').replace(/\/$/, '');
        const id = target === '~' || target === '' ? 'home' : target;
        if (!TERMINAL_DIRS.includes(id)) {
          return { lines: [{ text: `cd: no such section: ${rest[0]} — try ls`, kind: 'error' }] };
        }
        return { lines: [muted(`~/${id}`)], action: { type: 'jump', id } };
      }

      case 'cat': {
        if (!rest[0]) return { lines: [muted('usage: cat <file>   e.g. cat about.txt')] };
        const file = rest[0].toLowerCase().replace(/\.txt$/, '');
        if (file === 'contact') return runCommand('contact', context);
        if (file === 'about') {
          const bio = (identity.bio || []).filter((text) => typeof text === 'string' && text.trim());
          return { lines: bio.length ? bio.map((text) => ({ text })) : [muted('about.txt is empty')] };
        }
        return { lines: [{ text: `cat: ${rest[0]}: no such file — try ls`, kind: 'error' }] };
      }

      case 'pwd':
        return { lines: [{ text: `/home/${TERMINAL_PROMPT.user}/portfolio` }] };

      case 'date': {
        const now = context && context.now !== undefined ? context.now : Date.now();
        return { lines: [{ text: new Date(now).toUTCString() }] };
      }

      case 'echo':
        return { lines: [{ text: argText }] };

      case 'history': {
        const past = (context && context.history) || [];
        return { lines: past.length ? past.map((entry, i) => ({ text: `${i + 1}  ${entry}` })) : [muted('no commands yet')] };
      }

      case 'neofetch': {
        const current = (data.education || []).find((entry) => entry && entry.current);
        const groups = data.stack || [];
        const tools = groups.reduce((count, group) => count + ((group && group.items) || []).length, 0);
        const game = data.game;
        const facts = [
          ['role', identity.title],
          ['school', current && current.school],
          ['location', identity.location],
          ['stack', tools ? `${tools} tools in ${groups.length} groups` : null],
          ['projects', (data.projects || []).length ? String(data.projects.length) : null],
          ['chimken', game && Number.isInteger(game.highScore) ? `high score ${game.highScore}` : null],
          ['contact', email],
        ].filter(([, value]) => typeof value === 'string' && value.trim());
        const info = [TERMINAL_PROMPT.user, '------------', ...facts.map(([key, value]) => `${key.padEnd(9)} ${value}`)];
        const art = spriteToBlocks(CHIMKEN_SPRITE);
        const rows = Math.max(art.length, info.length);
        return {
          lines: Array.from({ length: rows }, (_, i) => ({
            label: (art[i] || '').padEnd(12),
            text: info[i] || '',
            kind: 'art',
          })),
        };
      }

      case 'chimken':
        return { lines: [muted('launching chimken…')], action: { type: 'game' } };

      case 'theme':
        return { lines: [muted('theme toggled')], action: { type: 'theme' } };

      case 'clear':
        return { lines: [], clear: true };

      default:
        return { lines: [{ text: `command not found: ${first} — try help`, kind: 'error' }] };
    }
  };

  // Tab completion: finishes a unique prefix, or returns the shared prefix + options.
  const completeCommand = (partial) => {
    const typed = String(partial || '').toLowerCase();
    if (!typed) return { value: '', options: [] };
    const options = TERMINAL_COMMANDS.filter((name) => name.startsWith(typed)).sort();
    if (!options.length) return { value: typed, options };
    let prefix = options[0];
    options.forEach((name) => { while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1); });
    return { value: prefix, options };
  };

  // History cursor: 0 = oldest … history.length = the empty new line.
  const historyStep = (history, index, direction) => Math.min(history.length, Math.max(0, index + direction));

  /* Outside-the-IDE photo deck (pure). Cards are a stacked pile: the current
     card is on top and straight, the next two peek out tilted below it. */
  const cardDepth = (i, index, count) => (i - index + count) % count;
  const deckStep = (index, count, direction) => (index + direction + count) % count;
  const cardTilt = (i) => ((i * 7 + 3) % 11) - 5;
  const cardStyle = (depth, i) => (depth === 0
    ? { rotate: 0, y: 0, scale: 1, z: 100, visible: true }
    : { rotate: cardTilt(i), y: depth * 10, scale: 1 - depth * 0.04, z: 100 - depth, visible: depth <= 2 });

  // A pointer gesture: small movement = tap, long horizontal = swipe, else ignore (scroll).
  const gestureAction = (dx, dy) => {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return 'tap';
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'next' : 'prev';
    return null;
  };

  /* chimken vs ck: the site owner's fixed high score (data.js `game`) is the
     score to beat. Beating it unlocks a crown, fireworks, and a brag to copy. */
  const gameOverSummary = (state, rival, crownUnlocked) => {
    const lines = ['GAME OVER', `score ${padCount(state.score, 5)} · best ${padCount(state.hi, 5)}`];
    const beat = Boolean(rival) && state.score > rival.highScore;
    if (rival) {
      lines.push(beat
        ? `you beat ${rival.owner}'s high score: ${rival.highScore}${crownUnlocked ? ' · crown unlocked' : ''}`
        : `you didn't beat ${rival.owner}'s high score: ${rival.highScore}`);
    }
    lines.push('space / tap to retry');
    return { beat, lines };
  };

  // Sidebar score row: your best against the owner's, as label + value text.
  const scoreRow = (hi, rival) => {
    if (!rival) return null;
    const best = Number.isFinite(hi) && hi > 0 ? Math.floor(hi) : 0;
    const theirs = padCount(rival.highScore, 5);
    if (!best) return { label: `beat ${rival.owner}`, value: theirs, hint: `Play chimken. ${rival.owner}'s score to beat is ${rival.highScore}.` };
    const beat = best > rival.highScore;
    return {
      label: beat ? `you beat ${rival.owner}` : `you / ${rival.owner}`,
      value: `${padCount(best, 5)} / ${theirs}`,
      hint: `Play chimken. Your best is ${best}; ${rival.owner}'s score is ${rival.highScore}.`,
    };
  };

  const passedRival = (previousScore, score, rival) => Boolean(rival)
    && previousScore <= rival.highScore && score > rival.highScore;

  const bragText = (score, rival, url) => `I scored ${score} on chimken and beat ${rival.owner}'s ${rival.highScore} 🐔 ${url}`;

  const SPARK_GRAVITY = 400;
  const spawnSparks = (x, y, count, random = Math.random) => Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const speed = 80 + random() * 160;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, life: 0.8 + random() * 0.6 };
  });

  const stepSparks = (sparks, dt) => sparks
    .map((spark) => ({
      ...spark,
      x: spark.x + spark.vx * dt,
      y: spark.y + spark.vy * dt,
      vy: spark.vy + SPARK_GRAVITY * dt,
      life: spark.life - dt,
    }))
    .filter((spark) => spark.life > 0);

  /* chimken view + sky (pure). The playfield keeps its pixel size: wide
     screens show the full 600px world, phones show a narrower, taller slice
     with the ground pinned to the bottom and extra room for sky. */
  const chimkenView = (cssWidth, cssHeight) => {
    const scale = Math.max(1, cssWidth / CHIMKEN.width);
    const width = cssWidth / scale;
    const height = cssHeight / scale;
    return { scale, width, height, groundY: height - (CHIMKEN.height - CHIMKEN.groundY) };
  };

  const buildSky = (width, groundY, random = Math.random) => {
    const skyBottom = groundY - 36;
    const count = Math.max(8, Math.round((width * skyBottom) / 1800));
    const stars = Array.from({ length: count }, () => ({
      x: Math.floor(random() * width),
      y: 6 + Math.floor(random() * (skyBottom - 6)),
      size: random() < 0.2 ? 4 : 2,
      phase: random() * Math.PI * 2,
    }));
    const bodyY = 6 + Math.floor((skyBottom - 6) * 0.15);
    const clouds = Array.from({ length: Math.max(2, Math.round(width / 200)) }, () => ({
      x: Math.floor(random() * width),
      y: 10 + Math.floor(random() * Math.max(1, skyBottom - 30)),
    }));
    return {
      width, groundY, stars, clouds,
      moon: { x: Math.round(width * 0.72), y: bodyY },
      sun: { x: Math.round(width * 0.72), y: bodyY },
    };
  };

  // Parallax: a layer moves `factor` as fast as the ground, wrapping at `wrap`.
  const skyOffset = (distance, factor, wrap) => (((distance * factor) % wrap) + wrap) % wrap;

  const starAlpha = (phase, t, reduced) => (reduced
    ? 0.55
    : 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + phase)));

  const resolveShortcut = (event, typing = false) => {
    const key = String(event.key || '');
    if (key === 'Escape') return { type: 'close' };
    if (event.altKey && !event.ctrlKey && !event.metaKey
      && (event.code === 'KeyK' || key.toLowerCase() === 'k')) {
      return { type: 'game' };
    }
    if (typing || event.altKey || event.ctrlKey || event.metaKey) return null;
    if (key === 't' || key === 'T') return { type: 'theme' };
    const section = SECTIONS.find((s) => s.key === key);
    return section ? { type: 'jump', id: section.id } : null;
  };

  // Joins optional text parts, skipping missing ones so a bad data.js edit
  // never prints "undefined".
  const joinParts = (parts, separator = ' · ') => parts
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .join(separator);

  // GitHub contributions payload → { days, total }, or null if unusable.
  const parseContributions = (payload) => {
    const days = payload && payload.contributions;
    if (!Array.isArray(days) || !days.length) return null;
    const valid = days.every((d) => d
      && /^\d{4}-\d{2}-\d{2}$/.test(d.date)
      && Number.isInteger(d.level) && d.level >= 0 && d.level <= 4
      && Number.isFinite(d.count));
    if (!valid) return null;
    const reported = payload.total && payload.total.lastYear;
    const total = Number.isFinite(reported) ? reported : days.reduce((sum, d) => sum + d.count, 0);
    return { days, total };
  };

  // Groups consecutive days into Sunday-first weeks; the first week is padded
  // with nulls so each day lands in its weekday row.
  const buildContributionWeeks = (days) => {
    const weeks = [];
    let week = new Array(new Date(`${days[0].date}T00:00:00Z`).getUTCDay()).fill(null);
    days.forEach((d) => {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    });
    if (week.length) weeks.push(week);
    return weeks;
  };

  // An empty 53-week grid ending this week: the GitHub panel draws it right
  // away so the page doesn't jump when the real data arrives.
  const skeletonDays = (nowMs) => {
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date(nowMs);
    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + (6 - today.getUTCDay()) * DAY;
    return Array.from({ length: 53 * 7 }, (_, i) => ({
      date: new Date(end - (53 * 7 - 1 - i) * DAY).toISOString().slice(0, 10),
      count: 0,
      level: 0,
    }));
  };

  // Month label per column, GitHub-style: a week is labeled by the month of
  // its first day. A cramped first label (< 3 weeks wide) is dropped.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels = (weeks) => {
    const labels = [];
    let previous = -1;
    weeks.forEach((week, col) => {
      const first = week.find(Boolean);
      if (!first) return;
      const month = Number(first.date.slice(5, 7)) - 1;
      if (month !== previous) labels.push({ col, label: MONTHS[month] });
      previous = month;
    });
    if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift();
    return labels;
  };

  // Dot radius for an activity level (0–4), scaled like react-github-calendar.
  const dotRadius = (level, cellSize) => {
    const clamped = Math.min(Math.max(level, 0), 4);
    return (cellSize * (0.3 + (clamped / 4) * 0.7)) / 2;
  };

  /* Hero yard (pure): chimken roams a strip under the hero — walks to a corn,
     pecks it, rests, then heads for the next one. Units: px and seconds.
     `x` is chimken's left edge, `cornX` the corn's centre (null once eaten). */
  const ROAM = { size: 24, speed: 30, peck: 1.6, rest: 1.1, minWalk: 60, reach: 3 };

  const placeCorn = (x, width, rand) => {
    const lo = ROAM.size;
    const hi = width - ROAM.size;
    if (hi - lo < ROAM.minWalk) return null;
    const centre = x + ROAM.size / 2;
    const corn = lo + rand() * (hi - lo);
    if (Math.abs(corn - centre) >= ROAM.minWalk) return corn;
    // Too close to be a walk: drop it toward the farther end instead.
    const far = centre < width / 2 ? hi - rand() * (hi - lo) * 0.25 : lo + rand() * (hi - lo) * 0.25;
    return Math.abs(far - centre) >= ROAM.minWalk ? far : (centre < width / 2 ? hi : lo);
  };

  const createRoamState = (width, rand) => {
    const x = Math.max(0, Math.min(width * 0.12, width - ROAM.size));
    return { x, dir: 1, mode: 'walk', timer: 0, walked: 0, eaten: 0, width, cornX: placeCorn(x, width, rand) };
  };

  const roamStep = (state, dt, rand) => {
    const step = Math.min(Math.max(dt, 0), 0.1);
    const next = { ...state };
    if (next.mode === 'peck') {
      next.timer -= step;
      if (next.timer <= 0) { next.mode = 'rest'; next.timer = ROAM.rest; next.cornX = null; next.eaten += 1; }
      return next;
    }
    if (next.mode === 'rest') {
      next.timer -= step;
      if (next.timer <= 0) { next.mode = 'walk'; next.timer = 0; next.cornX = placeCorn(next.x, next.width, rand); }
      return next;
    }
    if (next.cornX === null) { next.mode = 'rest'; next.timer = ROAM.rest; return next; }
    next.dir = next.cornX >= next.x + ROAM.size / 2 ? 1 : -1;
    const target = next.dir === 1 ? next.cornX - ROAM.size + ROAM.reach : next.cornX - ROAM.reach;
    const move = ROAM.speed * step;
    if (Math.abs(target - next.x) <= move) {
      next.x = target;
      next.mode = 'peck';
      next.timer = ROAM.peck;
    } else {
      next.x += Math.sign(target - next.x) * move;
      next.walked += move;
    }
    return next;
  };

  const roamResize = (state, width) => {
    if (width === state.width) return state;
    const maxX = Math.max(0, width - ROAM.size);
    const cornFits = state.cornX !== null && state.cornX >= ROAM.size && state.cornX <= maxX;
    const next = { ...state, width, x: Math.min(state.x, maxX), cornX: cornFits ? state.cornX : null };
    if (!cornFits && next.mode !== 'rest') { next.mode = 'rest'; next.timer = ROAM.rest; }
    return next;
  };

  const roamFrame = (state) => {
    if (state.mode === 'peck') return Math.floor(state.timer * 5) % 2 ? 'peck' : 'walkA';
    if (state.mode === 'walk') return Math.floor(state.walked / 7) % 2 ? 'walkB' : 'walkA';
    return 'walkA';
  };

  /* chimken — a tiny endless runner (pure logic; drawing lives in the DOM section).
     Units: px and seconds. `y` is chimken's height above the ground. */
  const CHIMKEN = {
    width: 600,
    height: 150,
    groundY: 128,
    chimkenX: 36,
    chimkenSize: 24,
    gravity: 2400,
    holdGravity: 0.55,
    jumpVelocity: 700,
    startSpeed: 300,
    maxSpeed: 720,
    acceleration: 7,
    restartDelay: 0.5,
    // `y` is the obstacle's height above the ground (flying ones only).
    obstacles: {
      small: { w: 14, h: 12 },
      large: { w: 18, h: 16 },
      pair: { w: 32, h: 12 },
      swarm: { w: 50, h: 12 },
      hawkLow: { w: 24, h: 14, y: 8 },   // at chimken height: jump over it
      hawkHigh: { w: 24, h: 14, y: 80 }, // at the top of the jump arc: stay grounded
    },
    // New kinds join in as the score climbs.
    unlocks: [
      { at: 0, kinds: ['small'] },
      { at: 150, kinds: ['large', 'pair'] },
      { at: 300, kinds: ['hawkLow'] },
      { at: 500, kinds: ['hawkHigh', 'swarm'] },
    ],
    corn: { w: 10, h: 10, y: 92, points: 25, chance: 0.35 }, // near the top of a tap jump
    milestoneEvery: 100,
  };

  const createChimkenState = (hi = 0) => ({
    status: 'ready',
    speed: CHIMKEN.startSpeed,
    distance: 0,
    score: 0,
    hi,
    overFor: 0,
    nextSpawnIn: CHIMKEN.width * 0.8,
    chimken: { y: 0, vy: 0, onGround: true },
    obstacles: [],
    bonus: 0,
    pickups: [],
  });

  // Distance until the next bug: always long enough to land and jump again.
  const spawnGap = (speed, random = Math.random) => speed * (0.8 + random() * 0.9);

  const obstaclePool = (score) => CHIMKEN.unlocks
    .filter((tier) => score >= tier.at)
    .flatMap((tier) => tier.kinds);

  const spawnObstacle = (random, score) => {
    const pool = obstaclePool(score);
    const kind = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    return { x: CHIMKEN.width, kind, ...CHIMKEN.obstacles[kind] };
  };

  // Box overlap with a little forgiveness; `thing.y` is its height above the ground.
  const hitsObstacle = (chimken, thing) => {
    const left = CHIMKEN.chimkenX + 4;
    const right = left + CHIMKEN.chimkenSize - 8;
    const bottom = chimken.y;
    const top = chimken.y + CHIMKEN.chimkenSize - 4;
    const base = thing.y || 0;
    return left < thing.x + thing.w && right > thing.x && bottom < base + thing.h - 2 && top > base + 2;
  };

  const milestone = (previousScore, score) => Math.floor(score / CHIMKEN.milestoneEvery)
    > Math.floor(previousScore / CHIMKEN.milestoneEvery);

  const stepChimken = (state, dt, input, random = Math.random) => {
    if (state.status === 'ready') {
      if (!input.jump) return state;
      return stepChimken({ ...state, status: 'running' }, dt, input, random);
    }
    if (state.status === 'over') {
      const overFor = state.overFor + dt;
      if (input.jump && overFor >= CHIMKEN.restartDelay) {
        return stepChimken({ ...createChimkenState(state.hi), status: 'running' }, dt, input, random);
      }
      return { ...state, overFor };
    }

    const speed = Math.min(CHIMKEN.maxSpeed, state.speed + CHIMKEN.acceleration * dt);
    let { y, vy, onGround } = state.chimken;
    if (input.jump && onGround) { vy = CHIMKEN.jumpVelocity; onGround = false; }
    if (!onGround) {
      const gravity = input.holding && vy > 0 ? CHIMKEN.gravity * CHIMKEN.holdGravity : CHIMKEN.gravity;
      vy -= gravity * dt;
      y += vy * dt;
      if (y <= 0) { y = 0; vy = 0; onGround = true; }
    }
    const chimken = { y, vy, onGround };

    const moved = speed * dt;
    const obstacles = state.obstacles
      .map((bug) => ({ ...bug, x: bug.x - moved }))
      .filter((bug) => bug.x + bug.w > 0);
    let pickups = (state.pickups || [])
      .map((corn) => ({ ...corn, x: corn.x - moved }))
      .filter((corn) => corn.x + corn.w > 0);
    let nextSpawnIn = state.nextSpawnIn - moved;
    if (nextSpawnIn <= 0) {
      obstacles.push(spawnObstacle(random, state.score));
      nextSpawnIn = spawnGap(speed, random);
      if (random() < CHIMKEN.corn.chance) {
        // Halfway to the next obstacle, high enough that it takes a jump.
        const { w, h, y } = CHIMKEN.corn;
        pickups.push({ x: CHIMKEN.width + nextSpawnIn / 2, y, w, h });
      }
    }

    let bonus = state.bonus || 0;
    const grabbed = pickups.filter((corn) => hitsObstacle(chimken, corn));
    if (grabbed.length) {
      bonus += grabbed.length * CHIMKEN.corn.points;
      pickups = pickups.filter((corn) => !grabbed.includes(corn));
    }

    const distance = state.distance + moved;
    const score = Math.floor(distance / 10) + bonus;
    const next = { ...state, speed, distance, score, chimken, obstacles, nextSpawnIn, bonus, pickups };
    if (obstacles.some((bug) => hitsObstacle(chimken, bug))) {
      return { ...next, status: 'over', overFor: 0, hi: Math.max(state.hi, score) };
    }
    return next;
  };

  const validateData = (data) => {
    if (!data || typeof data !== 'object') return ['data: missing'];
    const errors = [];
    const isText = (v) => typeof v === 'string' && v.trim() !== '';
    const isOptionalText = (v) => v === null || isText(v);
    const isOptionalUrl = (v) => v === null || safeUrl(v) !== null;
    const checkList = (name, list, check) => {
      if (!Array.isArray(list)) { errors.push(`${name}: must be an array`); return; }
      list.forEach((item, i) => check(item || {}, `${name}[${i}]`));
    };

    const profile = data.profile;
    if (!profile) {
      errors.push('profile: missing');
    } else {
      if (!isText(profile.email)) errors.push('profile.email: required text');
      ['github', 'linkedin'].forEach((k) => {
        if (!isOptionalUrl(profile[k])) errors.push(`profile.${k}: must be an https URL or null`);
      });
      if (!isOptionalText(profile.discord)) errors.push('profile.discord: text or null');
      if (!isOptionalText(profile.githubUsername)) errors.push('profile.githubUsername: text or null');
    }

    checkList('experience', data.experience, (e, p) => {
      if (!isText(e.title) || !isText(e.org) || !isText(e.dates)) errors.push(`${p}: title, org, dates required`);
      if (!Array.isArray(e.bullets)) errors.push(`${p}.bullets: must be an array`);
    });
    checkList('education', data.education, (e, p) => {
      if (!isText(e.school) || !isText(e.degree) || !isText(e.dates)) errors.push(`${p}: school, degree, dates required`);
      if (e.bullets != null && !Array.isArray(e.bullets)) errors.push(`${p}.bullets: must be an array or null`);
    });
    checkList('stack', data.stack, (g, p) => {
      if (!isText(g.category)) errors.push(`${p}.category: required text`);
      checkList(`${p}.items`, g.items, (item, ip) => {
        if (!isText(item.name)) errors.push(`${ip}.name: required text`);
        if (!isOptionalText(item.icon)) errors.push(`${ip}.icon: slug or null`);
      });
    });
    checkList('projects', data.projects, (pr, p) => {
      if (!isText(pr.title)) errors.push(`${p}.title: required text`);
      if (!isText(pr.meta)) errors.push(`${p}.meta: required text`);
      if (!PROJECT_STATUSES.includes(pr.status)) errors.push(`${p}.status: one of ${PROJECT_STATUSES.join(', ')}`);
      if (!isOptionalText(pr.description)) errors.push(`${p}.description: text or null`);
      if (!Array.isArray(pr.tags)) errors.push(`${p}.tags: must be an array`);
      const links = pr.links || {};
      ['source', 'live'].forEach((k) => {
        if (links[k] !== undefined && !isOptionalUrl(links[k])) errors.push(`${p}.links.${k}: https URL or null`);
      });
      if (pr.chat !== undefined && pr.chat !== null) {
        const scenes = pr.chat.scenes;
        const sceneOk = (scene) => scene && Array.isArray(scene.messages) && scene.messages.length > 0
          && scene.messages.every((m) => m && ['user', 'bot', 'system'].includes(m.from) && isText(m.text));
        if (!isText(pr.chat.bot) || !Array.isArray(scenes) || !scenes.length || !scenes.every(sceneOk)) {
          errors.push(`${p}.chat: needs bot and scenes of { from: user|bot|system, text }`);
        }
        if (pr.chat.botAvatar !== undefined && !SHOT_PATH.test(String(pr.chat.botAvatar))) {
          errors.push(`${p}.chat.botAvatar: a file in ./assets/projects/`);
        }
        if (pr.chat.userIcon !== undefined && !ICON_NAME.test(String(pr.chat.userIcon))) {
          errors.push(`${p}.chat.userIcon: the name of an icon in ./assets/icons/`);
        }
      }
      if (pr.diagram !== undefined && pr.diagram !== null) {
        const nodeOk = (node) => node && isText(node.name) && (node.note === undefined || isText(node.note));
        const { flow, store } = pr.diagram;
        if (!Array.isArray(flow) || !flow.length || !flow.every(nodeOk) || (store !== undefined && !nodeOk(store))) {
          errors.push(`${p}.diagram: needs flow of { name, note? } and an optional store`);
        }
      }
      if (pr.media !== undefined && pr.media !== null) {
        const kinds = Object.keys(pr.media);
        if (!kinds.length || kinds.some((kind) => !['desktop', 'mobile'].includes(kind))) {
          errors.push(`${p}.media: use desktop and/or mobile`);
        }
        kinds.forEach((kind) => {
          if (!SHOT_PATH.test(String(pr.media[kind]))) errors.push(`${p}.media.${kind}: a file in ./assets/projects/`);
        });
      }
    });
    checkList('certifications', data.certifications, (c, p) => {
      if (!isText(c.title) || !isText(c.issuer) || !isText(c.date)) errors.push(`${p}: title, issuer, date required`);
      if (c.link !== undefined && !isOptionalUrl(c.link)) errors.push(`${p}.link: https URL or null`);
    });
    if (!isText(data.certificationsPending)) errors.push('certificationsPending: required text');
    if (data.outsideIntro !== undefined && !isText(data.outsideIntro)) errors.push('outsideIntro: text');
    if (data.outside !== undefined) {
      checkList('outside', data.outside, (item, p) => {
        if (!/^\.\/assets\/outside\/[\w.-]+\.(svg|jpe?g|png|webp)$/.test(String(item.photo))) {
          errors.push(`${p}.photo: a file in ./assets/outside/`);
        }
        if (item.video !== undefined && !/^\.\/assets\/outside\/[\w.-]+\.mp4$/.test(String(item.video))) {
          errors.push(`${p}.video: an .mp4 in ./assets/outside/ (with a same-named .webm)`);
        }
      });
    }
    if (data.game !== undefined && data.game !== null) {
      const { owner, highScore } = data.game;
      if (!isText(owner) || !Number.isInteger(highScore) || highScore < 0) {
        errors.push('game: owner text and a non-negative integer highScore required');
      }
    }
    return errors;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SECTIONS, padCount, safeUrl, computeTiles, revealDelays, joinParts,
      parseContributions, buildContributionWeeks, dotRadius, monthLabels, skeletonDays,
      isTypingTarget, resolveShortcut, validateData, projectShots,
      chatTokens, chatTiming, chatScript,
      CHIMKEN, createChimkenState, stepChimken, spawnGap,
      obstaclePool, spawnObstacle, hitsObstacle, milestone,
      chimkenView, buildSky, skyOffset, starAlpha,
      gameOverSummary, passedRival, bragText, scoreRow, spawnSparks, stepSparks,
      cardDepth, deckStep, cardTilt, cardStyle, gestureAction,
      TERMINAL_COMMANDS, runCommand, completeCommand, historyStep, mailtoLink,
      spriteToBlocks, CHIMKEN_SPRITE, TERMINAL_PROMPT, manilaClock,
      ROAM, createRoamState, roamStep, roamResize, roamFrame, placeCorn,
      CHIMKEN_WALK_B, CHIMKEN_AIR, CHIMKEN_PECK, CHIMKEN_INK,
    };
  }
  if (typeof document === 'undefined') return;

  /* ==========================================================================
     2. DOM environment
     ========================================================================== */

  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = () => motionQuery.matches;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const storage = {
    get(area, key) {
      try { return window[area].getItem(key); } catch { return null; }
    },
    set(area, key, value) {
      try { window[area].setItem(key, value); } catch { /* storage blocked — keep going */ }
    },
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const stackIconEl = (slug) => {
    const span = el('span', 'icon icon-sm');
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--icon', `url("./assets/icons/stack/${slug}.svg")`);
    return span;
  };

  const externalLink = (href, text, className = 'text-link') => {
    const a = el('a', className, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };

  const announce = (message) => {
    const region = $('.sr-status');
    if (!region) return;
    region.textContent = '';
    window.setTimeout(() => { region.textContent = message; }, 50);
  };

  /* ==========================================================================
     2b. Chat replay — plays a project's real conversation into its chat window
     ========================================================================== */

  const chatReplay = (() => {
    const pending = [];
    const LINE_MS = 320; // the real bot streams its replies; long ones arrive line by line

    const messageEl = (message, chat) => {
      if (message.from === 'system') return el('p', 'chat-system', message.text);
      const isBot = message.from === 'bot';
      const name = isBot ? chat.bot : (message.name || chat.user || 'user');
      const row = el('div', `chat-msg ${isBot ? 'is-bot' : 'is-user'}`);
      // Picture for the bot, an icon for the user, else the name's first letter.
      const avatar = el('span', 'chat-avatar');
      avatar.setAttribute('aria-hidden', 'true');
      if (isBot && SHOT_PATH.test(String(chat.botAvatar))) {
        const img = el('img');
        img.src = chat.botAvatar;
        img.alt = '';
        img.draggable = false;
        avatar.classList.add('has-picture');
        avatar.append(img);
      } else if (!isBot && ICON_NAME.test(String(chat.userIcon))) {
        avatar.append(el('span', `icon icon-${chat.userIcon}`));
      } else {
        avatar.textContent = name.slice(0, 1).toUpperCase();
      }
      const bubble = el('div', 'chat-bubble');
      const label = el('p', 'chat-name', name);
      if (isBot) label.append(el('span', 'chat-app', 'APP'));
      const text = el('div', 'chat-text');
      chatTokens(message.text).forEach((tokens) => {
        const line = el('p', tokens.length ? 'chat-line' : 'chat-line chat-gap');
        tokens.forEach((token) => {
          if (token.style === 'bold') line.append(el('strong', null, token.text));
          else if (token.style === 'code') line.append(el('code', null, token.text));
          else line.append(document.createTextNode(token.text));
        });
        text.append(line);
      });
      bubble.append(label, text);
      row.append(avatar, bubble);
      return row;
    };

    const start = (box, chat) => {
      const log = $('.chat-log', box);
      const toggle = $('.chat-toggle', box);
      const sceneLabel = $('.chat-scene', box);
      const steps = chatScript(chat.scenes);
      if (!steps.length) return;

      // Reduced motion: the whole transcript, no animation.
      if (prefersReducedMotion()) {
        chat.scenes.forEach((scene, i) => {
          if (i) log.append(el('p', 'chat-divider', scene.label || ''));
          scene.messages.forEach((message) => log.append(messageEl(message, chat)));
        });
        sceneLabel.textContent = 'transcript';
        toggle.hidden = true;
        return;
      }

      const typing = el('p', 'chat-typing', `${chat.bot} is typing`);
      typing.append(el('span', 'chat-dots', '…'));
      let position = 0;
      let timer = 0;
      let paused = false;
      let visible = false;
      let active = false;
      let unfinished = null; // the message currently streaming in, if any

      const wait = (fn, ms) => { timer = window.setTimeout(fn, ms); };
      const toBottom = () => { log.scrollTop = log.scrollHeight; };

      const reveal = (row, done) => {
        const lines = $$('.chat-line', row);
        if (lines.length < 2) { done(); return; }
        lines.slice(1).forEach((line) => { line.hidden = true; });
        let shown = 1;
        const more = () => {
          if (shown >= lines.length) { done(); return; }
          lines[shown].hidden = false;
          shown += 1;
          toBottom();
          wait(more, LINE_MS);
        };
        wait(more, LINE_MS);
      };

      const play = () => {
        if (paused || !visible) { active = false; return; }
        active = true;
        const step = steps[position];
        if (step.index === 0) { // start of a scene: clear the previous one
          log.replaceChildren();
          sceneLabel.textContent = chat.scenes[step.scene].label || '';
        }
        const show = () => {
          typing.remove();
          const row = messageEl(step.message, chat);
          log.append(row);
          unfinished = row;
          toBottom();
          const after = () => {
            unfinished = null;
            position = (position + 1) % steps.length;
            wait(play, step.hold);
          };
          if (step.message.from === 'bot') reveal(row, after); else after();
        };
        wait(() => {
          if (!step.typing) { show(); return; }
          log.append(typing);
          toBottom();
          wait(show, step.typing);
        }, step.delay);
      };

      // Stopping keeps everything already shown. Only a half-streamed message is
      // removed, and that step starts over when the replay resumes.
      const halt = () => {
        window.clearTimeout(timer);
        typing.remove();
        if (unfinished) { unfinished.remove(); unfinished = null; }
        active = false;
      };
      const resume = () => { if (!active && !paused && visible) play(); };

      toggle.addEventListener('click', () => {
        paused = !paused;
        toggle.textContent = paused ? 'play' : 'pause';
        toggle.setAttribute('aria-pressed', String(paused));
        if (paused) halt(); else resume();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) halt(); else resume();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) resume(); else halt();
        }, { threshold: 0.3 }).observe(box);
      } else {
        visible = true;
        play();
      }
    };

    return {
      register: (box, chat) => pending.push([box, chat]),
      init: () => { pending.splice(0).forEach(([box, chat]) => start(box, chat)); },
    };
  })();

  /* ==========================================================================
     3. Render — builds list sections from PORTFOLIO_DATA
     ========================================================================== */

  const render = (() => {
    const pendingEl = (tag, text) => el(tag, 'pending', text);

    const social = ({ profile = {} }) => {
      const parts = [];
      const github = safeUrl(profile.github);
      if (github) parts.push(externalLink(github, 'github', ''));

      const linkedin = safeUrl(profile.linkedin);
      if (linkedin) {
        parts.push(externalLink(linkedin, 'linkedin', ''));
      } else {
        const pending = el('span', 'social-pending', 'linkedin');
        pending.title = 'coming soon';
        pending.append(el('span', 'visually-hidden', ' (coming soon)'));
        parts.push(pending);
      }

      if (profile.discord) {
        const button = el('button', 'social-copy');
        button.type = 'button';
        button.dataset.copy = profile.discord;
        button.setAttribute('aria-label', `Copy Discord username ${profile.discord}`);
        const label = el('span', null, 'discord');
        label.setAttribute('data-copy-label', '');
        button.append(label);
        parts.push(button);
      }

      return parts.flatMap((node, i) => {
        if (i === 0) return [node];
        const sep = el('span', 'social-sep', '/');
        sep.setAttribute('aria-hidden', 'true');
        return [sep, node];
      });
    };

    const rowHead = (title, meta, current) => {
      const head = el('div', 'row-head');
      const titleEl = el('p', 'row-title');
      if (current) {
        const dot = el('span', 'live-dot');
        dot.title = 'current';
        titleEl.append(dot);
      }
      titleEl.append(document.createTextNode(joinParts([title])));
      head.append(titleEl, el('span', 'row-meta', meta));
      return head;
    };

    const rowBullets = (li, item) => {
      const bullets = (item.bullets || []).filter(Boolean);
      if (!bullets.length) return;
      const ul = el('ul', 'row-bullets');
      bullets.forEach((text) => ul.append(el('li', null, text)));
      li.append(ul);
    };

    const experience = ({ experience: items = [] }) => items.map((item) => {
      const li = el('li');
      li.append(rowHead(item.title, item.dates, item.current), el('p', 'row-sub', item.org));
      rowBullets(li, item);
      return li;
    });

    const education = ({ education: items = [] }) => items.map((item) => {
      const li = el('li');
      li.append(rowHead(item.school, item.dates, item.current), el('p', 'row-sub', item.degree));
      rowBullets(li, item);
      return li;
    });

    const stack = ({ stack: groups = [] }) => groups.map((group) => {
      const box = el('div', 'stack-group card');
      const list = el('ul', 'stack-items');
      (group.items || []).forEach((item) => {
        const li = el('li', 'stack-item');
        if (item.icon) li.append(stackIconEl(item.icon));
        li.append(el('span', null, item.name));
        list.append(li);
      });
      box.append(el('h3', 'stack-group-title', group.category), list);
      return box;
    });

    // Screenshots as a device pair: a browser frame with a phone overlapping its
    // corner. Each frame is a button that opens the shot larger (see shotViewer).
    const deviceFrames = (shots) => {
      const media = el('div', `project-media${shots.length === 1 ? ` only-${shots[0].kind}` : ''}`);
      shots.forEach((shot) => {
        const frame = el('button', `device device-${shot.kind}`);
        frame.type = 'button';
        frame.dataset.shot = shot.src;
        frame.dataset.shotLabel = shot.label;
        frame.setAttribute('aria-label', `Enlarge screenshot: ${shot.label}`);
        if (shot.kind === 'desktop') {
          const bar = el('span', 'device-bar');
          bar.setAttribute('aria-hidden', 'true');
          bar.append(el('span'), el('span'), el('span'));
          frame.append(bar);
        }
        const img = el('img');
        img.src = shot.src;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        frame.append(img);
        media.append(frame);
      });
      return media;
    };

    // A small architecture diagram: a row of boxes joined by arrows, with an
    // optional data store hanging under the middle box.
    const diagramEl = (diagram) => {
      const nodeEl = (node, extra = '') => {
        const box = el('div', `diagram-node${extra}`);
        box.append(el('strong', null, node.name));
        if (node.note) box.append(el('span', null, node.note));
        return box;
      };
      const wrap = el('div', 'diagram');
      wrap.setAttribute('role', 'img');
      const names = diagram.flow.map((node) => node.name).join(' to ');
      wrap.setAttribute('aria-label', `Architecture: ${names}${diagram.store ? `; data stored in ${diagram.store.name}` : ''}`);
      const flow = el('div', 'diagram-flow');
      diagram.flow.forEach((node, i) => {
        if (i) flow.append(el('span', 'diagram-arrow', '⇄'));
        flow.append(nodeEl(node));
      });
      wrap.append(flow);
      if (diagram.store && diagram.store.name) {
        const store = el('div', 'diagram-store');
        store.append(el('span', 'diagram-arrow', '⇅'), nodeEl(diagram.store, ' is-store'));
        wrap.append(store);
      }
      [...wrap.children].forEach((child) => child.setAttribute('aria-hidden', 'true'));
      return wrap;
    };

    // The chat window shell; chatReplay (below) plays the conversation into it.
    const chatWindow = (chat) => {
      const media = el('div', 'project-media is-chat');
      const box = el('div', 'chat');
      const bar = el('div', 'chat-bar');
      const toggle = el('button', 'chat-toggle', 'pause');
      toggle.type = 'button';
      bar.append(el('span', 'chat-title', chat.bot), el('span', 'chat-scene'), toggle);
      const log = el('div', 'chat-log');
      log.setAttribute('role', 'log');
      log.setAttribute('aria-live', 'off');
      log.setAttribute('aria-label', `Replay of a real conversation with ${chat.bot}`);
      log.tabIndex = 0;
      box.append(bar, log);
      media.append(box);
      chatReplay.register(box, chat);
      return media;
    };

    const projects = ({ projects: items = [] }) => items.map((project) => {
      const li = el('li', 'project card');
      const head = el('div', 'project-head');
      const metaClass = project.status === 'done' ? 'project-meta' : 'badge';
      head.append(el('h3', 'project-title', project.title), el('span', metaClass, project.meta));
      li.append(head);

      const body = el('div', 'project-body');
      const info = el('div', 'project-info');
      info.append(project.description
        ? el('p', 'project-desc', project.description)
        : pendingEl('p', 'Details coming soon.'));

      const tags = (project.tags || []).filter(Boolean);
      if (tags.length) {
        const ul = el('ul', 'tags');
        ul.setAttribute('aria-label', 'Technologies');
        tags.forEach((tag) => ul.append(el('li', 'tag', tag)));
        info.append(ul);
      }

      const links = project.links || {};
      const source = safeUrl(links.source);
      const live = safeUrl(links.live);
      if (source || live) {
        const row = el('p', 'project-links');
        if (source) row.append(externalLink(source, 'source ↗'));
        if (live) row.append(externalLink(live, 'live ↗'));
        info.append(row);
      }
      body.append(info);

      if (project.diagram && Array.isArray(project.diagram.flow) && project.diagram.flow.length) {
        info.append(diagramEl(project.diagram));
      }

      const shots = projectShots(project);
      if (shots.length) {
        li.classList.add('has-media');
        body.append(deviceFrames(shots));
      } else if (chatScript(project.chat && project.chat.scenes).length) {
        li.classList.add('has-media', 'has-chat');
        body.append(chatWindow(project.chat));
      }
      li.append(body);
      return li;
    });

    const certifications = ({ certifications: items = [], certificationsPending }) => {
      if (!items.length) return [pendingEl('li', certificationsPending || 'Coming soon.')];
      return items.map((cert) => {
        const li = el('li');
        li.append(rowHead(cert.title, joinParts([cert.issuer, cert.date]), false));
        const link = safeUrl(cert.link);
        if (link) li.append(externalLink(link, 'view credential ↗', 'text-link row-link'));
        return li;
      });
    };

    // A card with `video` is a Live Photo: a silent looping clip with the still as poster.
    const liveVideo = (item) => {
      const video = el('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = item.photo;
      video.disablePictureInPicture = true;
      ['muted', 'loop', 'playsinline'].forEach((attr) => video.setAttribute(attr, ''));
      video.setAttribute('aria-hidden', 'true');
      [[item.video, 'video/mp4'], [item.video.replace(/\.mp4$/, '.webm'), 'video/webm']].forEach(([src, type]) => {
        const source = el('source');
        source.src = src;
        source.type = type;
        video.append(source);
      });
      return video;
    };

    const outside = ({ outside: items = [] }) => items.map((item) => {
      const li = el('li', 'deck-card');
      if (safeLocalVideo(item.video)) { li.append(liveVideo(item)); return li; }
      const img = el('img');
      img.src = item.photo;
      img.alt = ''; // decorative: the section description speaks for the photos
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      li.append(img);
      return li;
    });

    const renderers = { social, experience, education, stack, projects, certifications, outside };

    const showLoadError = (container) => {
      if (container.dataset.render === 'social') return; // static github link stays
      const tag = container.tagName === 'UL' || container.tagName === 'OL' ? 'li' : 'p';
      container.replaceChildren(pendingEl(tag, 'Content failed to load.'));
    };

    // The static markup carries the email as a no-JS fallback; data.js wins.
    const applyEmail = ({ profile = {} }) => {
      const email = typeof profile.email === 'string' ? profile.email.trim() : '';
      if (!safeUrl(`mailto:${email}`)) return;
      $$('a[data-email]').forEach((link) => { link.href = `mailto:${email}`; });
      $$('button[data-email]').forEach((button) => {
        button.dataset.copy = email;
        button.setAttribute('aria-label', `Copy email address ${email}`);
        const label = $('[data-copy-label]', button);
        if (label) label.textContent = email;
      });
    };

    const init = (data) => {
      const containers = $$('[data-render]');
      const errors = validateData(data);
      if (errors.length) console.warn('[portfolio] data.js problems:', errors);
      if (!data) { containers.forEach(showLoadError); return; }
      applyEmail(data);
      containers.forEach((container) => {
        const build = renderers[container.dataset.render];
        if (!build) return;
        try {
          container.replaceChildren(...build(data));
        } catch (error) {
          console.error(`[portfolio] failed to render ${container.dataset.render}`, error);
          showLoadError(container);
        }
      });
    };

    return { init };
  })();

  /* ==========================================================================
     4. Theme — light/dark with a circular View Transition ripple
     ========================================================================== */

  const theme = (() => {
    const button = $('.theme-toggle');
    const current = () => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    const syncButton = () => {
      if (!button) return;
      const t = current();
      $('.theme-label', button).textContent = `[MODE: ${t.toUpperCase()}]`;
      const icon = $('.theme-icon', button);
      icon.classList.toggle('icon-sun', t === 'light');
      icon.classList.toggle('icon-moon', t === 'dark');
      button.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
    };

    const apply = (t) => {
      root.setAttribute('data-theme', t);
      storage.set('localStorage', 'theme', t);
      syncButton();
    };

    const toggle = (origin = button) => {
      const next = current() === 'dark' ? 'light' : 'dark';
      if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
        apply(next);
        return;
      }
      const rect = origin ? origin.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty('--ripple-x', `${x}px`);
      root.style.setProperty('--ripple-y', `${y}px`);
      root.style.setProperty('--ripple-radius', `${radius}px`);
      document.startViewTransition(() => apply(next));
    };

    const init = () => {
      syncButton();
      if (button) button.addEventListener('click', () => toggle(button));
    };

    return { init, toggle };
  })();

  /* ==========================================================================
     5. Layout — tablet rail, desktop collapse, mobile drawer
     ========================================================================== */

  const layout = (() => {
    const body = document.body;
    const sidebar = $('#sidebar');
    const menuToggle = $('.menu-toggle');
    const backdrop = $('.backdrop');
    const collapseToggle = $('.collapse-toggle');
    const mobileQuery = window.matchMedia('(max-width: 639.98px)');
    const tabletQuery = window.matchMedia('(min-width: 640px) and (max-width: 1024px)');
    let collapsed = storage.get('localStorage', 'sidebar-collapsed') === 'true';

    const updateRail = () => {
      body.classList.toggle('is-rail', tabletQuery.matches || (!mobileQuery.matches && collapsed));
      if (!collapseToggle) return;
      collapseToggle.textContent = collapsed ? '[>>]' : '[<<]';
      collapseToggle.setAttribute('aria-expanded', String(!collapsed));
      collapseToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    };

    const isDrawerOpen = () => sidebar.classList.contains('is-open');

    const openDrawer = () => {
      sidebar.classList.add('is-open');
      backdrop.hidden = false;
      body.classList.add('drawer-open');
      menuToggle.setAttribute('aria-expanded', 'true');
      menuToggle.setAttribute('aria-label', 'Close navigation');
      const first = $('.nav-link', sidebar);
      if (first) first.focus();
    };

    const closeDrawer = ({ restoreFocus = true } = {}) => {
      if (!isDrawerOpen()) return;
      sidebar.classList.remove('is-open');
      backdrop.hidden = true;
      body.classList.remove('drawer-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
      if (restoreFocus) menuToggle.focus();
    };

    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !isDrawerOpen() || !mobileQuery.matches) return;
      const focusables = [menuToggle, ...$$('a[href], button:not([disabled])', sidebar)]
        .filter((node) => node.getClientRects().length > 0);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const init = () => {
      updateRail();
      tabletQuery.addEventListener('change', updateRail);
      mobileQuery.addEventListener('change', () => {
        updateRail();
        if (!mobileQuery.matches) closeDrawer({ restoreFocus: false });
      });
      if (collapseToggle) {
        collapseToggle.addEventListener('click', () => {
          collapsed = !collapsed;
          storage.set('localStorage', 'sidebar-collapsed', String(collapsed));
          updateRail();
        });
      }
      menuToggle.addEventListener('click', () => (isDrawerOpen() ? closeDrawer() : openDrawer()));
      backdrop.addEventListener('click', () => closeDrawer());
      sidebar.addEventListener('click', (event) => {
        if (mobileQuery.matches && event.target.closest('a[href^="#"]')) closeDrawer({ restoreFocus: false });
      });
      document.addEventListener('keydown', trapFocus);
    };

    return { init, closeDrawer };
  })();

  /* ==========================================================================
     6. Nav — active section tracking and programmatic jumps
     ========================================================================== */

  const nav = (() => {
    const links = $$('.nav-link');

    const setActive = (id) => {
      links.forEach((link) => {
        const on = link.dataset.section === id;
        link.classList.toggle('is-active', on);
        if (on) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    const jumpTo = (id) => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      setActive(id);
    };

    // The last section is short and may never cross the band; pin it at page bottom.
    const atBottom = () => window.innerHeight + window.scrollY >= root.scrollHeight - 4;
    const lastId = SECTIONS[SECTIONS.length - 1].id;

    const init = () => {
      setActive(SECTIONS[0].id);
      if (!('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver((entries) => {
        if (atBottom()) { setActive(lastId); return; }
        entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
      }, { rootMargin: '-35% 0px -60% 0px' });
      SECTIONS.forEach(({ id }) => {
        const section = document.getElementById(id);
        if (section) observer.observe(section);
      });

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          if (atBottom()) setActive(lastId);
        });
      }, { passive: true });
    };

    return { init, jumpTo };
  })();

  /* ==========================================================================
     7. chimken — Alt+K mini game drawn over the pure engine in section 1
     ========================================================================== */

  const game = (() => {
    const dialog = $('.game');
    const canvas = $('.game-canvas');
    const scoreEl = $('.game-score');
    const closeButton = $('.game-close');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    const HI_KEY = 'chimken-hi';
    const PIXEL = 2;
    const SPRITES = {
      runA: CHIMKEN_SPRITE,
      runB: CHIMKEN_WALK_B,
      air: CHIMKEN_AIR,
      bugSmall: ['X.....X', '.X...X.', '..XXX..', '.XXXXX.', 'XXXXXXX', '.X.X.X.'],
      moon: [
        '..XXXX...', '.XXX.....', 'XXX......', 'XX.......', 'XX.......',
        'XX.......', 'XXX......', '.XXX.....', '..XXXX...',
      ],
      sun: [
        '....X....', '.X.....X.', '...XXX...', '..X...X..', 'X.X...X.X',
        '..X...X..', '...XXX...', '.X.....X.', '....X....',
      ],
      crown: ['X.X.X', 'XXXXX'],
      cloud: ['....XXXX......', '..XX....XX....', '.X........XXX.', 'X.............X', 'XXXXXXXXXXXXXXX'],
      bugLarge: [
        'X.......X', '.X.....X.', '..XXXXX..', '.XX.X.XX.',
        'XXXXXXXXX', 'XXX.X.XXX', '.XXXXXXX.', 'X.X.X.X.X',
      ],
      // The hawk flies left, toward chimken: head on the left, two wing frames.
      hawkUp: [
        '......XX....', '.....XXXX...', '....XXXX....', '.XXXXXXXXXXX',
        'XX.XXXXXXX..', '..XXXXXX....', '............',
      ],
      hawkDown: [
        '............', '.XXXXXXXXXXX', 'XX.XXXXXXX..', '..XXXXXXX...',
        '....XXXX....', '.....XXXX...', '......XX....',
      ],
      corn: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'],
    };
    let state = createChimkenState();
    let input = { jump: false, holding: false };
    let raf = 0;
    let last = 0;
    let shownScore = '';
    let returnFocus = null;
    let view = chimkenView(CHIMKEN.width, CHIMKEN.height);
    const bragButton = $('.game-brag');
    const CROWN_KEY = 'chimken-crown';
    let rival = null;
    let crowned = false;
    let newlyCrowned = false;
    let crownedThisRun = false;
    let sparks = [];
    let flashUntil = 0;
    let cornPopUntil = 0;
    let milestoneTimer = 0;
    let sky = null;
    let clock = 0;

    const pad = (n) => String(n).padStart(5, '0');
    const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();

    // Same seed every time so the sky layout is stable between opens.
    const seededRandom = (seed) => () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const fitCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth || CHIMKEN.width;
      const cssHeight = canvas.clientHeight || CHIMKEN.height;
      const w = Math.max(1, Math.round(cssWidth * ratio));
      const h = Math.max(1, Math.round(cssHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      view = chimkenView(cssWidth, cssHeight);
      if (!sky || sky.width !== view.width || sky.groundY !== view.groundY) {
        sky = buildSky(view.width, view.groundY, seededRandom(7));
      }
      const unit = (w / cssWidth) * view.scale;
      ctx.setTransform(unit, 0, 0, unit, 0, 0);
    };

    // 'X' pixels use the current fill; with `ink`, each letter gets its own colour.
    const drawSprite = (rows, x, bottom, ink) => {
      const top = bottom - rows.length * PIXEL;
      const fill = ctx.fillStyle;
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c += 1) {
          if (row[c] === '.') continue;
          if (ink) ctx.fillStyle = ink[row[c]] || fill;
          ctx.fillRect(Math.round(x) + c * PIXEL, Math.round(top) + r * PIXEL, PIXEL, PIXEL);
        }
      });
      ctx.fillStyle = fill;
    };

    // Faint plate behind a message block so stars don't twinkle through the text.
    const drawPlate = (top, bottom, width) => {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = token('--bg');
      ctx.fillRect(Math.round((view.width - width) / 2), Math.round(top), Math.round(width), Math.round(bottom - top));
      ctx.globalAlpha = 1;
    };

    const drawText = (text, y, font, fill) => {
      ctx.font = font;
      ctx.fillStyle = fill;
      ctx.textAlign = 'center';
      ctx.fillText(text, view.width / 2, y);
    };

    // Wraps a drifting x back to the right edge once it leaves on the left.
    const drift = (x, factor, travel, margin) => {
      const span = view.width + margin * 2;
      return ((((x + margin - travel * factor) % span) + span) % span) - margin;
    };

    const drawSky = (fg, muted) => {
      const dark = root.getAttribute('data-theme') === 'dark';
      const reduced = prefersReducedMotion();
      const travel = reduced ? 0 : state.distance;
      const bottomOf = (body, rows) => body.y + rows.length * PIXEL;
      if (dark) {
        ctx.fillStyle = fg;
        const shift = skyOffset(travel, 0.08, view.width);
        sky.stars.forEach((star) => {
          ctx.globalAlpha = starAlpha(star.phase, clock, reduced);
          const x = (star.x - shift + view.width) % view.width;
          ctx.fillRect(Math.round(x), star.y, star.size, star.size);
        });
        ctx.globalAlpha = 0.85;
        drawSprite(SPRITES.moon, drift(sky.moon.x, 0.02, travel, 30), bottomOf(sky.moon, SPRITES.moon));
      } else {
        ctx.fillStyle = muted;
        ctx.globalAlpha = 0.5;
        drawSprite(SPRITES.sun, drift(sky.sun.x, 0.02, travel, 30), bottomOf(sky.sun, SPRITES.sun));
        ctx.globalAlpha = 0.35;
        sky.clouds.forEach((cloud) => {
          drawSprite(SPRITES.cloud, drift(cloud.x, 0.25, travel, 40), bottomOf(cloud, SPRITES.cloud));
        });
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      fitCanvas();
      const fg = token('--fg');
      const muted = token('--fg-muted');
      const ground = view.groundY;
      ctx.clearRect(0, 0, view.width, view.height);

      drawSky(fg, muted);

      ctx.fillStyle = muted;
      ctx.fillRect(0, ground, view.width, 1);
      const offset = state.distance % 12;
      for (let x = -offset; x < view.width; x += 12) ctx.fillRect(x, ground + 5, 2, 1);

      ctx.fillStyle = fg;
      const flap = !prefersReducedMotion() && Math.floor(clock * 6) % 2 === 1;
      state.obstacles.forEach((bug) => {
        const base = ground - (bug.y || 0);
        if (bug.kind === 'pair' || bug.kind === 'swarm') {
          const count = bug.kind === 'pair' ? 2 : 3;
          for (let n = 0; n < count; n += 1) drawSprite(SPRITES.bugSmall, bug.x + n * 18, base);
        } else if (bug.kind === 'hawkLow' || bug.kind === 'hawkHigh') {
          drawSprite(flap ? SPRITES.hawkDown : SPRITES.hawkUp, bug.x, base);
        } else {
          drawSprite(bug.kind === 'large' ? SPRITES.bugLarge : SPRITES.bugSmall, bug.x, base);
        }
      });
      (state.pickups || []).forEach((corn) => drawSprite(SPRITES.corn, corn.x, ground - corn.y));

      const { chimken } = state;
      let sprite = SPRITES.runA;
      if (!chimken.onGround) sprite = SPRITES.air;
      else if (state.status === 'running' && Math.floor(state.distance / 30) % 2) sprite = SPRITES.runB;
      const ink = {};
      Object.entries(CHIMKEN_INK).forEach(([letter, name]) => { ink[letter] = token(name); });
      drawSprite(sprite, CHIMKEN.chimkenX, ground - chimken.y, ink);
      if (crowned) {
        const headTop = ground - chimken.y - sprite.length * PIXEL;
        drawSprite(SPRITES.crown, CHIMKEN.chimkenX + 6 * PIXEL, headTop - 1);
      }

      if (clock < cornPopUntil) {
        ctx.globalAlpha = Math.min(1, (cornPopUntil - clock) * 2.5);
        ctx.font = '12px "Geist Mono", ui-monospace, monospace';
        ctx.fillStyle = fg;
        ctx.textAlign = 'left';
        ctx.fillText(`+${CHIMKEN.corn.points}`, CHIMKEN.chimkenX + 28, ground - chimken.y - 20);
        ctx.globalAlpha = 1;
      }

      sparks.forEach((spark) => {
        ctx.globalAlpha = Math.min(1, spark.life);
        ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
      });
      ctx.globalAlpha = 1;

      // Messages sit in the middle of the playfield (tall on phones).
      const mid = Math.min(view.height / 2, ground - 60);
      const mono = '12px "Geist Mono", ui-monospace, monospace';
      const pixel = '18px "Geist Pixel", "Geist Mono", monospace';
      if (state.status === 'ready') {
        drawText('press space or tap to start', mid, mono, muted);
        if (rival) drawText(`beat ${rival.owner}'s high score: ${rival.highScore}`, mid + 20, mono, muted);
      }
      if (state.status === 'running' && clock < flashUntil && rival) {
        drawText(`passed ${rival.owner}!`, mid - 20, '14px "Geist Pixel", "Geist Mono", monospace', fg);
      }
      if (state.status === 'over') {
        const { beat, lines } = gameOverSummary(state, rival, crownedThisRun);
        const [title, stats, ...rest] = lines;
        const hint = rest.pop();
        ctx.font = mono;
        const widest = Math.max(...lines.map((text) => ctx.measureText(text).width));
        drawPlate(mid - 54, mid + 46, Math.min(view.width, widest + 32));
        drawText(title, mid - 32, pixel, fg);
        drawText(stats, mid - 8, mono, muted);
        if (rest.length) drawText(rest[0], mid + 12, mono, beat ? fg : muted);
        drawText(hint, mid + 36, mono, muted);
      }

      const score = `${pad(state.score)}  HI ${pad(state.hi)}`;
      if (score !== shownScore) { scoreEl.textContent = score; shownScore = score; }
    };

    const frame = (now) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock = now / 1000;
      const wasOver = state.status === 'over';
      const previousScore = state.score;
      const previousBonus = state.bonus || 0;
      state = stepChimken(state, dt, input);
      input.jump = false;
      if ((state.bonus || 0) > previousBonus) cornPopUntil = clock + 0.7;
      if (state.status === 'running' && milestone(previousScore, state.score)) {
        scoreEl.classList.add('is-milestone');
        window.clearTimeout(milestoneTimer);
        milestoneTimer = window.setTimeout(() => scoreEl.classList.remove('is-milestone'), 900);
      }
      if (wasOver && state.status === 'running') { bragButton.hidden = true; crownedThisRun = false; }
      if (passedRival(previousScore, state.score, rival)) {
        sparks = sparks.concat(spawnSparks(view.width / 2, view.height * 0.3, 28));
        flashUntil = clock + 1.6;
        if (!crowned) {
          crowned = true;
          newlyCrowned = true;
          storage.set('localStorage', CROWN_KEY, '1');
        }
      }
      sparks = stepSparks(sparks, dt);
      if (!wasOver && state.status === 'over') {
        storage.set('localStorage', HI_KEY, String(state.hi));
        paintScoreRow();
        crownedThisRun = newlyCrowned;
        newlyCrowned = false;
        const summary = gameOverSummary(state, rival, crownedThisRun);
        announce(summary.lines.slice(0, -1).join('. '));
        if (summary.beat) {
          bragButton.dataset.copy = bragText(state.score, rival, `${window.location.origin}${window.location.pathname}`);
          bragButton.hidden = false;
        }
      }
      draw();
      raf = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      input = { jump: false, holding: false };
    };

    const isOpen = () => Boolean(dialog && dialog.open);

    // Sidebar: "you / ck" scores, kept in step with the saved best.
    const paintScoreRow = () => {
      const row = $('.score-row');
      const line = scoreRow(Number(storage.get('localStorage', HI_KEY)), rival);
      if (!row || !line) return;
      $('.score-label', row).textContent = line.label;
      $('.score-value', row).textContent = line.value;
      row.setAttribute('aria-label', line.hint);
      row.hidden = false;
    };

    const open = () => {
      if (!dialog || !ctx || typeof dialog.showModal !== 'function' || isOpen()) return;
      returnFocus = document.activeElement;
      layout.closeDrawer({ restoreFocus: false });
      const saved = Math.floor(Number(storage.get('localStorage', HI_KEY)));
      state = createChimkenState(Number.isFinite(saved) && saved > 0 ? saved : 0);
      shownScore = '';
      crowned = storage.get('localStorage', CROWN_KEY) === '1';
      newlyCrowned = false;
      crownedThisRun = false;
      sparks = [];
      flashUntil = 0;
      bragButton.hidden = true;
      dialog.showModal();
      canvas.focus();
      stop();
      raf = window.requestAnimationFrame(frame);
    };

    const close = () => { if (isOpen()) dialog.close(); };

    const press = () => { input.jump = true; input.holding = true; };
    const release = () => { input.holding = false; };
    const isJumpKey = (event) => event.key === ' ' || event.key === 'ArrowUp' || event.code === 'Space';

    const init = (data) => {
      const game = data && data.game;
      if (game && typeof game.owner === 'string' && Number.isInteger(game.highScore) && game.highScore >= 0) {
        rival = { owner: game.owner, highScore: game.highScore };
      }
      const triggers = $$('.game-trigger, .yard-chimken, .score-row');
      if (!dialog || !ctx || typeof dialog.showModal !== 'function') {
        triggers.forEach((button) => { button.hidden = true; });
        return;
      }
      triggers.forEach((button) => button.addEventListener('click', open));
      paintScoreRow();
      closeButton.addEventListener('click', close);
      dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
      dialog.addEventListener('keydown', (event) => {
        if (!isJumpKey(event) || event.target === closeButton) return;
        event.preventDefault();
        if (!event.repeat) press();
      });
      dialog.addEventListener('keyup', (event) => { if (isJumpKey(event)) release(); });
      canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        canvas.focus();
        press();
      });
      ['pointerup', 'pointercancel'].forEach((type) => dialog.addEventListener(type, release));
      dialog.addEventListener('close', () => {
        stop();
        if (returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length) {
          returnFocus.focus({ preventScroll: true });
        }
        returnFocus = null;
      });
    };

    return { init, open, close };
  })();

  /* ==========================================================================
     8. Keyboard shortcuts
     ========================================================================== */

  const keyboard = (() => {
    const init = () => {
      document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || event.repeat) return;
        const action = resolveShortcut(event, isTypingTarget(event.target));
        if (!action) return;
        switch (action.type) {
          case 'close':
            game.close();
            layout.closeDrawer();
            break;
          case 'game':
            event.preventDefault();
            game.open();
            break;
          case 'theme':
            theme.toggle();
            break;
          case 'jump':
            event.preventDefault();
            game.close();
            nav.jumpTo(action.id);
            break;
          default:
            break;
        }
      });
    };
    return { init };
  })();

  /* ==========================================================================
     9. Clipboard — copy email / discord with a manual-copy fallback
     ========================================================================== */

  const clipboard = (() => {
    const toast = $('.toast');
    const toastText = $('.toast-text');
    const toastInput = $('.toast-input');
    let toastTimer = 0;
    let returnFocus = null;

    const isVisible = (node) => Boolean(node) && node.getClientRects().length > 0;

    const hideToast = () => {
      toast.hidden = true;
      if (document.activeElement === toastInput && returnFocus && isVisible(returnFocus)) {
        returnFocus.focus({ preventScroll: true });
      }
      returnFocus = null;
    };

    // Visible feedback that works in rail mode, where button labels are hidden.
    // With copyText, shows a pre-selected read-only field (text inside a
    // <button> can't be selected in Firefox).
    const showToast = (message, copyText, ms, button) => {
      toastText.textContent = message;
      toastInput.hidden = !copyText;
      toast.hidden = false;
      if (copyText) {
        returnFocus = button;
        toastInput.value = copyText;
        toastInput.focus();
        toastInput.select();
      }
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(hideToast, ms);
    };

    const flashLabel = (button, message) => {
      const label = $('[data-copy-label]', button);
      if (!isVisible(label)) return false;
      if (label.dataset.original === undefined) label.dataset.original = label.textContent;
      label.textContent = message;
      window.clearTimeout(Number(button.dataset.timer));
      button.dataset.timer = String(window.setTimeout(() => {
        label.textContent = label.dataset.original;
      }, 1500));
      return true;
    };

    const copy = async (button) => {
      const text = button.dataset.copy;
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(text);
        if (!flashLabel(button, 'copied!')) showToast(`copied ${text}`, null, 1500, button);
        announce(`Copied ${text} to clipboard`);
      } catch {
        showToast('press ctrl+c to copy', text, 6000, button);
        announce(`Press Control plus C to copy ${text}`);
      }
    };

    const init = () => {
      if (!toast || !toastText || !toastInput) return;
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-copy]');
        if (button) copy(button);
      });
      toastInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideToast();
      });
    };

    return { init };
  })();

  /* ==========================================================================
     10. Scroll reveal — fade + slide up once, staggered in lists
     ========================================================================== */

  const reveal = (() => {
    const SINGLE = ['.github-panel', '.contact-intro', '.terminal', '.terminal-chips', '.divider', '.about-bio', '.timeline-block'];
    const STAGGERED = ['.stack-group', '.project', '#certifications .rows > li', '.outside-text', '.deck'];
    const STAGGER_MS = 60;
    const STAGGER_CAP = 8;

    const init = () => {
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });

      const track = (node, delay = 0) => {
        node.classList.add('reveal');
        if (delay) node.style.setProperty('--stagger', `${delay}ms`);
        observer.observe(node);
      };

      $$(SINGLE.join(',')).forEach((node) => track(node));
      STAGGERED.forEach((selector) => {
        $$(selector).forEach((node, i) => track(node, Math.min(i, STAGGER_CAP) * STAGGER_MS));
      });
    };

    return { init };
  })();

  /* ==========================================================================
     11. Pixel photo — 8×8 tiles dissolve profile.jpg into light.jpg
     ========================================================================== */

  const pixelPhoto = (() => {
    const GRID = 8;
    const STEP_MS = 6;
    const IMAGE = './assets/light.jpg';
    const IMAGE_W = 639;
    const IMAGE_H = 780;

    const init = () => {
      const photo = $('.hero-photo');
      if (!photo) return;
      const delays = revealDelays(GRID * GRID, prefersReducedMotion() ? 0 : STEP_MS);
      const fragment = document.createDocumentFragment();
      computeTiles(GRID, IMAGE_W, IMAGE_H).forEach((tile, i) => {
        const node = el('span', 'pixel-tile');
        node.setAttribute('aria-hidden', 'true');
        node.style.top = `${tile.top}%`;
        node.style.left = `${tile.left}%`;
        node.style.width = `${tile.size}%`;
        node.style.height = `${tile.size}%`;
        node.style.backgroundImage = `url("${IMAGE}")`;
        node.style.backgroundSize = `${tile.bgSize[0]}% ${tile.bgSize[1]}%`;
        node.style.backgroundPosition = `${tile.bgPos[0]}% ${tile.bgPos[1]}%`;
        node.style.setProperty('--delay', `${delays[i]}ms`);
        fragment.append(node);
      });
      photo.append(fragment);

      // Touch devices have no hover: tap toggles the reveal.
      const noHover = window.matchMedia('(hover: none)');
      photo.addEventListener('click', () => {
        if (noHover.matches) photo.classList.toggle('is-revealed');
      });

      const preload = () => { const img = new Image(); img.src = IMAGE; };
      if (document.readyState === 'complete') preload();
      else window.addEventListener('load', preload, { once: true });
    };

    return { init };
  })();

  /* ==========================================================================
     13. GitHub contributions — dot calendar under the stack, hidden on failure
     ========================================================================== */

  const githubGraph = (() => {
    const API = 'https://github-contributions-api.jogruber.de/v4';
    const CELL = 14;
    const DOT = 10;
    const TIMEOUT_MS = 5000;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const svgEl = (tag, attrs) => {
      const node = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };

    // With `placeholder`, draws the empty grid shown while loading: same size
    // as the real graph, no labels or tooltips.
    const draw = (graph, days, placeholder = false) => {
      const weeks = buildContributionWeeks(days);
      const width = weeks.length * CELL;
      const height = 7 * CELL;
      // Scales to the panel width: the whole year always fits, never scrolls.
      const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
      svg.setAttribute('aria-label', placeholder ? 'Loading GitHub contributions' : 'GitHub contribution activity over the last year');
      weeks.forEach((week, col) => {
        week.forEach((d, row) => {
          if (!d) return;
          const dot = svgEl('circle', {
            cx: col * CELL + CELL / 2,
            cy: row * CELL + CELL / 2,
            r: dotRadius(d.level, DOT),
            fill: 'currentColor',
          });
          if (d.level === 0) dot.setAttribute('class', 'github-dot-empty');
          if (!placeholder) {
            const title = svgEl('title', {});
            title.textContent = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
            dot.append(title);
          }
          svg.append(dot);
        });
      });
      const months = el('div', 'github-months');
      months.setAttribute('aria-hidden', 'true');
      (placeholder ? [] : monthLabels(weeks)).forEach(({ col, label }) => {
        const tag = el('span', 'github-month', label);
        tag.style.left = `${(col / weeks.length) * 100}%`;
        months.append(tag);
      });
      graph.replaceChildren(months, svg);
    };

    const load = async (panel, username) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(`${API}/${encodeURIComponent(username)}?y=last`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseContributions(await response.json());
        if (!parsed) throw new Error('Unusable contributions payload');
        draw($('.github-graph', panel), parsed.days);
        $('.github-total', panel).textContent =
          `${parsed.total.toLocaleString('en-US')} contribution${parsed.total === 1 ? '' : 's'} in the last year`;
      } catch {
        // Keep the panel and its empty grid: collapsing it would shift the page.
        $('.github-total', panel).textContent = 'contributions unavailable right now';
      } finally {
        window.clearTimeout(timer);
      }
    };

    const init = (data) => {
      const panel = $('.github-panel');
      const profile = (data && data.profile) || {};
      const username = typeof profile.githubUsername === 'string' ? profile.githubUsername.trim() : '';
      if (!panel || !username || typeof fetch !== 'function' || typeof AbortController !== 'function') return;

      const link = $('.github-user', panel);
      link.href = `https://github.com/${encodeURIComponent(username)}`;
      link.textContent = `@${username} ↗`;

      // Show the panel at its final size immediately, with an empty grid.
      draw($('.github-graph', panel), skeletonDays(Date.now()), true);
      $('.github-total', panel).textContent = 'loading contributions…';
      panel.hidden = false;

      const section = document.getElementById('stack');
      if (!('IntersectionObserver' in window) || !section) { load(panel, username); return; }
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load(panel, username);
      }, { rootMargin: '400px 0px' });
      observer.observe(section);
    };

    return { init };
  })();

  /* ==========================================================================
     14. Outside the IDE — tap / swipe / arrow-key photo deck
     ========================================================================== */

  const photoDeck = (() => {
    const HOLD_MS = 300;
    const LEAVE_MS = 320;

    const init = (data) => {
      const section = document.getElementById('outside');
      const deck = $('.deck');
      const cards = $$('.deck-card');
      if (!section || !deck) return;
      if (!cards.length) { section.hidden = true; return; }

      const intro = $('.outside-intro', section);
      if (data && typeof data.outsideIntro === 'string' && data.outsideIntro.trim()) intro.textContent = data.outsideIntro;
      else intro.hidden = true;

      const counter = $('.deck-count', section);
      let index = 0;
      let busy = false;
      let inView = false;

      // Live Photo cards loop only while on top, on screen, and motion is allowed.
      const syncVideos = () => {
        cards.forEach((card, i) => {
          const video = $('video', card);
          if (!video) return;
          const play = inView && i === index && !prefersReducedMotion();
          if (play) {
            if (video.preload !== 'auto') video.preload = 'auto';
            const attempt = video.play();
            if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {}); // autoplay blocked: poster stays
          } else if (!video.paused) {
            video.pause();
          }
        });
      };
      let holdTimer = 0;
      let start = null;

      const layout = () => {
        cards.forEach((card, i) => {
          const depth = cardDepth(i, index, cards.length);
          const style = cardStyle(depth, i);
          card.style.transform = `translateY(${style.y}px) rotate(${style.rotate}deg) scale(${style.scale})`;
          card.style.zIndex = String(style.z);
          card.style.opacity = style.visible ? '1' : '0';
          card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
        });
        counter.textContent = `${index + 1} / ${cards.length}`;
        syncVideos();
      };

      const go = (direction) => {
        if (busy || cards.length < 2) return;
        const top = cards[index];
        const finish = () => {
          top.classList.remove('is-leaving', 'is-leaving-back');
          index = deckStep(index, cards.length, direction);
          layout();
          busy = false;
        };
        if (prefersReducedMotion()) { finish(); return; }
        busy = true;
        top.classList.add(direction > 0 ? 'is-leaving' : 'is-leaving-back');
        window.setTimeout(finish, LEAVE_MS);
      };

      const endHold = () => {
        window.clearTimeout(holdTimer);
        deck.classList.remove('is-color');
      };

      deck.addEventListener('pointerdown', (event) => {
        start = { x: event.clientX, y: event.clientY, t: Date.now() };
        holdTimer = window.setTimeout(() => deck.classList.add('is-color'), HOLD_MS);
      });
      deck.addEventListener('pointerup', (event) => {
        const wasHold = deck.classList.contains('is-color');
        endHold();
        if (!start || wasHold) { start = null; return; }
        const action = gestureAction(event.clientX - start.x, event.clientY - start.y);
        start = null;
        if (action === 'tap' || action === 'next') go(1);
        else if (action === 'prev') go(-1);
      });
      ['pointercancel', 'pointerleave'].forEach((type) => deck.addEventListener(type, () => { endHold(); start = null; }));
      deck.addEventListener('contextmenu', (event) => event.preventDefault());
      deck.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          go(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(-1);
        }
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          syncVideos();
        }, { threshold: 0.25 }).observe(deck);
      }
      layout();
    };

    return { init };
  })();

  /* ==========================================================================
     15. Get in touch — terminal UI over the pure runCommand interpreter
     ========================================================================== */

  const terminal = (() => {
    const init = (data) => {
      const box = $('.terminal');
      if (!box) return;
      const screen = $('.terminal-screen', box);
      const form = $('.terminal-form', box);
      const input = $('.terminal-input', box);
      const textOf = (selector) => {
        const node = $(selector);
        return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
      };
      const history = [];
      const context = {
        data: data || {},
        history, // live reference, so `history` always sees the latest
        identity: {
          name: textOf('.hero-name'),
          title: textOf('.hero-title'),
          location: textOf('.hero-location'),
          status: box.dataset.status || null,
          bio: $$('.about-bio p').map((node) => node.textContent.replace(/\s+/g, ' ').trim()),
        },
      };
      let cursor = 0;
      input.setAttribute('autocorrect', 'off');

      // Every line is built with textContent — typed input is never parsed as HTML.
      const promptEl = () => el('span', 'terminal-ps1', TERMINAL_PROMPT.symbol);

      const lineEl = (line) => {
        const row = el('p', `terminal-line${line.kind ? ` is-${line.kind}` : ''}`);
        if (line.kind === 'cmd') row.append(promptEl());
        if (line.label) row.append(el('span', 'terminal-label', line.label));
        let body;
        if (line.href) {
          body = el('a', 'terminal-link', line.text);
          body.href = line.href;
          if (!line.href.startsWith('mailto:')) { body.target = '_blank'; body.rel = 'noopener noreferrer'; }
        } else if (line.jump) {
          body = el('a', 'terminal-link', line.text);
          body.href = `#${line.jump}`;
        } else if (line.copy) {
          body = el('button', 'terminal-link');
          body.type = 'button';
          body.dataset.copy = line.copy;
          body.title = 'Copy';
          const label = el('span', null, line.text);
          label.setAttribute('data-copy-label', '');
          body.append(label);
        } else {
          body = el('span', 'terminal-text', line.text);
        }
        row.append(body);
        return row;
      };

      // `art` lines (neofetch) render as one solid picture beside its facts, so
      // wrapping text can never pull the pixel rows apart.
      const artEl = (group) => {
        const block = el('div', 'terminal-art');
        const picture = el('pre', 'terminal-art-pic', group.map((line) => line.label).join('\n').replace(/\s+$/, ''));
        picture.setAttribute('aria-hidden', 'true');
        const info = el('div', 'terminal-art-info');
        group.filter((line) => line.text).forEach((line) => info.append(el('p', 'terminal-line', line.text)));
        block.append(picture, info);
        return block;
      };

      const print = (lines) => {
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].kind === 'art') {
            const group = [];
            while (i < lines.length && lines[i].kind === 'art') { group.push(lines[i]); i += 1; }
            i -= 1;
            screen.append(artEl(group));
          } else {
            screen.append(lineEl(lines[i]));
          }
        }
        screen.scrollTop = screen.scrollHeight;
      };

      const perform = async (action) => {
        if (!action) return;
        if (action.type === 'copy') {
          try {
            if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard API unavailable');
            await navigator.clipboard.writeText(action.text);
          } catch {
            print([{ text: "couldn't copy automatically — select the text above", kind: 'error' }]);
          }
        } else if (action.type === 'open') {
          window.location.href = action.href;
        } else if (action.type === 'jump') {
          nav.jumpTo(action.id);
        } else if (action.type === 'game') {
          game.open();
        } else if (action.type === 'theme') {
          theme.toggle();
        }
      };

      // Intro: the first time the terminal scrolls into view, `contact` types itself.
      const HINT = { text: 'type a command or tap one below. try `help`.', kind: 'muted' };
      let introDone = false;
      let introTimer = 0;
      let run = () => {};

      const finishIntro = () => {
        if (introDone) return;
        introDone = true;
        window.clearTimeout(introTimer);
        screen.removeAttribute('aria-busy');
        screen.replaceChildren();
        run('contact', { record: false });
        print([HINT]);
        screen.scrollTop = 0;
      };

      const playIntro = () => {
        const typed = el('span', 'terminal-text', '');
        const row = el('p', 'terminal-line is-cmd');
        row.append(promptEl(), typed);
        screen.replaceChildren(row);
        const word = 'contact';
        let shown = 0;
        const tick = () => {
          if (introDone) return;
          if (shown < word.length) {
            shown += 1;
            typed.textContent = word.slice(0, shown);
            introTimer = window.setTimeout(tick, 70);
          } else {
            introTimer = window.setTimeout(finishIntro, 250);
          }
        };
        introTimer = window.setTimeout(tick, 300);
      };

      run = (value, { record = true } = {}) => {
        if (!introDone) finishIntro(); // a command during the intro skips ahead
        const text = String(value).trim();
        print([{ text, kind: 'cmd' }]);
        if (!text) return;
        if (record) {
          if (history[history.length - 1] !== text) history.push(text);
          cursor = history.length;
        }
        const result = runCommand(text, context);
        if (result.clear) screen.replaceChildren();
        print(result.lines);
        perform(result.action);
      };

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        run(input.value);
        input.value = '';
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          cursor = historyStep(history, cursor, event.key === 'ArrowUp' ? -1 : 1);
          input.value = history[cursor] || '';
        } else if (event.key === 'Tab' && input.value.trim() && !event.shiftKey) {
          event.preventDefault(); // an empty prompt keeps normal Tab navigation
          const { value, options } = completeCommand(input.value.trim());
          input.value = value;
          if (options.length > 1) print([{ text: options.join('   '), kind: 'muted' }]);
        }
      });

      $$('.terminal-chip').forEach((chip) => {
        chip.addEventListener('click', () => run(chip.dataset.command));
      });

      // Clicking the screen focuses the prompt — mouse only, so phones don't pop the keyboard.
      const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
      screen.addEventListener('click', (event) => {
        if (!finePointer.matches || event.target.closest('a, button')) return;
        if (String(window.getSelection()) !== '') return;
        input.focus({ preventScroll: true });
      });

      const clock = $('.terminal-clock', box);
      if (clock) {
        const tick = () => { clock.textContent = `${manilaClock(Date.now())} PHT`; };
        tick();
        window.setInterval(tick, 20000);
      }

      const prompt = el('p', 'terminal-line is-cmd');
      prompt.append(promptEl());
      screen.replaceChildren(prompt);
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        finishIntro();
      } else {
        screen.setAttribute('aria-busy', 'true'); // don't announce each typed letter
        const observer = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          if (!introDone) playIntro();
        }, { threshold: 0.35 });
        observer.observe(box);
      }
    };

    return { init };
  })();

  /* ==========================================================================
     16. Screenshot viewer — enlarges a project shot in a dialog
     ========================================================================== */

  const shotViewer = (() => {
    const init = () => {
      const dialog = $('.shot-viewer');
      const stage = $('.shot-viewer-stage');
      if (!dialog || !stage || typeof dialog.showModal !== 'function') return;
      let returnFocus = null;

      document.addEventListener('click', (event) => {
        const frame = event.target.closest('[data-shot]');
        if (!frame) return;
        const img = el('img');
        img.src = frame.dataset.shot;
        img.alt = frame.dataset.shotLabel || '';
        stage.replaceChildren(img);
        stage.classList.toggle('is-mobile', frame.classList.contains('device-mobile'));
        returnFocus = frame;
        dialog.showModal();
      });
      $('.shot-viewer-close', dialog).addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => {
        stage.replaceChildren();
        if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
        returnFocus = null;
      });
    };
    return { init };
  })();

  /* ==========================================================================
     19. Hero yard — chimken roams under the hero, eats corn, opens the game
     ========================================================================== */

  const heroYard = (() => {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const CORN = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'];

    // One <rect> per run of same-coloured pixels; 'X' uses the current text colour.
    const spriteSvg = (rows) => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('aria-hidden', 'true');
      rows.forEach((row, y) => {
        for (const run of row.matchAll(/([^.])\1*/g)) {
          const rect = document.createElementNS(SVG_NS, 'rect');
          rect.setAttribute('x', String(run.index));
          rect.setAttribute('y', String(y));
          rect.setAttribute('width', String(run[0].length));
          rect.setAttribute('height', '1');
          if (CHIMKEN_INK[run[1]]) rect.style.fill = `var(${CHIMKEN_INK[run[1]]})`;
          svg.append(rect);
        }
      });
      return svg;
    };

    const init = () => {
      // The sidebar button shows the real chimken instead of the one-colour icon.
      $$('.game-trigger .icon-chimken').forEach((icon) => {
        const art = spriteSvg(CHIMKEN_SPRITE);
        art.classList.add('chimken-art');
        icon.replaceWith(art);
      });
      const yard = $('.hero-yard');
      const button = $('.yard-chimken');
      const corn = $('.yard-corn');
      if (!yard || !button || !corn || button.hidden) return;
      const frames = { walkA: spriteSvg(CHIMKEN_SPRITE), walkB: spriteSvg(CHIMKEN_WALK_B), peck: spriteSvg(CHIMKEN_PECK) };
      button.append(frames.walkA, frames.walkB, frames.peck);
      corn.append(spriteSvg(CORN));
      yard.hidden = false;

      let state = createRoamState(yard.clientWidth, Math.random);
      let inView = !('IntersectionObserver' in window);
      let raf = 0;
      let last = 0;

      const paint = () => {
        const still = prefersReducedMotion();
        const frame = still ? 'walkA' : roamFrame(state);
        Object.entries(frames).forEach(([name, svg]) => { svg.style.display = name === frame ? '' : 'none'; });
        button.style.translate = `${Math.round(state.x)}px 0`;
        button.classList.toggle('is-left', state.dir === -1);
        // The corn vanishes partway through the peck, as if swallowed.
        const eaten = state.mode === 'peck' && state.timer < ROAM.peck * 0.35;
        corn.hidden = still || state.cornX === null || eaten;
        if (state.cornX !== null) corn.style.left = `${Math.round(state.cornX)}px`;
      };

      const tick = (now) => {
        state = roamStep(state, (now - last) / 1000, Math.random);
        last = now;
        paint();
        raf = requestAnimationFrame(tick);
      };

      const sync = () => {
        const run = inView && !document.hidden && !prefersReducedMotion();
        if (run && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!run && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        paint();
      };

      const resize = () => { state = roamResize(state, yard.clientWidth); paint(); };
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(yard);
      else window.addEventListener('resize', resize);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(yard);
      }
      document.addEventListener('visibilitychange', sync);
      motionQuery.addEventListener('change', sync);
      sync();
    };

    return { init };
  })();

  /* ==========================================================================
     99. Boot
     ========================================================================== */

  const init = () => {
    const data = typeof PORTFOLIO_DATA !== 'undefined' ? PORTFOLIO_DATA : null;
    render.init(data);
    theme.init();
    layout.init();
    nav.init();
    game.init(data);
    keyboard.init();
    clipboard.init();
    pixelPhoto.init();
    reveal.init();
    githubGraph.init(data);
    photoDeck.init(data);
    terminal.init(data);
    shotViewer.init();
    chatReplay.init();
    heroYard.init();
    const year = $('.footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
