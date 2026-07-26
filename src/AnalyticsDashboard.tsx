import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { quizQuestions, resultProfiles } from "./data/quiz";
import type { OptionId, OutcomeId } from "./types";

type Period = "7" | "30" | "90" | "all";

type DistributionItem = {
  count: number;
  percent: number;
};

type ChoiceDistribution = {
  options: Array<DistributionItem & { optionId: OptionId }>;
  questionId: string;
  total: number;
};

type ContextDistribution = {
  completionPercent: number;
  completions: number;
  starts: number;
  value: string;
};

type DashboardData = {
  choiceDistribution: ChoiceDistribution[];
  context: {
    devices: ContextDistribution[];
    languages: ContextDistribution[];
    platforms: ContextDistribution[];
    viewports: ContextDistribution[];
  };
  dailyActivity: Array<{
    completions: number;
    date: string;
    shares: number;
    starts: number;
    visitors: number;
  }>;
  engagement: {
    journeyReviews: number;
    quizLinkClicks: number;
    shares: number;
    studentCareClicks: number;
  };
  funnel: {
    completionPercent: number;
    completions: number;
    startPercent: number;
    starts: number;
    visitors: number;
  };
  generatedAt: string;
  period: Period;
  quality: {
    eventCount: number;
    hasDeviceAndTimingData: boolean;
    truncated: boolean;
  };
  recentCompletions: Array<{
    completedAt: string;
    deviceType: string;
    durationMs: number;
    platform: string;
    resultId: OutcomeId | "unknown";
    source: string;
  }>;
  resultDistribution: Array<
    DistributionItem & { resultId: OutcomeId | "unknown" }
  >;
  sourceDistribution: Array<{
    completionPercent: number;
    completions: number;
    shares: number;
    source: string;
    starts: number;
    visitors: number;
  }>;
  timing: {
    averageDurationMs: number;
    medianDurationMs: number;
    p75DurationMs: number;
    sampleSize: number;
  };
};

const periodOptions: Array<{ label: string; value: Period }> = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "all" },
];

const resultColours: Record<OutcomeId, string> = {
  lostButVibing: "#f2a58d",
  lowkeyStrategist: "#78bce7",
  overachiever: "#8fc66d",
  socialButterfly: "#ee8eae",
  softSupporter: "#b99cde",
  weBallAgent: "#efc55b",
};

