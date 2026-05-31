import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  initialScores,
  outcomeOrder,
  quizQuestions,
  resultProfiles,
} from "./data/quiz";
import type {
  OptionId,
  OutcomeId,
  PopupEvent,
  QuizOption,
  ScoreMap,
  ScreenPhase,
  SelectedAnswer,
  ToastAlert,
} from "./types";
import { cleanText } from "./utils/text";

type QuizState = {
  phase: ScreenPhase;
  currentQuestionIndex: number;
  scores: ScoreMap;
  selectedAnswers: SelectedAnswer[];
  activePopup: PopupEvent | null;
  resultId: OutcomeId | null;
  selectedOptionId: OptionId | null;
};

type CompletedEvent = {
  id: string;
  optionId: OptionId;
  optionTitle: string;
  title: string;
};

type QuizAction =
  | { type: "START" }
  | { type: "BEGIN_QUEST" }
  | { type: "ANSWER"; option: QuizOption }
  | { type: "CONTINUE_FROM_POPUP" }
  | { type: "REVEAL_RESULT" }
  | { type: "RESTART" };

const calculationDelayMs = 1900;
const interstitialDelayMs = 900;
const toastDurationMs = 3900;
const sceneIntroDelayMs = 2400;
const sceneTransitionDelayMs = 800;
const awakeningDelayMs = 950;

const sceneBackgrounds = {
  title: "/assets/dynamic-bg/title-screen.png",
  wcy: "/assets/isekai-ui/wcy-plaza-background.png",
  orientation: "/assets/dynamic-bg/bg-orientation-arena.png",
  classroom: "/assets/dynamic-bg/bg-classroom.png",
  cca: "/assets/dynamic-bg/bg-cca-fair.png",
  burnout: "/assets/dynamic-bg/bg-burnout-dark.png",
  weekend: "/assets/dynamic-bg/bg-weekend-portal.png",
} as const;

type SceneKey = keyof typeof sceneBackgrounds;

type SoundName =
  | "start"
  | "answer"
  | "skip"
  | "textBeep"
  | "scene"
  | "result"
  | "toastQuest"
  | "toastObjective"
  | "toastEvent"
  | "toastNavigation"
  | "toastWarning"
  | "toastInstance";

type ArtifactKind = "groupChat" | "burnout" | "portal";

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
    outcome,
    count: answers.filter((answer) => answer.primaryOutcome === outcome).length,
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

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "START":
      return { ...state, phase: "prelude" };
    case "BEGIN_QUEST":
      return { ...state, phase: "question" };
    case "ANSWER": {
      if (state.phase !== "question") {
        return state;
      }

      const currentQuestion = quizQuestions[state.currentQuestionIndex];
      const selectedAnswer: SelectedAnswer = {
        questionId: currentQuestion.id,
        optionId: action.option.id,
        weights: action.option.weights,
        primaryOutcome: action.option.primaryOutcome,
      };
      const selectedAnswers = [...state.selectedAnswers, selectedAnswer];
      const scores = mergeScores(state.scores, action.option.weights);
      const isFinalQuestion =
        state.currentQuestionIndex === quizQuestions.length - 1;

      if (currentQuestion.popup) {
        return {
          ...state,
          activePopup: currentQuestion.popup,
          scores,
          selectedAnswers,
          selectedOptionId: action.option.id,
          phase: "popup",
        };
      }

      if (isFinalQuestion) {
        return {
          ...state,
          scores,
          selectedAnswers,
          selectedOptionId: action.option.id,
          phase: "calculating",
          resultId: selectWinner(scores, selectedAnswers),
        };
      }

      return {
        ...state,
        scores,
        selectedAnswers,
        selectedOptionId: action.option.id,
        phase: "popup",
        activePopup: {
          id: `${currentQuestion.id}-complete`,
          title: "Quest Updated",
          message: "Choice logged. Loading next event...",
        },
      };
    }
    case "CONTINUE_FROM_POPUP": {
      const isFinalQuestion =
        state.currentQuestionIndex === quizQuestions.length - 1;

      if (isFinalQuestion) {
        return {
          ...state,
          activePopup: null,
          selectedOptionId: null,
          phase: "calculating",
          resultId: selectWinner(state.scores, state.selectedAnswers),
        };
      }

      return {
        ...state,
        activePopup: null,
        selectedOptionId: null,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        phase: "question",
      };
    }
    case "REVEAL_RESULT":
      return {
        ...state,
        phase: "result",
        resultId: state.resultId ?? selectWinner(state.scores, state.selectedAnswers),
      };
    case "RESTART":
      return createInitialState();
    default:
      return state;
  }
}

function createInitialState(): QuizState {
  return {
    phase: "start",
    currentQuestionIndex: 0,
    scores: { ...initialScores },
    selectedAnswers: [],
    activePopup: null,
    resultId: null,
    selectedOptionId: null,
  };
}

function getSceneKey(state: QuizState): SceneKey {
  if (state.phase === "start") {
    return "title";
  }

  switch (state.currentQuestionIndex) {
    case 1:
      return "orientation";
    case 3:
      return "classroom";
    case 4:
      return "cca";
    case 5:
    case 6:
      return "burnout";
    case 7:
      return "weekend";
    default:
      return "wcy";
  }
}

function useSceneTransition(sceneKey: SceneKey) {
  const [renderedSceneKey, setRenderedSceneKey] = useState(sceneKey);
  const [previousSceneKey, setPreviousSceneKey] = useState<SceneKey | null>(null);
  const renderedSceneKeyRef = useRef(sceneKey);

  useEffect(() => {
    if (sceneKey === renderedSceneKeyRef.current) {
      return;
    }

    setPreviousSceneKey(renderedSceneKeyRef.current);
    setRenderedSceneKey(sceneKey);
    renderedSceneKeyRef.current = sceneKey;

    const timeout = window.setTimeout(() => {
      setPreviousSceneKey(null);
    }, sceneTransitionDelayMs);

    return () => window.clearTimeout(timeout);
  }, [sceneKey]);

  return {
    previousSceneKey,
    renderedSceneKey,
    sceneTransitioning: previousSceneKey !== null,
  };
}

function useRpgSfx(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!enabled) {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        return null;
      }

      contextRef.current = new AudioContextCtor();
    }

    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume();
    }

    return contextRef.current;
  }, [enabled]);

  const play = useCallback(
    (name: SoundName) => {
      const context = getContext();

      if (!context) {
        return;
      }

      const now = context.currentTime + 0.01;
      const patterns: Record<SoundName, number[]> = {
        start: [392, 523, 784],
        answer: [440, 660],
        skip: [320],
        textBeep: [880],
        scene: [196, 294, 392],
        result: [523, 659, 784, 1046],
        toastQuest: [494, 659],
        toastObjective: [523, 659, 880],
        toastEvent: [330, 494, 660],
        toastNavigation: [262, 392, 523, 392],
        toastWarning: [150, 95, 150, 95, 70],
        toastInstance: [392, 523, 740, 988],
      };
      const waveform: OscillatorType =
        name === "toastWarning"
          ? "sawtooth"
          : name === "toastInstance" || name === "toastNavigation"
            ? "triangle"
            : "square";

      patterns[name].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = now + index * 0.075;
        const duration =
          name === "toastWarning"
            ? 0.16
            : name === "textBeep"
              ? 0.035
            : name === "toastInstance"
              ? 0.12
              : 0.085;
        const peakVolume =
          name === "toastWarning"
            ? 0.085
            : name === "textBeep"
              ? 0.018
            : name === "toastInstance"
              ? 0.06
              : 0.045;

        oscillator.type = waveform;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(peakVolume, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
      });
    },
    [getContext],
  );

  const playSystemBoot = useCallback(() => play("start"), [play]);
  const playTextBeep = useCallback(() => play("textBeep"), [play]);
  const playNotificationAlert = useCallback(
    (kind: Exclude<ToastAlert["kind"], "warning"> = "quest") => {
      const soundByKind: Record<Exclude<ToastAlert["kind"], "warning">, SoundName> = {
        event: "toastEvent",
        instance: "toastInstance",
        navigation: "toastNavigation",
        objective: "toastObjective",
        quest: "toastQuest",
      };

      play(soundByKind[kind]);
    },
    [play],
  );
  const playCrisisWarning = useCallback(() => play("toastWarning"), [play]);
  const playOptionSelect = useCallback(() => play("answer"), [play]);

  return {
    play,
    playCrisisWarning,
    playNotificationAlert,
    playOptionSelect,
    playSystemBoot,
    playTextBeep,
    unlock: getContext,
  };
}

