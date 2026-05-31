export type OutcomeId =
  | "overachiever"
  | "socialButterfly"
  | "lostButVibing"
  | "softSupporter"
  | "weBallAgent"
  | "lowkeyStrategist";

export type OptionId = "A" | "B" | "C" | "D";

export type ScreenPhase =
  | "start"
  | "prelude"
  | "question"
  | "popup"
  | "calculating"
  | "result";

export type ScoreMap = Record<OutcomeId, number>;

export type QuizOption = {
  id: OptionId;
  label: string;
  title: string;
  detail?: string;
  weights: Partial<ScoreMap>;
  primaryOutcome: OutcomeId;
};

export type QuizQuestion = {
  id: string;
  title: string;
  scenario: string;
  prompt: string;
  options: QuizOption[];
  popup?: PopupEvent;
  toasts?: ToastAlert[];
};

export type ToastAlert = {
  id: string;
  kind: "quest" | "objective" | "event" | "navigation" | "warning" | "instance";
  title: string;
  message: string;
};

export type PopupEvent = {
  id: string;
  title: string;
  message: string;
  imageSrc?: string;
};

export type ResultProfile = {
  id: OutcomeId;
  name: string;
  motto: string;
  traits: string[];
  tags: string[];
  profile: string;
  wellbeingTips: string[];
};

export type SelectedAnswer = {
  questionId: string;
  optionId: OptionId;
  weights: Partial<ScoreMap>;
  primaryOutcome: OutcomeId;
};
