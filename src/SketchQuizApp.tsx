import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import "@fontsource/silkscreen/400.css";
import {
  initialScores,
  outcomeOrder,
  quizQuestions,
  resultProfiles,
} from "./data/quiz";
import type {
  OptionId,
  OutcomeId,
  QuizOption,
  ScoreMap,
  ScreenPhase,
  SelectedAnswer,
} from "./types";
import { cleanText } from "./utils/text";

type SketchQuizState = {
  currentQuestionIndex: number;
  phase: Exclude<ScreenPhase, "popup">;
  resultId: OutcomeId | null;
  scores: ScoreMap;
  selectedAnswers: SelectedAnswer[];
};

type SketchAction =
  | { type: "START" }
  | { type: "FINISH_PRELUDE" }
  | { type: "ANSWER"; option: QuizOption }
  | { type: "REVEAL_RESULT" }
  | { type: "RESTART" };

const designerAsset = "/assets/designer-elements/";

type SketchForegroundAsset = {
  src: string;
  variant:
    | "avatar"
    | "phone"
    | "burnout-frame"
    | "finals-warning"
    | "full-layer";
};

type SketchSceneConfig = {
  foreground: SketchForegroundAsset[];
  layers: string[];
  pane: "designer" | "custom";
};

type SketchNotice = {
  body: string;
  key: string;
  kind: "event" | "info" | "warning";
  title: string;
  advanceOnClose?: boolean;
};

type SketchVisualBeat = {
  detail: string;
  image: string;
  key: string;
  title: string;
  variant: "cheer" | "crowd" | "map" | "reroute" | "plaza" | "fair";
};

type SketchPreludeStep =
  | {
      body: string;
      eyebrow: string;
      foreground?: string;
      kind: "story";
      showWelcomePane?: boolean;
      tone?: "arrival" | "blink" | "flicker" | "hologram";
    }
  | {
      autoAdvanceMs: number;
      foreground?: string;
      kind: "notice";
      notice: SketchNotice;
      showWelcomePane?: boolean;
      tone?: "flicker" | "hologram";
    };

const startLayers = ["img_3686.png"];
const resultLayers = ["img_3713.png"];
const calculationDelayMs = 1250;
const optionRevealDelayMs = 400;

function getSketchNoticeDuration(kind: SketchNotice["kind"]) {
  return kind === "warning" ? 4500 : 3800;
}

const sketchPreludeSteps: SketchPreludeStep[] = [
  {
    body: "It's your first week at NBS.\nYou walk into WCY Plaza to find your orientation room.",
    eyebrow: "First Week",
    foreground: "img_3687.png",
    kind: "story",
    tone: "arrival",
  },
  {
    body: "The air feels juuust slightly off.\nThe lights flicker.",
    eyebrow: "",
    foreground: "img_3687.png",
    kind: "story",
    tone: "flicker",
  },
  {
    autoAdvanceMs: 3000,
    kind: "notice",
    notice: {
      body: "",
      key: "prelude-system-update",
      kind: "info",
      title: "System update in progress.",
    },
    tone: "hologram",
  },
  {
    autoAdvanceMs: 3200,
    foreground: "img_3689.png",
    kind: "notice",
    notice: {
      body: "The Freshman Arc has begun.",
      key: "prelude-welcome",
      kind: "info",
      title: "Welcome, Player.",
    },
    tone: "hologram",
  },
  {
    autoAdvanceMs: 3400,
    foreground: "img_3689.png",
    kind: "notice",
    notice: {
      body: "Complete events to determine your build.",
      key: "prelude-quest-log",
      kind: "event",
      title: "Quest Log Updated",
    },
    showWelcomePane: true,
    tone: "hologram",
  },
  {
    body: "",
    eyebrow: "Blink",
    foreground: "img_3687.png",
    kind: "story",
    tone: "blink",
  },
  {
    body: "...Did I just get isekai'd into NBS?",
    eyebrow: "",
    foreground: "img_3687.png",
    kind: "story",
    tone: "arrival",
  },
  {
    autoAdvanceMs: 3400,
    foreground: "img_3689.png",
    kind: "notice",
    notice: {
      body: "Attend The Orientation.",
      key: "prelude-orientation-objective",
      kind: "event",
      title: "New Objective Unlocked",
    },
    showWelcomePane: true,
    tone: "hologram",
  },
];

let sketchAudioContext: AudioContext | null = null;

function playSketchSceneSound(index: number) {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  try {
    sketchAudioContext ??= new AudioContextCtor();

    if (sketchAudioContext.state === "suspended") {
      void sketchAudioContext.resume();
    }

    const now = sketchAudioContext.currentTime + 0.01;
    const scenePatterns = [
      [392, 523],
      [440, 587],
      [330, 440],
      [349, 523],
      [392, 494],
      [196, 147, 196],
      [220, 330],
      [523, 659, 784],
    ];
    const pattern = scenePatterns[index] ?? scenePatterns[0];

    pattern.forEach((frequency, noteIndex) => {
      const oscillator = sketchAudioContext!.createOscillator();
      const gain = sketchAudioContext!.createGain();
      const startAt = now + noteIndex * 0.085;
      oscillator.type = index >= 5 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.045, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
      oscillator.connect(gain);
      gain.connect(sketchAudioContext!.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.2);
    });
  } catch {
    // Browsers may block audio until a user gesture; the quiz still works without it.
  }
}

