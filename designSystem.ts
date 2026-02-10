// ===== Design System Token Definitions =====
// Based on strict Swiss-style design system with 6 spacing levels,
// 5 typography roles, and 4-column grid.

// --- Spacing Tokens ---

export interface SpacingToken {
  name: string;
  label: string;
  px: number;
  usage: string;
}

export const SPACING_TOKENS: SpacingToken[] = [
  { name: 'none', label: '0', px: 0, usage: 'No spacing' },
  { name: 'space-1', label: 'XXS', px: 4, usage: 'Inside button/tag' },
  { name: 'space-2', label: 'XS', px: 8, usage: 'List item to item' },
  { name: 'space-3', label: 'S', px: 16, usage: 'Label to title' },
  { name: 'space-4', label: 'M', px: 32, usage: 'Heading to body' },
  { name: 'space-5', label: 'L', px: 64, usage: 'Header to content' },
  { name: 'space-6', label: 'XL', px: 120, usage: 'Section to section' },
];

export function matchSpacingToken(value: string): string {
  const px = parseFloat(value);
  if (isNaN(px) || px <= 0) return 'none';
  let closest = 'none';
  let minDiff = Infinity;
  for (const token of SPACING_TOKENS) {
    const diff = Math.abs(px - token.px);
    if (diff < minDiff) { minDiff = diff; closest = token.name; }
  }
  const tokenPx = SPACING_TOKENS.find(t => t.name === closest)!.px;
  if (tokenPx === 0 && px > 2) return 'custom';
  if (tokenPx > 0 && minDiff / tokenPx > 0.3) return 'custom';
  return closest;
}

export function getTokenPx(name: string): string {
  const token = SPACING_TOKENS.find(t => t.name === name);
  return token ? token.px + 'px' : '0px';
}

// --- Typography Roles ---

export interface TypographyRole {
  tag: string;
  label: string;
  description: string;
}

export const TYPOGRAPHY_ROLES: TypographyRole[] = [
  { tag: 'h1', label: 'H1', description: 'Primary Heading' },
  { tag: 'h2', label: 'H2', description: 'Secondary Heading' },
  { tag: 'h3', label: 'H3', description: 'Tertiary Heading' },
  { tag: 'h4', label: 'H4', description: 'Label / Auxiliary' },
  { tag: 'p', label: 'Body', description: 'Content Text' },
];

export function getTypographyRole(tag: string): TypographyRole | null {
  return TYPOGRAPHY_ROLES.find(r => r.tag === tag.toLowerCase()) || null;
}

// --- Grid System ---

export const GRID_DESKTOP_COLS = 4;
export const GRID_MOBILE_COLS = 2;

export function getGridNotation(start: number, span: number, maxCols: number): string {
  const parts: string[] = [];
  let pos = 1;
  while (pos <= maxCols) {
    if (pos === start) {
      parts.push(String(span));
      pos += span;
    } else {
      parts.push('0');
      pos++;
    }
  }
  return parts.join(' + ');
}

export function parseGridColumn(startVal: string, endVal: string): { start: number; span: number } {
  let start = parseInt(startVal) || 1;
  let end = parseInt(endVal) || start + 1;
  if (startVal === 'auto' && endVal === 'auto') return { start: 1, span: GRID_DESKTOP_COLS };
  if (startVal === 'auto') start = 1;
  if (endVal === 'auto') end = start + 1;
  const span = Math.max(1, end - start);
  return { start: Math.max(1, Math.min(start, GRID_DESKTOP_COLS)), span: Math.min(span, GRID_DESKTOP_COLS - start + 1) };
}
