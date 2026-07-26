const eventTypes = new Set([
  "quiz_landed",
  "quiz_started",
  "answer_selected",
  "quiz_completed",
  "quiz_link_clicked",
  "result_review_opened",
  "result_shared",
  "student_care_clicked",
]);
const optionIds = new Set(["A", "B", "C", "D"]);
const deviceTypes = new Set(["mobile", "tablet", "desktop", "unknown"]);
const platforms = new Set([
  "ios",
  "android",
  "windows",
  "macos",
  "chromeos",
  "other",
]);
const viewportBuckets = new Set([
  "compact",
  "standard-mobile",
  "large-mobile",
  "desktop",
  "unknown",
]);
const resultIds = new Set([
  "overachiever",
  "socialButterfly",
  "lostButVibing",
  "softSupporter",
  "weBallAgent",
  "lowkeyStrategist",
]);

function isShortString(value, maxLength = 100) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isValidPayload(payload) {
  if (
    !isShortString(payload.eventId) ||
    !isShortString(payload.attemptId) ||
    !eventTypes.has(String(payload.eventType))
  ) {
    return false;
  }

  if (payload.eventType === "answer_selected") {
    return (
      isShortString(payload.questionId) &&
      optionIds.has(String(payload.optionId))
    );
  }

  if (payload.eventType === "quiz_completed") {
    return resultIds.has(String(payload.resultId));
  }

  if (
    [
      "quiz_link_clicked",
      "result_review_opened",
      "result_shared",
      "student_care_clicked",
    ].includes(payload.eventType)
  ) {
    return resultIds.has(String(payload.resultId));
  }

  return true;
}

function allowedValue(value, allowedValues, fallback) {
  return allowedValues.has(String(value)) ? String(value) : fallback;
}

function getSupabaseHeaders(secretKey) {
  const headers = {
    apikey: secretKey,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  };

  if (!secretKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${secretKey}`;
  }

  return headers;
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return Response.json({ error: "Invalid analytics event." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return new Response(null, { status: 204 });
  }

  const headers = getSupabaseHeaders(supabaseSecretKey);
  const legacyRow = {
    attempt_id: payload.attemptId,
    event_id: payload.eventId,
    event_type: payload.eventType,
    option_id: payload.optionId ?? null,
    question_id: payload.questionId ?? null,
    result_id: payload.resultId ?? null,
    source: isShortString(payload.source, 60) ? payload.source : "direct",
  };
  const durationMs = Number.isInteger(payload.durationMs) &&
    payload.durationMs >= 0 &&
    payload.durationMs <= 7_200_000
    ? payload.durationMs
    : null;
  const analyticsRow = {
    ...legacyRow,
    device_type: allowedValue(payload.deviceType, deviceTypes, "unknown"),
    duration_ms: durationMs,
    language: isShortString(payload.language, 12) ? payload.language : "unknown",
    platform: allowedValue(payload.platform, platforms, "other"),
    viewport_bucket: allowedValue(
      payload.viewportBucket,
      viewportBuckets,
      "unknown",
    ),
  };
  const endpoint = `${supabaseUrl}/rest/v1/quiz_events`;
  let insertResponse = await fetch(endpoint, {
    body: JSON.stringify(analyticsRow),
    headers,
    method: "POST",
  });

  if (insertResponse.status === 400) {
    const errorBody = await insertResponse.text();
    const schemaIsOutdated =
      errorBody.includes("device_type") ||
      errorBody.includes("duration_ms") ||
      errorBody.includes("language") ||
      errorBody.includes("platform") ||
      errorBody.includes("viewport_bucket");

    if (schemaIsOutdated) {
      insertResponse = await fetch(endpoint, {
        body: JSON.stringify(legacyRow),
        headers,
        method: "POST",
      });
    }
  }

  if (!insertResponse.ok) {
    return Response.json({ error: "Analytics storage failed." }, { status: 502 });
  }

  return new Response(null, { status: 204 });
}
