// Demo workspace so the app looks lived-in on first launch. Settings -> "Reset demo data"
// restores it and "Clear everything" empties it.
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const EVERYTHING = "everything";

export function makeSeed(now = Date.now()) {
  const channels = [
    { id: "ch_content", name: "content", description: "", icon: "video" },
    { id: "ch_finances", name: "finances", description: "Manage company finance and accounting", icon: "mail" },
    { id: "ch_artifacts", name: "artifacts", description: "", icon: "calendar" },
  ];

  const artifacts = [
    {
      id: "a_deck9",
      kind: "deck",
      title: "9 Things to Know About Claude Duet",
      channel: "ch_content",
      pinned: false,
      status: "ready",
      createdAt: now - 20 * MIN,
      updatedAt: now - 1 * MIN,
      content: {
        title: "9 Things to Know About Claude Duet",
        slides: [
          { layout: "title", title: "Anthropic just released Duet.", subtitle: "9 things to know about Claude Duet", notes: "Open with the one-line summary: a Claude that messages you first." },
          { layout: "bullets", title: "1. It messages you first", bullets: ["Sends a morning brief from your email and calendar", "Posts updates through the day", "Follows up on quiet threads"] },
          { layout: "bullets", title: "2. It works while you're away", bullets: ["Runs on its own cloud computer", "Keeps going after you close the app", "Bigger jobs come back as editable files in Make"] },
          { layout: "bullets", title: "3. Connectors, not copy-paste", bullets: ["Gmail, Google Calendar, Google Drive", "Slack, QuickBooks, HubSpot", "Docusign and Calendly", "You start each connection and can disconnect any time"] },
          { layout: "statement", title: "4. It asks before anything risky.", subtitle: "Messages, payments, signing and deleting all wait for your approval." },
          { layout: "bullets", title: "5. Make and Tasks", bullets: ["Make holds the files it builds", "Tasks tracks progress on longer jobs", "Chat is where you steer it"] },
          { layout: "bullets", title: "6. A research preview", bullets: ["US only, Pro and Max plans", "Join a waitlist; invitations go out in waves", "No Team or Enterprise access yet"] },
          { layout: "statement", title: "7. One model, no picker.", subtitle: "It runs on Claude Opus 5.5 and decides how much effort a task needs." },
          { layout: "bullets", title: "8. Known limits", bullets: ["You can't watch or take over its browser", "It checks accounts at set intervals", "It doesn't make calls or send texts"] },
          { layout: "statement", title: "9. Review before you approve.", subtitle: "It can misread a thread or miscalibrate what's urgent." },
          { layout: "statement", title: "Bonus: voice dictation", subtitle: "Talk your request instead of typing it." },
        ],
      },
    },
    {
      id: "a_riley",
      kind: "document",
      title: "Riley's Observations of Claude Duet",
      channel: "ch_content",
      pinned: false,
      status: "ready",
      createdAt: now - 3 * HOUR,
      updatedAt: now - 1 * HOUR,
      content: {
        title: "Riley's Observations of Claude Duet",
        sections: [
          { heading: "What stood out", body: "It starts the conversation. The morning brief arrives before I open anything.\n- Approvals feel like a real safety net\n- Channels keep work from mixing together" },
          { heading: "What to watch", body: "Urgent items can be delayed because it checks accounts at intervals. Always read a draft before approving it." },
        ],
      },
    },
    {
      id: "a_cyber",
      kind: "document",
      title: "AI and cyber risk: working notes",
      channel: "ch_artifacts",
      pinned: false,
      status: "ready",
      createdAt: now - 5 * HOUR,
      updatedAt: now - 4 * HOUR,
      content: {
        title: "AI and cyber risk: working notes",
        sections: [
          { heading: "Prompt injection", body: "Content an agent reads can carry instructions. Approval gates are the main defence." },
          { heading: "Least privilege", body: "Connect only the apps a task needs and disconnect when it is done." },
        ],
      },
    },
    {
      id: "a_editing",
      kind: "deck",
      title: "What I've Learned with AI Editing",
      channel: "ch_content",
      pinned: true,
      status: "ready",
      createdAt: now - 4 * DAY,
      updatedAt: now - 2 * DAY,
      content: {
        title: "What I've Learned with AI Editing",
        slides: [
          { layout: "title", title: "What I've learned with AI editing", subtitle: "Notes from a month of cutting video with agents" },
          { layout: "bullets", title: "Start with a rough cut", bullets: ["Let the agent assemble a first pass", "Spend your time on pacing and taste", "Keep every version"] },
          { layout: "statement", title: "Taste is still yours.", subtitle: "The agent is fast. Deciding what stays is the job." },
        ],
      },
    },
    {
      id: "a_slop",
      kind: "document",
      title: "AI Is Removing Slop",
      channel: "ch_content",
      pinned: true,
      status: "ready",
      createdAt: now - 4 * DAY,
      updatedAt: now - 2 * DAY,
      content: {
        title: "AI Is Removing Slop",
        sections: [
          { heading: "The claim", body: "Better tools make the boring middle of a project disappear, so the weak parts get cut sooner." },
        ],
      },
    },
    {
      id: "a_intro",
      kind: "document",
      title: "Intro script v3",
      channel: "ch_content",
      pinned: true,
      status: "ready",
      createdAt: now - 6 * DAY,
      updatedAt: now - 3 * DAY,
      content: {
        title: "Intro script v3",
        sections: [{ heading: "Cold open", body: "Three seconds, one claim, no logo." }],
      },
    },
    {
      id: "a_v2",
      kind: "document",
      title: "v2.video: open questions and risks",
      channel: "ch_content",
      pinned: false,
      status: "ready",
      createdAt: now - 2 * DAY,
      updatedAt: now - 1 * DAY,
      content: {
        title: "v2.video: open questions and risks",
        sections: [
          { heading: "Open questions", body: "- How do we version a cut?\n- Who approves a publish?" },
          { heading: "Risks", body: "Rendering cost and review fatigue." },
        ],
      },
    },
    {
      id: "a_outline",
      kind: "document",
      title: "Video Versions App: Outline",
      channel: "ch_content",
      pinned: false,
      status: "ready",
      createdAt: now - 3 * DAY,
      updatedAt: now - 2 * DAY,
      content: {
        title: "Video Versions App: Outline",
        sections: [{ heading: "Introduction", body: "An app that keeps every cut of a video and lets you compare them side by side." }],
      },
    },
    {
      id: "a_agent_me",
      kind: "document",
      title: "Agent Me: onboarding notes",
      channel: "ch_artifacts",
      pinned: false,
      status: "ready",
      createdAt: now - 5 * DAY,
      updatedAt: now - 4 * DAY,
      content: {
        title: "Agent Me: onboarding notes",
        sections: [{ heading: "First run", body: "Connect email, calendar and one chat app. Nothing else." }],
      },
    },
    {
      id: "a_design_versions",
      kind: "design",
      title: "Video Versions",
      channel: "ch_content",
      pinned: false,
      status: "ready",
      createdAt: now - 3 * DAY,
      updatedAt: now - 2 * DAY,
      content: {
        title: "Video Versions",
        frames: [
          {
            name: "Version list",
            description: "Every cut of the video in one place.",
            palette: ["#111214", "#e5532c", "#f4f2ef", "#2a2a2d"],
            elements: [
              { type: "heading", text: "Versions" },
              { type: "card", text: "v3 · Final cut" },
              { type: "card", text: "v2 · Trimmed intro" },
              { type: "button", text: "Compare" },
            ],
          },
        ],
      },
    },
    {
      id: "a_design_agent",
      kind: "design",
      title: "Agent-native redesign, three directions",
      channel: "ch_artifacts",
      pinned: false,
      status: "ready",
      createdAt: now - 4 * DAY,
      updatedAt: now - 3 * DAY,
      content: {
        title: "Agent-native redesign, three directions",
        frames: [
          {
            name: "Direction A",
            description: "Chat first.",
            palette: ["#0d0f14", "#6e9bff", "#f4f2ef", "#232733"],
            elements: [
              { type: "heading", text: "Ask anything" },
              { type: "text", text: "The agent proposes, you approve." },
              { type: "button", text: "Start" },
            ],
          },
          {
            name: "Direction B",
            description: "Canvas first.",
            palette: ["#17120d", "#f0763f", "#f7efe6", "#33271c"],
            elements: [
              { type: "heading", text: "Your work" },
              { type: "image", text: "Preview" },
              { type: "button", text: "Open" },
            ],
          },
        ],
      },
    },
    {
      id: "a_design_page",
      kind: "design",
      title: "Landing page",
      channel: "ch_artifacts",
      pinned: false,
      status: "ready",
      createdAt: now - 6 * DAY,
      updatedAt: now - 5 * DAY,
      content: {
        title: "Landing page",
        frames: [
          {
            name: "Hero",
            description: "One promise and one button.",
            palette: ["#101a14", "#5fc98a", "#f2fff7", "#1d2b22"],
            elements: [
              { type: "heading", text: "Work that finishes itself" },
              { type: "text", text: "Briefs in the morning. Files by lunch." },
              { type: "button", text: "Join the waitlist" },
            ],
          },
        ],
      },
    },
  ];

  const messages = [
    {
      id: "m_seed1",
      role: "assistant",
      channel: "ch_content",
      text: "Sent to #content: the playhead will match each grid card's color.",
      ts: now - 40 * MIN,
    },
    {
      id: "m_seed2",
      role: "user",
      channel: "ch_content",
      text: "Hey, can you please add something at the end of the presentation we were last working on in the content channel? Add that I really like voice dictation, just as a little bonus slide at the end.",
      ts: now - 3 * MIN,
    },
    {
      id: "m_seed3",
      role: "assistant",
      channel: "ch_content",
      text: "I've sent the voice dictation bonus slide to #content. It'll go at the end of [[artifact:a_deck9]], and the link stays the same.",
      ts: now - 2 * MIN,
    },
  ];

  const tasks = [
    {
      id: "t_seed1",
      title: "Send the weekly finance summary to the team",
      details: "Draft is ready in #finances. Sends to 6 people.",
      channel: "ch_finances",
      status: "needs_approval",
      progress: 1,
      createdAt: now - 30 * MIN,
    },
    {
      id: "t_seed2",
      title: "Collect last month's invoices",
      details: "Checking Gmail and QuickBooks for new invoices.",
      channel: "ch_finances",
      status: "running",
      progress: 0.6,
      createdAt: now - 2 * HOUR,
    },
    {
      id: "t_seed3",
      title: "Morning brief",
      details: "Email and calendar summary for today.",
      channel: null,
      status: "done",
      progress: 1,
      createdAt: now - 9 * HOUR,
    },
  ];

  return { channels, messages, tasks, artifacts };
}

export const emptyState = () => ({ channels: [], messages: [], tasks: [], artifacts: [] });