function playSketchNotificationBurst() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  try {
    sketchAudioContext ??= new AudioContextCtor();

    if (sketchAudioContext.state === "suspended") {
      void sketchAudioContext.resume();
    }

    const now = sketchAudioContext.currentTime + 0.01;

    [659, 740, 831, 988].forEach((frequency, index) => {
      const oscillator = sketchAudioContext!.createOscillator();
      const gain = sketchAudioContext!.createGain();
      const startAt = now + index * 0.13;
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.028, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.11);
      oscillator.connect(gain);
      gain.connect(sketchAudioContext!.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.12);
    });
  } catch {
    // The notification animation remains usable when autoplay audio is blocked.
  }
}

function createSketchInitialState(): SketchQuizState {
  return {
    currentQuestionIndex: 0,
    phase: "start",
    resultId: null,
    scores: { ...initialScores },
    selectedAnswers: [],
  };
}

function mergeScores(scores: ScoreMap, weights: Partial<ScoreMap>): ScoreMap {
  return outcomeOrder.reduce<ScoreMap>(
    (nextScores, outcome) => ({
      ...nextScores,
      [outcome]: nextScores[outcome] + (weights[outcome] ?? 0),
    }),
    { ...scores },
  );
}

function selectWinner(scores: ScoreMap, answers: SelectedAnswer[]): OutcomeId {
  const highestScore = Math.max(...outcomeOrder.map((outcome) => scores[outcome]));
  const tiedOutcomes = outcomeOrder.filter(
    (outcome) => scores[outcome] === highestScore,
  );

  if (tiedOutcomes.length === 1) {
    return tiedOutcomes[0];
  }

  const primaryCounts = tiedOutcomes.map((outcome) => ({
    count: answers.filter((answer) => answer.primaryOutcome === outcome).length,
    outcome,
  }));
  const highestPrimaryCount = Math.max(...primaryCounts.map(({ count }) => count));
  const primaryTies = primaryCounts
    .filter(({ count }) => count === highestPrimaryCount)
    .map(({ outcome }) => outcome);

  if (primaryTies.length === 1) {
    return primaryTies[0];
  }

  const recentPrimary = [...answers]
    .reverse()
    .find((answer) => primaryTies.includes(answer.primaryOutcome));

  return recentPrimary?.primaryOutcome ?? primaryTies[0] ?? outcomeOrder[0];
}

function sketchReducer(
  state: SketchQuizState,
  action: SketchAction,
): SketchQuizState {
  switch (action.type) {
    case "START":
      return { ...state, phase: "prelude" };
    case "FINISH_PRELUDE":
      return { ...state, phase: "question" };
    case "ANSWER": {
      if (state.phase !== "question") {
        return state;
      }

      const question = quizQuestions[state.currentQuestionIndex];
      const nextScores = mergeScores(state.scores, action.option.weights);
      const nextAnswers: SelectedAnswer[] = [
        ...state.selectedAnswers,
        {
          optionId: action.option.id,
          primaryOutcome: action.option.primaryOutcome,
          questionId: question.id,
          weights: action.option.weights,
        },
      ];
      const isFinalQuestion =
        state.currentQuestionIndex === quizQuestions.length - 1;

      if (isFinalQuestion) {
        return {
          ...state,
          phase: "calculating",
          resultId: selectWinner(nextScores, nextAnswers),
          scores: nextScores,
          selectedAnswers: nextAnswers,
        };
      }

      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        scores: nextScores,
        selectedAnswers: nextAnswers,
      };
    }
    case "REVEAL_RESULT":
      return {
        ...state,
        phase: "result",
        resultId: state.resultId ?? selectWinner(state.scores, state.selectedAnswers),
      };
    case "RESTART":
      return createSketchInitialState();
    default:
      return state;
  }
}

function useSketchTypewriter(text: string, enabled: boolean) {
  const [visibleText, setVisibleText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTyping = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTyping();

    if (!enabled) {
      setVisibleText("");
      setIsTyping(false);
      return;
    }

    let index = 0;
    setVisibleText("");
    setIsTyping(true);

    intervalRef.current = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));

      if (index >= text.length) {
        clearTyping();
        setIsTyping(false);
      }
    }, 12);

    return clearTyping;
  }, [clearTyping, enabled, text]);

  const skipTyping = useCallback(() => {
    if (!isTyping) {
      return;
    }

    clearTyping();
    setVisibleText(text);
    setIsTyping(false);
  }, [clearTyping, isTyping, text]);

  return { isTyping, skipTyping, visibleText };
}

