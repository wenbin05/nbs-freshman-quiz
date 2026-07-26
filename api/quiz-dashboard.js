const allowedPeriods = new Set(["7", "30", "90", "all"]);
const pageSize = 1000;
const maxEvents = 100_000;
const extendedColumns = [
  "attempt_id",
  "event_type",
  "question_id",
  "option_id",
  "result_id",
  "source",
  "created_at",
  "device_type",
  "platform",
  "viewport_bucket",
  "language",
  "duration_ms",
].join(",");
const legacyColumns = [
  "attempt_id",
  "event_type",
  "question_id",
  "option_id",
  "result_id",
  "source",
  "created_at",
].join(",");

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": status === 200
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

function getSupabaseHeaders(secretKey) {
  const headers = {
    apikey: secretKey,
    Accept: "application/json",
  };

  if (!secretKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${secretKey}`;
  }

  return headers;
}

function getPeriodStart(period) {
  if (period === "all") {
    return null;
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (Number(period) - 1));
  return start.toISOString();
}

async function fetchEventPage({
  columns,
  offset,
  periodStart,
  secretKey,
  supabaseUrl,
}) {
  const query = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    order: "created_at.asc",
    select: columns,
  });

  if (periodStart) {
    query.set("created_at", `gte.${periodStart}`);
  }

  return fetch(`${supabaseUrl}/rest/v1/quiz_events?${query}`, {
    headers: getSupabaseHeaders(secretKey),
  });
}

async function fetchEvents({ period, secretKey, supabaseUrl }) {
  const periodStart = getPeriodStart(period);
  const events = [];
  let columns = extendedColumns;
  let usesExtendedSchema = true;
  let offset = 0;

  while (offset < maxEvents) {
    let response = await fetchEventPage({
      columns,
      offset,
      periodStart,
      secretKey,
      supabaseUrl,
    });

    if (response.status === 400 && columns === extendedColumns) {
      columns = legacyColumns;
      usesExtendedSchema = false;
      response = await fetchEventPage({
        columns,
        offset,
        periodStart,
        secretKey,
        supabaseUrl,
      });
    }

    if (!response.ok) {
      throw new Error(`Analytics query failed with ${response.status}.`);
    }

    const page = await response.json();
    events.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return {
    events,
    truncated: events.length >= maxEvents,
    usesExtendedSchema,
  };
}

function percentage(numerator, denominator) {
  return denominator === 0
    ? 0
    : Math.round((numerator / denominator) * 1000) / 10;
}

function uniqueAttempts(events, eventType) {
  return new Set(
    events
      .filter((event) => event.event_type === eventType)
      .map((event) => event.attempt_id),
  );
}

function countBy(values) {
  const counts = new Map();

  values.forEach((value) => {
    const key = value || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return counts;
}

function serialiseCounts(counts, total, idKey) {
  return [...counts.entries()]
    .map(([id, count]) => ({
      [idKey]: id,
      count,
      percent: percentage(count, total),
    }))
    .sort((left, right) => right.count - left.count);
}

function getPercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentile) - 1),
  );
  return sortedValues[index];
}

function aggregateEvents(events) {
  const visitors = uniqueAttempts(events, "quiz_landed");
  const starts = uniqueAttempts(events, "quiz_started");
  const completions = uniqueAttempts(events, "quiz_completed");
  const shares = uniqueAttempts(events, "result_shared");
  const journeyReviews = uniqueAttempts(events, "result_review_opened");
  const studentCareClicks = uniqueAttempts(events, "student_care_clicked");
  const quizLinkClicks = uniqueAttempts(events, "quiz_link_clicked");
  const answers = events.filter((event) => event.event_type === "answer_selected");
  const completionEvents = events.filter(
    (event) => event.event_type === "quiz_completed",
  );

  const choiceCounts = new Map();
  answers.forEach((event) => {
    if (!event.question_id || !event.option_id) {
      return;
    }

    const questionCounts = choiceCounts.get(event.question_id) ?? new Map();
    questionCounts.set(
      event.option_id,
      (questionCounts.get(event.option_id) ?? 0) + 1,
    );
    choiceCounts.set(event.question_id, questionCounts);
  });

  const choiceDistribution = [...choiceCounts.entries()].map(
    ([questionId, questionCounts]) => {
      const total = [...questionCounts.values()].reduce(
        (sum, count) => sum + count,
        0,
      );

      return {
        questionId,
        total,
        options: serialiseCounts(questionCounts, total, "optionId"),
      };
    },
  );

  const resultCounts = countBy(
    completionEvents.map((event) => event.result_id),
  );
  const resultDistribution = serialiseCounts(
    resultCounts,
    completionEvents.length,
    "resultId",
  );

  const sourceByAttempt = new Map();
  events.forEach((event) => {
    if (!sourceByAttempt.has(event.attempt_id) || event.event_type === "quiz_landed") {
      sourceByAttempt.set(event.attempt_id, event.source || "direct");
    }
  });
  const sourceIds = new Set(sourceByAttempt.values());
  const sourceDistribution = [...sourceIds]
    .map((source) => {
      const sourceAttempts = [...sourceByAttempt.entries()]
        .filter(([, attemptSource]) => attemptSource === source)
        .map(([attemptId]) => attemptId);
      const sourceAttemptSet = new Set(sourceAttempts);
      const sourceVisitors = [...visitors].filter((id) => sourceAttemptSet.has(id)).length;
      const sourceStarts = [...starts].filter((id) => sourceAttemptSet.has(id)).length;
      const sourceCompletions = [...completions].filter((id) =>
        sourceAttemptSet.has(id)
      ).length;
      const sourceShares = [...shares].filter((id) => sourceAttemptSet.has(id)).length;

      return {
        source,
        visitors: sourceVisitors,
        starts: sourceStarts,
        completions: sourceCompletions,
        shares: sourceShares,
        completionPercent: percentage(sourceCompletions, sourceStarts),
      };
    })
    .sort((left, right) => right.visitors - left.visitors);

  const contextByAttempt = new Map();
  events.forEach((event) => {
    const existing = contextByAttempt.get(event.attempt_id);
    if (!existing || event.event_type === "quiz_started") {
      contextByAttempt.set(event.attempt_id, {
        deviceType: event.device_type || "unknown",
        language: event.language || "unknown",
        platform: event.platform || "other",
        viewportBucket: event.viewport_bucket || "unknown",
      });
    }
  });
  const startedContexts = [...starts]
    .map((attemptId) => contextByAttempt.get(attemptId))
    .filter(Boolean);
  const completedContexts = [...completions]
    .map((attemptId) => contextByAttempt.get(attemptId))
    .filter(Boolean);

  const contextDistribution = (key) => {
    const startedCounts = countBy(startedContexts.map((context) => context[key]));
    const completedCounts = countBy(
      completedContexts.map((context) => context[key]),
    );
    const values = new Set([...startedCounts.keys(), ...completedCounts.keys()]);

    return [...values]
      .map((value) => ({
        value,
        starts: startedCounts.get(value) ?? 0,
        completions: completedCounts.get(value) ?? 0,
        completionPercent: percentage(
          completedCounts.get(value) ?? 0,
          startedCounts.get(value) ?? 0,
        ),
      }))
      .sort((left, right) => right.starts - left.starts);
  };

  const dailyMap = new Map();
  events.forEach((event) => {
    const date = String(event.created_at ?? "").slice(0, 10);

    if (!date) {
      return;
    }

    const day = dailyMap.get(date) ?? {
      completions: new Set(),
      shares: new Set(),
      starts: new Set(),
      visitors: new Set(),
    };

    if (event.event_type === "quiz_landed") {
      day.visitors.add(event.attempt_id);
    } else if (event.event_type === "quiz_started") {
      day.starts.add(event.attempt_id);
    } else if (event.event_type === "quiz_completed") {
      day.completions.add(event.attempt_id);
    } else if (event.event_type === "result_shared") {
      day.shares.add(event.attempt_id);
    }

    dailyMap.set(date, day);
  });
  const dailyActivity = [...dailyMap.entries()]
    .map(([date, day]) => ({
      date,
      visitors: day.visitors.size,
      starts: day.starts.size,
      completions: day.completions.size,
      shares: day.shares.size,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const durations = completionEvents
    .map((event) => Number(event.duration_ms))
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((left, right) => left - right);
  const averageDurationMs = durations.length === 0
    ? 0
    : Math.round(
        durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      );

  const recentCompletions = [...completionEvents]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, 20)
    .map((event) => {
      const context = contextByAttempt.get(event.attempt_id) ?? {};

      return {
        completedAt: event.created_at,
        deviceType: context.deviceType ?? "unknown",
        durationMs: Number(event.duration_ms) || 0,
        platform: context.platform ?? "other",
        resultId: event.result_id ?? "unknown",
        source: sourceByAttempt.get(event.attempt_id) ?? "direct",
      };
    });

  return {
    choiceDistribution,
    context: {
      devices: contextDistribution("deviceType"),
      languages: contextDistribution("language"),
      platforms: contextDistribution("platform"),
      viewports: contextDistribution("viewportBucket"),
    },
    dailyActivity,
    engagement: {
      journeyReviews: journeyReviews.size,
      quizLinkClicks: quizLinkClicks.size,
      shares: shares.size,
      studentCareClicks: studentCareClicks.size,
    },
    funnel: {
      completions: completions.size,
      completionPercent: percentage(completions.size, starts.size),
      starts: starts.size,
      startPercent: percentage(starts.size, visitors.size),
      visitors: visitors.size,
    },
    recentCompletions,
    resultDistribution,
    sourceDistribution,
    timing: {
      averageDurationMs,
      medianDurationMs: getPercentile(durations, 0.5),
      p75DurationMs: getPercentile(durations, 0.75),
      sampleSize: durations.length,
    },
  };
}

export async function GET(request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({ error: "Analytics storage is not configured." }, 503);
  }

  const requestedPeriod = new URL(request.url).searchParams.get("period") ?? "30";
  const period = allowedPeriods.has(requestedPeriod) ? requestedPeriod : "30";

  try {
    const { events, truncated, usesExtendedSchema } = await fetchEvents({
      period,
      secretKey: supabaseSecretKey,
      supabaseUrl,
    });

    return jsonResponse({
      ...aggregateEvents(events),
      generatedAt: new Date().toISOString(),
      period,
      quality: {
        eventCount: events.length,
        hasDeviceAndTimingData: usesExtendedSchema,
        truncated,
      },
    });
  } catch (error) {
    console.error("Quiz dashboard aggregation failed.", error);
    return jsonResponse({ error: "Could not load analytics data." }, 502);
  }
}