function useSkippableTypewriter(
  text: string,
  enabled: boolean,
  onCharacterTick: () => void,
  speed = 18,
) {
  const [visibleText, setVisibleText] = useState("");
  const [complete, setComplete] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const onCharacterTickRef = useRef(onCharacterTick);

  useEffect(() => {
    onCharacterTickRef.current = onCharacterTick;
  }, [onCharacterTick]);

  const clearTypingInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const skip = useCallback(() => {
    if (!isAnimated) {
      return;
    }

    clearTypingInterval();
    setVisibleText(text);
    setComplete(true);
    setIsAnimated(false);
  }, [clearTypingInterval, isAnimated, text]);

  useEffect(() => {
    clearTypingInterval();

    if (!enabled) {
      setVisibleText("");
      setComplete(false);
      setIsAnimated(false);
      return;
    }

    setVisibleText("");
    setComplete(false);
    setIsAnimated(true);

    let index = 0;
    intervalRef.current = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));

      const character = text[index - 1];
      if (character && character.trim() && index % 3 === 0) {
        onCharacterTickRef.current();
      }

      if (index >= text.length) {
        clearTypingInterval();
        setComplete(true);
        setIsAnimated(false);
      }
    }, speed);

    return clearTypingInterval;
  }, [clearTypingInterval, enabled, speed, text]);

  return { visibleText, complete, isAnimated, skip };
}

type DialogueStep = {
  text: string;
  pauseAfter?: number;
};

function useSequencedTypewriter(
  steps: DialogueStep[],
  enabled: boolean,
  onCharacterTick: () => void,
  speed = 18,
) {
  const [visibleText, setVisibleText] = useState("");
  const [complete, setComplete] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const onCharacterTickRef = useRef(onCharacterTick);
  const fullText = steps.map((step) => step.text).join("");

  useEffect(() => {
    onCharacterTickRef.current = onCharacterTick;
  }, [onCharacterTick]);

  const clearTypingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const skip = useCallback(() => {
    if (!isAnimated) {
      return;
    }

    clearTypingTimeout();
    setVisibleText(fullText);
    setComplete(true);
    setIsAnimated(false);
  }, [clearTypingTimeout, fullText, isAnimated]);

  useEffect(() => {
    clearTypingTimeout();

    if (!enabled) {
      setVisibleText("");
      setComplete(false);
      setIsAnimated(false);
      return;
    }

    let stepIndex = 0;
    let characterIndex = 0;
    let nextText = "";
    let cancelled = false;

    setVisibleText("");
    setComplete(false);
    setIsAnimated(true);

    const queue = (delay: number) => {
      timeoutRef.current = window.setTimeout(tick, delay);
    };

    const tick = () => {
      if (cancelled) {
        return;
      }

      const step = steps[stepIndex];

      if (!step) {
        setVisibleText(fullText);
        setComplete(true);
        setIsAnimated(false);
        timeoutRef.current = null;
        return;
      }

      if (characterIndex < step.text.length) {
        const character = step.text[characterIndex];
        nextText += character;
        characterIndex += 1;
        setVisibleText(nextText);

        if (character.trim() && nextText.length % 3 === 0) {
          onCharacterTickRef.current();
        }

        queue(speed);
        return;
      }

      stepIndex += 1;
      characterIndex = 0;
      queue(step.pauseAfter ?? 0);
    };

    queue(0);

    return () => {
      cancelled = true;
      clearTypingTimeout();
    };
  }, [clearTypingTimeout, enabled, fullText, speed]);

  return { visibleText, complete, isAnimated, skip };
}

function App() {
  const [state, dispatch] = useReducer(quizReducer, undefined, createInitialState);
  const [awakeningVisible, setAwakeningVisible] = useState(false);
  const [introCanStart, setIntroCanStart] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sceneIntroVisible, setSceneIntroVisible] = useState(false);
  const question = quizQuestions[state.currentQuestionIndex];
  const result = state.resultId ? resultProfiles[state.resultId] : null;
  const sceneKey = getSceneKey(state);
  const {
    play,
    playCrisisWarning,
    playNotificationAlert,
    playOptionSelect,
    playSystemBoot,
    playTextBeep,
    unlock,
  } = useRpgSfx(sfxEnabled);
  const { previousSceneKey, renderedSceneKey, sceneTransitioning } =
    useSceneTransition(sceneKey);
  const previousSoundSceneRef = useRef(sceneKey);

  useEffect(() => {
    if (state.phase !== "popup") {
      return;
    }

    const popupDelay =
      state.activePopup?.id === "burnout-disappear"
        ? 3400
        : state.activePopup?.imageSrc
          ? 2300
          : interstitialDelayMs;
    const timeout = window.setTimeout(() => {
      dispatch({ type: "CONTINUE_FROM_POPUP" });
    }, popupDelay);

    return () => window.clearTimeout(timeout);
  }, [state.activePopup?.id, state.activePopup?.imageSrc, state.phase]);

  useEffect(() => {
    if (state.phase !== "calculating") {
      return;
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: "REVEAL_RESULT" });
    }, calculationDelayMs);

    return () => window.clearTimeout(timeout);
  }, [state.phase]);

  useEffect(() => {
    if (previousSoundSceneRef.current !== sceneKey) {
      previousSoundSceneRef.current = sceneKey;

      if (state.phase !== "start") {
        play("scene");
      }
    }
  }, [play, sceneKey, state.phase]);

  useEffect(() => {
    if (state.phase === "result") {
      play("result");
    }
  }, [play, state.phase]);

  useEffect(() => {
    if (state.phase === "popup" && state.activePopup?.id === "burnout-disappear") {
      playCrisisWarning();
    }
  }, [playCrisisWarning, state.activePopup?.id, state.phase]);

  useEffect(() => {
    if (state.phase !== "question" || state.currentQuestionIndex === 0) {
      setSceneIntroVisible(false);
      return;
    }

    setSceneIntroVisible(true);

    const timeout = window.setTimeout(() => {
      setSceneIntroVisible(false);
    }, sceneIntroDelayMs);

    return () => window.clearTimeout(timeout);
  }, [state.currentQuestionIndex, state.phase]);

  useEffect(() => {
    if (
      state.phase === "question" &&
      (state.currentQuestionIndex === 5 || state.currentQuestionIndex === 6)
    ) {
      playCrisisWarning();
    }
  }, [playCrisisWarning, state.currentQuestionIndex, state.phase]);

  const triggerStart = () => {
    setAwakeningVisible(true);
    setIntroCanStart(false);
    unlock();
    playSystemBoot();
    dispatch({ type: "START" });

    window.setTimeout(() => {
      setAwakeningVisible(false);
      setIntroCanStart(true);
    }, awakeningDelayMs);
  };

  const isSceneIntro = state.phase === "question" && sceneIntroVisible;
  const isStoryPhase = state.phase === "start" || state.phase === "prelude";
  const isGlitching =
    state.phase === "popup" && state.activePopup?.id === "burnout-disappear";

  return (
    <main
      className={`game-shell scene-${renderedSceneKey} transition-${renderedSceneKey} ${
        sceneTransitioning ? "is-scene-transitioning" : ""
      } ${isSceneIntro ? "is-scene-intro" : ""} ${
        isGlitching ? "is-glitching" : ""
      }`}
      style={
        { "--scene-bg": `url("${sceneBackgrounds[renderedSceneKey]}")` } as CSSProperties
      }
    >
      {previousSceneKey && (
        <div
          className="world-layer world-layer-previous"
          aria-hidden="true"
          style={
            {
              "--scene-bg": `url("${sceneBackgrounds[previousSceneKey]}")`,
            } as CSSProperties
          }
        />
      )}
      <div className="world-layer world-layer-current" aria-hidden="true" />
      <div className={`ambient-layer ambient-${renderedSceneKey}`} aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      {awakeningVisible && (
        <div className="awakening-blink" aria-hidden="true">
          <span className="eyelid eyelid-top" />
          <span className="eyelid eyelid-bottom" />
        </div>
      )}
      <section
        className={`hud ${state.phase === "start" ? "is-title-hud" : ""} ${
          state.phase === "prelude" ? "is-prelude-hud" : ""
        }`}
      >
        {isSceneIntro && <SceneIntroCard currentIndex={state.currentQuestionIndex} question={question} />}

        {!isStoryPhase && !isSceneIntro && <StatusRail state={state} />}
        {!isStoryPhase && !isSceneIntro && (
          <button
            className="sfx-toggle"
            onClick={() => setSfxEnabled((isEnabled) => !isEnabled)}
            type="button"
          >
            {sfxEnabled ? "SFX ON" : "SFX OFF"}
          </button>
        )}

        {state.phase === "start" && (
          <StartScreen
            playSystemBoot={playSystemBoot}
            onStart={triggerStart}
          />
        )}

        {state.phase === "prelude" && (
          <IntroSequence
            canStart={introCanStart}
            onComplete={() => dispatch({ type: "BEGIN_QUEST" })}
            playNotificationAlert={playNotificationAlert}
            playTextBeep={playTextBeep}
          />
        )}

        {state.phase === "question" && (
          <QuestionScreen
            key={question.id}
            currentIndex={state.currentQuestionIndex}
            onAnswer={(option) => {
              playOptionSelect();
              dispatch({ type: "ANSWER", option });
            }}
            playCrisisWarning={playCrisisWarning}
            playNotificationAlert={playNotificationAlert}
            playSound={play}
            playTextBeep={playTextBeep}
            question={question}
            sceneReady={!sceneIntroVisible}
          />
        )}

        {state.phase === "popup" && (
          <InterstitialPopup popup={state.activePopup} />
        )}

        {state.phase === "calculating" && <CalculationScreen />}

        {state.phase === "result" && result && (
          <ResultScreen result={result} onRestart={() => dispatch({ type: "RESTART" })} />
        )}
      </section>
    </main>
  );
}

