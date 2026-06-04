import {
  api,
  type Buffer as FfiBuffer,
  type MutablePointer,
  type ReadonlyPointer,
} from "./ffi";
import { backend } from "./platform/index";
import { RGBA, type RGBAInput, terminalDefault } from "./rgba";

export const ATTR_CONTINUATION = 1 << 0;
export const ATTR_BOLD = 1 << 1;
export const ATTR_ITALIC = 1 << 2;
export const ATTR_UNDERLINE = 1 << 3;

export interface DrawBoxOptions {
  backgroundColor: RGBAInput;
  border?: boolean | ("top" | "right" | "bottom" | "left")[];
  borderColor: RGBAInput;
  height: number;
  title?: string;
  width: number;
  x: number;
  y: number;
}

export interface CapturedSpan {
  attributes: number;
  bg: RGBA;
  fg: RGBA;
  text: string;
  width: number;
}

export interface CapturedLine {
  spans: CapturedSpan[];
}

export interface CapturedFrame {
  cols: number;
  cursor: [number, number];
  lines: CapturedLine[];
  rows: number;
}

function cp(char: string): number {
  return char.codePointAt(0) ?? 0;
}

const DEFAULT_BORDER_CHARS = new Uint32Array([
  cp("┌"),
  cp("─"),
  cp("┐"),
  cp("│"),
  cp("┘"),
  cp("─"),
  cp("└"),
  cp("│"),
]);

const BORDER_TOP = 1;
const BORDER_RIGHT = 1 << 1;
const BORDER_BOTTOM = 1 << 2;
const BORDER_LEFT = 1 << 3;

export class MoonBuffer {
  readonly width: number;
  readonly height: number;
  private readonly _ptr: MutablePointer<FfiBuffer>;

  constructor(
    bufferPtr: MutablePointer<FfiBuffer>,
    width: number,
    height: number
  ) {
    this._ptr = bufferPtr;
    this.width = width;
    this.height = height;
  }

  get ptr(): MutablePointer<FfiBuffer> {
    return this._ptr;
  }

  private getViews(): {
    charDV: DataView;
    fgDV: DataView;
    bgDV: DataView;
    attrDV: DataView;
  } {
    const n = this.width * this.height;
    const p = this._ptr;
    const charP = api.buffer.bufferGetCharPtr(p);
    const fgP = api.buffer.bufferGetFgPtr(p);
    const bgP = api.buffer.bufferGetBgPtr(p);
    const attrP = api.buffer.bufferGetAttributesPtr(p);
    return {
      charDV: new DataView(backend.toArrayBuffer(charP, 0, n * 4)),
      fgDV: new DataView(backend.toArrayBuffer(fgP, 0, n * 8)),
      bgDV: new DataView(backend.toArrayBuffer(bgP, 0, n * 8)),
      attrDV: new DataView(backend.toArrayBuffer(attrP, 0, n * 4)),
    };
  }

  clear(bgColor: RGBAInput): void {
    api.buffer.bufferClear(this._ptr, bgColor);
  }

  drawText(
    text: string,
    x: number,
    y: number,
    fgColor: RGBAInput,
    bgColor?: RGBAInput,
    attributes?: number
  ): void {
    if (text.length === 0 || y >= this.height) {
      return;
    }
    api.buffer.bufferDrawText(
      this._ptr,
      text,
      x,
      y,
      fgColor,
      bgColor ?? terminalDefault(),
      attributes ?? 0
    );
  }

  drawBox(options: DrawBoxOptions): void {
    const { x, y, width, height, borderColor, backgroundColor } = options;
    if (width === 0 || height === 0) {
      return;
    }
    api.buffer.bufferDrawBox(
      this._ptr,
      x,
      y,
      width,
      height,
      DEFAULT_BORDER_CHARS,
      packBorderOptions(options.border),
      borderColor,
      backgroundColor
    );
    if (options.title) {
      this.drawText(
        options.title,
        options.x + 2,
        options.y,
        options.borderColor,
        options.backgroundColor
      );
    }
  }

  drawChar(
    charCodepoint: number,
    x: number,
    y: number,
    fgColor: RGBAInput,
    bgColor?: RGBAInput,
    attributes?: number
  ): void {
    if (x >= this.width || y >= this.height) {
      return;
    }
    api.buffer.bufferDrawChar(
      this._ptr,
      charCodepoint,
      x,
      y,
      fgColor,
      bgColor ?? terminalDefault(),
      attributes ?? 0
    );
  }

  fillRect(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    bgColor: RGBAInput
  ): void {
    api.buffer.bufferFillRect(this._ptr, rx, ry, rw, rh, bgColor);
  }