function getLayersForState(state: SketchQuizState) {
  if (state.phase === "start") {
    return startLayers;
  }

  if (state.phase === "prelude" || state.phase === "question") {
    return [];
  }

  if (state.phase === "result") {
    return resultLayers;
  }

  return startLayers;
}

function getSketchDialogueBeats(question: (typeof quizQuestions)[number]) {
  const prompt = cleanText(question.prompt);

  switch (question.id) {
    case "character-spawn":
      return [cleanText(`${question.scenario}\n\n${prompt}`)];
    case "orientation-arena":
      return [
        "You enter WCY Plaza and suddenly observe:",
        "Loud cheers.",
        "Seniors hyping the crowd.",
        "Friend groups forming in real time.",
        "You’ve entered the Orientation Arena.",
        '"Looks like I have to survive this Orientation event... what should I do...?"',
      ];
    case "finding-your-class":
      return [
        "You blink.\nYou’re back at the WCY Plaza entrance again.",
        "You start walking.\nLeft turn. Right turn. Another corridor. You are unable to find your class.",
        cleanText(
          `You are still at WCY Plaza, class is starting soon, and every corridor looks suspiciously similar.\n\n${prompt}`,
        ),
      ];
    case "group-project":
      return [
        "You finally reach the classroom.\nThe prof says:\n“Form groups.”",
        "It happens instantly. People cluster like they planned for this before class.\nYou’re in a group chat now:\n“Biz Case grp 3”",
        cleanText(
          `No one says anything.\nBiz Case grp 3 is open, silent, and somehow already stressful.\n\n${prompt}`,
        ),
      ];
    case "cca-fair":
      return [
        "Class ends.\nYou try to leave campus.\nYou think you’re finally done, but your path automatically reroutes.",
        "You find yourself back in WCY Plaza. Yet again.",
        "But this time, your surroundings are louder.\nSomeone hands you a tote bag. Another person pitches you an offer before you can react.",
        cleanText(
          `You didn’t plan for this CCA Fair detour, but the booths are closing in.\n\n${prompt}`,
        ),
      ];
    case "burnout-monster":
      return [
        "The environment suddenly darkens.",
        "Your phone keeps lighting up.\nAlerts stack at the corners of your vision.",
        "It doesn’t stop.",
        "A figure forms.",
        cleanText(
          `You are not prepared.\nThe Burnout Monster is in front of you, and the alerts are still stacking.\n\n${prompt}`,
        ),
      ];
    case "finals-mode":
      return [
        "The notifications start slowing down. The monster finally disappears.\nSilence.",
        "Then, before you can catch a break.",
        "Time speeds up.\nDays feel shorter.",
        cleanText(
          `You check the calendar.\nFinals are now close enough to stare back.\n\n${prompt}`,
        ),
      ];
    case "weekend-portal":
      return [
        "A glowing portal opens in front of you.",
        cleanText(
          `The weekend portal is open, but only for 48 hours.\n\n${prompt}`,
        ),
      ];
    default:
      return [cleanText(`${question.scenario}\n\n${prompt}`)];
  }
}

function getSketchNotice(
  questionId: (typeof quizQuestions)[number]["id"],
  beatIndex: number,
): SketchNotice | null {
  switch (questionId) {
    case "orientation-arena":
      return beatIndex === 4
        ? {
            advanceOnClose: true,
            body: "Difficulty: ???",
            key: "orientation-event",
            kind: "event",
            title: "Event: The Orientation",
          }
        : null;
    case "finding-your-class":
      if (beatIndex === 0) {
        return {
          advanceOnClose: true,
          body: "Attend Your First Class.",
          key: "class-objective",
          kind: "info",
          title: "New Objective Unlocked",
        };
      }

      return beatIndex === 1
        ? {
            advanceOnClose: true,
            body: "Find your first class before lecture starts.",
            key: "navigation-challenge",
            kind: "event",
            title: "NAVIGATION CHALLENGE INITIATED",
          }
        : null;
    case "group-project":
      return beatIndex === 0
        ? {
            body: "Team dynamics unknown.",
            key: "group-project-event",
            kind: "event",
            title: "Event: Group Project",
          }
        : null;
    case "cca-fair":
      return beatIndex === 2
        ? {
            advanceOnClose: true,
            body: "Survive CCA Fair",
            key: "cca-fair-event",
            kind: "event",
            title: "Event: The CCA Fair",
          }
        : null;
    case "burnout-monster":
      if (beatIndex === 2) {
        return {
          advanceOnClose: true,
          body: "Stress meter exceeding recommended limits.",
          key: "system-overload",
          kind: "warning",
          title: "WARNING: SYSTEM OVERLOAD",
        };
      }

      return beatIndex === 3
        ? {
            advanceOnClose: true,
            body: "Boss encounter initiated.",
            key: "burnout-monster-alert",
            kind: "warning",
            title: "The Burnout Monster has spawned",
          }
        : null;
    case "finals-mode":
      return beatIndex === 1
        ? {
            advanceOnClose: true,
            body: "Revision timer activated.",
            key: "finals-warning",
            kind: "warning",
            title: "FINALS IN 14 DAYS",
          }
        : null;
    case "weekend-portal":
      if (beatIndex === 0) {
        return {
          advanceOnClose: true,
          body: "(48 HOURS ONLY)",
          key: "weekend-instance",
          kind: "event",
          title: "WEEKEND INSTANCE AVAILABLE",
        };
      }

      return beatIndex === 1
        ? {
            body: "",
            key: "weekend-alert",
            kind: "warning",
            title: "ALERT: TIME RESOURCE MUST BE ALLOCATED",
          }
        : null;
    default:
      return null;
  }
}

