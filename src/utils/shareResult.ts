import type { ResultProfile } from "../types";

const storyWidth = 1080;
const storyHeight = 1920;

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

  const wash = context.createLinearGradient(0, 0, storyWidth, storyHeight);
  wash.addColorStop(0, "#f7fbff");
  wash.addColorStop(0.55, "#e5f1ff");
  wash.addColorStop(1, "#ffece5");
  context.fillStyle = wash;
  context.fillRect(0, 0, storyWidth, storyHeight);

  context.fillStyle = "#24568f";
  context.font = '52px "Silkscreen", monospace';
  context.textAlign = "center";
  context.fillText("WHAT NBS FRESHMAN ARE YOU?", storyWidth / 2, 112);

  const resultCard = await loadImage(resultCardSrc);
  const maxCardWidth = 880;
  const maxCardHeight = 1450;
  const scale = Math.min(
    maxCardWidth / resultCard.naturalWidth,
    maxCardHeight / resultCard.naturalHeight,
  );
  const cardWidth = resultCard.naturalWidth * scale;
  const cardHeight = resultCard.naturalHeight * scale;
  const cardX = (storyWidth - cardWidth) / 2;
  const cardY = 190;

  context.shadowColor = "rgba(31, 61, 98, 0.2)";
  context.shadowBlur = 30;
  context.shadowOffsetY = 18;
  context.drawImage(resultCard, cardX, cardY, cardWidth, cardHeight);
  context.shadowColor = "transparent";

  context.fillStyle = "#24568f";
  context.font = '34px "Silkscreen", monospace';
  context.fillText("NBS WELCOME DAY", storyWidth / 2, 1810);
  context.font = '25px "Silkscreen", monospace';
  context.fillText(`#${result.tags[0]?.replace(/^#/, "") ?? "NBSFreshman"}`, storyWidth / 2, 1865);

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
      text: `I got ${result.name} in What NBS Freshman Are You?`,
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
