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
      durationMs?: number;
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

function getDeviceContext() {
  const userAgent = navigator.userAgent;
  const viewportWidth = window.innerWidth;
  const deviceType = /iPad|Tablet|PlayBook|Silk/i.test(userAgent)
    ? "tablet"
    : /Mobi|iPhone|iPod|Android/i.test(userAgent)
      ? "mobile"
      : "desktop";
  const platform = /iPad|iPhone|iPod/i.test(userAgent)
    ? "ios"
    : /Android/i.test(userAgent)
      ? "android"
      : /Windows/i.test(userAgent)
        ? "windows"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "macos"
          : /CrOS/i.test(userAgent)
            ? "chromeos"
            : "other";
  const viewportBucket = viewportWidth <= 375
    ? "compact"
    : viewportWidth <= 430
      ? "standard-mobile"
      : viewportWidth <= 820
        ? "large-mobile"
        : "desktop";

  return {
    deviceType,
    language: navigator.language.slice(0, 12),
    platform,
    viewportBucket,
  };
}

export function trackQuizEvent(event: QuizAnalyticsEvent) {
  if (!import.meta.env.PROD) {
    return;
  }

  void fetch("/api/quiz-events", {
    body: JSON.stringify({
      ...event,
      ...getDeviceContext(),
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
