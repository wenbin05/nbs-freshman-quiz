import { readFile } from "node:fs/promises";
import process from "node:process";
import ts from "typescript";

const sourceUrl = new URL("../src/data/quiz.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;
const { outcomeOrder, quizQuestions } = await import(moduleUrl);

const OPTION_TOTAL = 3;
const totalScoreMass = quizQuestions.reduce(
  (total, question) =>
    total +
    question.options.reduce(
      (questionTotal, option) =>
        questionTotal +
        Object.values(option.weights).reduce(
          (optionTotal, weight) => optionTotal + weight,
          0,
        ),
      0,
    ),
  0,
);
const targetOutcomeMass = totalScoreMass / outcomeOrder.length;

const outcomeMass = Object.fromEntries(
  outcomeOrder.map((outcome) => [outcome, 0]),
);
const primaryCounts = Object.fromEntries(
  outcomeOrder.map((outcome) => [outcome, 0]),
);
const expectedScores = Object.fromEntries(
  outcomeOrder.map((outcome) => [outcome, 0]),
);
const failures = [];

for (const question of quizQuestions) {
  const questionMass = Object.fromEntries(
    outcomeOrder.map((outcome) => [outcome, 0]),
  );

  for (const option of question.options) {
    const optionTotal = Object.values(option.weights).reduce(
      (total, weight) => total + weight,
      0,
    );

    if (optionTotal !== OPTION_TOTAL) {
      failures.push(
        `${question.id} option ${option.id} awards ${optionTotal} points instead of ${OPTION_TOTAL}.`,
      );
    }

    if ((option.weights[option.primaryOutcome] ?? 0) !== 2) {
      failures.push(
        `${question.id} option ${option.id} does not award 2 points to its primary outcome.`,
      );
    }

    primaryCounts[option.primaryOutcome] += 1;
    for (const outcome of outcomeOrder) {
      const weight = option.weights[outcome] ?? 0;
      outcomeMass[outcome] += weight;
      questionMass[outcome] += weight;
    }
  }

  for (const outcome of outcomeOrder) {
    expectedScores[outcome] +=
      questionMass[outcome] / question.options.length;
  }
}

for (const outcome of outcomeOrder) {
  if (outcomeMass[outcome] !== targetOutcomeMass) {
    failures.push(
      `${outcome} has ${outcomeMass[outcome]} available points instead of ${targetOutcomeMass}.`,
    );
  }
}

const primaryValues = Object.values(primaryCounts);
if (Math.max(...primaryValues) - Math.min(...primaryValues) > 1) {
  failures.push("Primary outcome opportunities differ by more than one.");
}

function selectWinner(scores, primaryAnswers) {
  const highestScore = Math.max(
    ...outcomeOrder.map((outcome) => scores[outcome]),
  );
  const tiedOutcomes = outcomeOrder.filter(
    (outcome) => scores[outcome] === highestScore,
  );

  if (tiedOutcomes.length === 1) {
    return tiedOutcomes[0];
  }

  const primaryResultCounts = tiedOutcomes.map((outcome) => ({
    outcome,
    count: primaryAnswers.filter((answer) => answer === outcome).length,
  }));
  const strongestPrimary = primaryResultCounts.reduce((strongest, candidate) =>
    candidate.count * primaryCounts[strongest.outcome] >
    strongest.count * primaryCounts[candidate.outcome]
      ? candidate
      : strongest,
  );
  const primaryTies = primaryResultCounts
    .filter(
      ({ count, outcome }) =>
        count * primaryCounts[strongestPrimary.outcome] ===
        strongestPrimary.count * primaryCounts[outcome],
    )
    .map(({ outcome }) => outcome);

  if (primaryTies.length === 1) {
    return primaryTies[0];
  }

  const recentPrimary = [...primaryAnswers]
    .reverse()
    .find((outcome) => primaryTies.includes(outcome));

  return recentPrimary ?? primaryTies[0] ?? outcomeOrder[0];
}

const winnerCounts = Object.fromEntries(
  outcomeOrder.map((outcome) => [outcome, 0]),
);
const workingScores = Object.fromEntries(
  outcomeOrder.map((outcome) => [outcome, 0]),
);
const primaryAnswers = [];
let combinationCount = 0;

function evaluatePaths(questionIndex) {
  if (questionIndex === quizQuestions.length) {
    winnerCounts[selectWinner(workingScores, primaryAnswers)] += 1;
    combinationCount += 1;
    return;
  }

  for (const option of quizQuestions[questionIndex].options) {
    for (const outcome of outcomeOrder) {
      workingScores[outcome] += option.weights[outcome] ?? 0;
    }
    primaryAnswers.push(option.primaryOutcome);

    evaluatePaths(questionIndex + 1);

    primaryAnswers.pop();
    for (const outcome of outcomeOrder) {
      workingScores[outcome] -= option.weights[outcome] ?? 0;
    }
  }
}

evaluatePaths(0);

const winnerRates = Object.fromEntries(
  outcomeOrder.map((outcome) => [
    outcome,
    (winnerCounts[outcome] / combinationCount) * 100,
  ]),
);
const winnerRateValues = Object.values(winnerRates);
const winnerRateSpread =
  Math.max(...winnerRateValues) - Math.min(...winnerRateValues);

if (winnerRateSpread > 3) {
  failures.push(
    `The exhaustive winner-rate spread is ${winnerRateSpread.toFixed(2)} percentage points; expected no more than 3.`,
  );
}

console.table(
  outcomeOrder.map((outcome) => ({
    outcome,
    availablePoints: outcomeMass[outcome],
    expectedRandomScore: expectedScores[outcome],
    primaryOptions: primaryCounts[outcome],
    exhaustiveWinRate: `${winnerRates[outcome].toFixed(2)}%`,
  })),
);

if (failures.length > 0) {
  console.error("\nScoring audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `\nScoring is balanced: every option awards ${OPTION_TOTAL} points and every outcome has ${targetOutcomeMass} available points.`,
  );
  console.log(
    `Checked all ${combinationCount.toLocaleString()} answer paths; winner-rate spread is ${winnerRateSpread.toFixed(2)} percentage points.`,
  );
}
