import type { OptionId, OutcomeId } from "../types";
import { getAttributionSource } from "./quizUrl";

type QuizAnalyticsEvent =
  | {
      attemptId: string;
      eventType: "quiz_landed";
    }
  | {
      attemptId: string;
      eventType: "quiz_started";
    }
  | {
      attemptId: string;
      eventType: "answer_selected";
      optionId: OptionId;
      questionId: string;
    }
  | {
      attemptId: string;
      eventType: "quiz_completed";
      resultId: OutcomeId;
    }
  | {
      attemptId: string;
      eventType:
        | "quiz_link_clicked"
        | "result_review_opened"
        | "result_shared"
        | "student_care_clicked";
      resultId: OutcomeId;
    };

export function createAttemptId() {
  return globalThis.crypto?.randomUUID?.() ??
    `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function trackQuizEvent(event: QuizAnalyticsEvent) {
  if (!import.meta.env.PROD) {
    return;
  }

  void fetch("/api/quiz-events", {
    body: JSON.stringify({
      ...event,
      eventId: globalThis.crypto?.randomUUID?.() ??
        `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: getAttributionSource(),
    }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Analytics must never interrupt the quiz experience.
  });
}
