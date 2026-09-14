import { formatEventDate, type MunoEvent } from "@/app/lib/events";

// Tarjeta 4:5 (formato retrato habitual para compartir en redes/WhatsApp), dibujada con
// los mismos tonos e tipografias del sitio (Instrument Serif cursiva + Space Grotesk) en
// vez de un pantallazo generico -- asi lo que se comparte tiene la misma cara que la web.
const W = 1080;
const H = 1350;
const PAD = 64;

const COLORS = {
  background: "#f7f2ea",
  foreground: "#24242d",
  muted: "#6e6e7a",
  accent: "#b5502a",
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildShareCardBlob(event: MunoEvent): Promise<Blob> {
  // Sin esto el primer render a veces cae en la fuente de sistema por defecto porque la
  // fuente todavia no habia terminado de cargar cuando se pinta el lienzo.
  await document.fonts.load("italic 400 80px 'Instrument Serif'");
  await document.fonts.load("600 28px 'Space Grotesk'");
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = COLORS.foreground;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

  const innerX = PAD + 56;
  const innerW = W - (PAD + 56) * 2;
  let y = PAD + 110;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.accent;
  ctx.font = "600 26px 'Space Grotesk'";
  ctx.fillText("MUNO · MADRID", innerX, y);

  y += 56;
  const parts = event.start_at ? formatEventDate(event.start_at) : null;
  const dateLine = parts
    ? `${parts.weekday.toUpperCase()} ${parts.day} ${parts.monthLabel.toUpperCase()}${parts.time ? ` · ${parts.time}` : ""}`
    : "";
  if (dateLine) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 30px 'Space Grotesk'";
    ctx.fillText(dateLine, innerX, y);
  }

  y += 90;
  let fontSize = 78;
  let lines: string[] = [];
  while (fontSize > 36) {
    ctx.font = `italic 400 ${fontSize}px 'Instrument Serif'`;
    lines = wrapText(ctx, event.name, innerW);
    if (lines.length <= 5) break;
    fontSize -= 4;
  }
  ctx.fillStyle = COLORS.foreground;
  const lineHeight = fontSize * 1.15;
  for (const line of lines) {
    y += lineHeight;
    ctx.fillText(line, innerX, y);
  }

  if (event.address) {
    y += 56;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 28px 'Space Grotesk'";
    for (const line of wrapText(ctx, event.address, innerW).slice(0, 2)) {
      y += 38;
      ctx.fillText(line, innerX, y);
    }
  }

  const bottomY = H - PAD - 100;
  ctx.strokeStyle = COLORS.foreground;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, bottomY);
  ctx.lineTo(W - innerX, bottomY);
  ctx.stroke();

  ctx.fillStyle = COLORS.foreground;
  ctx.font = "italic 400 44px 'Instrument Serif'";
  ctx.fillText("muno", innerX, bottomY + 56);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 24px 'Space Grotesk'";
  ctx.textAlign = "right";
  ctx.fillText("muno-events.vercel.app", W - innerX, bottomY + 52);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))), "image/png");
  });
}
