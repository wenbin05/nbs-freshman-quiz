import QRCode from "qrcode";
import type { ResultProfile } from "../types";
import { getPublicQuizUrl } from "./quizUrl";

const storyWidth = 1080;
const storyHeight = 1920;

const resultPalette: Record<
  ResultProfile["id"],
  { accent: string; panel: string; soft: string }
> = {
  lostButVibing: {
    accent: "#e6785f",
    panel: "#ffd3c2",
    soft: "#fff0e9",
  },
  lowkeyStrategist: {
    accent: "#3374a8",
    panel: "#cce7f8",
    soft: "#edf8ff",
  },
  overachiever: {
    accent: "#5d8d46",
    panel: "#d9efc5",
    soft: "#f2faeb",
  },
  socialButterfly: {
    accent: "#d55f78",
    panel: "#ffd2db",
    soft: "#fff0f3",
  },
  softSupporter: {
    accent: "#8e6ab5",
    panel: "#e7d5f5",
    soft: "#f7f0fc",
  },
  weBallAgent: {
    accent: "#d49a26",
    panel: "#ffe8a9",
    soft: "#fff8df",
  },
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Unable to create the result image."));
      }
    }, "image/png");
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - corner,
    y + height,
  );
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function drawCenteredLines(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    context.fillText(line, centerX, startY + index * lineHeight);
  });

  return lines.length;
}

export async function createResultStoryImage(
  result: ResultProfile,
  resultCardSrc: string,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not supported by this browser.");
  }

  canvas.width = storyWidth;
  canvas.height = storyHeight;

  await document.fonts?.ready;

  const palette = resultPalette[result.id];
  const wash = context.createLinearGradient(0, 0, storyWidth, storyHeight);
  wash.addColorStop(0, "#f9fcff");
  wash.addColorStop(0.52, palette.soft);
  wash.addColorStop(1, "#e7f2ff");
  context.fillStyle = wash;
  context.fillRect(0, 0, storyWidth, storyHeight);

  context.globalAlpha = 0.22;
  context.fillStyle = palette.accent;
  for (let y = 34; y < storyHeight; y += 54) {
    for (let x = 34 + ((y / 54) % 2) * 27; x < storyWidth; x += 54) {
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;

  context.fillStyle = "#24568f";
  context.font = '30px "Silkscreen", monospace';
  context.textAlign = "center";
  context.fillText("NBS WELCOME DAY", storyWidth / 2, 72);

  context.fillStyle = "#24568f";
  context.font = '52px "Silkscreen", monospace';
  drawCenteredLines(
    context,
    "WHAT NBS FRESHMAN ARE YOU?",
    storyWidth / 2,
    142,
    950,
    62,
  );

  roundedRect(context, 158, 218, 764, 62, 31);
  context.fillStyle = "#d3e8f9";
  context.fill();
  context.fillStyle = "#24568f";
  context.font = '24px "Silkscreen", monospace';
  context.fillText(
    "YOUR CHOICE. YOUR VIBE. YOUR NBS STORY.",
    storyWidth / 2,
    258,
  );

  const quizUrl = getPublicQuizUrl("ig-story");
  const qrDataUrl = await QRCode.toDataURL(quizUrl, {
    color: {
      dark: "#173d70",
      light: "#ffffff",
    },
    margin: 1,
    width: 220,
  });
  const [resultCard, qrCode] = await Promise.all([
    loadImage(resultCardSrc),
    loadImage(qrDataUrl),
  ]);
  const maxCardWidth = 900;
  const maxCardHeight = 1020;
  const scale = Math.min(
    maxCardWidth / resultCard.naturalWidth,
    maxCardHeight / resultCard.naturalHeight,
  );
  const cardWidth = resultCard.naturalWidth * scale;
  const cardHeight = resultCard.naturalHeight * scale;
  const cardX = (storyWidth - cardWidth) / 2;
  const cardY = 330;

  context.shadowColor = "rgba(31, 61, 98, 0.2)";
  context.shadowBlur = 26;
  context.shadowOffsetY = 14;
  context.drawImage(resultCard, cardX, cardY, cardWidth, cardHeight);
  context.shadowColor = "transparent";

  const resultPanelY = Math.min(cardY + cardHeight + 46, 1390);
  roundedRect(context, 90, resultPanelY, 900, 300, 42);
  context.fillStyle = palette.panel;
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = palette.accent;
  context.stroke();

  context.fillStyle = palette.accent;
  context.font = '26px "Silkscreen", monospace';
  context.fillText("MY FRESHMAN TYPE", storyWidth / 2, resultPanelY + 54);

  context.fillStyle = "#173d70";
  context.font = '46px "Silkscreen", monospace';
  const nameLineCount = drawCenteredLines(
    context,
    result.name,
    storyWidth / 2,
    resultPanelY + 118,
    790,
    56,
  );

  const tagsY = resultPanelY + 142 + nameLineCount * 50;
  const visibleTags = result.tags.slice(0, 3).join("   ");
  context.fillStyle = "#24568f";
  context.font = '23px "Silkscreen", monospace';
  context.fillText(visibleTags, storyWidth / 2, Math.min(tagsY, resultPanelY + 252));

  roundedRect(context, 90, 1696, 900, 176, 34);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = palette.accent;
  context.stroke();

  context.fillStyle = "#24568f";
  context.font = '28px "Silkscreen", monospace';
  context.textAlign = "left";
  context.fillText("DISCOVER YOUR NBS TYPE", 132, 1758);
  context.font = '22px "Silkscreen", monospace';
  context.fillText("SCAN TO TAKE THE QUIZ", 132, 1806);
  context.font = '18px "Silkscreen", monospace';
  context.fillText("freshman-quiz.vercel.app", 132, 1848);

  context.drawImage(qrCode, 805, 1711, 144, 144);

  context.fillStyle = "#24568f";
  context.font = '21px "Silkscreen", monospace';
  context.textAlign = "center";
  context.fillText(
    `${result.tags[0] ?? "#NBSFreshman"}  #NBSWelcomeDay`,
    storyWidth / 2,
    1904,
  );

  return canvasToBlob(canvas);
}

export async function shareResultStory(
  result: ResultProfile,
  resultCardSrc: string,
) {
  const blob = await createResultStoryImage(result, resultCardSrc);
  const file = new File(
    [blob],
    `nbs-freshman-${result.id}.png`,
    { type: "image/png" },
  );

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      text: `I got ${result.name} in What NBS Freshman Are You? Try it: ${getPublicQuizUrl("shared-result")}`,
      title: "My NBS Freshman Type",
    });
    return "shared" as const;
  }

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = file.name;
  link.href = downloadUrl;
  link.click();
  URL.revokeObjectURL(downloadUrl);
  return "downloaded" as const;
}
