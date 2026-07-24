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

  const headers = {
    apikey: supabaseSecretKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  if (!supabaseSecretKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${supabaseSecretKey}`;
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/quiz_events`, {
    body: JSON.stringify({
      attempt_id: payload.attemptId,
      event_id: payload.eventId,
      event_type: payload.eventType,
      option_id: payload.optionId ?? null,
      question_id: payload.questionId ?? null,
      result_id: payload.resultId ?? null,
      source: isShortString(payload.source, 60) ? payload.source : "direct",
    }),
    headers,
    method: "POST",
  });

  if (!insertResponse.ok) {
    return Response.json({ error: "Analytics storage failed." }, { status: 502 });
  }

  return new Response(null, { status: 204 });
}