  getRealCharBytes(addLineBreaks = true): Uint8Array {
    const size = api.buffer.bufferRealCharSize(this._ptr, addLineBreaks);
    const output = new Uint8Array(size);
    const outPtr = backend.ptr(output);
    api.buffer.bufferWriteResolvedChars(
      this._ptr,
      outPtr,
      output.length,
      addLineBreaks
    );
    return output;
  }

  getSpanLines(): CapturedLine[] {
    const { charDV, fgDV, bgDV, attrDV } = this.getViews();

    const lines: CapturedLine[] = [];

    for (let y = 0; y < this.height; y++) {
      const spans: CapturedSpan[] = [];
      let currentSpan: CapturedSpan | null = null;

      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;

        if (attrDV.getUint32(idx * 4, true) & ATTR_CONTINUATION) {
          continue;
        }

        const ch = charDV.getUint32(idx * 4, true);
        const charStr = ch === 0 ? " " : String.fromCodePoint(ch);

        const fgOff = idx * 8;
        const fgBuffer = new Uint16Array(4);
        fgBuffer[0] = fgDV.getUint16(fgOff, true);
        fgBuffer[1] = fgDV.getUint16(fgOff + 2, true);
        fgBuffer[2] = fgDV.getUint16(fgOff + 4, true);
        fgBuffer[3] = fgDV.getUint16(fgOff + 6, true);
        const fg = RGBA.fromPackedBuffer(fgBuffer);

        const bgOff = idx * 8;
        const bgBuffer = new Uint16Array(4);
        bgBuffer[0] = bgDV.getUint16(bgOff, true);
        bgBuffer[1] = bgDV.getUint16(bgOff + 2, true);
        bgBuffer[2] = bgDV.getUint16(bgOff + 4, true);
        bgBuffer[3] = bgDV.getUint16(bgOff + 6, true);
        const bg = RGBA.fromPackedBuffer(bgBuffer);

        const attr = attrDV.getUint32(idx * 4, true);
        const styleAttrs = attr & ~ATTR_CONTINUATION;

        if (
          currentSpan &&
          currentSpan.fg.r === fg.r &&
          currentSpan.fg.g === fg.g &&
          currentSpan.fg.b === fg.b &&
          currentSpan.fg.a === fg.a &&
          currentSpan.fg.intent === fg.intent &&
          currentSpan.bg.r === bg.r &&
          currentSpan.bg.g === bg.g &&
          currentSpan.bg.b === bg.b &&
          currentSpan.bg.a === bg.a &&
          currentSpan.bg.intent === bg.intent &&
          currentSpan.attributes === styleAttrs
        ) {
          currentSpan.text += charStr;
          currentSpan.width += 1;
        } else {
          if (currentSpan) {
            spans.push(currentSpan);
          }
          currentSpan = {
            text: charStr,
            fg,
            bg,
            attributes: styleAttrs,
            width: 1,
          };
        }
      }

      if (currentSpan) {
        spans.push(currentSpan);
      }
      lines.push({ spans });
    }

    return lines;
  }
}

function packBorderOptions(border: DrawBoxOptions["border"]): number {
  if (border === false) {
    return 1 << 4;
  }
  if (Array.isArray(border)) {
    return border.reduce((flags, side) => {
      switch (side) {
        case "top":
          return flags | BORDER_TOP;
        case "right":
          return flags | BORDER_RIGHT;
        case "bottom":
          return flags | BORDER_BOTTOM;
        case "left":
          return flags | BORDER_LEFT;
        default:
          return flags;
      }
    }, 0);
  }
  return BORDER_TOP | BORDER_RIGHT | BORDER_BOTTOM | BORDER_LEFT;
}

export class ReadonlyMoonBuffer {
  readonly width: number;
  readonly height: number;
  private readonly _buffer: MoonBuffer;

  constructor(
    bufferPtr: ReadonlyPointer<FfiBuffer>,
    width: number,
    height: number
  ) {
    this.width = width;
    this.height = height;
    this._buffer = new MoonBuffer(
      bufferPtr as unknown as MutablePointer<FfiBuffer>,
      width,
      height
    );
  }

  get ptr(): ReadonlyPointer<FfiBuffer> {
    return this._buffer.ptr as unknown as ReadonlyPointer<FfiBuffer>;
  }

  getRealCharBytes(addLineBreaks = true): Uint8Array {
    return this._buffer.getRealCharBytes(addLineBreaks);
  }

  getSpanLines(): CapturedLine[] {
    return this._buffer.getSpanLines();
  }
}
