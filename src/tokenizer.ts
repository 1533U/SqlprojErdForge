/**
 * Trivia-preserving tokenizer (ADR-0009).
 *
 * Unlike a typical lexer, this keeps comment tokens (line + block) so the parser can
 * attach them to the four comment slots (ADR-0006). Whitespace is consumed but each token
 * records `startsLine` (was it the first non-whitespace token on its physical line?),
 * which is what distinguishes a *leading* comment from a *trailing* (inline) one.
 */

export type TokenKind =
  | "ident" // bare identifier: [A-Za-z_][A-Za-z0-9_]*
  | "bracketIdent" // [ ... ] quoted identifier (may contain '+' or spaces)
  | "string" // '...'
  | "number"
  | "punct" // ( ) , . ; and any other single delimiter
  | "lineComment" // -- ...
  | "blockComment"; // /* ... */

export interface Token {
  kind: TokenKind;
  /** Raw source text of the token (brackets/quotes/markers included). */
  text: string;
  /** Normalized value: identifier without brackets, comment without markers. */
  value: string;
  line: number; // 1-based
  col: number; // 1-based
  offset: number; // 0-based byte offset
  /** True if this is the first non-whitespace token on its physical line. */
  startsLine: boolean;
}

const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);
const isDigit = (c: string): boolean => /[0-9]/.test(c);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  // Tracks whether we have seen only whitespace since the last newline.
  let lineStillBlank = true;

  const advance = (n: number): void => {
    for (let k = 0; k < n; k++) {
      const ch = src[i];
      if (ch === "\n") {
        line++;
        col = 1;
        lineStillBlank = true;
      } else {
        col++;
      }
      i++;
    }
  };

  const push = (
    kind: TokenKind,
    text: string,
    value: string,
    startLine: number,
    startCol: number,
    startOffset: number,
  ): void => {
    const startsLine = lineStillBlank;
    tokens.push({ kind, text, value, line: startLine, col: startCol, offset: startOffset, startsLine });
    lineStillBlank = false;
  };

  while (i < src.length) {
    const ch = src[i] as string;

    // Whitespace.
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance(1);
      continue;
    }

    const startLine = line;
    const startCol = col;
    const startOffset = i;

    // Line comment: -- ... to end of line.
    if (ch === "-" && src[i + 1] === "-") {
      let j = i + 2;
      while (j < src.length && src[j] !== "\n") j++;
      const text = src.slice(i, j);
      advance(j - i);
      push("lineComment", text, stripLineComment(text), startLine, startCol, startOffset);
      continue;
    }

    // Block comment: /* ... */ (nesting supported).
    if (ch === "/" && src[i + 1] === "*") {
      let j = i + 2;
      let depth = 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "/" && src[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (src[j] === "*" && src[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      const text = src.slice(i, j);
      advance(j - i);
      push("blockComment", text, stripBlockComment(text), startLine, startCol, startOffset);
      continue;
    }

    // Bracket-quoted identifier: [ ... ] with ]] as an escaped ].
    if (ch === "[") {
      let j = i + 1;
      let inner = "";
      while (j < src.length) {
        if (src[j] === "]") {
          if (src[j + 1] === "]") {
            inner += "]";
            j += 2;
            continue;
          }
          j++; // consume closing ]
          break;
        }
        inner += src[j];
        j++;
      }
      const text = src.slice(i, j);
      advance(j - i);
      push("bracketIdent", text, inner, startLine, startCol, startOffset);
      continue;
    }

    // String literal: '...' with '' as an escaped '.
    if (ch === "'") {
      let j = i + 1;
      let value = "";
      while (j < src.length) {
        if (src[j] === "'") {
          if (src[j + 1] === "'") {
            value += "'";
            j += 2;
            continue;
          }
          j++;
          break;
        }
        value += src[j];
        j++;
      }
      const text = src.slice(i, j);
      advance(j - i);
      push("string", text, value, startLine, startCol, startOffset);
      continue;
    }

    // Number.
    if (isDigit(ch) || (ch === "." && isDigit(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && (isDigit(src[j] as string) || src[j] === ".")) j++;
      const text = src.slice(i, j);
      advance(j - i);
      push("number", text, text, startLine, startCol, startOffset);
      continue;
    }

    // Bare identifier / keyword.
    if (isIdentStart(ch)) {
      let j = i;
      while (j < src.length && isIdentPart(src[j] as string)) j++;
      const text = src.slice(i, j);
      advance(j - i);
      push("ident", text, text, startLine, startCol, startOffset);
      continue;
    }

    // Everything else is a single-character punctuation/operator token.
    advance(1);
    push("punct", ch, ch, startLine, startCol, startOffset);
  }

  return tokens;
}

export function stripLineComment(text: string): string {
  return text.replace(/^--\s?/, "").trimEnd();
}

export function stripBlockComment(text: string): string {
  return text
    .replace(/^\/\*\s?/, "")
    .replace(/\s?\*\/$/, "")
    .trim();
}

/** Normalize a comment token to the trivia string stored on the model. */
export function commentText(tok: Token): string {
  return tok.kind === "lineComment" ? stripLineComment(tok.text) : stripBlockComment(tok.text);
}
