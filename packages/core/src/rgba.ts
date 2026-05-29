export class RGBA {
  readonly buffer: Uint16Array;

  constructor(r: number, g: number, b: number, a = 65_535) {
    this.buffer = new Uint16Array(4);
    this.buffer[0] = r;
    this.buffer[1] = g;
    this.buffer[2] = b;
    this.buffer[3] = a;
  }

  get r(): number {
    return this.buffer[0];
  }

  get g(): number {
    return this.buffer[1];
  }

  get b(): number {
    return this.buffer[2];
  }

  get a(): number {
    return this.buffer[3];
  }
}

export type RGBAInput = RGBA | { r: number; g: number; b: number; a?: number };

export function toRGBA(input: RGBAInput): RGBA {
  if (input instanceof RGBA) {
    return input;
  }
  return new RGBA(input.r, input.g, input.b, input.a ?? 65_535);
}
