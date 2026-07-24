const defaultQuizUrl = "https://freshman-quiz.vercel.app/";

export function getAttributionSource() {
  const source = new URLSearchParams(window.location.search).get("source");
  return source?.slice(0, 60) || "direct";
}

export function getPublicQuizUrl(source?: string) {
  const configuredUrl = import.meta.env.VITE_PUBLIC_QUIZ_URL?.trim();
  const currentUrl =
    window.location.protocol === "http:" || window.location.protocol === "https:"
      ? `${window.location.origin}${window.location.pathname}`
      : "";
  const url = new URL(configuredUrl || currentUrl || defaultQuizUrl);

  url.search = "";
  url.hash = "";

  if (source) {
    url.searchParams.set("source", source);
  }

  return url.toString();
}
