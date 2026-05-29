/// Color intent embedded in RGBA high bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ColorIntent {
  /// RGB truecolor (24-bit)
  Rgb = 0,
  /// ANSI 256-color indexed
  Indexed = 1,
  /// Terminal default color (SGR 39/49)
  Default = 2,
}

/// RGBA color packed into four u16 values.
///
/// Each u16 component layout:
/// - Bits 0-7: channel value (0-255)
/// - Bits 8-9: ColorIntent (2 bits)
/// - Bits 10-15: palette slot for indexed colors (6 bits)
#[expect(clippy::upper_case_acronyms)]
pub type RGBA = [u16; 4];

/// Pack channel value and intent into a u16.
fn pack_component(channel: u8, intent: ColorIntent, slot: u8) -> u16 {
  let intent_bits = (intent as u16) & 0x03;
  let slot_bits = (slot as u16) & 0x3F;
  (slot_bits << 10) | (intent_bits << 8) | (channel as u16)
}

/// Create an RGBA color with Rgb intent.
pub fn rgb_color(r: u8, g: u8, b: u8, a: u8) -> RGBA {
  [
    pack_component(r, ColorIntent::Rgb, 0),
    pack_component(g, ColorIntent::Rgb, 0),
    pack_component(b, ColorIntent::Rgb, 0),
    pack_component(a, ColorIntent::Rgb, 0),
  ]
}

/// Create an RGBA color with Indexed intent.
#[cfg(test)]
pub fn indexed_color(slot: u8, r: u8, g: u8, b: u8) -> RGBA {
  [
    pack_component(r, ColorIntent::Indexed, slot),
    pack_component(g, ColorIntent::Indexed, slot),
    pack_component(b, ColorIntent::Indexed, slot),
    pack_component(255, ColorIntent::Indexed, slot),
  ]
}

/// Create an RGBA color with Default intent.
#[cfg(test)]
pub fn default_color(r: u8, g: u8, b: u8, a: u8) -> RGBA {
  [
    pack_component(r, ColorIntent::Default, 0),
    pack_component(g, ColorIntent::Default, 0),
    pack_component(b, ColorIntent::Default, 0),
    pack_component(a, ColorIntent::Default, 0),
  ]
}

/// Extract the low byte (channel value) from a packed component.
fn unpack_channel(component: u16) -> u8 {
  (component & 0xFF) as u8
}

/// Extract ColorIntent from a packed component.
#[expect(clippy::match_same_arms)]
fn unpack_intent(component: u16) -> ColorIntent {
  match (component >> 8) & 0x03 {
    0 => ColorIntent::Rgb,
    1 => ColorIntent::Indexed,
    2 => ColorIntent::Default,
    _ => ColorIntent::Rgb,
  }
}

/// Extract palette slot from a packed component.
fn unpack_slot(component: u16) -> u8 {
  ((component >> 10) & 0x3F) as u8
}

/// Get red channel (0-255).
pub fn red(color: RGBA) -> u8 {
  unpack_channel(color[0])
}

/// Get green channel (0-255).
pub fn green(color: RGBA) -> u8 {
  unpack_channel(color[1])
}

/// Get blue channel (0-255).
pub fn blue(color: RGBA) -> u8 {
  unpack_channel(color[2])
}

/// Get alpha channel (0-255).
#[cfg(test)]
pub fn alpha(color: RGBA) -> u8 {
  unpack_channel(color[3])
}

/// Get color intent.
pub fn intent(color: RGBA) -> ColorIntent {
  unpack_intent(color[0])
}

/// Get palette slot (only meaningful for Indexed intent).
pub fn slot(color: RGBA) -> u8 {
  unpack_slot(color[0])
}

/// ANSI 256-color palette lookup.
/// Returns an RGBA color with Rgb intent for the given index.
pub fn fallback_ansi256_color(index: u8) -> RGBA {
  let (r, g, b) = match index {
    0..=7 => ansi256_to_rgb_16(index),
    8..=15 => ansi256_to_rgb_16(index - 8 + 8),
    16..=231 => {
      let idx = index - 16;
      let b_comp = idx % 6;
      let g_comp = (idx / 6) % 6;
      let r_comp = idx / 36;
      (
        if r_comp == 0 { 0 } else { 55 + r_comp * 40 },
        if g_comp == 0 { 0 } else { 55 + g_comp * 40 },
        if b_comp == 0 { 0 } else { 55 + b_comp * 40 },
      )
    }
    232..=255 => {
      let gray = 8 + (index - 232) * 10;
      (gray, gray, gray)
    }
  };
  rgb_color(r, g, b, 255)
}