function StatusRail({ state }: { state: QuizState }) {
  const answered = state.selectedAnswers.length;
  const [isLogOpen, setIsLogOpen] = useState(false);
  const activeQuestion = quizQuestions[state.currentQuestionIndex];
  const activeQuest =
    state.phase === "result"
      ? "Freshman Type Revealed"
      : state.phase === "calculating"
        ? "Calculating build..."
        : state.phase === "popup"
          ? "Updating quest log..."
          : cleanText(activeQuestion.title.replace(/^Q\d+\.\s*/, ""));
  const completedEvents = state.selectedAnswers
    .map((answer) => {
      const question = quizQuestions.find(({ id }) => id === answer.questionId);
      const selectedOption = question?.options.find(
        ({ id }) => id === answer.optionId,
      );

      return question && selectedOption
        ? {
            id: answer.questionId,
            optionId: answer.optionId,
            optionTitle: cleanText(selectedOption.label),
            title: cleanText(question.title.replace(/^Q\d+\.\s*/, "")),
          }
        : null;
    })
    .filter((event): event is CompletedEvent => event !== null);
  const activeStep =
    state.phase === "result" || state.phase === "calculating"
      ? quizQuestions.length
      : Math.min(state.currentQuestionIndex + 1, quizQuestions.length);

  return (
    <aside className="status-rail quest-tracker" aria-label="Quiz status">
      <div className="quest-header">
        <p>Quest Log</p>
        <strong>
          {activeStep}/{quizQuestions.length}
        </strong>
      </div>

      <div className="quest-objective">
        <span>Active Objective</span>
        <strong>{activeQuest}</strong>
        <div className="quest-progress" aria-label={`${answered} quests completed`}>
          {quizQuestions.map((question, index) => {
            const isCompleted = index < answered;
            const isCurrent = index === state.currentQuestionIndex && state.phase === "question";

            return (
              <span
                className={`quest-node ${
                  isCompleted ? "is-complete" : isCurrent ? "is-current" : ""
                }`}
                key={question.id}
                title={cleanText(question.title)}
              />
            );
          })}
        </div>
      </div>

      <button
        className="quest-completed"
        onClick={() => setIsLogOpen(true)}
        type="button"
      >
        <span>Quest Archive</span>
        <strong>{completedEvents.length} records</strong>
        <small>Review past choices</small>
      </button>

      {isLogOpen && (
        <CompletedEventsWindow
          completedEvents={completedEvents}
          onClose={() => setIsLogOpen(false)}
        />
      )}
    </aside>
  );
}

