import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
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

const startLayers = ["img_3686.png"];
const resultLayers = ["img_3713.png"];
const calculationDelayMs = 1250;
const sceneIntroDelayMs = 2200;
const optionRevealDelayMs = 400;

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

  return { isTyping, visibleText };
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
        "You enter WCY Plaza and suddenly observe:\nLoud cheers\nSeniors hyping the crowd\nFriend groups forming in real time.",
        cleanText(`You’ve entered the Orientation Arena.\n\n${prompt}`),
      ];
    case "finding-your-class":
      return [
        "You blink—\nand you're back at the WCY Plaza entrance again.",
        cleanText(
          `You start walking.\nLeft turn. Right turn. Another corridor. You are unable to find your class.\n\n${prompt}`,
        ),
      ];
    case "group-project":
      return [
        "You finally reach the classroom.\nThe prof says:\n“Form groups.”",
        "It happens instantly. People cluster like they planned for this before class.\nYou’re in a group chat now:\n“Biz Case grp 3”",
        cleanText(`No one says anything.\n\n${prompt}`),
      ];
    case "cca-fair":
      return [
        "Class ends.\nYou try to leave campus,\nYou think you’re finally done.\nthe game: lol no",
        "Your path automatically reroutes.\nYou find yourself back in WCY Plaza. Yet again.",
        "But this time, your surroundings are louder.\nSomeone hands you a tote bag. Another person pitches you an offer before you can react.",
        cleanText(`You didn’t plan for this.\n\n${prompt}`),
      ];
    case "burnout-monster":
      return [
        "The environment suddenly darkens.",
        "Notifications start stacking:\ndeadlines\nmeetings\nunread messages\n“are you free?” (you are not)",
        "It doesn’t stop.\nThen:\nWARNING: SYSTEM OVERLOAD",
        "A figure forms.\nThe Burnout Monster has spawned.",
        cleanText(`You are not prepared.\n\n${prompt}`),
      ];
    case "finals-mode":
      return [
        "The notifications start slowing down. The monster finally disappears.\nSilence.",
        "Then, before you can catch a break:\n“FINALS IN 14 DAYS.”",
        "Time speeds up.\nDays feel shorter.",
        cleanText(`You check the calendar.\n\n${prompt}`),
      ];
    case "weekend-portal":
      return [
        "A glowing portal opens in front of you.\n“WEEKEND INSTANCE AVAILABLE (48 HOURS ONLY)”",
        cleanText(`System warning appears:\n“ALERT: TIME RESOURCE MUST BE ALLOCATED”\n\n${prompt}`),
      ];
    default:
      return [cleanText(`${question.scenario}\n\n${prompt}`)];
  }
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

      <a className="sketch-rpg-link" href="?theme=rpg">
        Open RPG build
      </a>
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
      <small>Chill sketch draft</small>
    </button>
  );
}

function SketchPreludeScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const isWelcome = step === 1;

  useEffect(() => {
    playSketchSceneSound(step);

    const timeout = window.setTimeout(() => {
      if (step === 0) {
        setStep(1);
        return;
      }

      onComplete();
    }, step === 0 ? 2400 : 2600);

    return () => window.clearTimeout(timeout);
  }, [onComplete, step]);

  return (
    <>
      <div className="designer-layer-stack" aria-hidden="true">
        <img
          alt=""
          className="designer-layer"
          src={`${designerAsset}img_3686.png`}
        />
        {isWelcome && (
          <img
            alt=""
            className="designer-layer designer-layer-welcome-pane"
            src={`${designerAsset}img_3688.png`}
          />
        )}
      </div>

      <div className="designer-foreground-stack" aria-hidden="true">
        <img
          alt=""
          className="designer-layer designer-foreground-full"
          src={`${designerAsset}${isWelcome ? "img_3689.png" : "img_3687.png"}`}
        />
      </div>

      {!isWelcome && (
        <div className="sketch-prelude-copy is-premise">
          <span>...</span>
          <strong>Did I just get isekai'd into NBS?</strong>
        </div>
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
  const [sceneIntroVisible, setSceneIntroVisible] = useState(true);
  const [beatIndex, setBeatIndex] = useState(0);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const dialogueBeats = useMemo(() => getSketchDialogueBeats(question), [question]);
  const currentBeatText = dialogueBeats[beatIndex] ?? dialogueBeats[0] ?? "";
  const isFinalBeat = beatIndex >= dialogueBeats.length - 1;
  const showGroupChatTrigger =
    question.id === "group-project" && !sceneIntroVisible && beatIndex >= 1;
  const { isTyping, visibleText } = useSketchTypewriter(
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
  const questionTitle = cleanText(question.title);
  const questionName = cleanText(question.title.replace(/^Q\d+\.\s*/, ""));
  const optionsActive = isFinalBeat && optionsVisible;

  useEffect(() => {
    setSceneIntroVisible(true);
    setBeatIndex(0);
    setOptionsVisible(false);
    setGroupChatOpen(false);
    playSketchSceneSound(currentIndex);

    const timeout = window.setTimeout(() => {
      setSceneIntroVisible(false);
    }, sceneIntroDelayMs);

    return () => window.clearTimeout(timeout);
  }, [currentIndex, question.id]);

  useEffect(() => {
    if (!showGroupChatTrigger) {
      setGroupChatOpen(false);
    }
  }, [showGroupChatTrigger]);

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
  }, [beatIndex, isFinalBeat, isTyping, question.id, sceneIntroVisible]);

  const handleDialogueClick = () => {
    if (sceneIntroVisible) {
      return;
    }

    if (isTyping) {
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
            <strong>{questionName}</strong>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SketchSceneLayers foreground={foregroundAssets} layers={scene.layers} />
      <div className="sketch-focus-wash" aria-hidden="true" />

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
            onClick={(event) => event.stopPropagation()}
            type="button"
          >
            <img
              alt="Biz Case group chat sketch"
              src={`${designerAsset}props/biz-case-phone.png`}
            />
            <span>Tap outside to return</span>
          </button>
        </div>
      )}

      <div className="sketch-quiz-layer">
        <div className="sketch-topbar">
          <span>{`${currentIndex + 1}/${quizQuestions.length}`}</span>
        </div>

        <div className="sketch-quest-strip" aria-label="Quiz progress">
          <span>Journey Log</span>
          <strong>{questionName}</strong>
          <small>{completedCount} choices saved</small>
        </div>

        <section
          className={`sketch-question-card sketch-pane-${scene.pane} has-options`}
        >
          <button
            className="sketch-dialogue"
            onClick={handleDialogueClick}
            type="button"
            aria-label={
              isTyping
                ? questionTitle
                : isFinalBeat
                  ? questionTitle
                  : "Continue dialogue"
            }
          >
            <span>{questionTitle}</span>
            <pre>
              {visibleText}
              {isTyping && <i aria-hidden="true">|</i>}
            </pre>
            {!isTyping && (
              <small>{isFinalBeat ? "Choose your move" : "Tap to continue"}</small>
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
