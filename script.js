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
  const CERTIFICATION_STATUSES = ['in-progress', 'completed'];
  const POST_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Publication dates stay the same in every visitor's time zone.
  const postDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  };
  const publishedPost = (post) => Boolean(post && POST_SLUG.test(post.slug) && postDate(post.date)
    && typeof post.body === 'string' && post.body.trim());
  const postReadTime = (body) => typeof body === 'string' && body.trim()
    ? Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200)) : null;
  const CERTIFICATE_PHOTO_PATH = /^\.\/assets\/certifications\/[\w.-]+\.(jpe?g|png|webp)$/;
  const CERTIFICATE_LOGO_PATH = /^\.\/assets\/certifications\/[\w.-]+\.(svg|jpe?g|png|webp)$/;

  // A project's screenshots as [{ kind, src, label }], desktop first. Only local
  // files in ./assets/projects/ are accepted.
  const SHOT_PATH = /^\.\/assets\/projects\/[\w.-]+\.(jpe?g|png|webp)$/;
  const ICON_NAME = /^[a-z][a-z0-9-]*$/;
  const BRAND_COLOR = /^#[\da-f]{6}$/i;
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

  // A resume is a PDF inside ./assets/ or an https link; anything else is ignored.
  const safeResume = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (/^\.\/assets\/[\w.-]+\.pdf$/i.test(trimmed)) return trimmed;
    return /^https:\/\/\S+$/i.test(trimmed) ? trimmed : null;
  };

  // How far down the page the reader is, 0–1 (0 when the page does not scroll).
  const scrollProgress = (scrollY, pageHeight, viewportHeight) => {
    const range = pageHeight - viewportHeight;
    if (!(range > 0)) return 0;
    return Math.min(1, Math.max(0, scrollY / range));
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
  // chimken's 12x12 frames — drawn by the game, the sidebar button and `neofetch`.
  // K = outline, W = body, S = shaded belly, A = comb, beak and legs.
  const CHIMKEN_BODY = [
    '........A...', '.......KAK..', '.KK...KWWWK.', 'KWWK..KWKWAA', 'KWWWKKWWWWA.',
    'KWWWWWWWWWK.', 'KSWWWWWWWWK.', 'KSSWWWWWWK..', '.KSSSWWWK...', '..KKKKKK....',
  ];
  const CHIMKEN_SPRITE = [...CHIMKEN_BODY, '...A..A.....', '..AA.AA.....'];
  const CHIMKEN_WALK_B = [...CHIMKEN_BODY, '....AA......', '...AA.AA....'];
  const CHIMKEN_AIR = [...CHIMKEN_BODY, '..AA.AA.....', '............'];
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
  // Three neighbors on either side. Percentages scale with the card width.
  const fanCardStyle = (i, index, count) => {
    const depth = cardDepth(i, index, count);
    const offset = depth > Math.floor(count / 2) ? depth - count : depth;
    const distance = Math.abs(offset);
    return { x: offset * 17, y: distance ? -distance * 2.5 : 0, rotate: offset * 7, scale: 1 - distance * 0.06, z: 100 - distance, visible: distance <= 3 };
  };

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

  /* Where he looks for a finger on a touch screen, as a cell of the directions atlas
     (rows up / level / down, columns left / centre / right). `dx`, `dy` are the
     finger's offset from his face. He sits in a corner, so the true angle to a
     scrolling finger hardly changes; coarse bands of the screen make his eyes
     visibly follow it instead. */
  const touchGaze = (dx, dy, width, height) => {
    if (![dx, dy, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return 4;
    const column = dx < -0.2 * width ? 0 : dx > 0.2 * width ? 2 : 1;
    const row = dy < -0.3 * height ? 0 : dy > 0.06 * height ? 2 : 1;
    return row * 3 + column;
  };

  /* Pixel Kenneth: eight look directions with a quiet centre and stable sector edges. */
  const MASCOT_CLOCKWISE = [5, 8, 7, 6, 3, 0, 1, 2];
  const mascotDirection = (dx, dy, previous = 4) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 44) return 4;
    const angle = Math.atan2(dy, dx);
    const sector = Math.PI / 4;
    const old = MASCOT_CLOCKWISE.indexOf(previous);
    const distance = old < 0 ? Infinity : Math.abs(Math.atan2(Math.sin(angle - old * sector), Math.cos(angle - old * sector)));
    if (distance < sector / 2 + 0.12) return previous;
    return MASCOT_CLOCKWISE[(Math.round(angle / sector) + 8) % 8];
  };

  const assistantEndpoint = (value, base) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, base);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.username || url.password || url.hash || url.search) return null;
      return url.protocol === 'https:' || (local && url.protocol === 'http:') ? url.href : null;
    } catch { return null; }
  };
  const assistantHistory = (history, question) => {
    const messages = history.slice(-10).map(({ role, text }) => ({ role, text }));
    const newest = { role: 'user', text: question };
    const requestBytes = () => new TextEncoder().encode(JSON.stringify({ messages: [...messages, newest] })).byteLength;
    while (messages.length && messages[0].role !== 'user') messages.shift();
    while (messages.length && (messages.reduce((n, m) => n + m.text.length, question.length) > 18000 || requestBytes() > 32000)) messages.splice(0, 2);
    return [...messages, newest];
  };

  // Cells of the reactions atlas (3×3, left to right, top to bottom).
  const MASCOT_REACTION = { blink: 0, smile: 1, surprised: 3, wink: 4, grin: 5, sleepy: 6, doubt: 7, delighted: 8 };
  // What CK's face does for a moment in the conversation; null once the moment has
  // passed and he goes back to idling. `still` (reduced motion) holds one frame.
  const assistantPose = (mood, elapsed, still = false) => {
    const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    const react = (name) => ({ direction: 4, reaction: MASCOT_REACTION[name] });
    switch (mood) {
      case 'hello': return !still && time < 1600 ? react('delighted') : null;
      case 'asked':
        if (!still && time < 500) return react('surprised');
        // Thinking: eyes wander along the floor.
        return { direction: still ? 7 : [6, 7, 8, 7][Math.floor((time - 500) / 700) % 4], reaction: null };
      case 'talking': return react(!still && Math.floor(time / 200) % 2 ? 'surprised' : 'smile');
      case 'done': return still || time < 2600 ? react('grin') : null;
      case 'error': return react('doubt');
      case 'wink': return !still && time < 1200 ? react('wink') : null;
      default: return null;
    }
  };
  // One frame of the photo glitch: a few thin horizontal strips (top/height in % of
  // the photo) pushed sideways, some showing the alternate image. `reveal` (0–1) adds
  // one wide band of the alternate image, so at the peak of a glitch it is plainly him.
  const glitchSlices = (random = Math.random, reveal = 0) => {
    const count = 3 + Math.floor(random() * 3);
    const slices = Array.from({ length: count }, () => {
      const height = 4 + Math.floor(random() * 9);
      const shift = 2 + Math.floor(random() * 5);
      return { top: Math.floor(random() * (100 - height)), height, shift: random() < 0.5 ? -shift : shift, alt: random() < 0.5 };
    });
    if (!slices.some((slice) => slice.alt)) slices[0].alt = true;
    const amount = Math.min(1, Math.max(0, Number(reveal) || 0));
    if (amount > 0) {
      const height = Math.round(30 + amount * 45);
      // The band goes first, so the thin strips still cut across it.
      slices.unshift({ top: Math.floor(random() * (100 - height)), height, shift: random() < 0.5 ? -1 : 1, alt: true });
    }
    return slices;
  };
  // How far the page has moved from the lone hero (0) to the ordinary layout (1),
  // eased at both ends. It is complete a little before the hero has fully left.
  const coverProgress = (scrollY, heroHeight) => {
    const range = Math.max(1, (Number(heroHeight) || 0) * 0.8);
    const raw = Math.min(1, Math.max(0, (Number(scrollY) || 0) / range));
    return raw * raw * (3 - 2 * raw);
  };
  // When each part of the hero intro starts (ms): the photo's tiles drop away, the
  // name types out as the photo completes, then the remaining lines rise in turn.
  const introTimeline = (letters, extras) => {
    const count = (value) => Math.max(0, Math.floor(value) || 0);
    const nameStart = 450;
    const nameStep = 34;
    const restStart = Math.max(1100, nameStart + count(letters) * nameStep - 100);
    const restStep = 70;
    return { tileStep: 13, tileFade: 140, nameStart, nameStep, restStart, restStep, end: restStart + Math.max(0, count(extras) - 1) * restStep + 380 };
  };
  // A small seeded generator, so the night sky is the same on every visit.
  const skyRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Stars for a width × height sky: mostly small and far, a few large and near.
  // Sparse on purpose, so text is never fighting them.
  const skyStars = (width, height, seed = 7) => {
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const random = skyRandom(seed);
    return Array.from({ length: Math.min(240, Math.round((w * h) / 9000)) }, () => {
      const layer = random();
      const near = layer > 0.9;
      const mid = layer > 0.6;
      return { x: random() * w, y: random() * h, size: near ? 3 : mid ? 2 : 1, depth: near ? 1 : mid ? 0.6 : 0.3, twinkle: random() < 0.2, phase: random() * Math.PI * 2 };
    });
  };
  // Where a star is drawn: it drifts left very slowly and slides up a little as the
  // page scrolls (near stars more than far ones), wrapping at the edges.
  const skyPosition = (star, width, height, seconds, scrollY) => {
    const wrap = (value, max) => (max > 0 ? ((value % max) + max) % max : 0);
    return { x: Math.floor(wrap(star.x - seconds * 4 * star.depth, width)), y: Math.floor(wrap(star.y - scrollY * 0.06 * star.depth, height)) };
  };
  // Near stars are brighter; one in five twinkles.
  const skyAlpha = (star, seconds) => {
    const base = 0.25 + star.depth * 0.55;
    return star.twinkle ? base * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(seconds * 1.6 + star.phase))) : base;
  };
  // What is wrong with a contact message, per field (an empty object when it is fine).
  // The Worker checks again; this is only so mistakes show up before sending.
  const contactProblems = ({ name, email, message } = {}) => {
    const text = (value) => (typeof value === 'string' ? value.trim() : '');
    const problems = {};
    if (!text(name)) problems.name = 'Please enter your name.';
    if (!text(email)) problems.email = 'Please enter your email, so I can reply.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(email))) problems.email = 'That email address doesn’t look right.';
    if (!text(message)) problems.message = 'Please write a message.';
    else if (text(message).length < 10) problems.message = 'Please write a little more.';
    return problems;
  };
  // Common slips in the big mail providers' domains, and what was meant.
  const EMAIL_TYPOS = {
    'gmail.com': ['gmial.com', 'gmai.com', 'gmal.com', 'gnail.com', 'gamil.com', 'gmaill.com', 'gmail.co', 'gmail.con', 'gmail.cm', 'gmail.cmo', 'gmail.comm'],
    'yahoo.com': ['yahooo.com', 'yaho.com', 'yhoo.com', 'yahoo.co', 'yahoo.con', 'yahoo.cm'],
    'outlook.com': ['outlok.com', 'outloo.com', 'outlook.co', 'outlook.con', 'outllook.com'],
    'hotmail.com': ['hotmial.com', 'hotmai.com', 'hotmal.com', 'hotmail.co', 'hotmail.con'],
    'icloud.com': ['iclould.com', 'icoud.com', 'icloud.co', 'icloud.con'],
  };
  // The address they probably meant, or null when the domain is not a known slip.
  const emailSuggestion = (email) => {
    const value = typeof email === 'string' ? email.trim() : '';
    const at = value.lastIndexOf('@');
    if (at < 1) return null;
    const domain = value.slice(at + 1).toLowerCase();
    const meant = Object.keys(EMAIL_TYPOS).find((good) => EMAIL_TYPOS[good].includes(domain));
    return meant ? `${value.slice(0, at)}@${meant}` : null;
  };
  // Which projects use a tool: those with a tag whose words begin the tool's name
  // ("Node.js" matches "Node.js 20 (Alpine)", "React" does not match "React Native").
  const stackUses = (tool, projects) => {
    const words = (text) => String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    const name = words(tool);
    return (Array.isArray(projects) ? projects : []).filter((project) => (project.tags || []).some((tag) => {
      const tagWords = words(tag);
      return tagWords.length > 0 && tagWords.length <= name.length && tagWords.every((word, i) => word === name[i]);
    })).map((project) => project.title);
  };
  // A project's anchor on the all-projects page, e.g. "project-pakisuyo-express".
  const projectSlug = (title) => `project-${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  // Each poke gets a different face; the order loops.
  const POKE_FACES = ['surprised', 'wink', 'delighted', 'doubt', 'grin'];
  const pokeReaction = (count) => MASCOT_REACTION[POKE_FACES[(Math.max(1, Math.floor(count) || 1) - 1) % POKE_FACES.length]];
  // The pixel emote that hops above his head for each face (7×7, X = ink), plus the
  // swirl for when he has been poked dizzy.
  const POKE_EMOTES = {
    surprised: ['..XX...', '..XX...', '..XX...', '..XX...', '..XX...', '.......', '..XX...'],
    wink: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '.XXXXX.', 'XX...XX', 'X.....X'],
    delighted: ['..XXXXX', '..X...X', '..X...X', '..X...X', '.XX..XX', 'XXX.XXX', '.X...X.'],
    doubt: ['.XXXX..', 'XX..XX.', '....XX.', '...XX..', '..XX...', '.......', '..XX...'],
    grin: ['...X...', '...X...', '..XXX..', 'XXXXXXX', '..XXX..', '...X...', '...X...'],
    dizzy: ['.XXXXX.', 'X.....X', 'X.XXX.X', 'X.X.X.X', 'X.X...X', 'X.XXXX.', '.X.....'],
  };
  const pokeEmote = (count) => POKE_FACES[(Math.max(1, Math.floor(count) || 1) - 1) % POKE_FACES.length];
  // Five pokes inside two seconds make him dizzy.
  const pokeDizzy = (stamps, now) => stamps.filter((at) => now - at >= 0 && now - at <= 2000).length >= 5;
  // The saved poke count, however storage hands it back.
  const pokeCount = (stored) => {
    const n = Math.floor(Number(stored));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 9999999) : 0;
  };
  // The shared total as the server reports it; null when it is missing or nonsense.
  const pokeTotal = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  // How many characters of a reply are written out after `elapsed` ms. Long replies
  // speed up so none takes more than 4.5 s.
  const assistantTyped = (length, elapsed) => {
    const total = Math.max(0, Math.floor(length) || 0);
    if (!total) return 0;
    if (!Number.isFinite(elapsed)) return total;
    const duration = Math.min(4500, Math.max(350, total * 18));
    return Math.min(total, Math.floor((Math.max(0, elapsed) / duration) * total));
  };

  const mascotIdle = (elapsed) => {
    const clock = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    return { direction: 4, reaction: clock % 6000 >= 5800 ? 0 : null };
  };

  // Dot radius for an activity level (0–4), scaled like react-github-calendar.
  const dotRadius = (level, cellSize) => {
    const clamped = Math.min(Math.max(level, 0), 4);
    return (cellSize * (0.3 + (clamped / 4) * 0.7)) / 2;
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
      if (profile.resume != null && !safeResume(profile.resume)) errors.push('profile.resume: a ./assets/*.pdf path, an https URL, or null');
      if (!isOptionalText(profile.githubUsername)) errors.push('profile.githubUsername: text or null');
    }

    checkList('experience', data.experience, (e, p) => {
      if (!isText(e.title) || !isText(e.org) || !isText(e.dates)) errors.push(`${p}: title, org, dates required`);
      if (!Array.isArray(e.bullets)) errors.push(`${p}.bullets: must be an array`);
    });
    checkList('education', data.education, (e, p) => {
      if (!isText(e.school) || !isText(e.degree) || !isText(e.dates)) errors.push(`${p}: school, degree, dates required`);
      if (e.bullets != null && !Array.isArray(e.bullets)) errors.push(`${p}.bullets: must be an array or null`);
      if (e.coursework != null && !(Array.isArray(e.coursework) && e.coursework.every(isText))) errors.push(`${p}.coursework: an array of course names or null`);
    });
    checkList('stack', data.stack, (g, p) => {
      if (!isText(g.category)) errors.push(`${p}.category: required text`);
      checkList(`${p}.items`, g.items, (item, ip) => {
        if (!isText(item.name)) errors.push(`${ip}.name: required text`);
        if (!isOptionalText(item.icon)) errors.push(`${ip}.icon: slug or null`);
        if (item.color != null && !BRAND_COLOR.test(String(item.color))) errors.push(`${ip}.color: six-digit hex color or null`);
      });
    });
    checkList('projects', data.projects, (pr, p) => {
      if (!isText(pr.title)) errors.push(`${p}.title: required text`);
      if (!isText(pr.meta)) errors.push(`${p}.meta: required text`);
      if (!isOptionalText(pr.role)) errors.push(`${p}.role: text or null`);
      if (pr.caseStudy != null) {
        const study = pr.caseStudy;
        if (typeof study !== 'object' || !['problem', 'built', 'ships', 'learned'].every((key) => isOptionalText(study[key]))) {
          errors.push(`${p}.caseStudy: an object of text parts (problem, built, ships, learned), each text or null`);
        } else if (study.pipeline != null && !(Array.isArray(study.pipeline.flow) && study.pipeline.flow.every((node) => node && isText(node.name)))) {
          errors.push(`${p}.caseStudy.pipeline: needs flow of { name, note? }`);
        }
      }
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
      if (!isText(c.title) || !isText(c.issuer)) errors.push(`${p}: title and issuer required`);
      if (!CERTIFICATION_STATUSES.includes(c.status)) errors.push(`${p}.status: in-progress or completed`);
      if (!isOptionalText(c.date) || (c.status === 'completed' && !isText(c.date))) errors.push(`${p}.date: completed entries need a date; otherwise text or null`);
      [['photo', CERTIFICATE_PHOTO_PATH], ['logo', CERTIFICATE_LOGO_PATH]].forEach(([key, pattern]) => {
        if (c[key] != null && !pattern.test(String(c[key]))) errors.push(`${p}.${key}: a file in ./assets/certifications/ or null`);
      });
      if (c.photoCrop != null) {
        const { aspectRatio, positionY } = c.photoCrop;
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0 || aspectRatio > 3 || !Number.isFinite(positionY) || positionY < 0 || positionY > 100) {
          errors.push(`${p}.photoCrop: positive aspectRatio up to 3 and positionY from 0 to 100`);
        }
      }
      if (c.link !== undefined && !isOptionalUrl(c.link)) errors.push(`${p}.link: https URL or null`);
    });
    if (!isText(data.certificationsPending)) errors.push('certificationsPending: required text');
    if (data.more !== undefined) {
      if (!data.more || !isText(data.more.title) || !isText(data.more.intro)) errors.push('more: title and intro text required');
    }
    if (data.projectsPage !== undefined) {
      if (!data.projectsPage || !isText(data.projectsPage.title) || !isText(data.projectsPage.intro)) errors.push('projectsPage: title and intro text required');
    }
    if (data.stackPage !== undefined) {
      if (!data.stackPage || !isText(data.stackPage.title) || !isText(data.stackPage.intro)) errors.push('stackPage: title and intro text required');
    }
    if (data.blogPage !== undefined) {
      if (!data.blogPage || !isText(data.blogPage.title) || !isText(data.blogPage.intro)) errors.push('blogPage: title and intro text required');
    }
    if (data.writing !== undefined) {
      const slugs = new Set();
      checkList('writing', data.writing, (post, p) => {
        if (typeof post.slug !== 'string' || !POST_SLUG.test(post.slug) || slugs.has(post.slug)) errors.push(`${p}.slug: unique lowercase slug required`);
        slugs.add(post.slug);
        if (!isText(post.title) || !isText(post.excerpt)) errors.push(`${p}: title and excerpt text required`);
        if (!isOptionalText(post.body)) errors.push(`${p}.body: text or null`);
        if (post.date !== null && !postDate(post.date)) errors.push(`${p}.date: YYYY-MM-DD or null`);
        if (isText(post.body) && !postDate(post.date)) errors.push(`${p}: a finished post needs a publication date`);
      });
    }
    if (data.outsideIntro !== undefined && !isText(data.outsideIntro)) errors.push('outsideIntro: text');
    if (data.outsideHint !== undefined && (!data.outsideHint || !isText(data.outsideHint.action) || !isText(data.outsideHint.controls))) errors.push('outsideHint: action and controls text required');
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
      SECTIONS, padCount, safeUrl, safeResume, scrollProgress, computeTiles, revealDelays, joinParts, postDate, publishedPost, postReadTime,
      parseContributions, buildContributionWeeks, dotRadius, monthLabels, skeletonDays,
      isTypingTarget, resolveShortcut, validateData, projectShots,
      chatTokens, chatTiming, chatScript,
      CHIMKEN, createChimkenState, stepChimken, spawnGap,
      obstaclePool, spawnObstacle, hitsObstacle, milestone,
      chimkenView, buildSky, skyOffset, starAlpha,
      gameOverSummary, passedRival, bragText, scoreRow, spawnSparks, stepSparks,
      cardDepth, deckStep, cardTilt, cardStyle, fanCardStyle, gestureAction,
      TERMINAL_COMMANDS, runCommand, completeCommand, historyStep, mailtoLink,
      spriteToBlocks, CHIMKEN_SPRITE, TERMINAL_PROMPT, manilaClock,
      CHIMKEN_WALK_B, CHIMKEN_AIR, CHIMKEN_INK,
      mascotDirection, mascotIdle, touchGaze, assistantEndpoint, assistantHistory,
      MASCOT_REACTION, assistantPose, assistantTyped, pokeReaction, pokeCount, pokeTotal, POKE_EMOTES, pokeEmote, pokeDizzy, contactProblems, emailSuggestion, projectSlug, stackUses,
      skyStars, skyPosition, skyAlpha, introTimeline, coverProgress, glitchSlices,
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

  const stackIconEl = (slug, color) => {
    const span = el('span', 'icon icon-sm stack-brand');
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--icon', `url("./assets/icons/stack/${slug}.svg")`);
    if (typeof color === 'string' && BRAND_COLOR.test(color)) span.style.setProperty('--brand-color', color);
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
      // The sidebar's icon links point at the same profiles.
      $$('[data-profile-link]').forEach((link) => {
        const url = safeUrl(profile[link.dataset.profileLink]);
        if (url) link.href = url;
        else link.hidden = true;
      });
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
      const courses = (item.coursework || []).filter(Boolean);
      if (courses.length) {
        const list = el('ul', 'tags coursework');
        list.setAttribute('aria-label', 'Relevant coursework');
        courses.forEach((course) => list.append(el('li', 'tag', course)));
        li.append(el('p', 'coursework-label', 'Relevant coursework'), list);
      }
      return li;
    });

    // The Stack page: every tool on its own line with the projects that use it,
    // each linking to that project's card. Home keeps the short version below.
    const stackSheet = ({ stack: groups = [], projects: all = [] }) => {
      const tools = groups.reduce((sum, group) => sum + (group.items || []).length, 0);
      const intro = el('p', 'stack-summary', `${tools} tools across ${groups.length} areas. The ones I have shipped with link to the projects that use them.`);
      return [intro, ...groups.map((group) => {
        const items = group.items || [];
        const box = el('section', 'stack-sheet');
        const title = el('h3', 'stack-sheet-title', group.category);
        title.append(el('span', 'stack-sheet-count', String(items.length).padStart(2, '0')));
        const list = el('ul', 'stack-sheet-list');
        items.forEach((item) => {
          const li = el('li', 'stack-sheet-item');
          if (item.icon) li.append(stackIconEl(item.icon, item.color));
          li.append(el('span', 'stack-sheet-name', item.name));
          const used = el('span', 'stack-sheet-used');
          stackUses(item.name, all).forEach((name) => {
            const link = el('a', 'text-link', name);
            link.href = `./?view=projects#${projectSlug(name)}`;
            used.append(link);
          });
          if (used.childElementCount) li.append(used);
          list.append(li);
        });
        box.append(title, list);
        return box;
      })];
    };
    const stack = (data) => (root.classList.contains('view-stack') ? stackSheet(data) : stackHome(data));
    const stackHome = ({ stack: groups = [] }) => groups.map((group) => {
      const box = el('div', 'stack-group');
      const list = el('ul', 'stack-items');
      (group.items || []).forEach((item) => {
        const li = el('li', 'stack-item');
        if (item.icon) li.append(stackIconEl(item.icon, item.color));
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
      const wrap = el('div', diagram.oneWay ? 'diagram is-pipeline' : 'diagram');
      wrap.setAttribute('role', 'img');
      const names = diagram.flow.map((node) => node.name).join(' to ');
      wrap.setAttribute('aria-label', `${diagram.oneWay ? 'Pipeline' : 'Architecture'}: ${names}${diagram.store ? `; data stored in ${diagram.store.name}` : ''}`);
      const flow = el('div', 'diagram-flow');
      diagram.flow.forEach((node, i) => {
        if (i) flow.append(el('span', 'diagram-arrow', diagram.oneWay ? '↓' : '⇄'));
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

    // Home: a slim row per project, linking to its full card on the Projects page
    // (?view=projects). The first few rows show; "+ N more" reveals the rest.
    // Where a project leads: its case study when it has one, else its full card.
    const projectLink = (project) => (project.caseStudy
      ? `./?view=case&p=${projectSlug(project.title).replace('project-', '')}`
      : `./?view=projects#${projectSlug(project.title)}`);
    // The case study: up to four parts, each a heading and its paragraphs.
    const caseStudyEl = (study) => {
      const box = el('div', 'case');
      [['problem', 'The problem'], ['built', 'What I built'], ['ships', 'How it ships'], ['learned', 'What went wrong, and what changed']].forEach(([key, heading]) => {
        if (typeof study[key] !== 'string' || !study[key].trim()) return;
        const part = el('section', 'case-part');
        part.append(el('h4', 'case-title', heading));
        study[key].split(/\n\s*\n/).forEach((text) => part.append(el('p', null, text.trim())));
        if (key === 'ships' && study.pipeline && Array.isArray(study.pipeline.flow) && study.pipeline.flow.length) part.append(diagramEl(study.pipeline));
        box.append(part);
      });
      return box;
    };
    const projectRow = (project) => {
      const shots = projectShots(project);
      const avatar = project.chat && SHOT_PATH.test(String(project.chat.botAvatar)) ? project.chat.botAvatar : null;
      const picture = shots.length ? (shots.find((shot) => shot.kind === 'desktop') || shots[0]).src : avatar;
      const thumb = el('span', `project-thumb${shots.length ? '' : ' is-avatar'}`);
      thumb.setAttribute('aria-hidden', 'true');
      if (picture) {
        const img = document.createElement('img');
        img.src = picture;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        thumb.append(img);
      } else {
        thumb.textContent = String(project.title || '').slice(0, 1);
      }
      const line = el('span', 'project-line');
      line.append(el('h3', 'project-title', project.title), el('span', project.status === 'done' ? 'project-meta' : 'badge', project.meta));
      const main = el('span', 'project-main');
      main.append(line, el('span', 'project-summary', project.description || 'Details coming soon.'));
      const link = el('a', 'project-row-link');
      link.href = projectLink(project);
      link.append(thumb, main);
      const tag = (project.tags || []).find(Boolean);
      if (tag) link.append(el('span', 'project-kind', tag));
      const li = el('li', 'project-row');
      li.append(link);
      return li;
    };
    // Home: rows. The Projects page: every full card. A case study page
    // (?view=case&p=<slug>): that one project's card with its case study under it.
    const projects = ({ projects: items = [], stack = [] }) => {
      if (root.classList.contains('view-case')) {
        const wanted = `project-${new URLSearchParams(window.location.search).get('p')}`;
        const one = items.find((project) => project.caseStudy && projectSlug(project.title) === wanted);
        if (one) return [caseArticle(one, stack)];
        // An unknown ?p= is the Projects page.
        root.classList.replace('view-case', 'view-projects');
      }
      return items.map(root.classList.contains('view-projects') ? projectCard : projectRow);
    };
    // A project's screenshots or replayed chat, whichever it has.
    const projectMedia = (project) => {
      const shots = projectShots(project);
      if (shots.length) return deviceFrames(shots);
      return chatScript(project.chat && project.chat.scenes).length ? chatWindow(project.chat) : null;
    };
    // The project's tags sorted under the Stack areas they belong to; the rest under "Also".
    const builtWith = (project, stack) => {
      const rows = new Map();
      (project.tags || []).filter(Boolean).forEach((tag) => {
        const area = stack.find((group) => (group.items || []).some((item) => stackUses(item.name, [{ title: tag, tags: [tag] }]).length));
        const label = area ? area.category : 'Also';
        rows.set(label, [...(rows.get(label) || []), tag]);
      });
      const part = el('section', 'case-part');
      part.append(el('h4', 'case-title', 'Built with'));
      const list = el('dl', 'case-built');
      [...rows].sort(([a], [b]) => (a === 'Also') - (b === 'Also')).forEach(([label, tags]) => {
        const row = el('div', 'case-built-row');
        row.append(el('dt', null, label), el('dd', null, tags.join(', ')));
        list.append(row);
      });
      part.append(list);
      return rows.size ? part : null;
    };
    // A case study page: a plain article on the page, no card.
    const caseArticle = (project, stack) => {
      const li = el('li', 'case-page');
      const back = el('a', 'case-back', '← All projects');
      back.href = './?view=projects';
      li.append(back, el('h3', 'case-name', project.title));
      if (project.description) li.append(el('p', 'case-lede', project.description));

      const strip = el('div', 'case-meta');
      const who = el('p', 'case-who');
      if (project.role) who.append(el('strong', null, project.role));
      who.append(el('span', project.status === 'done' ? 'project-meta' : 'badge', project.meta));
      strip.append(who);
      const links = project.links || {};
      const source = safeUrl(links.source);
      const live = safeUrl(links.live);
      if (source || live) {
        const row = el('p', 'project-links');
        if (live) row.append(externalLink(live, 'live ↗'));
        if (source) row.append(externalLink(source, 'source ↗'));
        strip.append(row);
      }
      li.append(strip);

      const media = projectMedia(project);
      if (media) {
        const frame = el('div', 'case-media');
        frame.append(media);
        li.append(frame);
      }
      li.append(caseStudyEl(project.caseStudy));
      const built = builtWith(project, stack);
      if (built) li.lastChild.append(built);
      return li;
    };
    const projectCard = (project) => {
      const li = el('li', 'project');
      li.id = projectSlug(project.title);
      const head = el('div', 'project-head');
      const metaClass = project.status === 'done' ? 'project-meta' : 'badge';
      const title = el('h3', 'project-title', project.caseStudy ? null : project.title);
      if (project.caseStudy) {
        // The whole card opens the case study: this link is stretched over it in CSS.
        const open = el('a', 'project-open', project.title);
        open.href = projectLink(project);
        title.append(open);
      }
      head.append(title, el('span', metaClass, project.meta));
      li.append(head);
      if (project.role) li.append(el('p', 'project-role', project.role));

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

      const media = projectMedia(project);
      if (media) {
        li.classList.add('has-media');
        if (!projectShots(project).length) li.classList.add('has-chat');
        body.append(media);
      }
      li.append(body);
      return li;
    };

    const certifications = ({ certifications: items = [], certificationsPending }) => {
      if (!items.length) return [pendingEl('li', certificationsPending || 'Coming soon.')];
      return items.map((cert) => {
        const inProgress = cert.status === 'in-progress';
        const li = el('li', `certification${inProgress ? ' is-in-progress' : ''}`);
        const logo = el('span', 'certification-logo');
        logo.setAttribute('aria-hidden', 'true');
        if (typeof cert.logo === 'string' && CERTIFICATE_LOGO_PATH.test(cert.logo)) {
          const img = el('img');
          img.src = cert.logo;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          logo.append(img);
        } else {
          logo.append(el('span', 'icon icon-certifications'));
        }
        li.append(logo, el('h3', 'certification-title', cert.title), el('p', 'certification-issuer', cert.issuer));
        const status = inProgress ? 'In progress' : `Completed ${cert.date}`;
        li.append(el('p', 'certification-status', status));
        const footer = el('div', 'certification-footer');
        if (!inProgress && typeof cert.photo === 'string' && CERTIFICATE_PHOTO_PATH.test(cert.photo)) {
          const button = el('button', 'certification-action', 'View certificate');
          button.type = 'button';
          button.dataset.shot = cert.photo;
          button.dataset.shotLabel = `${cert.title} — ${cert.issuer}`;
          button.dataset.certificate = '';
          if (cert.photoCrop) {
            button.dataset.cropAspect = String(cert.photoCrop.aspectRatio);
            button.dataset.cropPosition = String(cert.photoCrop.positionY);
          }
          button.setAttribute('aria-label', `View certificate: ${cert.title}`);
          button.setAttribute('aria-haspopup', 'dialog');
          footer.append(button);
        } else if (!inProgress && safeUrl(cert.link)) {
          footer.append(externalLink(safeUrl(cert.link), 'Verify credential', 'certification-action'));
        }
        li.append(footer);
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

    const paragraphs = (text) => typeof text === 'string'
      ? text.split(/\n\s*\n/).filter((part) => part.trim()).map((part) => el('p', null, part.trim())) : [];
    const pageHeading = (content, introClass) => {
      if (!content) return [];
      const back = el('a', 'case-back', '← Home');
      back.href = './';
      const title = el('h1', 'personal-title', content.title);
      return introClass ? [back, title, el('p', introClass, content.intro)] : [back, title];
    };
    const moreHeading = ({ more }) => pageHeading(more);
    const projectsHeading = ({ projectsPage }) => pageHeading(projectsPage, 'projects-page-intro');
    const stackHeading = ({ stackPage }) => pageHeading(stackPage, 'stack-page-intro');
    const blogHeading = ({ blogPage }) => pageHeading(blogPage, 'blog-page-intro');
    const personal = ({ more, profile = {} }) => {
      if (!more) return [];
      const identity = el('div', 'personal-identity');
      const name = el('h2', 'personal-name', profile.name);
      name.id = 'personal-heading';
      identity.append(name, el('p', 'personal-role', profile.title));
      return [identity, ...paragraphs(more.intro)];
    };
    const postTime = (post) => {
      const time = el('time', 'writing-date', postDate(post.date));
      time.dateTime = post.date;
      return time;
    };
    const postArticle = (post) => {
      const item = el('li', 'writing-page');
      const article = el('article');
      const back = el('a', 'case-back', '← Blog');
      back.href = './?view=blog';
      const title = el('h1', 'writing-name', post.title);
      const body = el('div', 'writing-body');
      body.append(...paragraphs(post.body));
      article.append(back, title, postTime(post), el('p', 'writing-lede', post.excerpt), body);
      item.append(article);
      document.title = `${post.title} • CK`;
      return item;
    };
    const writingEntry = (post) => {
      const ready = publishedPost(post);
      const item = el('li', `writing-entry${ready ? '' : ' is-upcoming'}`);
      const heading = el('h3', 'writing-title');
      if (ready) {
        const link = el('a', 'writing-link', post.title);
        link.href = `./?view=post&p=${post.slug}`;
        heading.append(link);
      } else heading.textContent = post.title;
      const copy = el('div', 'writing-copy');
      copy.append(heading, el('p', 'writing-excerpt', post.excerpt));
      if (ready) copy.append(el('p', 'writing-read-time', `~${postReadTime(post.body)} min read`));
      item.append(copy, ready ? postTime(post) : el('span', 'writing-date', 'Coming soon'));
      return item;
    };
    const writingRows = (posts) => posts.length ? posts.map(writingEntry) : [pendingEl('li', 'No posts yet.')];
    const blogPreview = ({ writing: posts = [] }) => writingRows(posts.slice(0, 3));
    const writing = ({ writing: posts = [] }) => {
      if (root.classList.contains('view-post')) {
        const slug = new URLSearchParams(window.location.search).get('p');
        const post = posts.find((entry) => entry.slug === slug && publishedPost(entry));
        if (post) return [postArticle(post)];
        // Unwritten and unknown posts return to the Blog list.
        root.classList.replace('view-post', 'view-blog');
      }
      return writingRows(posts);
    };

    const renderers = { social, experience, education, stack, stackHeading, projects, projectsHeading, certifications, outside, moreHeading, personal, writing, blogHeading, blogPreview };

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

    // A "Resume" button joins "Email me" once data.js points at a PDF.
    const applyResume = ({ profile = {} }) => {
      const href = safeResume(profile.resume);
      const actions = $('.hero-actions');
      if (!href || !actions) return;
      const link = el('a', 'btn btn-secondary', 'Resume');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actions.append(link);
    };

    const init = (data) => {
      const containers = $$('[data-render]');
      const errors = validateData(data);
      if (errors.length) console.warn('[portfolio] data.js problems:', errors);
      if (!data) { containers.forEach(showLoadError); return; }
      applyEmail(data);
      applyResume(data);
      // The heading says which list this is: the selected few at home, or all of them.
      // Each page numbers and names only the sections it shows.
      const head = (id, index, label) => {
        const heading = $(`#${id}-heading`);
        if (!heading) return;
        $('.divider-index', heading).textContent = index;
        if (label) heading.lastChild.textContent = ` ${label} `;
      };
      if (/\bview-(more|post)\b/.test(root.className)) { head('outside', '01 //'); head('writing', '02 //'); head('contact', '03 //', 'Terminal'); }
      else if (/\bview-(projects|case)\b/.test(root.className)) head('projects', '01 //', 'All projects');
      else if (root.classList.contains('view-stack')) head('stack', '01 //');
      else head('contact', '07 //');
      containers.forEach((container) => {
        const build = renderers[container.dataset.render];
        if (!build) return;
        try {
          container.replaceChildren(...build(data));
          if (container.dataset.render === 'projects' && root.classList.contains('view-projects') && window.location.hash) {
            // The cards did not exist yet when the browser looked for this anchor.
            const card = document.getElementById(window.location.hash.slice(1));
            if (card) card.scrollIntoView({ block: 'start' });
          }
          if (container.dataset.render === 'projects' && !/\bview-/.test(root.className)) {
            // Home shows the first three rows; the pill reveals the rest in place.
            const extra = [...container.children].slice(3);
            const more = $('.project-more');
            if (more && extra.length) {
              extra.forEach((row) => { row.hidden = true; });
              more.textContent = `+ ${extra.length} more`;
              more.hidden = false;
              more.addEventListener('click', () => {
                extra.forEach((row) => { row.hidden = false; });
                more.hidden = true;
                $('a', extra[0]).focus();
              }, { once: true });
            }
          }
        } catch (error) {
          console.error(`[portfolio] failed to render ${container.dataset.render}`, error);
          showLoadError(container);
        }
      });
      if (root.classList.contains('view-more') && data.more) document.title = `${data.more.title} • CK`;
      if (root.classList.contains('view-projects') && data.projectsPage) document.title = `${data.projectsPage.title} • CK`;
      if (root.classList.contains('view-stack') && data.stackPage) document.title = `${data.stackPage.title} • CK`;
      if (root.classList.contains('view-blog') && data.blogPage) document.title = `${data.blogPage.title} • CK`;
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
        if (mobileQuery.matches && event.target.closest('a[href*="#"]')) closeDrawer({ restoreFocus: false });
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
      // A section this page does not show (the Projects and More about me pages show only their own): go home for it.
      if (target.offsetParent === null && /\bview-/.test(root.className)) { window.location.href = `./#${id}`; return; }
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      setActive(id);
    };

    // The last section is short and may never cross the band; pin it at page bottom.
    const atBottom = () => window.innerHeight + window.scrollY >= root.scrollHeight - 4;
    const lastId = SECTIONS[SECTIONS.length - 1].id;

    const init = () => {
      // On the Projects, Stack and More about me pages the sidebar marks the page itself, not Home.
      if (/\bview-/.test(root.className)) {
        links.forEach((link) => {
          const view = link.dataset.view;
          const active = view && (root.classList.contains(`view-${view}`)
            || (view === 'projects' && root.classList.contains('view-case'))
            || (view === 'blog' && root.classList.contains('view-post')));
          if (active) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
        return;
      }
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
      const triggers = $$('.game-trigger, .score-row');
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
    const STAGGERED = ['.stack-group', '.project', '.certification', '.outside-text', '.deck'];
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

      // Every so often the photo glitches for a little over half a second: strips
      // jump, then a wide band of the alternate image holds for a moment, then it
      // breaks up and snaps back. Not while it is being revealed
      // by hover, during the intro, off screen, in a background tab, or under
      // reduced motion.
      const base = $('.hero-photo-img', photo);
      const glitch = el('span', 'photo-glitch');
      glitch.setAttribute('aria-hidden', 'true');
      const strips = Array.from({ length: 6 }, () => glitch.appendChild(document.createElement('span')));
      if (base) base.after(glitch);
      let inView = !('IntersectionObserver' in window);
      let glitchTimer = 0;
      const clear = () => strips.forEach((strip) => { strip.style.opacity = ''; });
      const frame = (reveal) => {
        const slices = glitchSlices(Math.random, reveal);
        strips.forEach((strip, i) => {
          const slice = slices[i];
          if (!slice) { strip.style.opacity = ''; return; }
          strip.style.backgroundImage = `url("${slice.alt || !base ? IMAGE : base.currentSrc || base.src}")`;
          strip.style.clipPath = `inset(${slice.top}% 0 ${100 - slice.top - slice.height}% 0)`;
          strip.style.translate = `${slice.shift}% 0`;
          strip.style.opacity = '1';
        });
      };
      const quiet = () => !inView || document.hidden || prefersReducedMotion() || root.classList.contains('intro-play')
        || photo.matches(':hover, :focus-visible, .is-revealed');
      const plan = (delay) => {
        clearTimeout(glitchTimer);
        glitchTimer = window.setTimeout(() => {
          plan(8000 + Math.random() * 7000);
          if (quiet()) return;
          // [ms from the start, how much of the alternate image shows]
          [[0, 0], [80, 0.4], [190, 1], [430, 0.5], [530, 0]].forEach(([at, reveal]) => window.setTimeout(() => frame(reveal), at));
          window.setTimeout(clear, 620);
        }, delay);
      };
      if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(photo);
      photo.addEventListener('pointerenter', clear);
      plan(6000);

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
      const fan = root.classList.contains('view-more');
      deck.classList.toggle('is-fan', fan);
      const dots = [];
      if (fan) {
        counter.classList.add('visually-hidden');
        const choices = el('div', 'deck-dots');
        choices.setAttribute('role', 'group');
        choices.setAttribute('aria-label', 'Choose a photo');
        cards.forEach((card, i) => {
          const button = el('button', 'deck-dot');
          button.type = 'button';
          button.setAttribute('aria-label', `Show photo ${i + 1} of ${cards.length}`);
          button.append(el('span'));
          button.addEventListener('click', () => select(i));
          dots.push(button);
          choices.append(button);
        });
        deck.after(choices);
        if (data.outsideHint) {
          const hint = $('.deck-hint', section);
          hint.replaceChildren(el('span', 'deck-hint-action', data.outsideHint.action), el('br'), el('span', 'deck-hint-controls', data.outsideHint.controls));
        }
      }
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
          const style = fan ? fanCardStyle(i, index, cards.length) : cardStyle(depth, i);
          card.style.transform = fan
            ? `translate(calc(${style.x}% * var(--fan-spread, 1)), ${style.y}%) rotate(${style.rotate}deg) scale(${style.scale})`
            : `translateY(${style.y}px) rotate(${style.rotate}deg) scale(${style.scale})`;
          card.style.zIndex = String(style.z);
          card.style.opacity = style.visible ? '1' : '0';
          card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
        });
        counter.textContent = `${index + 1} / ${cards.length}`;
        dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
        syncVideos();
      };

      const select = (next) => {
        if (busy || next === index) return;
        index = next;
        layout();
        if (!prefersReducedMotion()) {
          busy = true;
          window.setTimeout(() => { busy = false; }, LEAVE_MS);
        }
      };
      const go = (direction) => {
        if (busy || cards.length < 2) return;
        if (fan) { select(deckStep(index, cards.length, direction)); return; }
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
     16. Image viewer — enlarges project shots and certificate photos
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
        const certificate = frame.hasAttribute('data-certificate');
        dialog.setAttribute('aria-label', `${certificate ? 'Certificate' : 'Screenshot'}: ${img.alt}`);
        stage.classList.toggle('is-certificate', certificate);
        const aspect = Number(frame.dataset.cropAspect);
        const position = Number(frame.dataset.cropPosition);
        const cropped = certificate && Number.isFinite(aspect) && aspect > 0 && aspect <= 3
          && Number.isFinite(position) && position >= 0 && position <= 100;
        stage.classList.toggle('is-cropped', cropped);
        if (cropped) {
          stage.style.setProperty('--photo-aspect', String(aspect));
          stage.style.setProperty('--photo-position', `${position}%`);
        }
        if (certificate) {
          img.addEventListener('error', () => {
            if (img.isConnected) stage.replaceChildren(el('p', 'image-preview-error', 'Certificate image could not load. Close this preview and try again.'));
          }, { once: true });
        }
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
     19. Portfolio assistant — floating character, private Gemini connection
     ========================================================================== */
  const portfolioAssistant = (() => {
    const init = (data) => {
      const config = data && data.assistant;
      const launcher = $('.assistant-launcher');
      const dialog = $('.assistant-dialog');
      if (!config || !launcher || !dialog || typeof dialog.showModal !== 'function') return;
      const form = $('.assistant-form', dialog);
      const input = $('#assistant-input', dialog);
      const sendButton = $('.assistant-send', dialog);
      const scene = $('.assistant-scene', dialog);
      const log = $('.assistant-log', dialog);
      const speech = $('.assistant-speech', dialog);
      const say = $('.assistant-say', dialog);
      const dots = $('.assistant-dots', dialog);
      const status = $('.assistant-status', dialog);
      const suggestions = $('.assistant-suggestions', dialog);
      const recovery = $('.assistant-recovery', dialog);
      const character = $('.assistant-character', dialog);
      const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
      const sprites = [$('.assistant-sprite', launcher), $('.assistant-sprite', character)];
      const chatButton = $('.sidebar-chat');
      const poke = $('.poke');
      const pokeButton = $('.poke-button');
      const pokeValue = $('.poke-value');
      const pokeSprite = pokeButton && $('.assistant-sprite', pokeButton);
      let opener = launcher;
      let openedOnce = false;
      let pokes = pokeCount(storage.get('localStorage', 'ck-pokes'));
      let pokeFace = null;
      let pokeUntil = 0;
      const reactions = new Image();
      reactions.src = './assets/mascot/mini-ck-reactions.webp';
      let history = [];
      let busy = false;
      let lastQuestion = null;
      let controller = null;
      let requestId = 0;
      let timer = 0;
      let pointerFrame = 0;
      let direction = 4;
      let pointerAt = -Infinity;
      let activeAt = 0;
      let mood = { name: 'idle', at: 0 };
      let spoken = config.greeting; // the full text of the speech bubble
      let spokenIsReply = true; // errors are said, but never kept in the transcript
      let typing = null;
      let greeted = false;

      $('.assistant-bubble', launcher).textContent = config.launcher;
      $('#assistant-title', dialog).textContent = config.title;
      $('.assistant-speaker', dialog).textContent = config.name;
      $('.assistant-email', dialog).href = `mailto:${data.profile.email}`;
      say.textContent = spoken;
      launcher.hidden = false;
      document.body.classList.add('has-assistant');

      const still = () => prefersReducedMotion();
      const show = (sprite, pose) => {
        const cell = pose.reaction === null ? pose.direction : pose.reaction;
        sprite.classList.toggle('is-reacting', pose.reaction !== null);
        sprite.style.backgroundPosition = `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%`;
      };
      const paint = () => {
        const now = performance.now();
        let pose = dialog.open ? assistantPose(mood.name, now - mood.at, still()) : null;
        if (!pose) {
          if (still()) pose = { direction: 4, reaction: null };
          else if (now - pointerAt < 1800) pose = { direction, reaction: null };
          else if (dialog.open && now - activeAt > 40000) pose = { direction: 4, reaction: MASCOT_REACTION.sleepy };
          else pose = mascotIdle(now);
        }
        const poked = now < pokeUntil ? { direction: 4, reaction: pokeFace } : null;
        show(sprites[dialog.open ? 1 : 0], (!dialog.open && poked) || pose);
        // The sidebar CK idles like the launcher, rests while the chat is open,
        // and pulls a face for a moment after each poke.
        if (pokeSprite) show(pokeSprite, poked || (dialog.open ? { direction: 4, reaction: null } : pose));
      };
      const setMood = (name) => {
        mood = { name, at: performance.now() };
        activeAt = mood.at;
        paint();
      };
      const syncMotion = () => {
        clearInterval(timer);
        timer = 0;
        cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
        if (!still() && !document.hidden) timer = window.setInterval(paint, 200);
        paint();
      };

      // Earlier turns scroll up above the speech bubble as a quieter transcript.
      const archive = (role, text) => {
        const item = document.createElement('div');
        item.className = `assistant-message${role === 'user' ? ' is-user' : ''}`;
        const label = document.createElement('span');
        label.className = role === 'user' ? 'visually-hidden' : 'assistant-message-label';
        label.textContent = role === 'user' ? 'You: ' : config.name;
        const content = document.createElement('span');
        content.textContent = text;
        item.append(label, content);
        log.append(item);
      };
      const toBottom = () => { scene.scrollTop = scene.scrollHeight; };
      const finishTyping = () => {
        if (!typing) return;
        cancelAnimationFrame(typing.frame);
        typing = null;
        say.textContent = spoken;
        say.classList.remove('is-typing');
        setMood('done');
        toBottom();
      };
      // CK says `text` in the bubble; `type` writes it out unless motion is off.
      const speak = (text, type = false) => {
        finishTyping();
        spoken = text;
        dots.hidden = true;
        say.hidden = false;
        if (!type || still()) {
          say.textContent = text;
          toBottom();
          return false;
        }
        const chars = Array.from(text);
        typing = { at: performance.now(), frame: 0 };
        say.classList.add('is-typing');
        const step = () => {
          if (!typing) return;
          const count = assistantTyped(chars.length, performance.now() - typing.at);
          const pinned = scene.scrollHeight - scene.scrollTop - scene.clientHeight < 48;
          say.textContent = chars.slice(0, count).join('');
          if (pinned) toBottom();
          if (count >= chars.length) finishTyping();
          else typing.frame = requestAnimationFrame(step);
        };
        step();
        return true;
      };

      const updateInput = () => {
        sendButton.disabled = busy || !input.value.trim();
        input.style.height = 'auto';
        input.style.height = `${Math.min(112, input.scrollHeight)}px`;
      };
      const setBusy = (value) => {
        busy = value;
        form.setAttribute('aria-busy', String(value));
        $$('.assistant-suggestion', suggestions).forEach((button) => { button.disabled = value; });
        $('.assistant-retry', dialog).disabled = value;
        updateInput();
      };
      const showError = (text) => {
        spokenIsReply = false;
        speak(text);
        status.textContent = text;
        recovery.hidden = false;
        setMood('error');
        toBottom();
      };
      const submit = async (question, retry = false) => {
        const text = String(question).trim();
        if (busy || !text || text.length > 2000) return;
        finishTyping();
        lastQuestion = text;
        if (!retry) {
          if (spokenIsReply) archive('assistant', spoken);
          archive('user', text);
          input.value = '';
        }
        suggestions.hidden = true;
        recovery.hidden = true;
        say.hidden = true;
        dots.hidden = false;
        status.textContent = 'Thinking…';
        setBusy(true);
        setMood('asked');
        toBottom();
        const id = ++requestId;
        controller = new AbortController();
        const timeout = window.setTimeout(() => controller && controller.abort(), 30000);
        try {
          const endpoint = assistantEndpoint(config.endpoint, window.location.href);
          if (!endpoint) throw new Error('unavailable');
          const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: assistantHistory(history, text) }),
            credentials: 'omit', signal: controller.signal,
          });
          const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
          if (id !== requestId) return;
          if (!response.ok) {
            if (body && body.code === 'NOT_CONFIGURED') throw new Error('not-configured');
            if (response.status === 429) throw new Error('busy');
            throw new Error('unavailable');
          }
          if (!body || typeof body.reply !== 'string' || !body.reply.trim() || body.reply.length > 6000) throw new Error('unavailable');
          history = [...assistantHistory(history, text), { role: 'assistant', text: body.reply }];
          spokenIsReply = true;
          status.textContent = body.reply;
          setMood(speak(body.reply, true) ? 'talking' : 'done');
        } catch (error) {
          if (id !== requestId) return;
          showError(error.name === 'AbortError' ? 'That took me too long. Try again?'
            : error.message === 'not-configured' ? 'My chat isn’t connected yet. You can still look around, or email me.'
            : error.message === 'busy' ? 'I’m getting a lot of questions right now. Try again in a minute.'
            : 'I couldn’t get that answer through. Try again, or email me.');
        } finally {
          clearTimeout(timeout);
          if (id === requestId) { controller = null; setBusy(false); }
        }
      };
      config.suggestions.forEach((question) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'assistant-suggestion';
        button.textContent = question;
        button.addEventListener('click', () => submit(question));
        suggestions.append(button);
      });
      form.addEventListener('submit', (event) => { event.preventDefault(); submit(input.value); });
      input.addEventListener('input', updateInput);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
      $('.assistant-retry', dialog).addEventListener('click', () => { if (lastQuestion) submit(lastQuestion, true); });
      // A tap on the bubble skips the typing and shows the whole answer.
      speech.addEventListener('click', finishTyping);
      const fitViewport = () => {
        if (!dialog.open || !window.visualViewport) return;
        dialog.style.setProperty('--assistant-height', `${window.visualViewport.height}px`);
        // Phones: the sheet sits on the bottom of what is visible, so above the keyboard.
        dialog.style.setProperty('--assistant-bottom', `${Math.max(0, window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height)}px`);
        dialog.classList.toggle('is-compact', window.visualViewport.height < 540);
      };
      const open = (from) => {
        opener = from;
        layout.closeDrawer({ restoreFocus: false });
        launcher.classList.add('has-opened');
        // From now on the floating CK is for poking; the sidebar's "Chat with me" reopens the chat.
        openedOnce = true;
        launcher.setAttribute('aria-label', 'Poke CK');
        launcher.removeAttribute('aria-haspopup');
        launcher.removeAttribute('aria-controls');
        document.body.classList.add('assistant-open');
        dialog.showModal();
        fitViewport();
        syncMotion();
        if (!greeted) {
          greeted = true;
          setMood(speak(config.greeting, true) ? 'talking' : 'hello');
        } else {
          setMood('hello');
        }
        toBottom();
        // Keep the phone keyboard closed until the visitor chooses to type.
        if (pointerQuery.matches) input.focus({ preventScroll: true });
      };
      // A poke squashes him down and he springs back; too many too fast and he sways.
      const squash = [{ scale: '1 1' }, { scale: '1.14 0.82', offset: 0.22 }, { scale: '0.95 1.08', offset: 0.55 }, { scale: '1 1' }];
      const sway = [0, -4, 4, -3, 3, -2, 2, 0].map((x) => ({ translate: `${x}px 0`, rotate: `${x * 1.5}deg` }));
      const spring = { duration: 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };
      const DIZZY_MS = 1600;
      let recent = [];
      let dizzyUntil = 0;
      // A small pixel drawing: one <rect> per run of ink, in the current text colour.
      const pixelIcon = (rows) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('fill', 'currentColor');
        rows.forEach((row, y) => {
          for (const run of row.matchAll(/X+/g)) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(run.index));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(run[0].length));
            rect.setAttribute('height', '1');
            svg.append(rect);
          }
        });
        return svg;
      };
      // The emote hops up from his head, holds, and fades.
      const showEmote = (host, name, hold) => {
        $$('.poke-emote', host).forEach((old) => old.remove());
        const emote = el('span', 'poke-emote');
        emote.setAttribute('aria-hidden', 'true');
        emote.dataset.emote = name;
        emote.append(pixelIcon(POKE_EMOTES[name]));
        host.append(emote);
        emote.animate([
          { opacity: 0, translate: '0 6px', scale: 0.6 },
          { opacity: 1, translate: '0 -3px', scale: 1, offset: 0.2 },
          { opacity: 1, translate: '0 -5px', scale: 1, offset: 0.75 },
          { opacity: 0, translate: '0 -11px', scale: 1 },
        ], { duration: hold, easing: 'ease-out' }).onfinish = () => emote.remove();
      };
      // With a server the number is everyone's pokes; without one it is this visitor's own.
      const pokeEndpoint = assistantEndpoint(data.pokes && data.pokes.endpoint, window.location.href);
      const pokeLabel = $('.poke-label');
      let total = null;
      let unsent = 0;
      let flushTimer = 0;
      const shownPokes = () => (total === null ? pokes : total).toLocaleString('en-US');
      const showPokes = () => {
        if (pokeValue) pokeValue.textContent = shownPokes();
        if (pokeLabel) pokeLabel.textContent = total === null ? 'Your pokes' : 'Total pokes';
      };
      const pokeRequest = (options) => fetch(pokeEndpoint, { credentials: 'omit', ...options })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => pokeTotal(body && body.total))
        .catch(() => null);
      // Taps are sent in small batches, so a burst of pokes is one request.
      const flushPokes = (keepalive = false) => {
        clearTimeout(flushTimer);
        flushTimer = 0;
        if (!pokeEndpoint || !unsent) return;
        const count = Math.min(unsent, 20);
        unsent -= count;
        pokeRequest({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count }), keepalive }).then((latest) => {
          if (latest === null) return;
          total = latest + unsent;
          showPokes();
          if (unsent) flushTimer = window.setTimeout(flushPokes, 1200);
        });
      };
      if (pokeEndpoint) {
        pokeRequest({}).then((latest) => {
          if (latest === null) return;
          total = latest + unsent;
          showPokes();
        });
        window.addEventListener('pagehide', () => flushPokes(true));
      }
      // One more poke: count it, save it, and have every visible CK pull the next face,
      // with its emote. Returns false while he is too dizzy to notice.
      const pokeOnce = (sprite, host) => {
        const now = performance.now();
        if (now < dizzyUntil) return false;
        pokes = pokeCount(pokes + 1);
        storage.set('localStorage', 'ck-pokes', String(pokes));
        if (total !== null) total += 1;
        if (pokeEndpoint) {
          unsent += 1;
          if (!flushTimer) flushTimer = window.setTimeout(flushPokes, 1200);
        }
        showPokes();
        recent = [...recent.filter((at) => now - at <= 2000), now];
        const dizzy = pokeDizzy(recent, now);
        const lasts = dizzy ? DIZZY_MS : 1100;
        if (dizzy) { recent = []; dizzyUntil = now + DIZZY_MS; }
        pokeFace = dizzy ? MASCOT_REACTION.sleepy : pokeReaction(pokes);
        pokeUntil = now + lasts;
        paint();
        window.setTimeout(paint, lasts + 20);
        if (still() || typeof sprite.animate !== 'function') return true;
        // WAAPI, so a quick second poke restarts the squash cleanly.
        sprite.style.transformOrigin = '50% 100%';
        sprite.animate(dizzy ? sway : squash, dizzy ? { duration: DIZZY_MS - 300, easing: 'ease-in-out' } : spring);
        showEmote(host, dizzy ? 'dizzy' : pokeEmote(pokes), dizzy ? DIZZY_MS : 900);
        return true;
      };
      launcher.addEventListener('click', () => {
        if (!openedOnce) { open(launcher); return; }
        if (!pokeOnce(sprites[0], launcher)) return;
        $$('.assistant-pop', launcher).forEach((old) => old.remove());
        const pop = document.createElement('span');
        pop.className = 'assistant-pop';
        pop.setAttribute('aria-hidden', 'true');
        pop.textContent = shownPokes();
        launcher.append(pop);
        if (still() || typeof pop.animate !== 'function') { window.setTimeout(() => pop.remove(), 900); return; }
        pop.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 -6px', offset: 0.25 }, { opacity: 1, translate: '0 -10px', offset: 0.75 }, { opacity: 0, translate: '0 -16px' }], { duration: 900, easing: 'ease-out' }).onfinish = () => pop.remove();
      });
      if (chatButton) {
        chatButton.hidden = false;
        chatButton.addEventListener('click', () => open(chatButton));
      }
      if (poke && pokeSprite) {
        showPokes();
        poke.hidden = false;
        pokeButton.addEventListener('click', () => {
          if (!pokeOnce(pokeSprite, poke)) return;
          if (!still() && typeof pokeValue.animate === 'function') pokeValue.animate([{ opacity: 0.4, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        });
      }
      $('.assistant-close', dialog).addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
      });
      // Native dialog handles Escape and focus trapping; suppress page shortcuts.
      dialog.addEventListener('keydown', (event) => { activeAt = performance.now(); event.stopPropagation(); });
      dialog.addEventListener('close', () => {
        finishTyping();
        if (controller) {
          requestId += 1;
          controller.abort();
          controller = null;
          setBusy(false);
          showError('I stopped that reply when you closed the chat. Ask again when you’re ready.');
        }
        document.body.classList.remove('assistant-open');
        direction = 4;
        pointerAt = -Infinity;
        syncMotion();
        // The drawer closes when the chat opens, so its button may be out of reach.
        (opener.getClientRects().length ? opener : launcher).focus({ preventScroll: true });
      });
      character.addEventListener('click', () => { if (!busy && !typing) setMood('wink'); });
      // He looks at the cursor, and on touch screens at every tap and drag.
      const lookAt = (x, y, finger = false) => {
        if (still() || document.hidden) return;
        cancelAnimationFrame(pointerFrame);
        pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          // On desktop the launcher is hidden and the sidebar CK does the looking.
          const watcher = dialog.open ? character : launcher.getClientRects().length || !pokeButton ? launcher.lastElementChild : pokeButton;
          const box = watcher.getBoundingClientRect();
          const dx = x - box.left - box.width / 2;
          const dy = y - box.top - box.height * 0.4;
          direction = finger ? touchGaze(dx, dy, window.innerWidth, window.innerHeight) : mascotDirection(dx, dy, direction);
          pointerAt = performance.now();
          activeAt = pointerAt;
          paint();
        });
      };
      const lookAtPointer = (event) => lookAt(event.clientX, event.clientY, event.pointerType === 'touch');
      window.addEventListener('pointermove', lookAtPointer, { passive: true });
      window.addEventListener('pointerdown', lookAtPointer, { passive: true });
      // A scrolling finger stops sending pointer events, but still sends touch moves,
      // so he keeps following it for the whole swipe.
      const lookAtTouch = (event) => {
        const touch = event.touches[0];
        if (touch) lookAt(touch.clientX, touch.clientY, true);
      };
      window.addEventListener('touchstart', lookAtTouch, { passive: true });
      window.addEventListener('touchmove', lookAtTouch, { passive: true });
      document.addEventListener('visibilitychange', syncMotion);
      motionQuery.addEventListener('change', () => { finishTyping(); syncMotion(); });
      window.visualViewport?.addEventListener('resize', fitViewport);
      window.visualViewport?.addEventListener('scroll', fitViewport);
      syncMotion();
    };
    return { init };
  })();

  /* ==========================================================================
     19b. chimken art — the sidebar button shows the full sprite
     ========================================================================== */

  const chimkenArt = (() => {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    // One <rect> per run of same-coloured pixels.
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
    };

    return { init };
  })();

  /* ==========================================================================
     19c. Night sky — a slow pixel starfield behind the page (dark theme only)
     ========================================================================== */
  const nightSky = (() => {
    const init = () => {
      const canvas = $('.sky');
      const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return;
      const started = performance.now();
      let stars = [];
      let width = 0;
      let height = 0;
      let ink = '#ececee';
      let frame = 0;
      let drawn = 0;
      let resizing = 0;
      let shot = null;
      let nextShot = started + 8000;
      const dark = () => root.getAttribute('data-theme') === 'dark';

      const resize = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        stars = skyStars(width, height);
      };
      // A pixel shooting star: a 2px head and a fading trail, about once every half minute.
      const shoot = (now) => {
        if (!shot && now >= nextShot) {
          shot = { at: now, x: width * (0.35 + Math.random() * 0.6), y: height * Math.random() * 0.35 };
          nextShot = now + 22000 + Math.random() * 24000;
        }
        if (!shot) return;
        const age = (now - shot.at) / 1000;
        if (age > 0.9) { shot = null; return; }
        for (let i = 0; i < 12; i++) {
          const t = age - i * 0.012;
          if (t < 0) break;
          ctx.globalAlpha = (1 - age / 0.9) * (1 - i / 12) * 0.9;
          ctx.fillRect(Math.floor(shot.x - t * 520), Math.floor(shot.y + t * 230), 2, 2);
        }
      };
      const draw = (now) => {
        const moving = !prefersReducedMotion();
        const seconds = moving ? (now - started) / 1000 : 0;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = ink;
        stars.forEach((star) => {
          const at = skyPosition(star, width, height, seconds, moving ? window.scrollY : 0);
          ctx.globalAlpha = skyAlpha(star, seconds);
          ctx.fillRect(at.x, at.y, star.size, star.size);
        });
        if (moving) shoot(now);
        ctx.globalAlpha = 1;
      };
      const loop = (now) => {
        frame = requestAnimationFrame(loop);
        if (now - drawn < 33) return; // ~30 frames a second is plenty for a slow drift
        drawn = now;
        draw(now);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        canvas.hidden = !dark();
        if (!dark()) return;
        ink = getComputedStyle(root).getPropertyValue('--fg').trim() || ink;
        draw(performance.now());
        if (!prefersReducedMotion() && !document.hidden) frame = requestAnimationFrame(loop);
      };

      resize();
      sync();
      window.addEventListener('resize', () => {
        cancelAnimationFrame(resizing);
        resizing = requestAnimationFrame(() => { resize(); sync(); });
      });
      document.addEventListener('visibilitychange', sync);
      motionQuery.addEventListener('change', sync);
      if (typeof MutationObserver === 'function') new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    };
    return { init };
  })();

  /* ==========================================================================
     19d. Cover — the hero is its own opening screen; the sidebar arrives after it
     ========================================================================== */
  const cover = (() => {
    const init = () => {
      if (!root.classList.contains('has-cover')) return;
      // Tells the <head> failsafe that this script is in charge.
      root.setAttribute('data-cover', 'ready');
      const photo = $('.hero-photo');
      const name = $('.hero-name');
      if (!photo || !name || !$('.hero') || !$('#main')) { root.classList.remove('has-cover', 'at-cover', 'intro-play'); return; }

      // The change from lone hero to ordinary page follows the scroll position:
      // the hero glides from the centre of the window to the page column while the
      // sidebar (the top bar on phones) slides in, and the floating CK fades in.
      // Scrolling back up runs it in reverse. Styles are set on the elements
      // themselves, not through a variable, so only they are restyled each frame.
      const hero = $('.hero');
      const main = $('#main');
      const sidebar = $('#sidebar');
      const topbar = $('.topbar');
      const launcher = $('.assistant-launcher');
      const wide = window.matchMedia('(min-width: 640px)');
      let queued = false;
      let hint = null;
      const sync = () => {
        queued = false;
        const amount = prefersReducedMotion() ? (window.scrollY > 4 ? 1 : 0) : coverProgress(window.scrollY, hero.offsetHeight);
        const away = 1 - amount;
        root.classList.toggle('at-cover', window.scrollY <= 4);
        if (wide.matches) {
          hero.style.translate = `${(-(parseFloat(getComputedStyle(main).marginLeft) || 0) / 2) * away}px 0`;
          if (sidebar) sidebar.style.translate = `calc(${-100 * away}% - ${48 * away}px) 0`;
        } else {
          hero.style.translate = '';
          if (sidebar) sidebar.style.translate = '';
        }
        if (topbar) topbar.style.translate = `0 ${-100 * away}%`;
        if (launcher) {
          launcher.style.opacity = String(amount);
          launcher.style.pointerEvents = amount > 0.6 ? '' : 'none';
        }
      };
      const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(sync);
      };
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      motionQuery.addEventListener('change', schedule);
      if (sidebar) sidebar.addEventListener('transitionend', schedule); // collapsing changes the column
      sync();

      hint = el('button', 'intro-hint', 'Scroll');
      hint.type = 'button';
      hint.setAttribute('aria-label', 'Scroll to the About section');
      hint.addEventListener('click', () => {
        const about = $('#about');
        if (about) about.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
      document.body.append(hint);

      // The intro plays once per load, and only when the page opens at the top.
      if (!root.classList.contains('intro-play')) return;
      const rest = $$('.hero-text > :not(.hero-name)');
      const title = name.textContent;
      if (window.scrollY > 4 || typeof name.animate !== 'function') { root.classList.remove('intro-play'); return; }
      const running = [];
      let timer = 0;
      let played = false;
      // Jump to the finished hero (also how a click skips the animation).
      const finish = () => {
        if (played) return;
        played = true;
        clearTimeout(timer);
        document.removeEventListener('pointerdown', finish);
        window.removeEventListener('keydown', finish);
        running.forEach((animation) => animation.cancel());
        $$('.intro-tiles').forEach((tiles) => tiles.remove());
        photo.style.opacity = '';
        name.textContent = title;
        name.removeAttribute('aria-label');
        name.style.opacity = '';
        root.classList.remove('intro-play');
      };
      document.addEventListener('pointerdown', finish);
      window.addEventListener('keydown', finish);

      const time = introTimeline(Array.from(title.replace(/\s/g, '')).length, rest.length);

      // 1. The photo: 64 page-coloured tiles drop away in a shuffled order.
      const tiles = el('div', 'intro-tiles');
      tiles.setAttribute('aria-hidden', 'true');
      revealDelays(64, time.tileStep).forEach((delay) => {
        const tile = document.createElement('span');
        tiles.append(tile);
        running.push(tile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: time.tileFade, delay: 80 + delay, easing: 'steps(2, end)', fill: 'forwards' }));
      });
      photo.append(tiles);
      photo.style.opacity = '1';

      // 2. The name: each letter is already in place, so nothing shifts as it types.
      name.setAttribute('aria-label', title);
      name.textContent = '';
      let letter = 0;
      title.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { name.append(' '); return; }
        const word = el('span', 'intro-word');
        word.setAttribute('aria-hidden', 'true');
        Array.from(part).forEach((character) => {
          const span = el('span', 'intro-char', character);
          word.append(span);
          running.push(span.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: time.nameStart + letter * time.nameStep, fill: 'forwards' }));
          letter += 1;
        });
        name.append(word);
      });
      name.style.opacity = '1';

      // 3. Everything else rises into place, one line after another.
      rest.forEach((node, index) => {
        running.push(node.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 380, delay: time.restStart + index * time.restStep, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' }));
      });
      timer = window.setTimeout(finish, time.end + 60);
    };
    return { init };
  })();

  /* ==========================================================================
     19e. Click burst — short rays fan out from the cursor's tip on a mouse click
     ========================================================================== */
  const clickBurst = (() => {
    // Degrees clockwise from "right": a fan over the upper-left of the arrow's tip.
    const RAYS = [165, 205, 245, 285, 325];
    const init = () => {
      const layer = el('div', 'click-layer');
      layer.setAttribute('aria-hidden', 'true');
      const topLayer = typeof layer.showPopover === 'function';
      if (topLayer) layer.setAttribute('popover', 'manual');
      document.body.append(layer);
      document.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || prefersReducedMotion() || typeof layer.animate !== 'function') return;
        // Re-show the layer so it sits above a dialog opened since the last click.
        if (topLayer) {
          try { layer.hidePopover(); } catch { /* not shown yet */ }
          try { layer.showPopover(); } catch { /* fall back to the page layer */ }
        }
        const burst = el('span', 'click-burst');
        burst.style.left = `${event.clientX}px`;
        burst.style.top = `${event.clientY}px`;
        RAYS.forEach((angle) => {
          const ray = document.createElement('span');
          burst.append(ray);
          ray.animate([
            { transform: `rotate(${angle}deg) translateX(8px) scaleX(1)`, opacity: 1 },
            { transform: `rotate(${angle}deg) translateX(17px) scaleX(0.3)`, opacity: 0 },
          ], { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
        });
        layer.append(burst);
        window.setTimeout(() => burst.remove(), 340);
      }, { passive: true });
    };
    return { init };
  })();

  /* ==========================================================================
     19f. Contact form — emails me through the Worker; falls back to the mail app
     ========================================================================== */
  const contactForm = (() => {
    const init = (data) => {
      const form = $('.contact-form');
      const endpoint = assistantEndpoint(data && data.contact && data.contact.endpoint, window.location.href);
      if (!form || !endpoint) return;
      const fields = { name: $('#contact-name', form), email: $('#contact-email', form), message: $('#contact-message', form) };
      const trap = $('#contact-website', form);
      const button = $('.contact-send', form);
      const status = $('.contact-status', form);
      const owner = data.profile.email;
      form.hidden = false;
      let sending = false;

      const values = () => ({ name: fields.name.value, email: fields.email.value, message: fields.message.value });
      const mark = (problems) => {
        Object.entries(fields).forEach(([key, field]) => {
          const problem = problems[key] || '';
          $(`#contact-${key}-error`, form).textContent = problem;
          if (problem) field.setAttribute('aria-invalid', 'true');
          else field.removeAttribute('aria-invalid');
        });
      };
      // Once a field has been flagged, clear the flag as soon as it is put right.
      Object.entries(fields).forEach(([key, field]) => {
        field.addEventListener('input', () => {
          if (field.getAttribute('aria-invalid') !== 'true' || contactProblems(values())[key]) return;
          field.removeAttribute('aria-invalid');
          $(`#contact-${key}-error`, form).textContent = '';
        });
      });
      // "Did you mean …@gmail.com?" under the email field; one click applies it.
      const suggest = $('.contact-suggest', form);
      const offer = () => {
        const better = emailSuggestion(fields.email.value);
        suggest.hidden = !better;
        suggest.textContent = better ? `Did you mean ${better}?` : '';
        suggest.dataset.email = better || '';
      };
      fields.email.addEventListener('blur', offer);
      fields.email.addEventListener('input', () => { if (!suggest.hidden) offer(); });
      suggest.addEventListener('click', () => {
        fields.email.value = suggest.dataset.email;
        fields.email.dispatchEvent(new Event('input', { bubbles: true }));
        fields.email.focus();
      });
      const say = (text, link) => {
        status.textContent = text;
        if (!link) return;
        const anchor = el('a', null, link.label);
        anchor.href = link.href;
        status.append(' ', anchor);
      };

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (sending) return;
        const message = values();
        const problems = contactProblems(message);
        mark(problems);
        offer();
        const first = Object.keys(fields).find((key) => problems[key]);
        if (first) { say(''); fields[first].focus(); return; }
        sending = true;
        button.disabled = true;
        button.textContent = 'Sending…';
        say('');
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
            body: JSON.stringify({ name: message.name.trim(), email: message.email.trim(), message: message.message.trim(), website: trap ? trap.value : '' }),
          });
          const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
          if (response.ok) {
            const replyTo = message.email.trim();
            form.reset();
            offer();
            say(`Sent. Thanks, I’ll reply to you at ${replyTo}.`);
          } else if (body && body.code === 'INVALID_EMAIL') {
            // The address cannot receive mail: say so at the field itself.
            mark({ email: body.error });
            fields.email.focus();
          } else if (response.status === 400 || response.status === 413) {
            // The Worker found something this page missed: show its wording.
            say((body && body.error) || 'Please check the form and try again.');
          } else {
            throw new Error('unavailable');
          }
        } catch {
          // Nothing they wrote is lost: the same message opens in their mail app.
          say('That didn’t go through.', { label: 'Send it from your mail app instead', href: mailtoLink(owner, `Portfolio message from ${message.name.trim()}`, message.message.trim()) });
        } finally {
          clearTimeout(timeout);
          sending = false;
          button.disabled = false;
          button.textContent = 'Send';
        }
      });
    };
    return { init };
  })();

  /* ==========================================================================
     20. Scroll aids — reading-progress line
     ========================================================================== */

  const scrollAids = (() => {
    const init = () => {
      const bar = $('.scroll-progress-bar');
      if (!bar) return;
      let queued = false;

      const paint = () => {
        queued = false;
        const page = document.documentElement;
        bar.style.transform = `scaleX(${scrollProgress(window.scrollY, page.scrollHeight, window.innerHeight)})`;
      };
      const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      };

      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      paint();
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
    portfolioAssistant.init(data);
    chimkenArt.init();
    nightSky.init();
    cover.init();
    clickBurst.init();
    contactForm.init(data);
    scrollAids.init();
    const year = $('.footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