function percentage(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

function createDemoDashboardData(period: Period): DashboardData {
  const resultCounts: Record<OutcomeId, number> = {
    overachiever: 112,
    socialButterfly: 96,
    lostButVibing: 88,
    softSupporter: 71,
    weBallAgent: 66,
    lowkeyStrategist: 60,
  };
  const resultTotal = Object.values(resultCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const questionTotals = [548, 535, 526, 519, 511, 503, 498, 493];
  const optionPatterns = [
    [174, 136, 123, 115],
    [141, 168, 126, 100],
    [188, 118, 131, 89],
    [172, 126, 123, 98],
    [121, 144, 136, 110],
    [139, 119, 137, 108],
    [183, 102, 126, 87],
    [144, 131, 127, 91],
  ];
  const dailyStarts = [62, 74, 71, 83, 96, 89, 77];

  return {
    choiceDistribution: quizQuestions.map((question, questionIndex) => ({
      questionId: question.id,
      total: questionTotals[questionIndex],
      options: question.options.map((option, optionIndex) => ({
        optionId: option.id,
        count: optionPatterns[questionIndex][optionIndex],
        percent: percentage(
          optionPatterns[questionIndex][optionIndex],
          questionTotals[questionIndex],
        ),
      })),
    })),
    context: {
      devices: [
        { value: "mobile", starts: 509, completions: 458, completionPercent: 90 },
        { value: "desktop", starts: 31, completions: 28, completionPercent: 90.3 },
        { value: "tablet", starts: 12, completions: 7, completionPercent: 58.3 },
      ],
      languages: [
        { value: "en-SG", starts: 492, completions: 444, completionPercent: 90.2 },
        { value: "en-GB", starts: 43, completions: 37, completionPercent: 86 },
        { value: "other", starts: 17, completions: 12, completionPercent: 70.6 },
      ],
      platforms: [
        { value: "ios", starts: 327, completions: 301, completionPercent: 92 },
        { value: "android", starts: 194, completions: 164, completionPercent: 84.5 },
        { value: "macos", starts: 19, completions: 18, completionPercent: 94.7 },
        { value: "windows", starts: 12, completions: 10, completionPercent: 83.3 },
      ],
      viewports: [
        { value: "standard-mobile", starts: 288, completions: 264, completionPercent: 91.7 },
        { value: "compact", starts: 136, completions: 118, completionPercent: 86.8 },
        { value: "large-mobile", starts: 97, completions: 83, completionPercent: 85.6 },
        { value: "desktop", starts: 31, completions: 28, completionPercent: 90.3 },
      ],
    },
    dailyActivity: dailyStarts.map((starts, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (dailyStarts.length - index - 1));
      const completions = Math.round(starts * 0.89);

      return {
        date: date.toISOString().slice(0, 10),
        visitors: starts + 16,
        starts,
        completions,
        shares: Math.round(completions * 0.26),
      };
    }),
    engagement: {
      journeyReviews: 184,
      quizLinkClicks: 78,
      shares: 127,
      studentCareClicks: 23,
    },
    funnel: {
      visitors: 684,
      starts: 552,
      completions: 493,
      startPercent: 80.7,
      completionPercent: 89.3,
    },
    generatedAt: new Date().toISOString(),
    period,
    quality: {
      eventCount: 6254,
      hasDeviceAndTimingData: true,
      truncated: false,
    },
    recentCompletions: [
      ["socialButterfly", "qr", "mobile", "ios", 206000],
      ["overachiever", "direct", "mobile", "android", 231000],
      ["softSupporter", "shared-result", "mobile", "ios", 194000],
      ["lostButVibing", "direct", "desktop", "macos", 178000],
    ].map(([resultId, source, deviceType, platform, durationMs], index) => ({
      completedAt: new Date(Date.now() - index * 6 * 60_000).toISOString(),
      deviceType: String(deviceType),
      durationMs: Number(durationMs),
      platform: String(platform),
      resultId: resultId as OutcomeId,
      source: String(source),
    })),
    resultDistribution: Object.entries(resultCounts)
      .map(([resultId, count]) => ({
        resultId: resultId as OutcomeId,
        count,
        percent: percentage(count, resultTotal),
      }))
      .sort((left, right) => right.count - left.count),
    sourceDistribution: [
      {
        source: "direct",
        visitors: 431,
        starts: 351,
        completions: 313,
        shares: 78,
        completionPercent: 89.2,
      },
      {
        source: "qr",
        visitors: 188,
        starts: 157,
        completions: 143,
        shares: 35,
        completionPercent: 91.1,
      },
      {
        source: "shared-result",
        visitors: 65,
        starts: 44,
        completions: 37,
        shares: 14,
        completionPercent: 84.1,
      },
    ],
    timing: {
      averageDurationMs: 214000,
      medianDurationMs: 202000,
      p75DurationMs: 248000,
      sampleSize: 493,
    },
  };
}

function formatDuration(durationMs: number) {
  if (!durationMs) {
    return "Not available";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function labelFromId(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function AnalyticsStatus({
  error,
  loading,
  onRetry,
}: {
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="analytics-login-shell">
      <section className="analytics-login-panel" aria-labelledby="analytics-login-title">
        <p className="analytics-eyebrow">NBS Student Care Team</p>
        <h1 id="analytics-login-title">Quiz analytics</h1>
        <p>{loading ? "Loading anonymous quiz data..." : error}</p>
        {!loading && (
          <button onClick={onRetry} type="button">
            Try again
          </button>
        )}
        <small>No student names, emails, or individual profiles are collected.</small>
      </section>
    </main>
  );
}

function Metric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function HorizontalBar({
  colour,
  label,
  percent,
  value,
}: {
  colour?: string;
  label: string;
  percent: number;
  value: string;
}) {
  return (
    <div className="analytics-bar-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i aria-hidden="true">
        <b
          style={{
            background: colour ?? "#3d78b5",
            width: `${Math.max(0, Math.min(100, percent))}%`,
          }}
        />
      </i>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="analytics-empty">{children}</p>;
}

export default function AnalyticsDashboard() {
  const demoMode =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");
  const [period, setPeriod] = useState<Period>("30");
  const [data, setData] = useState<DashboardData | null>(
    () => (demoMode ? createDemoDashboardData("30") : null),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(
    async (selectedPeriod: Period) => {
      if (demoMode) {
        setData(createDemoDashboardData(selectedPeriod));
        setError("");
        return true;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/quiz-dashboard?period=${encodeURIComponent(selectedPeriod)}`,
        );
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || "Could not load dashboard.");
        }

        setData(responseData);
        return true;
      } catch (requestError) {
        setData(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load dashboard.",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [demoMode],
  );

  useEffect(() => {
    if (demoMode) {
      setData(createDemoDashboardData(period));
      return;
    }

    void loadDashboard(period);
  }, [demoMode, loadDashboard, period]);

  const resultRows = useMemo(() => {
    if (!data) {
      return [];
    }

    const distribution = new Map(
      data.resultDistribution.map((item) => [item.resultId, item]),
    );

    return Object.values(resultProfiles)
      .map((profile) => ({
        ...profile,
        count: distribution.get(profile.id)?.count ?? 0,
        percent: distribution.get(profile.id)?.percent ?? 0,
      }))
      .sort((left, right) => right.count - left.count);
  }, [data]);

  const questionRows = useMemo(() => {
    if (!data) {
      return [];
    }

    const distribution = new Map(
      data.choiceDistribution.map((item) => [item.questionId, item]),
    );

    return quizQuestions.map((question, index) => {
      const questionData = distribution.get(question.id);
      const previousReach = index === 0
        ? data.funnel.starts
        : distribution.get(quizQuestions[index - 1].id)?.total ?? 0;

      return {
        question,
        total: questionData?.total ?? 0,
        dropOffPercent: percentage(
          Math.max(0, previousReach - (questionData?.total ?? 0)),
          previousReach,
        ),
        options: question.options.map((option) => ({
          ...option,
          count:
            questionData?.options.find((item) => item.optionId === option.id)
              ?.count ?? 0,
          percent:
            questionData?.options.find((item) => item.optionId === option.id)
              ?.percent ?? 0,
        })),
      };
    });
  }, [data]);

  if (!data) {
    return (
      <AnalyticsStatus
        error={error}
        loading={loading}
        onRetry={() => void loadDashboard(period)}
      />
    );
  }

  const chartDays = data.dailyActivity.slice(-30);
  const maxDailyStarts = Math.max(
    1,
    ...chartDays.map((day) => day.starts),
  );

  return (
    <main className="analytics-shell">
      <header className="analytics-header">
        <div>
          <p className="analytics-eyebrow">NBS Student Care Team</p>
          <h1>Freshman quiz analytics</h1>
          <p>
            Anonymous participation, choices, outcomes, and engagement.
            {demoMode && <strong className="analytics-demo-label"> Demo data</strong>}
          </p>
        </div>
        <div className="analytics-header-actions">
          <div className="analytics-period-control" aria-label="Reporting period">
            {periodOptions.map((option) => (
              <button
                aria-pressed={period === option.value}
                key={option.value}
                onClick={() => setPeriod(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            className="analytics-secondary-action"
            disabled={loading}
            onClick={() => void loadDashboard(period)}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="analytics-metrics" aria-label="Key quiz metrics">
        <Metric
          detail={`${data.funnel.startPercent}% of visitors`}
          label="Quiz attempts"
          value={data.funnel.starts.toLocaleString()}
        />
        <Metric
          detail={`${data.funnel.completionPercent}% of starts`}
          label="Completed quizzes"
          value={data.funnel.completions.toLocaleString()}
        />
        <Metric
          detail={`${data.timing.sampleSize.toLocaleString()} timed completions`}
          label="Median completion time"
          value={formatDuration(data.timing.medianDurationMs)}
        />
        <Metric
          detail={`${percentage(data.engagement.shares, data.funnel.completions)}% of results`}
          label="Results shared"
          value={data.engagement.shares.toLocaleString()}
        />
      </section>

      <section className="analytics-grid analytics-grid-overview">
        <article className="analytics-panel">
          <header>
            <div>
              <h2>Participation trend</h2>
              <p>Starts and completions by day</p>
            </div>
          </header>
          {chartDays.length === 0 ? (
            <EmptyState>No activity recorded in this period.</EmptyState>
          ) : (
            <div className="analytics-daily-chart" aria-label="Daily quiz activity">
              {chartDays.map((day, index) => (
                <div
                  className="analytics-day"
                  key={day.date}
                  title={`${day.date}: ${day.starts} starts, ${day.completions} completions`}
                >
                  <div>
                    <i
                      className="is-start"
                      style={{ height: `${(day.starts / maxDailyStarts) * 100}%` }}
                    />
                    <i
                      className="is-completion"
                      style={{
                        height: `${(day.completions / maxDailyStarts) * 100}%`,
                      }}
                    />
                  </div>
                  <span>
                    {chartDays.length <= 10 || index % 5 === 0
                      ? day.date.slice(5)
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          <footer className="analytics-chart-legend">
            <span><i className="is-start" /> Starts</span>
            <span><i className="is-completion" /> Completions</span>
          </footer>
        </article>

        <article className="analytics-panel">
          <header>
            <div>
              <h2>Conversion funnel</h2>
              <p>From visit to completed result</p>
            </div>
          </header>
          <div className="analytics-funnel">
            <HorizontalBar
              label="Page visitors"
              percent={100}
              value={data.funnel.visitors.toLocaleString()}
            />
            <HorizontalBar
              colour="#6397c9"
              label="Quiz starts"
              percent={percentage(data.funnel.starts, data.funnel.visitors)}
              value={`${data.funnel.starts.toLocaleString()} · ${data.funnel.startPercent}%`}
            />
            <HorizontalBar
              colour="#4c9b78"
              label="Completed results"
              percent={percentage(data.funnel.completions, data.funnel.visitors)}
              value={`${data.funnel.completions.toLocaleString()} · ${data.funnel.completionPercent}% of starts`}
            />
          </div>
          <dl className="analytics-inline-stats">
            <div>
              <dt>Average time</dt>
              <dd>{formatDuration(data.timing.averageDurationMs)}</dd>
            </div>
            <div>
              <dt>75th percentile</dt>
              <dd>{formatDuration(data.timing.p75DurationMs)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="analytics-grid analytics-grid-results">
        <article className="analytics-panel">
          <header>
            <div>
              <h2>Personality results</h2>
              <p>Distribution across completed quizzes</p>
            </div>
          </header>
          <div className="analytics-result-list">
            {resultRows.map((result) => (
              <HorizontalBar
                colour={resultColours[result.id]}
                key={result.id}
                label={result.name}
                percent={result.percent}
                value={`${result.count.toLocaleString()} · ${result.percent}%`}
              />
            ))}
          </div>
        </article>

        <article className="analytics-panel">
          <header>
            <div>
              <h2>Post-result engagement</h2>
              <p>Actions taken after seeing a personality result</p>
            </div>
          </header>
          <dl className="analytics-engagement-grid">
            <div>
              <dt>Instagram shares</dt>
              <dd>{data.engagement.shares.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Journey reviews</dt>
              <dd>{data.engagement.journeyReviews.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Quiz-link visits</dt>
              <dd>{data.engagement.quizLinkClicks.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Student Care clicks</dt>
              <dd>{data.engagement.studentCareClicks.toLocaleString()}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="analytics-panel analytics-question-panel">
        <header>
          <div>
            <h2>Question choices and drop-off</h2>
            <p>Answer distribution for every question</p>
          </div>
        </header>
        <div className="analytics-question-list">
          {questionRows.map((row, questionIndex) => (
            <article key={row.question.id}>
              <header>
                <span>Q{questionIndex + 1}</span>
                <div>
                  <h3>{row.question.title.replace(/^Q\d+\.\s*/, "")}</h3>
                  <p>
                    {row.total.toLocaleString()} answers
                    {row.dropOffPercent > 0 && ` · ${row.dropOffPercent}% drop-off`}
                  </p>
                </div>
              </header>
              <div>
                {row.options.map((option) => (
                  <HorizontalBar
                    key={option.id}
                    label={`${option.id}. ${option.label}`}
                    percent={option.percent}
                    value={`${option.count.toLocaleString()} · ${option.percent}%`}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-grid analytics-grid-context">
        <article className="analytics-panel">
          <header>
            <div>
              <h2>Traffic sources</h2>
              <p>How students arrive and convert</p>
            </div>
          </header>
          <div className="analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Visitors</th>
                  <th>Starts</th>
                  <th>Completed</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceDistribution.map((source) => (
                  <tr key={source.source}>
                    <td>{labelFromId(source.source)}</td>
                    <td>{source.visitors.toLocaleString()}</td>
                    <td>{source.starts.toLocaleString()}</td>
                    <td>{source.completions.toLocaleString()}</td>
                    <td>{source.completionPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="analytics-panel">
          <header>
            <div>
              <h2>Device completion</h2>
              <p>Useful for spotting platform-specific friction</p>
            </div>
          </header>
          <div className="analytics-context-list">
            {data.context.platforms.map((platform) => (
              <HorizontalBar
                key={platform.value}
                label={labelFromId(platform.value)}
                percent={platform.completionPercent}
                value={`${platform.completions}/${platform.starts} · ${platform.completionPercent}%`}
              />
            ))}
          </div>
          {!data.quality.hasDeviceAndTimingData && (
            <p className="analytics-data-note">
              Device and timing fields will populate after the database upgrade.
            </p>
          )}
        </article>
      </section>

      <section className="analytics-grid analytics-grid-context">
        <article className="analytics-panel">
          <header>
            <div>
              <h2>Device mix</h2>
              <p>Completion by broad device category</p>
            </div>
          </header>
          <div className="analytics-context-list">
            {data.context.devices.map((device) => (
              <HorizontalBar
                key={device.value}
                label={labelFromId(device.value)}
                percent={device.completionPercent}
                value={`${device.completions}/${device.starts} · ${device.completionPercent}%`}
              />
            ))}
          </div>
        </article>

        <article className="analytics-panel">
          <header>
            <div>
              <h2>Screen-size completion</h2>
              <p>Helps identify layouts that may need attention</p>
            </div>
          </header>
          <div className="analytics-context-list">
            {data.context.viewports.map((viewport) => (
              <HorizontalBar
                key={viewport.value}
                label={labelFromId(viewport.value)}
                percent={viewport.completionPercent}
                value={`${viewport.completions}/${viewport.starts} · ${viewport.completionPercent}%`}
              />
            ))}
          </div>
        </article>
      </section>

      <section className="analytics-panel">
        <header>
          <div>
            <h2>Recent completions</h2>
            <p>Latest anonymous result activity</p>
          </div>
        </header>
        {data.recentCompletions.length === 0 ? (
          <EmptyState>No completed quizzes in this period.</EmptyState>
        ) : (
          <div className="analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Completed</th>
                  <th>Result</th>
                  <th>Source</th>
                  <th>Device</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCompletions.map((completion, index) => (
                  <tr key={`${completion.completedAt}-${index}`}>
                    <td>{formatDateTime(completion.completedAt)}</td>
                    <td>
                      {completion.resultId === "unknown"
                        ? "Unknown"
                        : resultProfiles[completion.resultId]?.name ??
                          labelFromId(completion.resultId)}
                    </td>
                    <td>{labelFromId(completion.source)}</td>
                    <td>
                      {labelFromId(completion.platform)} ·{" "}
                      {labelFromId(completion.deviceType)}
                    </td>
                    <td>{formatDuration(completion.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="analytics-footer">
        <span>
          Refreshed {formatDateTime(data.generatedAt)} ·{" "}
          {data.quality.eventCount.toLocaleString()} anonymous events
        </span>
        <span>
          {data.quality.truncated && "Large dataset: showing the latest reporting window. "}
          No personal identifiers collected.
        </span>
      </footer>
    </main>
  );
}
