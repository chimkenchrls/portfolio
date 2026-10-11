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
      title: "AI Engineer for Developers",
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