function getSketchVisualBeats(
  questionId: (typeof quizQuestions)[number]["id"],
  beatIndex: number,
  isCurrentBeatComplete: boolean,
): SketchVisualBeat[] {
  if (questionId === "orientation-arena") {
    const orientationBeats: SketchVisualBeat[] = [
      {
        detail: "Sound waves fill WCY Plaza.",
        image: "generated-v2/story-loud-cheers-v2.png",
        key: "loud-cheers",
        title: "Loud cheers",
        variant: "cheer",
      },
      {
        detail: "Seniors rally the crowd.",
        image: "generated-v2/story-senior-hype-v2.png",
        key: "senior-hype",
        title: "Seniors hyping the crowd",
        variant: "crowd",
      },
      {
        detail: "Groups form in real time.",
        image: "generated-v2/story-friend-groups-v2.png",
        key: "friend-groups",
        title: "Friend groups forming",
        variant: "crowd",
      },
    ];

    if (beatIndex <= 0) {
      return [];
    }

    const targetIndex = Math.min(2, beatIndex - 1);
    const visibleIndex =
      beatIndex <= 3 && !isCurrentBeatComplete ? targetIndex - 1 : targetIndex;

    return visibleIndex >= 0 ? [orientationBeats[visibleIndex]] : [];
  }

  if (questionId === "finding-your-class" && beatIndex >= 1) {
    return isCurrentBeatComplete || beatIndex > 1
      ? [
      {
        detail: "The map insists you are both close and lost.",
        image: "generated-v2/story-reroute-v2.png",
        key: "map-loop",
        title: "Route recalculating",
        variant: "map",
      },
        ]
      : [];
  }

  if (questionId === "cca-fair") {
    const ccaBeats: SketchVisualBeat[] = [
      {
        detail: "Exit route bends back toward the plaza.",
        image: "generated-v2/story-reroute-v2.png",
        key: "reroute-path",
        title: "Path reroutes",
        variant: "reroute",
      },
      {
        detail: "Same plaza. Somehow louder.",
        image: "generated-v2/story-back-plaza-v2.png",
        key: "back-to-plaza",
        title: "Back at WCY Plaza",
        variant: "plaza",
      },
      {
        detail: "A tote bag appears in your hands.",
        image: "generated-v2/story-cca-fair-v2.png",
        key: "tote-bag",
        title: "Freebies acquired",
        variant: "fair",
      },
    ];

    const targetIndex = Math.min(2, beatIndex);
    const visibleIndex =
      beatIndex <= 2 && !isCurrentBeatComplete ? targetIndex - 1 : targetIndex;

    return visibleIndex >= 0 ? [ccaBeats[visibleIndex]] : [];
  }

  return [];
}

function getSketchVisualSlotCount(
  questionId: (typeof quizQuestions)[number]["id"],
  beatIndex: number,
) {
  if (questionId === "orientation-arena") {
    return beatIndex >= 1 ? 3 : 0;
  }

  if (questionId === "finding-your-class") {
    return beatIndex >= 1 ? 3 : 0;
  }

  return questionId === "cca-fair" ? 3 : 0;
}

function getSketchForegroundAssets(
  _questionId: (typeof quizQuestions)[number]["id"],
  _beatIndex: number,
): SketchForegroundAsset[] {
  return [];
}

