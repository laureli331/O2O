export const MAX_CNY_FEN = 9_999_999 as const;

declare const cnyFenBrand: unique symbol;

/** Integer fen for CNY, bounded by the PRD's 99,999.99 yuan maximum. */
export type CnyFen = number & { readonly [cnyFenBrand]: 'CNY-fen' };

export type ParseCnyFenResult =
  | { readonly ok: true; readonly value: CnyFen }
  | { readonly ok: false; readonly reason: 'not-decimal-string' | 'invalid-format' | 'too-precise' | 'out-of-range' };

const YUAN_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/** Parse a decimal yuan string exactly; JSON floating-point numbers are rejected. */
export function parseCnyFen(input: unknown): ParseCnyFenResult {
  if (typeof input !== 'string') return { ok: false, reason: 'not-decimal-string' };

  const match = YUAN_PATTERN.exec(input);
  if (!match) return { ok: false, reason: 'invalid-format' };
  const fractionText = match[2] ?? '';
  if (fractionText.length > 2) return { ok: false, reason: 'too-precise' };

  const normalizedYuan = match[1].replace(/^0+(?=\d)/, '');
  if (normalizedYuan.length > 5) return { ok: false, reason: 'out-of-range' };

  const yuan = Number(normalizedYuan);
  const fraction = fractionText.padEnd(2, '0');
  const fen = yuan * 100 + Number(fraction || '0');
  if (!Number.isSafeInteger(fen) || fen > MAX_CNY_FEN) {
    return { ok: false, reason: 'out-of-range' };
  }

  return { ok: true, value: fen as CnyFen };
}

/** Format a validated integer-fen amount without converting through a float yuan value. */
export function formatCnyFen(amount: CnyFen): string {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CNY_FEN) {
    throw new RangeError('CNY fen amount is outside the supported range');
  }

  const yuan = Math.floor(amount / 100);
  const fen = amount % 100;
  return `${yuan}.${String(fen).padStart(2, '0')}`;
}
