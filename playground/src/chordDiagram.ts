import type { DiagramData } from 'chordpro-core';

const CELL_W = 30;
const CELL_H = 28;
const NUM_FRETS = 5;
const MARGIN_LEFT = 28;
const MARGIN_TOP = 46;   // space for name + O/X
const MARGIN_RIGHT = 28; // space for fret number
const MARGIN_BOTTOM = 8;

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render a chord diagram as an inline SVG string. */
export function renderChordDiagram(name: string, data: DiagramData): string {
  const { baseFret, frets, fingers } = data;
  const numStrings = frets.length;

  const totalW = MARGIN_LEFT + (numStrings - 1) * CELL_W + MARGIN_RIGHT;
  const totalH = MARGIN_TOP + NUM_FRETS * CELL_H + MARGIN_BOTTOM;

  const sx = (i: number) => MARGIN_LEFT + i * CELL_W;
  const fy = (f: number) => MARGIN_TOP + f * CELL_H;
  const dotY = (f: number) => MARGIN_TOP + (f - 0.5) * CELL_H;

  const parts: string[] = [];

  // Chord name
  parts.push(
    `<text x="${(sx(0) + sx(numStrings - 1)) / 2}" y="14" text-anchor="middle" class="diagram-name">${escSvg(name)}</text>`,
  );

  // Nut or fret-number line at top
  const nutStroke = baseFret === 1 ? 'class="nut"' : 'class="fret-line"';
  parts.push(
    `<line x1="${sx(0)}" y1="${fy(0)}" x2="${sx(numStrings - 1)}" y2="${fy(0)}" ${nutStroke}/>`,
  );

  // Fret lines
  for (let f = 1; f <= NUM_FRETS; f++) {
    const y = fy(f);
    parts.push(`<line x1="${sx(0)}" y1="${y}" x2="${sx(numStrings - 1)}" y2="${y}" class="fret-line"/>`);
  }

  // String lines
  for (let s = 0; s < numStrings; s++) {
    const x = sx(s);
    parts.push(`<line x1="${x}" y1="${fy(0)}" x2="${x}" y2="${fy(NUM_FRETS)}" class="string-line"/>`);
  }

  // Open / muted markers above nut
  for (let s = 0; s < numStrings; s++) {
    const x = sx(s);
    const f = frets[s] ?? 0;
    if (f < 0) {
      parts.push(`<text x="${x}" y="${MARGIN_TOP - 8}" text-anchor="middle" class="muted-marker">✕</text>`);
    } else if (f === 0) {
      parts.push(`<circle cx="${x}" cy="${MARGIN_TOP - 10}" r="5" class="open-marker"/>`);
    }
  }

  // Finger dots
  for (let s = 0; s < numStrings; s++) {
    const f = frets[s] ?? 0;
    if (f <= 0) continue;
    const x = sx(s);
    const y = dotY(f);
    const finger = fingers?.[s] ?? 0;
    parts.push(`<circle cx="${x}" cy="${y}" r="11" class="finger-dot"/>`);
    if (finger > 0) {
      parts.push(
        `<text x="${x}" y="${y + 4}" text-anchor="middle" class="finger-label">${finger}</text>`,
      );
    }
  }

  // Base fret indicator
  if (baseFret > 1) {
    const y = dotY(1);
    parts.push(
      `<text x="${sx(numStrings - 1) + 14}" y="${y + 4}" class="basefret-label">${baseFret}fr</text>`,
    );
  }

  return `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" class="chord-diagram" aria-label="${escSvg(name)} chord diagram">${parts.join('')}</svg>`;
}