/// Map ANSI 16-color index to RGB.
#[expect(clippy::match_same_arms)]
fn ansi256_to_rgb_16(index: u8) -> (u8, u8, u8) {
  match index {
    0 => (0, 0, 0),
    1 => (128, 0, 0),
    2 => (0, 128, 0),
    3 => (128, 128, 0),
    4 => (0, 0, 128),
    5 => (128, 0, 128),
    6 => (0, 128, 128),
    7 => (192, 192, 192),
    8 => (128, 128, 128),
    9 => (255, 0, 0),
    10 => (0, 255, 0),
    11 => (255, 255, 0),
    12 => (0, 0, 255),
    13 => (255, 0, 255),
    14 => (0, 255, 255),
    15 => (255, 255, 255),
    _ => (0, 0, 0),
  }
}

/// Quantize an RGB color to the nearest ANSI 256-color palette index.
pub fn nearest_palette_index(color: RGBA) -> u8 {
  let r = red(color) as i32;
  let g = green(color) as i32;
  let b = blue(color) as i32;

  let mut best_index = 0u8;
  let mut best_distance = i32::MAX;

  for index in 0u8..=255 {
    let palette_color = fallback_ansi256_color(index);
    let pr = red(palette_color) as i32;
    let pg = green(palette_color) as i32;
    let pb = blue(palette_color) as i32;

    let dr = r - pr;
    let dg = g - pg;
    let db = b - pb;
    let distance = dr * dr + dg * dg + db * db;

    if distance < best_distance || (distance == best_distance && index > best_index) {
      best_distance = distance;
      best_index = index;
    }
  }

  best_index
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_rgb_color_constructor() {
    let color = rgb_color(255, 128, 0, 255);
    assert_eq!(red(color), 255);
    assert_eq!(green(color), 128);
    assert_eq!(blue(color), 0);
    assert_eq!(alpha(color), 255);
    assert_eq!(intent(color), ColorIntent::Rgb);
  }

  #[test]
  fn test_indexed_color_constructor() {
    let color = indexed_color(9, 255, 0, 0);
    assert_eq!(intent(color), ColorIntent::Indexed);
    assert_eq!(slot(color), 9);
    assert_eq!(red(color), 255);
    assert_eq!(green(color), 0);
    assert_eq!(blue(color), 0);
  }

  #[test]
  fn test_default_color_constructor() {
    let color = default_color(0, 0, 0, 255);
    assert_eq!(intent(color), ColorIntent::Default);
    assert_eq!(red(color), 0);
    assert_eq!(green(color), 0);
    assert_eq!(blue(color), 0);
    assert_eq!(alpha(color), 255);
  }

  #[test]
  fn test_fallback_ansi256_color_16() {
    let color = fallback_ansi256_color(9);
    assert_eq!(red(color), 255);
    assert_eq!(green(color), 0);
    assert_eq!(blue(color), 0);
    assert_eq!(intent(color), ColorIntent::Rgb);
  }

  #[test]
  fn test_fallback_ansi256_color_21() {
    let color = fallback_ansi256_color(21);
    assert_eq!(red(color), 0);
    assert_eq!(green(color), 0);
    assert_eq!(blue(color), 255);
  }

  #[test]
  fn test_fallback_ansi256_color_232() {
    let color = fallback_ansi256_color(232);
    assert!(red(color) < 20);
    assert!(green(color) < 20);
    assert!(blue(color) < 20);
  }

  #[test]
  fn test_nearest_palette_index_red() {
    let color = rgb_color(255, 0, 0, 255);
    assert_eq!(nearest_palette_index(color), 196);
  }

  #[test]
  fn test_nearest_palette_index_blue() {
    let color = rgb_color(0, 0, 255, 255);
    assert_eq!(nearest_palette_index(color), 21);
  }

  #[test]
  fn test_color_equality_same() {
    let a = rgb_color(255, 0, 0, 255);
    let b = rgb_color(255, 0, 0, 255);
    assert_eq!(a, b);
  }

  #[test]
  fn test_color_equality_different_intent() {
    let a = rgb_color(255, 0, 0, 255);
    let b = indexed_color(9, 255, 0, 0);
    assert_ne!(a, b);
  }
}
