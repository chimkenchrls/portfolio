/* ==========================================================================
   Portfolio content — the only file to edit when updating the site.
   - Use null (never "") for anything you don't have yet; the page shows a
     "coming soon" state instead.
   - URLs must start with https://.
   - Stack icons are local simple-icons SVGs; color is the brand hex or null
     for a monochrome mark that follows the theme.
   - After editing, run: node --test tests/*.test.js
   ========================================================================== */
const PORTFOLIO_DATA = {
  profile: {
    name: "Kenneth Charles Valdez",
    title: "Aspiring DevOps Engineer",
    location: "Sariaya, Quezon, Philippines",
    bio: "A 4th-year BS Computer Science student at STI College Lucena, building side projects and learning how to make deployments smooth and scalable.",
    email: "charleskenneth129@gmail.com",
    github: "https://github.com/chimkenchrls",
    githubUsername: "chimkenchrls",
    linkedin: "https://www.linkedin.com/in/kennethcharlesvaldez",
    discord: "de4dicated",
    // Put the PDF in ./assets/ and set this to "./assets/resume.pdf" to show a
    // "Resume" button next to "Email me". null hides the button.
    resume: "./assets/resume.pdf",
  },

  // Personal introduction on More about me. A blank line starts a paragraph.
  more: {
    title: "More about me",
    intro:
      "Hey, I’m CK. I’m a computer science student building side projects and learning as I go.\n\nThis is a little space for thoughts between builds, and the places, things, and moments that recharge me away from the terminal.",
  },

  projectsPage: {
    title: "Projects",
    intro: "Side projects and practical tools, with a focus on how they’re built, shipped, and run.",
  },

  stackPage: {
    title: "Stack",
    intro: "Tools I use and explore across development, deployment, and infrastructure.",
  },

  // Writing lives on More about me. Leave body and date null until a post is
  // ready. Set both (date: YYYY-MM-DD; body: paragraphs separated by blank lines)
  // to publish it at ./?view=post&p=<slug>. Text is displayed literally.
  writing: [
    {
      slug: "keep-going",
      title: 'if (everythingFallsApart) print("keep going..");',
      excerpt: "On finding a small next step when things don’t go as planned.",
      date: null,
      body: null,
    },
  ],

  assistant: {
    // Public endpoint only. Keep the Gemini API key in the server's environment.
    // The Cloudflare Worker (worker/index.mjs). For the local Node server use "./api/chat".
    endpoint: "https://kenchrls-api.kenchrls.workers.dev/api/chat",
    // The pixel character speaks as Ken in the first person; "name" is his speaker tag.
    name: "CK",
    launcher: "Chat with me",
    title: "Chat with me",
    greeting:
      "Hey, I’m CK. Ask me about my projects, my stack, or what I’m looking for.",
    suggestions: [
      "What have you built?",
      "What’s your tech stack?",
      "Are you looking for an internship?",
    ],
  },

  // The shared poke counter. null keeps pokes private to each visitor's browser;
  // set it to the deployed Worker's HTTPS URL (…/api/pokes) to count every device.
  pokes: { endpoint: "https://kenchrls-api.kenchrls.workers.dev/api/pokes" },

  // The contact form under the terminal. Messages are emailed to me by the Worker
  // (through Resend). null hides the form and leaves the terminal and email links.
  contact: {
    endpoint: "https://kenchrls-api.kenchrls.workers.dev/api/contact",
  },

  // chimken: the site owner's high score shown as the score to beat.
  game: { owner: "ck", highScore: 3236 },

  experience: [
    {
      title: "OJT / Internship",
      org: "Actively Seeking",
      dates: "2026 — Present",
      current: true,
      bullets: [
        "Currently seeking internship opportunities to gain practical experience and contribute to real-world projects.",
      ],
    },
    {
      title: "Capstone Project",
      org: "STI College Lucena",
      dates: "2026 — Present",
      current: true,
      bullets: [
        "Thready: An AI Enhanced Web-Based Production Management System with Computer Vision for Garments Monitoring for Shiela and Joel Garments",
      ],
    },
  ],

  education: [
    {
      school: "STI College Lucena",
      degree: "Bachelor of Science in Computer Science",
      dates: "2023 — Current",
      current: true,
      bullets: [
        "Champion in Local CodeFest Competition Tagisan ng Talino 2026.",
      ],
      // Relevant coursework, shown as a short list under the degree.
      // An array of course names, or null to leave the list out.
      coursework: [
        "Platform Technology (Operating Systems)",
        "Network Technology",
        "Information Assurance & Security",
        "Database Management Systems",
        "Software Engineering",
        "Software Quality Assurance",
        "Web Development",
        "Data Structures & Algorithms",
      ],
    },
  ],

  stack: [
    // Brand colors: https://github.com/simple-icons/simple-icons/blob/master/data/simple-icons.json
    {
      category: "DevOps & Cloud",
      items: [
        { name: "GitHub Actions", icon: "githubactions", color: "#2088FF" },
        { name: "Docker + Compose", icon: "docker", color: "#2496ED" },
        { name: "Azure", icon: "microsoftazure", color: "#0078D4" },
        { name: "Caddy 2", icon: "caddy", color: "#1F88C0" },
      ],
    },
    {
      category: "Security & Identity",
      items: [
        { name: "Tailscale", icon: "tailscale", color: null },
        { name: "WireGuard", icon: "wireguard", color: "#88171A" },
      ],
    },
    {
      category: "Backend",
      items: [
        { name: "Node.js 20 (Alpine)", icon: "nodedotjs", color: "#5FA04E" },
        { name: "Java", icon: "openjdk", color: null },
        { name: "Python", icon: "python", color: "#3776AB" },
        { name: "PHP", icon: "php", color: "#777BB4" },
        { name: "Express 5", icon: "express", color: null },
        { name: "MySQL 8", icon: "mysql", color: "#4479A1" },
      ],
    },
    {
      category: "Frontend",
      items: [
        { name: "HTML", icon: "html5", color: "#E34F26" },
        { name: "TypeScript", icon: "typescript", color: "#3178C6" },
        { name: "Tailwind CSS 3", icon: "tailwindcss", color: "#06B6D4" },
        { name: "Next.js 16", icon: "nextdotjs", color: null },
        { name: "React 18.3", icon: "react", color: "#61DAFB" },
        { name: "Bootstrap", icon: "bootstrap", color: "#7952B3" },
        { name: "Vite", icon: "vite", color: "#9135FF" },
      ],
    },
    {
      category: "AI & Machine Learning",
      items: [
        { name: "Ultralytics (YOLOv8)", icon: "ultralytics", color: "#111F68" },
      ],
    },
    {
      category: "Developer Tools",
      items: [
        { name: "Git", icon: "git", color: "#F03C2E" },
        { name: "GitHub", icon: "github", color: null },
        { name: "VS Code", icon: "visualstudiocode", color: "#007ACC" },
        { name: "Vitest", icon: "vitest", color: "#00FF74" },
        { name: "Claude Code", icon: "claudecode", color: "#D97757" },
        { name: "Codex", icon: "openai", color: null },
      ],
    },
  ],

  projects: [
    {
      title: "Ambiancy",
      role: "Independent developer",
      // Case study, shown at ./?view=case&p=<slug>. Each part is plain text; a blank
      // line starts a new paragraph. Use null for a part that is not written yet.
      caseStudy: {
        problem:
          "Most of my projects were about the app. This one is about the delivery. The app is small on purpose, an ambient sound mixer, so that the work goes into how it is built, shipped and run.",
        built:
          "A React and TypeScript player that layers sounds such as rain, a fireplace and a coffee shop, with a volume for each layer, a sleep and focus timer, and a mix you can share as a link. The mix is encoded in the link itself, so sharing needs no account and no server.",
        ships:
          "The app is built into a two-stage Docker image: a Node stage builds the static files, then a small nginx image serves only those files, leaving Node and the source code behind. Docker Compose runs that container next to a second nginx container that serves the audio, so the app and its media stay separate. The live site is on Vercel, with the media bundled alongside it.",
        learned:
          "The first pass failed quietly in three places: the timer reset when you changed pages, a sound that failed to load showed nothing, and a missing file could be cached as if it were real. All three are fixed.\n\nStill open: the repository has no CI pipeline yet, and the media is bundled with the site instead of being served from object storage, which is what the design calls for.",
        pipeline: {
          oneWay: true,
          flow: [
            { name: "Source", note: "React · TypeScript · Vite" },
            { name: "Docker build", note: "Node 22 stage" },
            { name: "nginx image", note: "static files only" },
            { name: "Compose stack", note: "web + media server" },
          ],
        },
      },
      meta: "in progress",
      status: "in-progress",
      description:
        "A free ambient sound mixer. Layer sounds such as rain, a fireplace and a coffee shop, set each one's volume, and share the mix by link. Built as a DevOps portfolio project: the app is small, and the way it is built, shipped and run is the point.",
      tags: [
        "React",
        "TypeScript",
        "Vite",
        "Vitest",
        "Docker Compose",
        "nginx",
      ],
      links: {
        source: "https://github.com/chimkenchrls/ambiancy",
        live: "https://ambiancy.vercel.app",
      },
      // Screenshots live in ./assets/projects/ (desktop and/or mobile).
      media: {
        desktop: "./assets/projects/ambiancy-desktop.jpg",
        mobile: "./assets/projects/ambiancy-mobile.jpg",
      },
    },
    {
      title: "Pakisuyo Express",
      role: "Independent developer",
      // Case study, shown at ./?view=case&p=<slug>. Each part is plain text; a blank
      // line starts a new paragraph. Use null for a part that is not written yet.
      caseStudy: {
        problem:
          "Pakisuyo Express is a food and drink delivery service in Sariaya, Quezon that takes every order by hand through Facebook Messenger. I built this site as a portfolio piece, with the owner's permission, to replace that manual form with a structured order flow.",
        built:
          "A mobile-first site with one validated order form: Philippine mobile numbers, address, landmark, store, order list and payment method. The order is formatted in the layout the business already uses and handed to Messenger. A map with a draggable pin checks the location against the Sariaya boundary, a directory lists more than 150 stores sourced from OpenStreetMap, and a tap-through preview shows a possible delivery app. Nothing is stored on a server.",
        ships:
          "Every change reaches the main branch through a pull request, and the branch is protected. Three checks must pass: unit tests and builds, Playwright end-to-end tests on a phone-sized screen, and Lighthouse CI, which fails the change if the median performance score drops below 90 or accessibility below 95. Each pull request gets its own preview deploy on Netlify with the link posted on the pull request. Production deploys only the exact commit that passed, then runs smoke checks against the live site.",
        learned:
          "A risk I had to design around: the deploy job starts when CI finishes, so re-running an old CI run could have redeployed an old commit and quietly rolled the site back. The deploy now checks that the tested commit is still the newest one on main, and production deploys run one at a time.\n\nThe deploy tool is also installed from its own lockfile before the deploy token is present, so a compromised package cannot read it.",
        pipeline: {
          oneWay: true,
          flow: [
            { name: "Pull request", note: "protected main" },
            { name: "CI", note: "unit · end-to-end · Lighthouse" },
            { name: "Preview deploy", note: "Netlify, per pull request" },
            { name: "Production deploy", note: "the tested commit only" },
            { name: "Smoke checks", note: "against the live site" },
          ],
        },
      },
      meta: "2026",
      status: "in-progress",
      description:
        "A website for a local food delivery service whose orders were taken entirely by hand through Facebook Messenger. The site provides a validated order form with map-pin location capture, a directory of more than 150 stores in Sariaya and Lucena sourced from OpenStreetMap, and an interactive preview of a future delivery app.",
      tags: [
        "Vite",
        "GitHub Actions",
        "Lighthouse CI",
        "Playwright",
        "Netlify",
      ],
      links: {
        source: "https://github.com/chimkenchrls/pakisuyo-express",
        live: "https://pakisuyoexpress.netlify.app",
      },
      media: {
        desktop: "./assets/projects/pakisuyo-express-desktop.jpg",
        mobile: "./assets/projects/pakisuyo-express-mobile.jpg",
      },
    },
    {
      title: "OwlSet",
      role: "Hackathon submission · Frontend and DevOps lead",
      // Case study, shown at ./?view=case&p=<slug>. Each part is plain text; a blank
      // line starts a new paragraph. Use null for a part that is not written yet.
      caseStudy: {
        problem:
          "Freelancers agree on work in chat, and later requests grow past what was agreed. OwlSet, a team entry for the AppBuildersPH hackathon, turns a client conversation into a confirmed scope, checks new requests against it, and drafts a change proposal when a request goes beyond it.",
        built:
          "An Android app in React Native and Expo. Data stays in a local SQLite database on the phone, and the AI can run on the phone itself through llama.rn with no internet connection, using a model the user imports once. A phone with too little memory can use a model on the local network instead, or a rule-based fallback with no AI. I led the frontend and the delivery pipeline; a companion website carries an interactive demo.",
        ships:
          "One CI job runs on every push and pull request: lint, type check, tests, an Expo dependency compatibility check and a production web build. Actions are pinned to exact commits and the job has a read-only token. A separate CD workflow publishes the website to Vercel only for a commit that CI has just verified on main, from a push, in this repository, and one deploy at a time. The Android app is built as an installable APK with EAS Build.",
        learned:
          "Running a model on a phone was the hard part. Long conversations overflowed what the model could take, and calls into the native library had to be made one at a time. We capped the input, serialised access to the model, and made a failed model import leave the working model in place.",
        pipeline: {
          oneWay: true,
          flow: [
            { name: "Push or pull request", note: "main" },
            { name: "CI", note: "lint · types · tests · web build" },
            { name: "CD gate", note: "verified commit on main" },
            { name: "Vercel", note: "website + demo" },
          ],
        },
      },
      meta: "in progress",
      status: "in-progress",
      description:
        "An Android app for freelancers that turns client conversations into project scopes, checks new requests against confirmed agreements, and drafts change proposals. It stores data locally in SQLite and supports on-device AI through llama.rn, with a companion website and interactive demo.",
      tags: [
        "React Native",
        "Expo",
        "TypeScript",
        "SQLite",
        "llama.rn",
        "GitHub Actions",
        "Vercel",
      ],
      links: {
        source: "https://github.com/chimkenchrls/appbuildersph-hackathon",
        live: "https://owlsetph.vercel.app",
      },
      media: {
        desktop: "./assets/projects/owlset-desktop.jpg",
        mobile: "./assets/projects/owlset-mobile.jpg",
      },
    },
    {
      title: "Thready",
      role: "Thesis project · Frontend and DevOps lead",
      // Case study, shown at ./?view=case&p=<slug>. Each part is plain text; a blank
      // line starts a new paragraph. Use null for a part that is not written yet.
      caseStudy: {
        problem:
          "A capstone for a local garment business, Shiela and Joel Garments: one system to manage production orders, who is working on each step, and quality checks, with computer vision to count garments.",
        built:
          "A Next.js, TypeScript and Tailwind frontend, a Node.js backend, a MySQL 8 database, and a separate Python service that runs a YOLO model for garment counting. It covers production planning, orders, assigning several employees to a step, a quality-control role with reason codes, and sign-in hardening such as one-time codes, a single active session and login lockout. I led the frontend and the infrastructure.",
        ships:
          "Six containers run under Docker Compose: Caddy, a Cloudflare Tunnel connector, the frontend, the backend, MySQL and the counting service. Only Caddy publishes a port, and it is bound to the private network. Employees reach the app through the Cloudflare Tunnel, which only connects outward, so no inbound port is open to the internet. Admins reach it over Tailscale.\n\nEvery pull request runs four checks: frontend lint, tests and a dependency audit; backend tests and audit; Python tests for the counting service with the model mocked, so no GPU is needed; and validation of the Compose files. On a push to main, once all four pass, a self-hosted GitHub Actions runner on the production server pulls the commit, rebuilds and restarts the stack, and waits for the health checks. There is no SSH access from outside.",
        learned:
          "A deploy that changed only the Caddy configuration reported success while the site kept serving the old configuration, because the running container never re-read the file. From the outside it looked like a broken certificate.\n\nSeparately, after Caddy was recreated, the tunnel container could no longer find it and the public site returned 502 errors until it retried. Both containers are now restarted on every deploy, in that order, whether or not they changed.",
        pipeline: {
          oneWay: true,
          flow: [
            { name: "Pull request", note: "four checks" },
            { name: "Merge to main", note: "all checks green" },
            { name: "Self-hosted runner", note: "on the production server" },
            { name: "Compose rebuild", note: "six containers" },
            { name: "Health checks", note: "before the deploy passes" },
          ],
        },
      },
      meta: "in progress",
      status: "in-progress",
      description:
        "AI-enhanced, web-based production management system with computer vision for garment monitoring, built as a capstone project for Shiela and Joel Garments.",
      tags: [
        "TypeScript",
        "Next.js",
        "Tailwind CSS",
        "Node.js",
        "MySQL 8",
        "Docker Compose",
        "Cloudflare Tunnel",
        "Tailscale",
      ],
      links: { source: null, live: null },
      media: {
        desktop: "./assets/projects/thready-desktop.jpg",
        mobile: "./assets/projects/thready-mobile.jpg",
      },
    },
    {
      title: "AmIgo",
      role: "Independent developer",
      // Case study, shown at ./?view=case&p=<slug>. Each part is plain text; a blank
      // line starts a new paragraph. Use null for a part that is not written yet.
      caseStudy: {
        problem:
          "The aim was a Discord bot that feels like one of the group chat: it talks in casual Taglish, joins in when mentioned or called by name, and remembers things about the server instead of starting fresh with every message.",
        built:
          "A discord.js and TypeScript bot backed by Google's Gemini API. It keeps conversation memory per channel in SQLite, has commands to save, list and forget notes, a study mode, a photo roast, and a Werewolf game. A background job distils settled channel chat into durable notes, so the bot can recall them later.",
        ships:
          "GitHub Actions runs a type check and the test suite on every push and pull request, covering the game, the commands, the AI layer and the storage. The bot runs as a single Node.js process with its SQLite file beside it, and slash commands are registered with a deploy script.",
        learned:
          "A slow or unreachable Gemini used to leave a reply waiting. Requests now time out after 15 seconds, and network failures are reported as the AI being unavailable instead of a generic error.\n\nStill open: the bot is not containerised, and CI tests it but does not deploy it.",
        pipeline: {
          oneWay: true,
          flow: [
            { name: "Push or pull request", note: "any branch" },
            { name: "CI", note: "type check · tests" },
            { name: "Deploy script", note: "registers slash commands" },
            { name: "Node.js process", note: "bot + SQLite" },
          ],
        },
      },
      meta: "2026",
      status: "done",
      description:
        "AmIgo is a Discord AI bot that acts like a chaotic, performative group chat friend chatting in casual Taglish when mentioned, replied to, or called by name. Powered by Google's Gemini API with per-channel conversation memory, with a study mode, and a persistent-facts system so it can remember and recall things about the server over time.",
      tags: ["Discord.js", "TypeScript", "SQLite3", "Google Gemini API"],
      links: { source: null, live: null },
      // A real conversation with the bot, replayed in a chat window. The wording
      // is as it happened (minus the book emoji). **bold** and `code` are supported.
      chat: {
        bot: "AmIgo",
        user: "ck",
        botAvatar: "./assets/projects/amigo-avatar.png", // the bot's picture
        userIcon: "chimken", // an icon from ./assets/icons/ for my messages
        scenes: [
          {
            label: "study mode",
            messages: [
              { from: "system", text: "ck used /study" },
              {
                from: "bot",
                text: "**Study mode on.** Paste your notes or name a topic, then `@mention` me to have it explained, or say **quiz me** and I'll drill you on it. `/study` again to stop.",
              },
              { from: "user", text: "amigo explain how CI/CD works" },
              {
                from: "bot",
                text: 'CI/CD (Continuous Integration / Continuous Delivery) automates the process of building, testing, and releasing software so you can push updates quickly and safely.\n\n**Worked Example:**\nImagine you add a new "Dark Mode" button to your app on GitHub.\n1. **CI:** As soon as you push your code, an automated pipeline runs tests to make sure your new button didn\'t break existing features.\n2. **CD:** Once the tests pass, the pipeline automatically deploys the updated app to your live web server for users to see.\n\n**Quick Check:**\nIf a developer pushes code with a syntax error, at which stage—Continuous Integration (testing/building) or Continuous Deployment (releasing)—should the pipeline catch and stop the broken code?',
              },
              { from: "system", text: "ck used /study" },
              { from: "bot", text: "**Study mode off** — back to normal." },
            ],
          },
          {
            label: "banter",
            messages: [
              { from: "user", text: "hello amigo" },
              {
                from: "bot",
                text: "yo, ano'ng ganap? ako lang ba 'yung 6'0 ft, family oriented, at marunong sumagot ng po at opo dito? haha, kamusta bro?",
              },
            ],
          },
        ],
      },
      // How it fits together (from the bot's own code; no hosting claims).
      diagram: {
        flow: [
          { name: "Discord", note: "mentions · slash commands" },
          { name: "AmIgo", note: "Node.js · TypeScript · discord.js" },
          { name: "Gemini API", note: "streamed replies" },
        ],
        store: { name: "SQLite", note: "chat memory · saved notes" },
      },
    },
  ],

  // "Outside the IDE" photo deck. Photos live in ./assets/outside/.
  // outside-1 is a Live Photo: `video` loops while it is the top card
  // (an .mp4 plus a same-named .webm for browsers without H.264).
  outsideIntro:
    "Life away from the terminal. The places, things, and little moments that recharge me between builds.",
  outsideHint: {
    action: "Tap or click the stack to shuffle",
    controls: "Swipe · ← → keys · hold for color",
  },
  outside: [
    {
      photo: "./assets/outside/outside-1.jpg",
      video: "./assets/outside/outside-1.mp4",
    },
    { photo: "./assets/outside/outside-2.jpg" },
    { photo: "./assets/outside/outside-3.jpg" },
    { photo: "./assets/outside/outside-4.jpg" },
    { photo: "./assets/outside/outside-5.jpg" },
    { photo: "./assets/outside/outside-6.jpg" },
    { photo: "./assets/outside/outside-7.jpg" },
    { photo: "./assets/outside/outside-8.jpg" },
  ],

  // Add issuer logos and certificate photos in ./assets/certifications/.
  // Keep missing assets null; in-progress entries do not offer a preview.
  certifications: [
    {
      title: "AI Engineering for Developers",
      issuer: "DataCamp",
      status: "in-progress",
      date: null,
      logo: "./assets/certifications/datacamp-logo.png",
      photo: null,
      link: null,
    },
    {
      title: "Champion in Local Codefest Competition",
      issuer: "STI College Lucena",
      status: "completed",
      date: "2026",
      logo: "./assets/certifications/sti-logo.png",
      photo: "./assets/certifications/sti-codefest-original.png",
      // Crop the original photo in the viewer; keep its pixels untouched.
      photoCrop: { aspectRatio: 768 / 745, positionY: 25.1 },
      link: null,
    },
    {
      title: "Certificate of Participation on AppBuildersPH Hackathon",
      issuer: "AppBuildersPH",
      status: "completed",
      date: "2026",
      logo: "./assets/certifications/appbuildersph-logo-black.png",
      photo: "./assets/certifications/appbuildersph-certificate.png",
      link: null,
    },
  ],
  certificationsPending:
    "Currently working toward certifications. Check back soon.",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PORTFOLIO_DATA;
}