function CompletedEventsWindow({
  completedEvents,
  onClose,
}: {
  completedEvents: CompletedEvent[];
  onClose: () => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const closeWindow = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyPress = () => closeWindow();

    document.addEventListener("keydown", handleKeyPress, true);
    document.addEventListener("keyup", handleKeyPress, true);

    return () => {
      document.removeEventListener("keydown", handleKeyPress, true);
      document.removeEventListener("keyup", handleKeyPress, true);

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [closeWindow]);

  return createPortal(
    <div
      className={`event-log-overlay ${isClosing ? "is-closing" : ""}`}
      onKeyDown={closeWindow}
      ref={overlayRef}
      role="presentation"
      tabIndex={-1}
    >
      <button
        aria-label="Return to game"
        className="event-log-backdrop"
        onClick={closeWindow}
        type="button"
      />
      <section
        aria-labelledby="completed-events-heading"
        aria-modal="true"
        className="event-log-window"
        role="dialog"
      >
        <div className="event-log-header">
          <span>Adventure Record</span>
          <h2 id="completed-events-heading">Quest Archive</h2>
          <button onClick={closeWindow} type="button">
            Return
          </button>
        </div>

        {completedEvents.length ? (
          <ol className="completed-event-list">
            {completedEvents.map((event, index) => (
              <li key={event.id}>
                <span className="event-index">{index + 1}</span>
                <span className="event-record">
                  <strong>{cleanText(event.title)}</strong>
                  <small>
                    Choice {event.optionId}: {cleanText(event.optionTitle)}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No records sealed yet.</p>
        )}
      </section>
    </div>,
    document.body,
  );
}

function HolographicPanel({
  children,
  className = "",
  interactive = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`holo-panel ${interactive ? "is-interactive" : ""} ${className}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="panel-grid" />
      <div className="panel-content">{children}</div>
    </div>
  );
}

function NarrativeBox({
  children,
  className = "",
  interactive = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <HolographicPanel
      className={`narrative-box ${className}`}
      interactive={interactive}
      onClick={onClick}
    >
      {children}
    </HolographicPanel>
  );
}

function StartScreen({
  onStart,
  playSystemBoot,
}: {
  onStart: () => void;
  playSystemBoot: () => void;
}) {
  const [bootStep, setBootStep] = useState<
    "system" | "sync" | "welcome" | "title"
  >("system");

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setBootStep("sync"), 1100);
    const welcomeTimer = window.setTimeout(() => setBootStep("welcome"), 2200);
    const titleTimer = window.setTimeout(() => {
      setBootStep("title");
      playSystemBoot();
    }, 3600);

    return () => {
      window.clearTimeout(syncTimer);
      window.clearTimeout(welcomeTimer);
      window.clearTimeout(titleTimer);
    };
  }, [playSystemBoot]);

  const bootNoticeByStep: Record<Exclude<typeof bootStep, "title">, ToastAlert> = {
    system: {
      id: "boot-system",
      kind: "objective",
      message: "",
      title: "System update in progress.",
    },
    sync: {
      id: "boot-sync",
      kind: "navigation",
      message: "Synchronising player profile.",
      title: "Player signature detected.",
    },
    welcome: {
      id: "boot-welcome",
      kind: "objective",
      message: "The Freshman Arc has begun.",
      title: "Welcome, Player.",
    },
  };

  return (
    <div className={`title-flow is-${bootStep}`}>
      {bootStep !== "title" && (
        <div className="boot-sequence" aria-live="polite">
          <SystemNoticeFrame
            className={`boot-system-layer boot-${bootStep}`}
            icon={bootStep === "sync" ? "SYNC" : "SYS"}
            toast={bootNoticeByStep[bootStep]}
          />
          {bootStep === "sync" && <div className="boot-link-scan" aria-hidden="true" />}
        </div>
      )}

      <button
        aria-label="Start The Freshman Arc"
        className="title-screen"
        onClick={onStart}
        type="button"
      >
        <span className="sr-only">What NBS Freshman Are You?</span>
        <span className="press-start">PRESS START</span>
      </button>
    </div>
  );
}

const introFrames: Array<{
  id: string;
  layer: "narrative" | "system";
  lines: string[];
  notice?: ToastAlert;
  duration: number;
}> = [
  {
    id: "arrival",
    layer: "narrative",
    lines: [
      "It’s your first week at NBS.",
      "You walk into WCY Plaza to find your orientation room.",
      "The air feels juuust slightly off. The lights flicker.",
    ],
    duration: 2600,
  },
  {
    id: "system",
    layer: "system",
    lines: ["System update in progress."],
    duration: 1700,
  },
  {
    id: "welcome",
    layer: "system",
    lines: ["Welcome, Player.", "The Freshman Arc has begun."],
    duration: 2500,
  },
  {
    id: "quest",
    layer: "system",
    lines: [],
    notice: {
      id: "intro-quest-log",
      kind: "quest",
      title: "Quest Log Updated",
      message: "Complete events to determine your build.",
    },
    duration: 3200,
  },
  {
    id: "isekai",
    layer: "narrative",
    lines: ["The plaza glitches out.", "“...Did I just get isekai’d into NBS?”"],
    duration: 1800,
  },
  {
    id: "objective",
    layer: "system",
    lines: [],
    notice: {
      id: "intro-objective",
      kind: "objective",
      title: "New Objective Unlocked",
      message: "Attend The Orientation.",
    },
    duration: 2300,
  },
];

function IntroSequence({
  canStart,
  onComplete,
  playNotificationAlert,
  playTextBeep,
}: {
  canStart: boolean;
  onComplete: () => void;
  playNotificationAlert: (kind?: Exclude<ToastAlert["kind"], "warning">) => void;
  playTextBeep: () => void;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [narrativeReady, setNarrativeReady] = useState(false);
  const frame = introFrames[frameIndex];

  useEffect(() => {
    if (!canStart) {
      return;
    }

    const riftClassName = "is-rift-awakening";

    if (frame.id === "isekai") {
      document.body.classList.add(riftClassName);
    } else {
      document.body.classList.remove(riftClassName);
    }

    return () => {
      document.body.classList.remove(riftClassName);
    };
  }, [canStart, frame.id]);

  useEffect(() => {
    if (!canStart) {
      return;
    }

    setNarrativeReady(false);
  }, [canStart, frame.id]);

  useEffect(() => {
    if (!canStart) {
      return;
    }

    if (frame.layer === "system") {
      playNotificationAlert(frame.notice?.kind === "warning" ? "quest" : frame.notice?.kind);
    }

    if (frame.layer === "narrative" && !narrativeReady) {
      return;
    }

    const frameDelay =
      frame.layer === "narrative" && frame.id === "isekai" ? 2500 : frame.duration;

    const timeout = window.setTimeout(() => {
      if (frameIndex >= introFrames.length - 1) {
        onComplete();
        return;
      }

      setFrameIndex((index) => index + 1);
    }, frameDelay);

    return () => window.clearTimeout(timeout);
  }, [
    frame.duration,
    frame.id,
    frame.layer,
    frame.notice?.kind,
    frameIndex,
    narrativeReady,
    onComplete,
    playNotificationAlert,
    canStart,
  ]);

  if (!canStart) {
    return <div className="intro-sequence intro-waiting" aria-hidden="true" />;
  }

  return (
    <div className={`intro-sequence intro-${frame.id}`}>
      {frame.id === "isekai" && (
        <div className="transport-overlay" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {frame.layer === "system" ? (
        <SystemNoticeFrame
          className="intro-system-layer"
          durationMs={frame.duration}
          icon={frame.notice ? getToastIcon(frame.notice.kind) : "SYS"}
          key={frame.id}
          toast={{
            id: frame.notice?.id ?? `intro-${frame.id}`,
            kind: frame.notice?.kind ?? "objective",
            message: cleanText(frame.notice?.message ?? frame.lines.slice(1).join(" ")),
            title: cleanText(frame.notice?.title ?? frame.lines[0]),
          }}
        />
      ) : (
        <IntroNarrativeFrame
          frame={frame}
          onReady={() => setNarrativeReady(true)}
          playTextBeep={playTextBeep}
        />
      )}
    </div>
  );
}

function IntroNarrativeFrame({
  frame,
  onReady,
  playTextBeep,
}: {
  frame: (typeof introFrames)[number];
  onReady: () => void;
  playTextBeep: () => void;
}) {
  const shouldType = frame.layer === "narrative";
  const typedText = cleanText(frame.lines.join("\n"));
  const { complete, isAnimated, skip, visibleText } = useSkippableTypewriter(
    typedText,
    shouldType,
    playTextBeep,
    24,
  );

  useEffect(() => {
    if (!shouldType || complete) {
      onReady();
    }
  }, [complete, onReady, shouldType]);

  return (
    <NarrativeBox
      className="intro-panel"
      interactive={isAnimated}
      key={frame.id}
      onClick={skip}
    >
      <div className="intro-copy" aria-live="polite">
        {shouldType ? (
          <pre>
            {visibleText}
            {!complete && <span className="cursor">_</span>}
          </pre>
        ) : (
          frame.lines.map((line) => <p key={line}>{cleanText(line)}</p>)
        )}
      </div>
    </NarrativeBox>
  );
}

function SceneIntroCard({
  currentIndex,
  question,
}: {
  currentIndex: number;
  question: (typeof quizQuestions)[number];
}) {
  const questionName = question.title.replace(/^Q\d+\.\s*/, "");

  return (
    <div className="scene-intro-card" role="status" aria-live="polite">
      <span>Entering Scene {currentIndex + 1}</span>
      <strong>{questionName}</strong>
      <small>Loading environment...</small>
    </div>
  );
}

const groupChatAsset = "/assets/story/group-chat-biz-case-grp-3.png";
const burnoutNotificationAsset = "/assets/story/burnout-notification-card.png";

function getInitialToasts(question: (typeof quizQuestions)[number]) {
  if (
    question.id === "finding-your-class" ||
    question.id === "group-project" ||
    question.id === "orientation-arena" ||
    question.id === "cca-fair" ||
    question.id === "burnout-monster" ||
    question.id === "finals-mode" ||
    question.id === "weekend-portal"
  ) {
    return [];
  }

  return question.toasts ?? [];
}

function getDialogueSteps(
  question: (typeof quizQuestions)[number],
  questionText: string,
  phase: number,
): DialogueStep[] {
  if (question.id !== "orientation-arena") {
    if (question.id === "finding-your-class") {
      if (phase === 0) {
        return [{ text: "" }];
      }

      if (phase === 1) {
        return [
          {
            text:
              "You blink—\nand you're back at the WCY Plaza entrance again.",
          },
        ];
      }

      if (phase === 2) {
        return [
          {
            text:
              "You start walking.\nLeft turn. Right turn. Another corridor. You are unable to find your class.\n\nWhat’s your next move?",
          },
        ];
      }

      return [
        {
          text:
            "You start walking.\nLeft turn. Right turn. Another corridor. You are unable to find your class.\n\nWhat’s your next move?",
        },
      ];
    }

    if (question.id === "group-project") {
      if (phase === 0) {
        return [
          {
            text:
              "You finally reach the classroom.\nThe prof says:\n“Form groups.”\nIt happens instantly. People cluster like they planned for this before class.\nYou’re in a group chat now:",
          },
        ];
      }

      return [
        {
          text:
            phase === 1
              ? "No one says anything.\n\nWhat do you do?"
              : "No one says anything.\n\nWhat do you do?",
        },
      ];
    }

    if (question.id === "cca-fair") {
      if (phase === 0) {
        return [
          {
            text:
              "Class ends.\nYou try to leave campus,\nYou think you’re finally done.\nthe game: lol no",
          },
        ];
      }

      if (phase === 1) {
        return [
          {
            text: "Your path automatically reroutes.",
          },
        ];
      }

      if (phase === 2) {
        return [
          {
            text:
              "You find yourself back in WCY Plaza. Yet again.\nBut this time, your surroundings are louder.",
          },
        ];
      }

      if (phase === 3) {
        return [
          {
            text:
              "Someone hands you a tote bag. Another person pitches you an offer before you can react.\nYou didn’t plan for this.\n\nYour move?",
          },
        ];
      }

      return [
        {
          text:
            "Someone hands you a tote bag. Another person pitches you an offer before you can react.\nYou didn’t plan for this.\n\nYour move?",
        },
      ];
    }

    if (question.id === "burnout-monster") {
      if (phase === 1) {
        return [{ text: "" }];
      }

      if (phase === 2) {
        return [
          {
            text: "It doesn’t stop.\nThen:",
          },
        ];
      }

      if (phase === 4) {
        return [
          {
            text: "A figure forms.",
          },
        ];
      }

      if (phase >= 5) {
        return [
          {
            text: "The Burnout Monster remains in front of you.\nYou are not prepared.\n\nChoose a strategy:",
          },
        ];
      }

      return [
        {
          text: "The environment suddenly darkens.",
        },
      ];
    }

    if (question.id === "finals-mode") {
      return [
        {
          text:
            "Then, before you can catch a break:\n“FINALS IN 14 DAYS.”\nTime speeds up.\nDays feel shorter.\nYou check the calendar.\n\nWhat now?",
        },
      ];
    }

    if (question.id === "weekend-portal") {
      if (phase === 0) {
        return [
          {
            text: "A glowing portal opens in front of you.",
          },
        ];
      }

      return [
        {
          text: "A glowing portal opens in front of you.\n\nWhat do you do?",
        },
      ];
    }

    return [{ text: questionText }];
  }

  return [
    { text: "You enter WCY Plaza and suddenly observe:\n", pauseAfter: 300 },
    { text: "Loud cheers\n", pauseAfter: 300 },
    { text: "Seniors hyping the crowd\n", pauseAfter: 300 },
    { text: "Friend groups forming in real time.\n", pauseAfter: 300 },
    { text: "You’ve entered the Orientation Arena.\n\nWhat do you do?" },
  ];
}

function renderDialogueText(text: string, questionId: string) {
  if (questionId !== "cca-fair") {
    return text;
  }

  const rerouteIndex = text.indexOf("reroutes");

  if (rerouteIndex === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, rerouteIndex)}
      <span className="story-glitch-word">reroutes</span>
      {text.slice(rerouteIndex + "reroutes".length)}
    </>
  );
}

const artifactConfig: Record<
  ArtifactKind,
  {
    asset: string;
    eyebrow: string;
    title: string;
    message: string;
    thumbLabel: string;
  }
> = {
  burnout: {
    asset: "/assets/isekai-ui/burnout-monster.png",
    eyebrow: "Boss Encounter",
    message: "The Burnout Monster has spawned.",
    thumbLabel: "Boss",
    title: "Burnout Monster",
  },
  groupChat: {
    asset: groupChatAsset,
    eyebrow: "Group Chat Unlocked",
    message: "Biz Case grp 3 is now active. No one says anything.",
    thumbLabel: "Chat",
    title: "Biz Case grp 3",
  },
  portal: {
    asset: "/assets/isekai-ui/weekend-portal.png",
    eyebrow: "Instance Available",
    message: "Weekend instance available. Forty-eight hours only.",
    thumbLabel: "Portal",
    title: "Weekend Portal",
  },
};

function ArtifactPopup({
  artifact,
  onClose,
}: {
  artifact: ArtifactKind | null;
  onClose: () => void;
}) {
  if (!artifact) {
    return null;
  }

  const config = artifactConfig[artifact];

  return createPortal(
    <div className={`artifact-overlay artifact-${artifact}`}>
      <button
        aria-label="Return to question"
        className="artifact-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={config.title}
        aria-modal="true"
        className="artifact-window"
        role="dialog"
      >
        <p className="artifact-eyebrow">{config.eyebrow}</p>
        <img alt="" src={config.asset} />
        <div className="artifact-copy">
          <strong>{config.title}</strong>
          <span>{config.message}</span>
        </div>
        <button className="artifact-return" onClick={onClose} type="button">
          Return to Scene
        </button>
      </section>
    </div>,
    document.body,
  );
}

function ArtifactTray({
  artifacts,
  onOpen,
}: {
  artifacts: ArtifactKind[];
  onOpen: (artifact: ArtifactKind) => void;
}) {
  if (!artifacts.length) {
    return null;
  }

  return (
    <div className="artifact-tray" aria-label="Scene artifacts">
      {artifacts.map((artifact) => {
        const config = artifactConfig[artifact];

        return (
          <button
            className={`artifact-token artifact-token-${artifact}`}
            key={artifact}
            onClick={() => onOpen(artifact)}
            type="button"
          >
            <img alt="" src={config.asset} />
            <span>{config.thumbLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function NotificationStack() {
  const notifications = [
    { label: "DEADLINE", detail: "2359 submission" },
    { label: "MEETING", detail: "Group call pending" },
    { label: "UNREAD", detail: "12 new messages" },
    { label: "ARE YOU FREE?", detail: "Reply requested" },
  ];

  return (
    <div className="notification-stack" aria-hidden="true">
      {notifications.map((notification, index) => (
        <div
          className="stacked-notification"
          key={`${notification.label}-${index}`}
          style={{ "--stack-index": index } as CSSProperties}
        >
          <img alt="" src={burnoutNotificationAsset} />
          <span>
            <strong>{notification.label}</strong>
            <small>{notification.detail}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function QuestionScreen({
  currentIndex,
  onAnswer,
  playCrisisWarning,
  playNotificationAlert,
  playSound,
  playTextBeep,
  question,
  sceneReady,
}: {
  currentIndex: number;
  onAnswer: (option: QuizOption) => void;
  playCrisisWarning: () => void;
  playNotificationAlert: (kind?: Exclude<ToastAlert["kind"], "warning">) => void;
  playSound: (name: SoundName) => void;
  playTextBeep: () => void;
  question: (typeof quizQuestions)[number];
  sceneReady: boolean;
}) {
  const questionName = cleanText(question.title.replace(/^Q\d+\.\s*/, ""));
  const questionText = cleanText(`${question.scenario}\n\n${question.prompt}`);
  const [phase, setPhase] = useState(0);
  const [showTimeFliesScene, setShowTimeFliesScene] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind | null>(null);
  const [seenArtifacts, setSeenArtifacts] = useState<Record<ArtifactKind, boolean>>({
    burnout: false,
    groupChat: false,
    portal: false,
  });
  const dialogueSteps = useMemo(
    () => getDialogueSteps(question, questionText, phase),
    [phase, question, questionText],
  );
  const currentDialogueText = useMemo(
    () => dialogueSteps.map((step) => step.text).join(""),
    [dialogueSteps],
  );
  const initialToasts = useMemo(() => getInitialToasts(question), [question]);
  const [activeToastIndex, setActiveToastIndex] = useState<number | null>(null);
  const [dialogueReady, setDialogueReady] = useState(false);
  const [optionsReady, setOptionsReady] = useState(false);
  const [storyToast, setStoryToast] = useState<ToastAlert | null>(null);
  const [orientationEventDone, setOrientationEventDone] = useState(false);
  const [classNavigationDone, setClassNavigationDone] = useState(false);
  const [groupProjectEventDone, setGroupProjectEventDone] = useState(false);
  const [ccaEventDone, setCcaEventDone] = useState(false);
  const [weekendSystemDone, setWeekendSystemDone] = useState(false);
  const [finalsSilence, setFinalsSilence] = useState(false);
  const [awaitingPhaseAdvance, setAwaitingPhaseAdvance] = useState(false);
  const storyToastTimeoutRef = useRef<number | null>(null);
  const storyFxTimersRef = useRef<number[]>([]);
  const storyBeatRefs = useRef<Record<string, boolean>>({});
  const typewriterEnabled =
    dialogueReady &&
    !(question.id === "finding-your-class" && phase === 0) &&
    !(question.id === "burnout-monster" && phase === 1);
  const { visibleText, complete, isAnimated, skip } = useSequencedTypewriter(
    dialogueSteps,
    typewriterEnabled,
    playTextBeep,
  );
  const phaseTextComplete = complete && visibleText === currentDialogueText;
  const visibleArtifacts = useMemo<ArtifactKind[]>(() => {
    const nextArtifacts: ArtifactKind[] = [];

    if (question.id === "group-project" && seenArtifacts.groupChat) {
      nextArtifacts.push("groupChat");
    }

    if (question.id === "burnout-monster" && seenArtifacts.burnout) {
      nextArtifacts.push("burnout");
    }

    if (question.id === "weekend-portal" && seenArtifacts.portal) {
      nextArtifacts.push("portal");
    }

    return nextArtifacts;
  }, [question.id, seenArtifacts]);
  const showNotificationStack = question.id === "burnout-monster" && phase >= 1;
  const activeToast =
    storyToast ??
    (activeToastIndex === null ? null : initialToasts[activeToastIndex] ?? null);

  const showStoryToast = useCallback((toast: ToastAlert, duration = toastDurationMs) => {
    if (storyToastTimeoutRef.current !== null) {
      window.clearTimeout(storyToastTimeoutRef.current);
    }

    setStoryToast(toast);
    storyToastTimeoutRef.current = window.setTimeout(() => {
      setStoryToast(null);
      storyToastTimeoutRef.current = null;
    }, duration);
  }, []);

  const closeArtifact = useCallback(() => {
    if (!activeArtifact) {
      return;
    }

    setSeenArtifacts((artifacts) => ({
      ...artifacts,
      [activeArtifact]: true,
    }));

    if (question.id === "group-project" && activeArtifact === "groupChat" && phase === 0) {
      setPhase(1);
    }

    if (question.id === "burnout-monster" && activeArtifact === "burnout" && phase === 4) {
      setPhase(5);
    }

    if (question.id === "weekend-portal" && activeArtifact === "portal" && phase === 0) {
      setPhase(1);
    }

    setActiveArtifact(null);
  }, [activeArtifact, phase, question.id]);

  const advancePhase = useCallback(() => {
    if (!awaitingPhaseAdvance) {
      return;
    }

    setAwaitingPhaseAdvance(false);

    if (question.id === "finding-your-class") {
      if (phase === 1) {
        showStoryToast(
          {
            id: "class-objective-story",
            kind: "objective",
            title: "New Objective Unlocked",
            message: "Attend Your First Class.",
          },
          3400,
        );
        setPhase(2);
        return;
      }

      if (phase === 2) {
        return;
      }
    }

    if (question.id === "group-project") {
      if (phase === 0) {
        playNotificationAlert("event");
        setActiveArtifact("groupChat");
        return;
      }

      if (phase === 1) {
        return;
      }
    }

    if (question.id === "cca-fair") {
      if (phase === 0) {
        setPhase(1);
        return;
      }

      if (phase === 1) {
        showStoryToast(
          {
            id: "rerouting-route-update",
            kind: "navigation",
            title: "Route Updated",
            message: "Returning to WCY Plaza.",
          },
          3400,
        );
        setPhase(2);
        return;
      }

      if (phase === 2) {
        setPhase(3);
        return;
      }

      if (phase === 3) {
        return;
      }
    }

    if (question.id === "burnout-monster") {
      if (phase === 0) {
        setPhase(1);
        return;
      }

      if (phase === 1) {
        setPhase(2);
        return;
      }

      if (phase === 4 && !seenArtifacts.burnout) {
        playCrisisWarning();
        setActiveArtifact("burnout");
        return;
      }
    }

    if (question.id === "weekend-portal") {
      if (phase === 0) {
        playNotificationAlert("instance");
        setActiveArtifact("portal");
        return;
      }

      if (phase === 1) {
        return;
      }

      if (phase === 2) {
        return;
      }
    }
  }, [
    awaitingPhaseAdvance,
    phase,
    playCrisisWarning,
    playNotificationAlert,
    question.id,
    seenArtifacts.burnout,
    showStoryToast,
  ]);

  useEffect(() => {
    setPhase(0);
    setShowTimeFliesScene(false);
    setActiveArtifact(null);
    setSeenArtifacts({
      burnout: false,
      groupChat: false,
      portal: false,
    });
    setStoryToast(null);
    setOrientationEventDone(false);
    setClassNavigationDone(false);
    setGroupProjectEventDone(false);
    setCcaEventDone(false);
    setWeekendSystemDone(false);
    setFinalsSilence(false);
    setAwaitingPhaseAdvance(false);
    storyBeatRefs.current = {};

    if (storyToastTimeoutRef.current !== null) {
      window.clearTimeout(storyToastTimeoutRef.current);
      storyToastTimeoutRef.current = null;
    }

    storyFxTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    storyFxTimersRef.current = [];

    document.body.classList.remove(
      "is-time-skip-warp",
      "is-finals-silence",
    );
  }, [question.id]);

  useEffect(() => {
    setAwaitingPhaseAdvance(false);
  }, [phase, question.id]);

  useEffect(() => {
    document.body.classList.toggle("is-finals-silence", finalsSilence);

    return () => {
      document.body.classList.remove("is-finals-silence");
    };
  }, [finalsSilence]);

  useEffect(() => {
    if (!activeToast) {
      return;
    }

    if (activeToast.kind === "warning") {
      playCrisisWarning();
      return;
    }

    playNotificationAlert(activeToast.kind);
  }, [activeToast, playCrisisWarning, playNotificationAlert]);

  useEffect(() => {
    if (!sceneReady) {
      setActiveToastIndex(null);
      setDialogueReady(false);
      return;
    }

    if (question.id === "finals-mode") {
      const timers: number[] = [];

      setDialogueReady(false);
      setActiveToastIndex(null);
      setFinalsSilence(true);

      timers.push(
        window.setTimeout(() => {
          setFinalsSilence(false);
          showStoryToast(
            {
              id: "finals-threat-story",
              kind: "warning",
              title: "FINALS IN 14 DAYS",
              message: "Revision timer activated.",
            },
            3200,
          );
        }, 1500),
      );

      timers.push(
        window.setTimeout(() => {
          setDialogueReady(true);
        }, 4800),
      );

      return () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        setFinalsSilence(false);
      };
    }

    if (!initialToasts.length) {
      setActiveToastIndex(null);
      setDialogueReady(true);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    setDialogueReady(false);
    setActiveToastIndex(0);

    const showToast = (index: number) => {
      setActiveToastIndex(index);

      const timer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        const nextIndex = index + 1;

        if (nextIndex < initialToasts.length) {
          showToast(nextIndex);
          return;
        }

        setActiveToastIndex(null);
        setDialogueReady(true);
      }, toastDurationMs);

      timers.push(timer);
    };

    showToast(0);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initialToasts, question.id, sceneReady, showStoryToast]);

  useEffect(() => {
    if (question.id !== "orientation-arena" || !phaseTextComplete) {
      return;
    }

    if (storyBeatRefs.current.orientationToast) {
      return;
    }

    storyBeatRefs.current.orientationToast = true;
    showStoryToast(
      {
        id: "orientation-event-story",
        kind: "event",
        title: "Event: The Orientation",
        message: "Difficulty: ???",
      },
      3000,
    );

    const timeout = window.setTimeout(() => {
      setOrientationEventDone(true);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [phaseTextComplete, question.id, showStoryToast]);

  useEffect(() => {
    if (!dialogueReady) {
      return;
    }

    if (question.id === "finding-your-class" && phase === 0) {
      if (!storyBeatRefs.current.timeFliesScene) {
        storyBeatRefs.current.timeFliesScene = true;
        setShowTimeFliesScene(true);
        playNotificationAlert("navigation");
      }

      return;
    }

    if (question.id === "finding-your-class" && phase === 1 && phaseTextComplete) {
      if (!storyBeatRefs.current.classObjectiveReady) {
        storyBeatRefs.current.classObjectiveReady = true;
        setAwaitingPhaseAdvance(true);
      }

      return;
    }

    if (question.id === "finding-your-class" && phase === 2 && phaseTextComplete) {
      if (!storyBeatRefs.current.navigationChallengeToast) {
        storyBeatRefs.current.navigationChallengeToast = true;
        showStoryToast(
          {
            id: "navigation-challenge-story",
            kind: "navigation",
            title: "NAVIGATION CHALLENGE INITIATED",
            message: "Pathfinding module unstable.",
          },
          3000,
        );

        const timeout = window.setTimeout(() => {
          setClassNavigationDone(true);
        }, 2600);

        return () => window.clearTimeout(timeout);
      }

      return;
    }

    if (question.id === "group-project" && phase === 0 && phaseTextComplete) {
      if (!storyBeatRefs.current.groupChatReady) {
        storyBeatRefs.current.groupChatReady = true;
        setAwaitingPhaseAdvance(true);
      }

      return;
    }

    if (question.id === "group-project" && phase === 1 && phaseTextComplete) {
      if (!storyBeatRefs.current.groupProjectEventToast) {
        storyBeatRefs.current.groupProjectEventToast = true;
        showStoryToast(
          {
            id: "group-project-event-story",
            kind: "event",
            title: "Event: Group Project",
            message: "Team dynamics unknown.",
          },
          3000,
        );

        const timeout = window.setTimeout(() => {
          setGroupProjectEventDone(true);
        }, 2500);

        return () => window.clearTimeout(timeout);
      }

      return;
    }

    if (question.id === "cca-fair" && phaseTextComplete && phase < 3) {
      const key = `ccaPhase${phase}Ready`;

      if (!storyBeatRefs.current[key]) {
        storyBeatRefs.current[key] = true;
        setAwaitingPhaseAdvance(true);
      }

      return;
    }

    if (question.id === "cca-fair" && phase === 3 && phaseTextComplete) {
      if (!storyBeatRefs.current.ccaEventToast) {
        storyBeatRefs.current.ccaEventToast = true;
        showStoryToast(
          {
            id: "cca-fair-event-story",
            kind: "event",
            title: "Event: The CCA Fair",
            message: "Campus path has been rerouted.",
          },
          3100,
        );

        const timeout = window.setTimeout(() => {
          setCcaEventDone(true);
        }, 2600);

        return () => window.clearTimeout(timeout);
      }

      return;
    }

    if (question.id === "burnout-monster") {
      if (phase === 0 && phaseTextComplete) {
        if (!storyBeatRefs.current.burnoutThreatReady) {
          storyBeatRefs.current.burnoutThreatReady = true;
          setAwaitingPhaseAdvance(true);
        }

        return;
      }

      if (phase === 1) {
        if (!storyBeatRefs.current.burnoutNotificationsReady) {
          storyBeatRefs.current.burnoutNotificationsReady = true;
          const notificationTimers = [0, 220, 440, 660].map((delay) =>
            window.setTimeout(() => {
              playNotificationAlert("event");
            }, delay),
          );

          const phaseTimer = window.setTimeout(() => {
            setPhase(2);
          }, 1850);

          storyFxTimersRef.current.push(...notificationTimers, phaseTimer);

          return () => {
            notificationTimers.forEach((timer) => window.clearTimeout(timer));
            window.clearTimeout(phaseTimer);
          };
        }

        return;
      }

      if (phase === 2 && phaseTextComplete) {
        if (!storyBeatRefs.current.systemOverloadReady) {
          storyBeatRefs.current.systemOverloadReady = true;
          showStoryToast(
            {
              id: "system-overload-story",
              kind: "warning",
              title: "WARNING: SYSTEM OVERLOAD",
              message: "Stress meter exceeding recommended limits.",
            },
            3800,
          );

          const timeout = window.setTimeout(() => {
            setPhase(4);
          }, 2600);

          storyFxTimersRef.current.push(timeout);

          return () => window.clearTimeout(timeout);
        }

        return;
      }

      if (phase === 4 && phaseTextComplete && !seenArtifacts.burnout) {
        if (!storyBeatRefs.current.burnoutBossReady) {
          storyBeatRefs.current.burnoutBossReady = true;
          const timeout = window.setTimeout(() => {
            playCrisisWarning();
            setActiveArtifact("burnout");
          }, 650);

          storyFxTimersRef.current.push(timeout);

          return () => window.clearTimeout(timeout);
        }

        return;
      }
    }

    if (question.id === "weekend-portal" && phase === 0 && phaseTextComplete) {
      if (!storyBeatRefs.current.portalReady) {
        storyBeatRefs.current.portalReady = true;
        setAwaitingPhaseAdvance(true);
      }

      return;
    }

    if (question.id === "weekend-portal" && phase === 1 && phaseTextComplete) {
      if (!storyBeatRefs.current.weekendInstanceReady) {
        storyBeatRefs.current.weekendInstanceReady = true;
        showStoryToast(
          {
            id: "weekend-instance-story",
            kind: "instance",
            title: "WEEKEND INSTANCE AVAILABLE (48 HOURS ONLY)",
            message: "",
          },
          2800,
        );

        const resourceTimer = window.setTimeout(() => {
          showStoryToast(
            {
              id: "weekend-resource-story",
              kind: "instance",
              title: "ALERT: TIME RESOURCE MUST BE ALLOCATED",
              message: "",
            },
            3200,
          );
        }, 2900);

        const doneTimer = window.setTimeout(() => {
          setWeekendSystemDone(true);
        }, 5600);

        return () => {
          window.clearTimeout(resourceTimer);
          window.clearTimeout(doneTimer);
        };
      }

      return;
    }
  }, [
    dialogueReady,
    phase,
    phaseTextComplete,
    playCrisisWarning,
    playNotificationAlert,
    question.id,
    seenArtifacts.burnout,
    showStoryToast,
  ]);

  useEffect(() => {
    setOptionsReady(false);

    const optionGateReady =
      (question.id !== "orientation-arena" || orientationEventDone) &&
      (question.id !== "finding-your-class" || (phase >= 2 && classNavigationDone)) &&
      (question.id !== "group-project" || (phase >= 1 && groupProjectEventDone)) &&
      (question.id !== "cca-fair" || (phase >= 3 && ccaEventDone)) &&
      (question.id !== "burnout-monster" || phase >= 5) &&
      (question.id !== "weekend-portal" || (phase >= 1 && weekendSystemDone));

    if (!phaseTextComplete || !optionGateReady || finalsSilence) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOptionsReady(true);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [
    finalsSilence,
    ccaEventDone,
    classNavigationDone,
    groupProjectEventDone,
    orientationEventDone,
    phase,
    phaseTextComplete,
    question.id,
    weekendSystemDone,
  ]);

  const canAdvancePhase =
    awaitingPhaseAdvance && !activeArtifact && !isAnimated && !optionsReady;
  const handleDialogueClick = useCallback(() => {
    if (isAnimated) {
      playSound("skip");
      skip();
      return;
    }

    if (canAdvancePhase) {
      playSound("skip");
      advancePhase();
    }
  }, [advancePhase, canAdvancePhase, isAnimated, playSound, skip]);

  if (!sceneReady) {
    return null;
  }

  if (finalsSilence) {
    return <div className="question-layout finals-silence-stage" aria-hidden="true" />;
  }

  return (
    <div
      className={`question-layout ${
        visibleArtifacts.length ? "has-artifact-tray" : ""
      }`}
    >
      <SystemToast toast={activeToast} />
      <ArtifactPopup artifact={activeArtifact} onClose={closeArtifact} />
      {showTimeFliesScene && (
        <TimeFliesScene
          onContinue={() => {
            playSound("skip");
            setShowTimeFliesScene(false);
            setPhase(1);
          }}
        />
      )}
      {showNotificationStack && <NotificationStack />}
      <ArtifactTray
        artifacts={visibleArtifacts}
        onOpen={(artifact) => setActiveArtifact(artifact)}
      />

      <div className="question-main-column">
        <NarrativeBox
          className="dialogue-panel"
          interactive={isAnimated || canAdvancePhase}
          onClick={handleDialogueClick}
        >
          <div className="dialogue-heading">
            <span className="event-chip">Event {currentIndex + 1}</span>
            <h2>{questionName}</h2>
          </div>
          <p className="transmission-label">Live Scene Feed</p>
          <pre className="dialogue-copy">
            {renderDialogueText(visibleText, question.id)}
            {typewriterEnabled && !complete && <span className="cursor">_</span>}
          </pre>
          <div className="dialogue-indicator" aria-live="polite">
            {canAdvancePhase ? (
              <span className="continue-prompt">Click to continue</span>
            ) : optionsReady ? (
              <span className="select-prompt">Select an option</span>
            ) : (
              typewriterEnabled && complete && <span className="next-triangle" />
            )}
          </div>
        </NarrativeBox>

        {optionsReady && (
          <div className="answer-grid is-ready">
            {question.options.map((option) => (
              <button
                className="answer-button"
                key={option.id}
                onClick={() => onAnswer(option)}
                type="button"
              >
                <span className="answer-key">{option.id}</span>
                <span className="answer-copy">
                  <strong>{cleanText(option.label)}</strong>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeFliesScene({ onContinue }: { onContinue: () => void }) {
  return createPortal(
    <button
      className="time-flies-scene"
      onClick={onContinue}
      type="button"
      aria-label="Continue after time flies scene"
    >
      <span className="time-flies-panel">
        <span className="time-flies-eyebrow">Timeline Sync</span>
        <strong>Few Days Later</strong>
        <span className="time-flies-copy">
          A few days blur past like a system montage.
        </span>
        <small>Click to continue</small>
      </span>
    </button>,
    document.body,
  );
}

function getToastIcon(kind: ToastAlert["kind"]) {
  const toastIcon: Record<ToastAlert["kind"], string> = {
    event: "EVT",
    instance: "GATE",
    navigation: "NAV",
    objective: "OBJ",
    quest: "LOG",
    warning: "WARN",
  };

  return toastIcon[kind];
}

function getToastVariant(kind: ToastAlert["kind"]) {
  return kind === "warning"
    ? "warning"
    : kind === "quest" || kind === "event"
      ? "event"
      : "info";
}

function SystemNoticeFrame({
  className = "",
  durationMs,
  icon,
  toast,
}: {
  className?: string;
  durationMs?: number;
  icon?: string;
  toast: ToastAlert;
}) {
  const toastVariant = getToastVariant(toast.kind);

  return (
    <div
      className={`system-layer toast-${toast.kind} toast-variant-${toastVariant} ${className}`}
      style={
        durationMs
          ? ({ "--notice-duration": `${durationMs}ms` } as CSSProperties)
          : undefined
      }
    >
      {toast.kind === "warning" ? (
        <ThreatWarningBanner message={toast.message} title={toast.title} />
      ) : (
        <SystemHudNotice
          icon={icon ?? getToastIcon(toast.kind)}
          message={toast.message}
          title={toast.title}
        />
      )}
    </div>
  );
}

function SystemHudNotice({
  icon,
  message,
  title,
}: {
  icon: string;
  message?: string;
  title: string;
}) {
  return (
    <div className="system-hud-notice" role="status" aria-live="polite">
      <span className="system-hud-icon">{icon}</span>
      <span className="system-hud-copy">
        <strong>{cleanText(title)}</strong>
        {message && <span>{cleanText(message)}</span>}
      </span>
    </div>
  );
}

function ThreatWarningBanner({
  message,
  title,
}: {
  message?: string;
  title: string;
}) {
  useEffect(() => {
    document.body.classList.add("is-threat-shaking");

    const timeout = window.setTimeout(() => {
      document.body.classList.remove("is-threat-shaking");
    }, 520);

    return () => {
      window.clearTimeout(timeout);
      document.body.classList.remove("is-threat-shaking");
    };
  }, [title]);

  return (
    <div className="threat-warning-banner" role="alert" aria-live="assertive">
      <span className="threat-code">WARN</span>
      <span className="threat-copy">
        <strong>{cleanText(title)}</strong>
        {message && <span>{cleanText(message)}</span>}
      </span>
    </div>
  );
}

function SystemToast({ toast }: { toast: ToastAlert | null }) {
  if (!toast) {
    return null;
  }

  return createPortal(
    <SystemNoticeFrame
      key={toast.id}
      toast={{
        ...toast,
        message: cleanText(toast.message),
        title: cleanText(toast.title),
      }}
    />,
    document.body,
  );
}

function InterstitialPopup({ popup }: { popup: PopupEvent | null }) {
  if (!popup) {
    return null;
  }

  return (
    <div
      className={`popup-stage popup-${popup.id}`}
      role="status"
      aria-live="polite"
    >
      <div className="popup-burst" />
      {popup.imageSrc && (
        <img className="popup-image" src={popup.imageSrc} alt="" aria-hidden="true" />
      )}
      <HolographicPanel className="popup-panel">
        <p className="eyebrow">{cleanText(popup.title)}</p>
        <p>{cleanText(popup.message)}</p>
      </HolographicPanel>
    </div>
  );
}

function CalculationScreen() {
  return (
    <HolographicPanel className="calculation-panel">
      <p className="eyebrow">Events Completed</p>
      <h2>Calculating build...</h2>
      <div className="loader" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </HolographicPanel>
  );
}

function ResultScreen({
  onRestart,
  result,
}: {
  onRestart: () => void;
  result: (typeof resultProfiles)[OutcomeId];
}) {
  return (
    <HolographicPanel className="result-panel">
      <p className="eyebrow">Freshman Type Revealed</p>
      <h2>{cleanText(result.name)}</h2>
      <p className="motto">"{cleanText(result.motto)}"</p>

      <div className="result-columns">
        <section aria-labelledby="traits-heading">
          <h3 id="traits-heading">Traits</h3>
          <div className="chip-row">
            {result.traits.map((trait) => (
              <span className="chip" key={trait}>
                {cleanText(trait)}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="tags-heading">
          <h3 id="tags-heading">Personality Tags</h3>
          <div className="chip-row">
            {result.tags.map((tag) => (
              <span className="chip accent" key={tag}>
                {cleanText(tag)}
              </span>
            ))}
          </div>
        </section>
      </div>

      <p className="profile-copy">{cleanText(result.profile)}</p>

      <section className="tips" aria-labelledby="tips-heading">
        <h3 id="tips-heading">Wellbeing Tips</h3>
        <ul>
          {result.wellbeingTips.map((tip) => (
            <li key={tip}>{cleanText(tip)}</li>
          ))}
        </ul>
      </section>

      <button className="primary-action" onClick={onRestart} type="button">
        Replay Arc
      </button>
    </HolographicPanel>
  );
}

export default App;
