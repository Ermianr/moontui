export const ColorIntent = {
  Rgb: 0,
  Indexed: 1,
  Default: 2,
} as const;

export type ColorIntent = (typeof ColorIntent)[keyof typeof ColorIntent];

function packComponent(channel: number, intent: number, slot: number): number {
  return ((slot & 0x3f) << 10) | ((intent & 0x03) << 8) | (channel & 0xff);
}

function unpackChannel(packed: number): number {
  return packed & 0xff;
}

function unpackIntent(packed: number): number {
  return (packed >> 8) & 0x03;
}

function unpackSlot(packed: number): number {
  return (packed >> 10) & 0x3f;
}

export class RGBA {
  readonly buffer: Uint16Array;

  constructor(
    r: number,
    g: number,
    b: number,
    a = 255,
    intent: ColorIntent = ColorIntent.Rgb,
    slot = 0
  ) {
    this.buffer = new Uint16Array(4);
    this.buffer[0] = packComponent(r, intent, slot);
    this.buffer[1] = packComponent(g, intent, slot);
    this.buffer[2] = packComponent(b, intent, slot);
    this.buffer[3] = packComponent(a, intent, slot);
  }

  get r(): number {
    return unpackChannel(this.buffer[0]);
  }
  get g(): number {
    return unpackChannel(this.buffer[1]);
  }
  get b(): number {
    return unpackChannel(this.buffer[2]);
  }
  get a(): number {
    return unpackChannel(this.buffer[3]);
  }

  get intent(): ColorIntent {
    return unpackIntent(this.buffer[0]) as ColorIntent;
  }

  get slot(): number {
    return unpackSlot(this.buffer[0]);
  }

  static fromPackedBuffer(buffer: Uint16Array): RGBA {
    if (buffer.length !== 4) {
      throw new Error(
        `RGBA.fromPackedBuffer: expected length 4, got ${buffer.length}`
      );
    }
    const rgba = Object.create(RGBA.prototype) as RGBA;
    (rgba as { buffer: Uint16Array }).buffer = buffer;
    return rgba;
  }
}

export function rgb(r: number, g: number, b: number, a = 255): RGBA {
  return new RGBA(r, g, b, a, ColorIntent.Rgb);
}

export function indexed(
  slot: number,
  r: number,
  g: number,
  b: number,
  a = 255
): RGBA {
  return new RGBA(r, g, b, a, ColorIntent.Indexed, slot);
}

export function terminalDefault(r = 0, g = 0, b = 0, a = 255): RGBA {
  return new RGBA(r, g, b, a, ColorIntent.Default);
}

export type RGBAInput = RGBA | { r: number; g: number; b: number; a?: number };

export function toRGBA(
  input: RGBAInput,
  intent: ColorIntent = ColorIntent.Rgb
): RGBA {
  if (input instanceof RGBA) {
    return input;
  }
  return new RGBA(input.r, input.g, input.b, input.a ?? 255, intent);
}