function SketchSceneLayers({
  foreground,
  layers,
}: {
  foreground: SketchForegroundAsset[];
  layers: string[];
}) {
  return (
    <>
      <div className="designer-layer-stack" aria-hidden="true">
        {layers.map((layer, index) => (
          <img
            alt=""
            className="designer-layer"
            key={`${layer}-${index}`}
            src={`${designerAsset}${layer}`}
            style={{ "--layer-index": index } as CSSProperties}
          />
        ))}
      </div>

      {foreground.length > 0 && (
        <div className="designer-foreground-stack" aria-hidden="true">
          {foreground.map((asset, index) => (
            <img
              alt=""
              className={
                asset.variant === "full-layer"
                  ? "designer-layer designer-foreground-full"
                  : `designer-prop designer-prop-${asset.variant}`
              }
              key={`${asset.src}-${index}`}
              src={`${designerAsset}${asset.src}`}
              style={{ "--layer-index": index } as CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}

function getSketchQuestionScene(
  questionId: (typeof quizQuestions)[number]["id"],
  beatIndex: number,
  sceneIntroVisible: boolean,
): SketchSceneConfig {
  switch (questionId) {
    case "character-spawn":
      return {
        foreground: [{ src: "props/avatar-q1.png", variant: "avatar" }],
        layers: ["img_3686.png"],
        pane: "designer",
      };
    case "orientation-arena":
      return {
        foreground: [{ src: "props/avatar-q2.png", variant: "avatar" }],
        layers: ["img_3691.png"],
        pane: "designer",
      };
    case "finding-your-class":
      return sceneIntroVisible
        ? {
            foreground: [],
            layers: ["img_3686.png"],
            pane: "designer",
          }
        : {
            foreground: [{ src: "props/avatar-q3.png", variant: "avatar" }],
            layers: ["img_3697.png"],
            pane: "designer",
          };
    case "group-project":
      return {
        foreground:
          sceneIntroVisible || beatIndex < 1
            ? []
            : [{ src: "props/avatar-q4.png", variant: "avatar" }],
        layers: ["img_3700.png"],
        pane: "custom",
      };
    case "cca-fair":
      return {
        foreground: sceneIntroVisible
          ? []
          : [{ src: "props/avatar-q5.png", variant: "avatar" }],
        layers: ["img_3703.png"],
        pane: "designer",
      };
    case "burnout-monster":
      return sceneIntroVisible
        ? {
            foreground: [],
            layers: ["img_3706.png"],
            pane: "designer",
          }
        : {
            foreground: [],
            layers: ["img_3707.png"],
            pane: "designer",
          };
    case "finals-mode":
      return sceneIntroVisible
        ? {
            foreground: [],
            layers: ["img_3709.png"],
            pane: "custom",
          }
        : {
            foreground: [],
            layers: ["img_3710.png"],
            pane: "custom",
          };
    case "weekend-portal":
      return {
        foreground: [],
        layers: ["img_3713.png"],
        pane: "designer",
      };
    default:
      return {
        foreground: [],
        layers: ["img_3686.png"],
        pane: "designer",
      };
  }
}

function SketchQuizApp() {
  const [state, dispatch] = useReducer(
    sketchReducer,
    undefined,
    createSketchInitialState,
  );
  const question = quizQuestions[state.currentQuestionIndex];
  const result = state.resultId ? resultProfiles[state.resultId] : null;
  const layers = getLayersForState(state);
  const showBuildSwitcher = new URLSearchParams(window.location.search).has(
    "debug",
  );

  useEffect(() => {
    if (state.phase !== "calculating") {
      return;
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: "REVEAL_RESULT" });
    }, calculationDelayMs);

    return () => window.clearTimeout(timeout);
  }, [state.phase]);

  return (
    <main
      className={`sketch-shell sketch-phase-${state.phase} sketch-q-${
        state.currentQuestionIndex + 1
      }`}
    >
      <div className="sketch-backdrop" aria-hidden="true" />
      <section className="sketch-stage" aria-label="What NBS Freshman Are You?">
        <div className="designer-layer-stack" aria-hidden="true">
          {layers.map((layer, index) => (
            <img
              alt=""
              className="designer-layer"
              key={`${layer}-${index}-${state.phase}-${state.currentQuestionIndex}`}
              src={`${designerAsset}${layer}`}
              style={{ "--layer-index": index } as CSSProperties}
            />
          ))}
        </div>

        {state.phase === "start" && (
          <SketchStartScreen onStart={() => dispatch({ type: "START" })} />
        )}

        {state.phase === "prelude" && (
          <SketchPreludeScreen
            onComplete={() => dispatch({ type: "FINISH_PRELUDE" })}
          />
        )}

        {state.phase === "question" && (
          <SketchQuestionScreen
            key={question.id}
            completedCount={state.selectedAnswers.length}
            currentIndex={state.currentQuestionIndex}
            onAnswer={(option) => dispatch({ type: "ANSWER", option })}
            question={question}
          />
        )}

        {state.phase === "calculating" && <SketchCalculationScreen />}

        {state.phase === "result" && result && (
          <SketchResultScreen
            completedAnswers={state.selectedAnswers}
            onRestart={() => dispatch({ type: "RESTART" })}
            result={result}
          />
        )}
      </section>

      {showBuildSwitcher && (
        <a className="sketch-rpg-link" href="?theme=rpg">
          Open RPG build
        </a>
      )}
    </main>
  );
}

function SketchStartScreen({ onStart }: { onStart: () => void }) {
  return (
    <button
      aria-label="Start What NBS Freshman Are You?"
      className="sketch-start"
      onClick={onStart}
      type="button"
    >
      <span>What NBS Freshman Are You?</span>
      <strong>Press Start</strong>
      <small>NBS Welcome Day</small>
    </button>
  );
}

function SketchPreludeScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const currentStep = sketchPreludeSteps[step] ?? sketchPreludeSteps[0];
  const showWelcomePane = Boolean(currentStep.showWelcomePane);
  const toneClass = currentStep.tone ? `is-${currentStep.tone}` : "";

  const advancePrelude = useCallback(() => {
    if (step >= sketchPreludeSteps.length - 1) {
      onComplete();
      return;
    }

    setStep((currentStepIndex) => currentStepIndex + 1);
  }, [onComplete, step]);

  useEffect(() => {
    playSketchSceneSound(step);

    if (currentStep.kind !== "notice") {
      return;
    }

    const timeout = window.setTimeout(() => {
      advancePrelude();
    }, currentStep.autoAdvanceMs);

    return () => window.clearTimeout(timeout);
  }, [advancePrelude, currentStep, step]);

  return (
    <>
      <div className="designer-layer-stack" aria-hidden="true">
        <img
          alt=""
          className="designer-layer"
          src={`${designerAsset}img_3686.png`}
        />
        {showWelcomePane && (
          <img
            alt=""
            className="designer-layer designer-layer-welcome-pane"
            src={`${designerAsset}img_3688.png`}
          />
        )}
      </div>

      <div className="designer-foreground-stack" aria-hidden="true">
        {currentStep.foreground && (
          <img
            alt=""
            className="designer-layer designer-foreground-full"
            src={`${designerAsset}${currentStep.foreground}`}
          />
        )}
      </div>

      {currentStep.tone && (
        <div
          className={`sketch-prelude-atmosphere ${toneClass}`}
          aria-hidden="true"
        />
      )}

      {currentStep.kind === "story" && currentStep.tone === "blink" && (
        <button
          className="sketch-blink-moment"
          onClick={advancePrelude}
          type="button"
        >
          <span>You blink.</span>
        </button>
      )}

      {currentStep.kind === "story" && currentStep.tone !== "blink" && (
        <button
          className={`sketch-prelude-copy ${toneClass}`}
          onClick={advancePrelude}
          type="button"
        >
          {currentStep.eyebrow && <span>{currentStep.eyebrow}</span>}
          <strong>{currentStep.body}</strong>
          <small>Tap to continue</small>
        </button>
      )}

      {currentStep.kind === "notice" && (
        <SketchSystemNotice
          durationMs={currentStep.autoAdvanceMs}
          notice={currentStep.notice}
        />
      )}

    </>
  );
}

function SketchQuestionScreen({
  completedCount,
  currentIndex,
  onAnswer,
  question,
}: {
  completedCount: number;
  currentIndex: number;
  onAnswer: (option: QuizOption) => void;
  question: (typeof quizQuestions)[number];
}) {
  const [sceneIntroVisible, setSceneIntroVisible] = useState(false);
  const [beatIndex, setBeatIndex] = useState(0);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const burnoutNotificationSoundPlayedRef = useRef(false);
  const [acknowledgedNoticeKey, setAcknowledgedNoticeKey] = useState<
    string | null
  >(null);
  const dialogueBeats = useMemo(() => getSketchDialogueBeats(question), [question]);
  const currentBeatText = dialogueBeats[beatIndex] ?? dialogueBeats[0] ?? "";
  const isFinalBeat = beatIndex >= dialogueBeats.length - 1;
  const showGroupChatTrigger =
    question.id === "group-project" && !sceneIntroVisible && beatIndex >= 1;
  const { isTyping, skipTyping, visibleText } = useSketchTypewriter(
    currentBeatText,
    !sceneIntroVisible,
  );
  const scene = useMemo(
    () => getSketchQuestionScene(question.id, beatIndex, sceneIntroVisible),
    [beatIndex, question.id, sceneIntroVisible],
  );
  const foregroundAssets = useMemo(
    () => [
      ...scene.foreground,
      ...getSketchForegroundAssets(question.id, beatIndex),
    ],
    [beatIndex, question.id, scene.foreground],
  );
  const optionsActive = isFinalBeat && optionsVisible;
  const beatNotice = useMemo(
    () => getSketchNotice(question.id, beatIndex),
    [beatIndex, question.id],
  );
  const activeNotice =
    !sceneIntroVisible &&
    !isTyping &&
    beatNotice &&
    acknowledgedNoticeKey !== beatNotice.key
      ? beatNotice
      : null;
  const showBurnoutNotifications =
    question.id === "burnout-monster" &&
    !sceneIntroVisible &&
    beatIndex >= 1;
  const visualBeats = getSketchVisualBeats(question.id, beatIndex, !isTyping);
  const visualSlotCount = getSketchVisualSlotCount(question.id, beatIndex);

  useEffect(() => {
    setSceneIntroVisible(false);
    setBeatIndex(0);
    setOptionsVisible(false);
    setGroupChatOpen(false);
    setAcknowledgedNoticeKey(null);
    playSketchSceneSound(currentIndex);
  }, [currentIndex, question.id]);

  useEffect(() => {
    if (
      !showBurnoutNotifications ||
      burnoutNotificationSoundPlayedRef.current
    ) {
      return;
    }

    burnoutNotificationSoundPlayedRef.current = true;
    playSketchNotificationBurst();
  }, [showBurnoutNotifications]);

  useEffect(() => {
    setAcknowledgedNoticeKey(null);
  }, [beatIndex, question.id]);

  useEffect(() => {
    if (!showGroupChatTrigger) {
      setGroupChatOpen(false);
    }
  }, [showGroupChatTrigger]);

  const handleNoticeClose = useCallback(() => {
    if (!activeNotice) {
      return;
    }

    setAcknowledgedNoticeKey(activeNotice.key);

    if (activeNotice.advanceOnClose && !isFinalBeat) {
      setBeatIndex((index) => index + 1);
    }
  }, [activeNotice, isFinalBeat]);

  useEffect(() => {
    if (!groupChatOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGroupChatOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [groupChatOpen]);

  useEffect(() => {
    if (!activeNotice) {
      return;
    }

    playSketchSceneSound(activeNotice.kind === "warning" ? 6 : 2);
  }, [activeNotice]);

  useEffect(() => {
    if (!activeNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      handleNoticeClose();
    }, getSketchNoticeDuration(activeNotice.kind));

    return () => window.clearTimeout(timeout);
  }, [activeNotice, handleNoticeClose]);

  useEffect(() => {
    if (sceneIntroVisible) {
      return;
    }

    playSketchSceneSound((currentIndex + beatIndex) % quizQuestions.length);
  }, [beatIndex, currentIndex, sceneIntroVisible]);

  useEffect(() => {
    setOptionsVisible(false);

    if (sceneIntroVisible || isTyping || !isFinalBeat) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOptionsVisible(true);
    }, optionRevealDelayMs);

    return () => window.clearTimeout(timeout);
  }, [
    beatIndex,
    isFinalBeat,
    isTyping,
    question.id,
    sceneIntroVisible,
  ]);

  const handleDialogueClick = () => {
    if (sceneIntroVisible) {
      return;
    }

    if (isTyping) {
      skipTyping();
      return;
    }

    if (activeNotice) {
      return;
    }

    if (!isFinalBeat) {
      setBeatIndex((index) => index + 1);
    }
  };

  if (sceneIntroVisible) {
    return (
      <>
        <SketchSceneLayers foreground={[]} layers={scene.layers} />
        <div className="sketch-quiz-layer is-scene-preview" aria-live="polite">
          <div className="sketch-scene-card">
            <span>Scene {currentIndex + 1}</span>
            <strong>{cleanText(question.title.replace(/^Q\d+\.\s*/, ""))}</strong>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SketchSceneLayers foreground={foregroundAssets} layers={scene.layers} />
      <div className="sketch-focus-wash" aria-hidden="true" />

      {showBurnoutNotifications && <SketchNotificationStack />}

      {showGroupChatTrigger && (
        <button
          aria-label="Open Biz Case group chat"
          className="sketch-chat-trigger"
          onClick={() => setGroupChatOpen(true)}
          type="button"
        >
          <img
            alt=""
            src={`${designerAsset}props/biz-case-phone.png`}
          />
          <span>Biz Case grp 3</span>
        </button>
      )}

      {groupChatOpen && (
        <div
          className="sketch-asset-modal"
          onClick={() => setGroupChatOpen(false)}
          role="presentation"
        >
          <button
            aria-label="Close Biz Case group chat"
            className="sketch-asset-window"
            onClick={(event) => {
              event.stopPropagation();
              setGroupChatOpen(false);
            }}
            type="button"
          >
            <img
              alt="Biz Case group chat sketch"
              src={`${designerAsset}props/biz-case-phone.png`}
            />
            <span>Tap to return</span>
          </button>
        </div>
      )}

      {activeNotice && (
        <SketchSystemNotice
          durationMs={getSketchNoticeDuration(activeNotice.kind)}
          notice={activeNotice}
        />
      )}

      <div
        className="sketch-quiz-layer"
      >
        <div className="sketch-topbar">
          <span>{`${currentIndex + 1}/${quizQuestions.length}`}</span>
        </div>

        <section
          className={`sketch-question-card sketch-pane-${scene.pane} ${
            isFinalBeat ? "is-choice-phase" : "is-story-phase"
          } ${visualSlotCount > 0 ? "has-visuals" : ""}`}
        >
          <button
            className="sketch-dialogue"
            onClick={handleDialogueClick}
            type="button"
            aria-label={
              isTyping
                ? "Story text is typing"
                : isFinalBeat
                  ? "Choose an option"
                  : "Continue dialogue"
            }
          >
            <div className="sketch-dialogue-content">
              <div className="sketch-dialogue-copy">
                <pre className="sketch-dialogue-text">
                  {visibleText}
                  {isTyping && <i aria-hidden="true">|</i>}
                </pre>
                <pre className="sketch-dialogue-measure" aria-hidden="true">
                  {currentBeatText}
                </pre>
              </div>
              {visualSlotCount > 0 && (
                <SketchDialogueVisuals
                  beats={visualBeats}
                  slotCount={visualSlotCount}
                />
              )}
            </div>
            {!isTyping && (
              <small className={isFinalBeat ? "is-choice-cue" : "is-continue-cue"}>
                {isFinalBeat ? "Choose your move" : "Tap to continue"}
              </small>
            )}
          </button>

          <div
            className={`sketch-options ${optionsActive ? "is-visible" : ""}`}
            aria-hidden={!optionsActive}
          >
            {question.options.map((option, index) => (
              <button
                className="sketch-option"
                disabled={!optionsActive}
                key={option.id}
                onClick={() => onAnswer(option)}
                style={{ "--option-index": index } as CSSProperties}
                type="button"
              >
                <span>{option.id}</span>
                <strong>{cleanText(option.label)}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function SketchDialogueVisuals({
  beats,
  slotCount,
}: {
  beats: SketchVisualBeat[];
  slotCount: number;
}) {
  return (
    <div className="sketch-dialogue-visuals" aria-hidden="true">
      {Array.from({ length: slotCount }, (_, index) => {
        const beat = beats[index];

        return (
        <figure
          className={`sketch-dialogue-visual ${
            beat ? `has-image is-${beat.variant}` : "is-reserved"
          }`}
          key={beat?.key ?? `reserved-${index}`}
          style={{ "--beat-index": index } as CSSProperties}
        >
          {beat && <img alt="" src={`${designerAsset}${beat.image}`} />}
        </figure>
        );
      })}
    </div>
  );
}

function SketchSystemNotice({
  durationMs,
  notice,
}: {
  durationMs: number;
  notice: SketchNotice;
}) {
  return (
    <div
      className={`sketch-system-notice is-${notice.kind}`}
      role="status"
      aria-live={notice.kind === "warning" ? "assertive" : "polite"}
      aria-label={notice.title}
      style={{ "--notice-duration": `${durationMs}ms` } as CSSProperties}
    >
      <div
        className={`sketch-system-notice-card ${
          notice.body ? "" : "has-title-only"
        }`}
      >
        <span>{notice.title}</span>
        {notice.body && <strong>{notice.body}</strong>}
      </div>
    </div>
  );
}

function SketchNotificationStack() {
  const notifications = [
    "Deadline due",
    "Meeting invite",
    "Unread messages",
    "Are you free?",
  ];

  return (
    <div className="sketch-notification-stack" aria-hidden="true">
      {notifications.map((notification, index) => (
        <i
          key={notification}
          style={{ "--notice-index": index } as CSSProperties}
        >
          {notification}
        </i>
      ))}
    </div>
  );
}

function SketchCalculationScreen() {
  return (
    <section className="sketch-result-card sketch-calculation" role="status">
      <span>Adventure record complete</span>
      <h1>Calculating build...</h1>
      <div aria-hidden="true" className="sketch-loader">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}

function SketchResultScreen({
  completedAnswers,
  onRestart,
  result,
}: {
  completedAnswers: SelectedAnswer[];
  onRestart: () => void;
  result: (typeof resultProfiles)[OutcomeId];
}) {
  const completedEvents = useMemo(
    () =>
      completedAnswers
        .map((answer) => {
          const question = quizQuestions.find(({ id }) => id === answer.questionId);
          const option = question?.options.find(({ id }) => id === answer.optionId);

          return question && option
            ? {
                optionId: answer.optionId,
                optionText: cleanText(option.label),
                title: cleanText(question.title.replace(/^Q\d+\.\s*/, "")),
              }
            : null;
        })
        .filter(
          (
            event,
          ): event is {
            optionId: OptionId;
            optionText: string;
            title: string;
          } => event !== null,
        ),
    [completedAnswers],
  );

  return (
    <section className="sketch-result-card">
      <span>Freshman Type Revealed</span>
      <h1>{cleanText(result.name)}</h1>
      <p className="sketch-motto">"{cleanText(result.motto)}"</p>

      <div className="sketch-result-grid">
        <section>
          <h2>Traits</h2>
          <div className="sketch-chip-row">
            {result.traits.map((trait) => (
              <i key={trait}>{cleanText(trait)}</i>
            ))}
          </div>
        </section>

        <section>
          <h2>Personality Tags</h2>
          <div className="sketch-chip-row">
            {result.tags.map((tag) => (
              <i key={tag}>{cleanText(tag)}</i>
            ))}
          </div>
        </section>
      </div>

      <p className="sketch-profile">{cleanText(result.profile)}</p>

      <section className="sketch-tips">
        <h2>Wellbeing Tips</h2>
        <ul>
          {result.wellbeingTips.map((tip) => (
            <li key={tip}>{cleanText(tip)}</li>
          ))}
        </ul>
      </section>

      <details className="sketch-adventure-log">
        <summary>Review your journey</summary>
        <ol>
          {completedEvents.map((event, index) => (
            <li key={`${event.title}-${event.optionId}`}>
              <span>{index + 1}</span>
              <strong>{event.title}</strong>
              <small>
                {event.optionId}. {event.optionText}
              </small>
            </li>
          ))}
        </ol>
      </details>

      <button className="sketch-replay" onClick={onRestart} type="button">
        Replay Quiz
      </button>
    </section>
  );
}

export default SketchQuizApp;
