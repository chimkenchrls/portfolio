/* ==========================================================================
   Portfolio content — the only file to edit when updating the site.
   - Use null (never "") for anything you don't have yet; the page shows a
     "coming soon" state instead.
   - URLs must start with https://.
   - Stack icons are slugs of files in ./assets/icons/stack/ (simple-icons).
   - After editing, run: node --test tests/*.test.js
   ========================================================================== */
const PORTFOLIO_DATA = {
  profile: {
    email: "charleskenneth129@gmail.com",
    github: "https://github.com/chimkenchrls",
    githubUsername: "chimkenchrls",
    linkedin: "https://www.linkedin.com/in/kennethcharlesvaldez",
    discord: "de4dicated",
    // Put the PDF in ./assets/ and set this to "./assets/resume.pdf" to show a
    // "Resume" button next to "Email me". null hides the button.
    resume: "./assets/resume.pdf",
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
    },
    {
      school: "Sariaya Institute Inc.",
      degree: "Senior High School",
      dates: "2021 — 2023",
      current: false,
    },
    {
      school: "Sariaya Institute Inc.",
      degree: "Junior High School",
      dates: "2017 — 2023",
      current: false,
    },
    {
      school: "Jose Rizal Elementary School",
      degree: "Elementary",
      dates: "2011 — 2017",
      current: false,
    },
  ],

  stack: [
    {
      category: "DevOps & Cloud",
      items: [
        { name: "Docker + Compose", icon: "docker" },
        { name: "Azure", icon: null },
        { name: "Caddy 2", icon: "caddy" },
        { name: "GitHub Actions", icon: "githubactions" },
        { name: "Let's Encrypt (Lego ACME client)", icon: "letsencrypt" },
      ],
    },
    {
      category: "Security & Identity",
      items: [
        { name: "Tailscale", icon: "tailscale" },
        { name: "WireGuard (wg-easy)", icon: "wireguard" },
      ],
    },
    {
      category: "Backend",
      items: [
        { name: "Node.js 20 (Alpine)", icon: "nodedotjs" },
        { name: "Java", icon: "openjdk" },
        { name: "Python", icon: "python" },
        { name: "PHP", icon: "php" },
        { name: "Express 5", icon: "express" },
        { name: "MySQL 8 (mysql2)", icon: "mysql" },
        { name: "JWT", icon: "jsonwebtokens" },
        { name: "Axios", icon: "axios" },
      ],
    },
    {
      category: "Frontend",
      items: [
        { name: "TypeScript", icon: "typescript" },
        { name: "Next.js 16 (App Router)", icon: "nextdotjs" },
        { name: "React 18.3", icon: "react" },
        { name: "Tailwind CSS 3", icon: "tailwindcss" },
        { name: "Vite", icon: "vite" },
        { name: "Google Fonts (Rubik)", icon: "googlefonts" },
      ],
    },
    {
      category: "AI & Machine Learning",
      items: [{ name: "Ultralytics (YOLOv8)", icon: "ultralytics" }],
    },
    {
      category: "Developer Tools",
      items: [
        { name: "Git", icon: "git" },
        { name: "GitHub", icon: "github" },
        { name: "VS Code", icon: null },
        { name: "Vitest", icon: "vitest" },
        { name: "Playwright", icon: null },
        { name: "Husky", icon: null },
      ],
    },
  ],

  projects: [
    {
      title: "Ambiancy",
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
      links: { source: "https://github.com/chimkenchrls/ambiancy", live: null },
      // Screenshots live in ./assets/projects/ (desktop and/or mobile).
      media: {
        desktop: "./assets/projects/ambiancy-desktop.jpg",
        mobile: "./assets/projects/ambiancy-mobile.jpg",
      },
    },
    {
      title: "Pakisuyo Express",
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
      title: "Thready",
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
        botAvatar: "./assets/projects/amigo-avatar.jpg", // the bot's picture
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

  certifications: [],
  certificationsPending:
    "Currently working toward certifications. Check back soon.",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PORTFOLIO_DATA;
}
