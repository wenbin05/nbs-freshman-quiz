import type {
  OutcomeId,
  QuizQuestion,
  ResultProfile,
  ScoreMap,
} from "../types";

export const outcomeOrder: OutcomeId[] = [
  "overachiever",
  "socialButterfly",
  "lostButVibing",
  "softSupporter",
  "weBallAgent",
  "lowkeyStrategist",
];

export const initialScores: ScoreMap = {
  overachiever: 0,
  socialButterfly: 0,
  lostButVibing: 0,
  softSupporter: 0,
  weBallAgent: 0,
  lowkeyStrategist: 0,
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "character-spawn",
    title: "Q1. Character Spawn",
    scenario:
      "You have spawned back at the WCY Plaza entrance. 4 starter packs materialise in front of you.",
    prompt: "Which do you pick?",
    options: [
      {
        id: "A",
        label: "Planner, highlighters, colour-coded timetable",
        title: "Equip the Master Planner",
        detail: "Planner, highlighters, colour-coded timetable.",
        weights: { overachiever: 2, lowkeyStrategist: 1 },
        primaryOutcome: "overachiever",
      },
      {
        id: "B",
        label: "AirPods, iced coffee/matcha, vibes only",
        title: "Activate Vibe Mode",
        detail: "AirPods, iced coffee/matcha, vibes only.",
        weights: { socialButterfly: 1, lostButVibing: 2 },
        primaryOutcome: "lostButVibing",
      },
      {
        id: "C",
        label: "Emotional support item + snacks",
        title: "Pack the Comfort Kit",
        detail: "Emotional support item plus snacks.",
        weights: { softSupporter: 2, lostButVibing: 1 },
        primaryOutcome: "softSupporter",
      },
      {
        id: "D",
        label: "“I’ll figure it out later” energy",
        title: "Select Mystery Loadout",
        detail: "“I’ll figure it out later” energy.",
        weights: { weBallAgent: 2, lostButVibing: 1 },
        primaryOutcome: "weBallAgent",
      },
    ],
  },
  {
    id: "orientation-arena",
    title: "Q2. The Orientation Arena",
    scenario:
      "You enter WCY Plaza and suddenly observe:\nLoud cheers\nSeniors hyping the crowd\nFriend groups forming in real time.\nYou’ve entered the Orientation Arena.",
    prompt: "What do you do?",
    toasts: [
      {
        id: "orientation-event",
        kind: "event",
        title: "Event: The Orientation",
        message: "Difficulty: ???",
      },
    ],
    options: [
      {
        id: "A",
        label: "Smile politely, observe, then join a group strategically",
        title: "Scan, Smile, Sync",
        detail: "Observe first, then join a group strategically.",
        weights: { lowkeyStrategist: 2, overachiever: 1 },
        primaryOutcome: "lowkeyStrategist",
      },
      {
        id: "B",
        label: "Talk to EVERYONE. You now have 12 new friends",
        title: "Cast Mass Friendship",
        detail: "Talk to everyone. Somehow, you now have twelve new friends.",
        weights: { socialButterfly: 3 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "Stick to 1–2 people and trauma bond quietly",
        title: "Form a Small Party",
        detail: "Stick to one or two people and survive quietly together.",
        weights: { softSupporter: 2, lowkeyStrategist: 1 },
        primaryOutcome: "softSupporter",
      },
      {
        id: "D",
        label: "Stand there until someone adopts you",
        title: "Wait for Party Invite",
        detail: "Stand in spawn mode until someone friendly adopts you.",
        weights: { lostButVibing: 2, softSupporter: 1 },
        primaryOutcome: "lostButVibing",
      },
    ],
  },
  {
    id: "finding-your-class",
    title: "Q3. Finding Your Class",
    scenario:
      "TIME SKIP.\nThe Orientation blurs past like a montage. A whole week somehow disappears in 3 seconds.\nYou blink—\nand you're back at the WCY Plaza entrance again.\nYou start walking.\nLeft turn. Right turn. Another corridor. You are unable to find your class.",
    prompt: "What’s your next move?",
    toasts: [
      {
        id: "class-objective",
        kind: "objective",
        title: "New Objective Unlocked",
        message: "Attend Your First Class.",
      },
      {
        id: "navigation-challenge",
        kind: "navigation",
        title: "NAVIGATION CHALLENGE INITIATED",
        message: "Pathfinding module unstable.",
      },
    ],
    options: [
      {
        id: "A",
        label: "Google Maps + NTU map + walk faster like it’s intentional",
        title: "Triangulate Route",
        detail: "Google Maps, NTU map, and walk faster like it’s intentional.",
        weights: { overachiever: 1, lowkeyStrategist: 2 },
        primaryOutcome: "lowkeyStrategist",
      },
      {
        id: "B",
        label: "Ask a random senior: “hi sorry where is LT5 😭”",
        title: "Request Senior Intel",
        detail: "Ask a random senior: “hi sorry where is LT5”.",
        weights: { socialButterfly: 2, softSupporter: 1 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "Pretend you know where you’re going while slowly spiralling",
        title: "Maintain Main Character Walk",
        detail: "Pretend you know where you’re going while slowly spiralling.",
        weights: { lostButVibing: 2, lowkeyStrategist: 1 },
        primaryOutcome: "lostButVibing",
      },
      {
        id: "D",
        label: "Just go back to hostel",
        title: "Abort Mission",
        detail: "Just go back to hostel.",
        weights: { weBallAgent: 2, lostButVibing: 1 },
        primaryOutcome: "weBallAgent",
      },
    ],
  },
  {
    id: "group-project",
    title: "Q4. Group Project",
    scenario:
      "You finally reach the classroom.\nThe prof says:\n“Form groups.”\nIt happens instantly. People cluster like they planned for this before class.\nYou’re in a group chat now:\n“Biz Case grp 3”\nNo one says anything.",
    prompt: "What do you do?",
    toasts: [
      {
        id: "group-project-event",
        kind: "event",
        title: "Event: Group Project",
        message: "Team dynamics unknown.",
      },
    ],
    options: [
      {
        id: "A",
        label: "“Let’s assign roles + timeline + Google Doc NOW.”",
        title: "Open the War Room",
        detail: "Assign roles, timeline, and Google Doc now.",
        weights: { overachiever: 2, lowkeyStrategist: 1 },
        primaryOutcome: "overachiever",
      },
      {
        id: "B",
        label: "“Guys let’s get to know each other first hehe”",
        title: "Cast Icebreaker",
        detail: "Get to know each other before the slides begin.",
        weights: { socialButterfly: 2, softSupporter: 1 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "“I’ll just do my part… y’all don’t worry”",
        title: "Quietly Take a Lane",
        detail: "Do your part properly and keep things moving.",
        weights: { softSupporter: 2, lowkeyStrategist: 1 },
        primaryOutcome: "softSupporter",
      },
      {
        id: "D",
        label: "“We ball.”",
        title: "Enable Chaos Protocol",
        detail: "No plan. Full confidence.",
        weights: { weBallAgent: 3 },
        primaryOutcome: "weBallAgent",
      },
    ],
  },
  {
    id: "cca-fair",
    title: "Q5. The CCA Fair",
    scenario:
      "Class ends.\nYou try to leave campus,\nYou think you’re finally done.\nthe game: lol no\nYour path automatically reroutes.\nYou find yourself back in WCY Plaza. Yet again.\nBut this time, your surroundings are louder.\nSomeone hands you a tote bag. Another person pitches you an offer before you can react.\nYou didn’t plan for this.",
    prompt: "Your move?",
    toasts: [
      {
        id: "cca-fair-event",
        kind: "event",
        title: "Event: The CCA Fair",
        message: "Survive CCA Fair",
      },
    ],
    options: [
      {
        id: "A",
        label: "Research all CCAs before committing",
        title: "Audit Every Booth",
        detail: "Research all CCAs before committing.",
        weights: { overachiever: 1, lowkeyStrategist: 2 },
        primaryOutcome: "lowkeyStrategist",
      },
      {
        id: "B",
        label: "Sign up for everything. Future you problem",
        title: "Collect All Side Quests",
        detail: "Sign up for everything. Future you problem.",
        weights: { socialButterfly: 2, weBallAgent: 1 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "Walk around, take freebies, disappear",
        title: "Loot and Evade",
        detail: "Take freebies, avoid commitment, disappear.",
        weights: { lostButVibing: 2, weBallAgent: 1 },
        primaryOutcome: "lostButVibing",
      },
      {
        id: "D",
        label: "Join because your friend joined",
        title: "Follow Party Leader",
        detail: "Join because your friend joined.",
        weights: { softSupporter: 2, socialButterfly: 1 },
        primaryOutcome: "softSupporter",
      },
    ],
  },
  {
    id: "burnout-monster",
    title: "Q6. The Burnout Monster",
    scenario:
      "The environment suddenly darkens.\nNotifications start stacking:\ndeadlines\nmeetings\nunread messages\n“are you free?” (you are not)\nIt doesn’t stop.\nThen:\nWARNING: SYSTEM OVERLOAD\nA figure forms.\nThe Burnout Monster has spawned\nYou are not prepared.",
    prompt: "Choose a strategy:",
    toasts: [
      {
        id: "system-overload",
        kind: "warning",
        title: "WARNING: SYSTEM OVERLOAD",
        message: "Stress meter exceeding recommended limits.",
      },
      {
        id: "burnout-monster-alert",
        kind: "warning",
        title: "The Burnout Monster has spawned",
        message: "Boss encounter initiated.",
      },
    ],
    popup: {
      id: "burnout-disappear",
      title: "Silence Returns",
      message: "The notifications slow down. The monster finally disappears.",
      imageSrc: "/assets/isekai-ui/burnout-monster.png",
    },
    options: [
      {
        id: "A",
        label: "Lock in. Finish everything first",
        title: "Full Focus Burst",
        detail: "Lock in. Finish everything first.",
        weights: { overachiever: 2, lowkeyStrategist: 1 },
        primaryOutcome: "overachiever",
      },
      {
        id: "B",
        label: "Text friends: “guys i cannot 😭”",
        title: "Call for Backup",
        detail: "Text friends: “guys i cannot”.",
        weights: { socialButterfly: 1, softSupporter: 2 },
        primaryOutcome: "softSupporter",
      },
      {
        id: "C",
        label: "Take a nap. Reset.",
        title: "Use Recovery Potion",
        detail: "Take a nap. Reset.",
        weights: { lostButVibing: 2, softSupporter: 1 },
        primaryOutcome: "lostButVibing",
      },
      {
        id: "D",
        label: "Exist in stress. Romanticise suffering a bit",
        title: "Dramatic Endurance Mode",
        detail: "Exist in stress. Romanticise suffering a bit.",
        weights: { weBallAgent: 2, overachiever: 1 },
        primaryOutcome: "weBallAgent",
      },
    ],
  },
  {
    id: "finals-mode",
    title: "Q7. Finals Mode",
    scenario:
      "The notifications start slowing down. The monster finally disappears.\nSilence.\nThen, before you can catch a break:\n“FINALS IN 14 DAYS.”\nTime speeds up.\nDays feel shorter.\nYou check the calendar.",
    prompt: "What now?",
    toasts: [
      {
        id: "finals-warning",
        kind: "warning",
        title: "FINALS IN 14 DAYS",
        message: "Revision timer activated.",
      },
    ],
    options: [
      {
        id: "A",
        label: "Already started revision last week",
        title: "Execute Revision Plan",
        detail: "Already started revision last week.",
        weights: { overachiever: 2, lowkeyStrategist: 1 },
        primaryOutcome: "overachiever",
      },
      {
        id: "B",
        label: "“Okay let’s study… after this one outing”",
        title: "Balance Study and Side Quest",
        detail: "“Okay let’s study... after this one outing.”",
        weights: { socialButterfly: 2, lostButVibing: 1 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "“Still got time lah”",
        title: "Delay the Countdown",
        detail: "“Still got time lah.”",
        weights: { lostButVibing: 2, weBallAgent: 1 },
        primaryOutcome: "lostButVibing",
      },
      {
        id: "D",
        label: "Panic. Do nothing. Spiral a bit.",
        title: "Enter Spiral Cutscene",
        detail: "Panic. Do nothing. Spiral a bit.",
        weights: { weBallAgent: 2, softSupporter: 1 },
        primaryOutcome: "weBallAgent",
      },
    ],
  },
  {
    id: "weekend-portal",
    title: "Q8. Weekend Portal",
    scenario:
      "A glowing portal opens in front of you.\n“WEEKEND INSTANCE AVAILABLE (48 HOURS ONLY)”\nSystem warning appears:\n“ALERT: TIME RESOURCE MUST BE ALLOCATED”",
    prompt: "What do you do?",
    toasts: [
      {
        id: "weekend-instance",
        kind: "instance",
        title: "WEEKEND INSTANCE AVAILABLE (48 HOURS ONLY)",
        message: "",
      },
      {
        id: "weekend-resource-alert",
        kind: "instance",
        title: "ALERT: TIME RESOURCE MUST BE ALLOCATED",
        message: "",
      },
    ],
    options: [
      {
        id: "A",
        label: "Catch up on studies + get ahead",
        title: "Preload Next Week",
        detail: "Catch up on studies and get ahead.",
        weights: { overachiever: 2, lowkeyStrategist: 1 },
        primaryOutcome: "overachiever",
      },
      {
        id: "B",
        label: "Hang out, cafe hop, live life",
        title: "Enter Social Free Roam",
        detail: "Hang out, cafe hop, live life.",
        weights: { socialButterfly: 2, weBallAgent: 1 },
        primaryOutcome: "socialButterfly",
      },
      {
        id: "C",
        label: "Sleep. Recover. Heal.",
        title: "Restore HP",
        detail: "Sleep. Recover. Heal.",
        weights: { softSupporter: 2, lostButVibing: 1 },
        primaryOutcome: "softSupporter",
      },
      {
        id: "D",
        label: "Start on something productive… then end up doomscrolling",
        title: "Open Productivity Mirage",
        detail: "Start productive, then end up doomscrolling.",
        weights: { lostButVibing: 2, weBallAgent: 1 },
        primaryOutcome: "lostButVibing",
      },
    ],
  },
];

export const resultProfiles: Record<OutcomeId, ResultProfile> = {
  overachiever: {
    id: "overachiever",
    name: "The Overachiever",
    motto: "If I'm here, I'm going to excel.",
    traits: ["Driven", "Organised", "Ambitious"],
    tags: ["#Ambitious", "#Disciplined", "#FutureCEO"],
    profile:
      "You came into NBS with a plan, and a backup plan. You're always thinking ahead, whether it's internships, GPA, or networking. While others are still figuring things out, you're already 3 steps ahead. Groupmates love you, and also rely on you a bit too much.",
    wellbeingTips: [
      "It's okay to rest. Productivity is not self-worth.",
      "Don't compare your journey constantly.",
      "Schedule breaks like you schedule work.",
    ],
  },
  socialButterfly: {
    id: "socialButterfly",
    name: "The Social Butterfly",
    motto: "Connections are everything.",
    traits: ["Outgoing", "Friendly", "Energetic"],
    tags: ["#ExtrovertCore", "#MainCharacter", "#Networker"],
    profile:
      "You somehow know everyone in your course, and half the seniors too. Orientation? You thrived. CCA fair? You signed up for everything. Your calendar is packed, your social battery is infinite somehow, and you're the reason group chats are alive.",
    wellbeingTips: [
      "It's okay to say no sometimes.",
      "Protect your energy. Not every event is a must-go.",
      "Make time for yourself, not just others.",
    ],
  },
  lostButVibing: {
    id: "lostButVibing",
    name: "The Lost but Vibing",
    motto: "I'll figure it out... eventually.",
    traits: ["Chill", "Adaptable", "Go-with-the-flow"],
    tags: ["#JustVibing", "#ItIsWhatItIs", "#NoThoughtsHeadEmpty"],
    profile:
      "Do you fully know what's going on? Not really. But are you surviving? Yes. You take things as they come, somehow making it through chaos with vibes alone. Directions? Unclear. Deadlines? Flexible in your mind. But you always land on your feet eventually.",
    wellbeingTips: [
      "A little structure can go a long way.",
      "Ask for help earlier, not at 2am.",
      "You don't have to have everything figured out.",
    ],
  },
  softSupporter: {
    id: "softSupporter",
    name: "The Soft Supporter",
    motto: "We'll get through this together.",
    traits: ["Caring", "Dependable", "Emotionally aware"],
    tags: ["#GroupMom", "#ComfortHuman", "#WholesomeCore"],
    profile:
      "You're the quiet MVP of every group. You check in on people, make sure everyone's okay, and somehow keep things running smoothly behind the scenes. You might not be the loudest, but you're the one everyone trusts.",
    wellbeingTips: [
      "Don't forget to prioritise yourself too.",
      "You're allowed to set boundaries.",
      "You don't have to carry everyone's problems.",
    ],
  },
  weBallAgent: {
    id: "weBallAgent",
    name: "The \"We Ball\" Agent",
    motto: "No plan.",
    traits: ["Spontaneous", "Chaotic", "Bold"],
    tags: ["#LastMinuteGod", "#ChaosEnergy", "#WeBall"],
    profile:
      "You operate on pure instinct. Deadlines? Negotiable. Plans? Optional. Somehow, everything always works out for you, even if it's at the last possible second. You bring chaos, but also unmatched energy to every situation.",
    wellbeingTips: [
      "Your future self deserves less stress.",
      "Start slightly earlier, just a bit.",
      "Chaos is fun. Burnout isn't.",
    ],
  },
  lowkeyStrategist: {
    id: "lowkeyStrategist",
    name: "The Lowkey Strategist",
    motto: "Work smart, not loud.",
    traits: ["Observant", "Calculated", "Efficient"],
    tags: ["#SilentCarry", "#BigBrain", "#LowkeyWinning"],
    profile:
      "You don't say much, but when you do, it matters. You observe, plan quietly, and move with intention. While others are panicking, you already know what needs to be done. You're not flashy, but your results speak for themselves.",
    wellbeingTips: [
      "Don't isolate yourself too much.",
      "It's okay to let others see your effort.",
      "Balance efficiency with connection.",
    ],
  },
};
