use crate::color::{self, ColorIntent, RGBA};
use crate::terminal::Capabilities;
use std::io::Write;

pub fn write_move_cursor(out: &mut Vec<u8>, x: u32, y: u32) {
  let _ = write!(out, "\x1B[{};{}H", y + 1, x + 1);
}

pub fn write_fg(out: &mut Vec<u8>, color: RGBA, caps: Capabilities) {
  let intent = color::intent(color);
  match intent {
    ColorIntent::Default => {
      out.extend_from_slice(b"\x1B[39m");
    }
    ColorIntent::Indexed => {
      let s = color::slot(color);
      let _ = write!(out, "\x1B[38;5;{s}m");
    }
    ColorIntent::Rgb => {
      if caps.rgb {
        let r = color::red(color);
        let g = color::green(color);
        let b = color::blue(color);
        let _ = write!(out, "\x1B[38;2;{r};{g};{b}m");
      } else {
        let index = color::nearest_palette_index(color);
        let _ = write!(out, "\x1B[38;5;{index}m");
      }
    }
  }
}

pub fn write_bg(out: &mut Vec<u8>, color: RGBA, caps: Capabilities) {
  let intent = color::intent(color);
  match intent {
    ColorIntent::Default => {
      out.extend_from_slice(b"\x1B[49m");
    }
    ColorIntent::Indexed => {
      let s = color::slot(color);
      let _ = write!(out, "\x1B[48;5;{s}m");
    }
    ColorIntent::Rgb => {
      if caps.rgb {
        let r = color::red(color);
        let g = color::green(color);
        let b = color::blue(color);
        let _ = write!(out, "\x1B[48;2;{r};{g};{b}m");
      } else {
        let index = color::nearest_palette_index(color);
        let _ = write!(out, "\x1B[48;5;{index}m");
      }
    }
  }
}

pub fn write_style(out: &mut Vec<u8>, attributes: u32) {
  out.push(b'\x1B');
  out.push(b'[');
  out.push(b'0');
  if (attributes & crate::buffer::ATTR_BOLD) != 0 {
    out.extend_from_slice(b";1");
  }
  if (attributes & crate::buffer::ATTR_ITALIC) != 0 {
    out.extend_from_slice(b";3");
  }
  if (attributes & crate::buffer::ATTR_UNDERLINE) != 0 {
    out.extend_from_slice(b";4");
  }
  out.push(b'm');
}

pub fn write_hide_cursor(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?25l");
}

pub fn write_show_cursor(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?25h");
}

pub fn write_enter_alt_screen(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?1049h");
}

pub fn write_exit_alt_screen(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?1049l");
}

pub fn write_clear_screen(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[2J\x1B[H");
}

pub fn write_enable_mouse(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?1000h");
  out.extend_from_slice(b"\x1B[?1002h");
  out.extend_from_slice(b"\x1B[?1006h");
}

pub fn write_enable_mouse_with_motion(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?1000h");
  out.extend_from_slice(b"\x1B[?1002h");
  out.extend_from_slice(b"\x1B[?1003h");
  out.extend_from_slice(b"\x1B[?1006h");
}

pub fn write_disable_mouse(out: &mut Vec<u8>) {
  out.extend_from_slice(b"\x1B[?1006l");
  out.extend_from_slice(b"\x1B[?1003l");
  out.extend_from_slice(b"\x1B[?1002l");
  out.extend_from_slice(b"\x1B[?1000l");
}

pub fn write_pointer_style(out: &mut Vec<u8>, style: u32) {
  match style {
    1 => out.extend_from_slice(b"\x1B]22;pointer\x1B\\"),
    2 => out.extend_from_slice(b"\x1B]22;text\x1B\\"),
    3 => out.extend_from_slice(b"\x1B]22;crosshair\x1B\\"),
    4 => out.extend_from_slice(b"\x1B]22;move\x1B\\"),
    5 => out.extend_from_slice(b"\x1B]22;not-allowed\x1B\\"),
    _ => out.extend_from_slice(b"\x1B]22;default\x1B\\"),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::color::rgb_color;

  fn caps_rgb() -> Capabilities {
    Capabilities { rgb: true, ansi256: true, ansi16: true }
  }

  fn caps_ansi256() -> Capabilities {
    Capabilities { rgb: false, ansi256: true, ansi16: true }
  }

  #[test]
  fn test_write_move_cursor() {
    let mut out = Vec::new();
    write_move_cursor(&mut out, 0, 0);
    assert_eq!(out, b"\x1B[1;1H");
    let mut out = Vec::new();
    write_move_cursor(&mut out, 5, 3);
    assert_eq!(out, b"\x1B[4;6H");
  }

  #[test]
  fn test_write_fg_rgb_intent_with_rgb_caps() {
    let mut out = Vec::new();
    let color = rgb_color(255, 0, 0, 255);
    write_fg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[38;2;255;0;0m");
  }

  #[test]
  fn test_write_fg_rgb_intent_without_rgb_caps() {
    let mut out = Vec::new();
    let color = rgb_color(255, 0, 0, 255);
    write_fg(&mut out, color, caps_ansi256());
    assert_eq!(out, b"\x1B[38;5;196m");
  }

  #[test]
  fn test_write_fg_indexed_intent() {
    let mut out = Vec::new();
    let color = color::indexed_color(9, 255, 0, 0);
    write_fg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[38;5;9m");
  }

  #[test]
  fn test_write_fg_default_intent() {
    let mut out = Vec::new();
    let color = color::default_color(0, 0, 0, 255);
    write_fg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[39m");
  }

  #[test]
  fn test_write_bg_rgb_intent_with_rgb_caps() {
    let mut out = Vec::new();
    let color = rgb_color(0, 255, 0, 255);
    write_bg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[48;2;0;255;0m");
  }

  #[test]
  fn test_write_bg_rgb_intent_without_rgb_caps() {
    let mut out = Vec::new();
    let color = rgb_color(0, 0, 255, 255);
    write_bg(&mut out, color, caps_ansi256());
    assert_eq!(out, b"\x1B[48;5;21m");
  }

  #[test]
  fn test_write_bg_indexed_intent() {
    let mut out = Vec::new();
    let color = color::indexed_color(9, 255, 0, 0);
    write_bg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[48;5;9m");
  }

  #[test]
  fn test_write_bg_default_intent() {
    let mut out = Vec::new();
    let color = color::default_color(0, 0, 0, 255);
    write_bg(&mut out, color, caps_rgb());
    assert_eq!(out, b"\x1B[49m");
  }

  #[test]
  fn test_write_style_bold() {
    let mut out = Vec::new();
    write_style(&mut out, crate::buffer::ATTR_BOLD);
    assert_eq!(out, b"\x1B[0;1m");
  }

  #[test]
  fn test_write_style_italic_underline() {
    let mut out = Vec::new();
    write_style(&mut out, crate::buffer::ATTR_ITALIC | crate::buffer::ATTR_UNDERLINE);
    assert_eq!(out, b"\x1B[0;3;4m");
  }

  #[test]
  fn test_write_style_no_attributes() {
    let mut out = Vec::new();
    write_style(&mut out, 0);
    assert_eq!(out, b"\x1B[0m");
  }

  #[test]
  fn test_write_hide_cursor() {
    let mut out = Vec::new();
    write_hide_cursor(&mut out);
    assert_eq!(out, b"\x1B[?25l");
  }

  #[test]
  fn test_write_show_cursor() {
    let mut out = Vec::new();
    write_show_cursor(&mut out);
    assert_eq!(out, b"\x1B[?25h");
  }

  #[test]
  fn test_write_enter_alt_screen() {
    let mut out = Vec::new();
    write_enter_alt_screen(&mut out);
    assert_eq!(out, b"\x1B[?1049h");
  }

  #[test]
  fn test_write_exit_alt_screen() {
    let mut out = Vec::new();
    write_exit_alt_screen(&mut out);
    assert_eq!(out, b"\x1B[?1049l");
  }

  #[test]
  fn test_write_clear_screen() {
    let mut out = Vec::new();
    write_clear_screen(&mut out);
    assert_eq!(out, b"\x1B[2J\x1B[H");
  }

  #[test]
  fn test_write_enable_mouse() {
    let mut out = Vec::new();
    write_enable_mouse(&mut out);
    assert_eq!(out, b"\x1B[?1000h\x1B[?1002h\x1B[?1006h");
  }

  #[test]
  fn test_write_enable_mouse_with_motion() {
    let mut out = Vec::new();
    write_enable_mouse_with_motion(&mut out);
    assert_eq!(out, b"\x1B[?1000h\x1B[?1002h\x1B[?1003h\x1B[?1006h");
  }

  #[test]
  fn test_write_disable_mouse() {
    let mut out = Vec::new();
    write_disable_mouse(&mut out);
    assert_eq!(out, b"\x1B[?1006l\x1B[?1003l\x1B[?1002l\x1B[?1000l");
  }

  #[test]
  fn test_write_pointer_style() {
    let mut out = Vec::new();
    write_pointer_style(&mut out, 0);
    assert_eq!(out, b"\x1B]22;default\x1B\\");
    let mut out = Vec::new();
    write_pointer_style(&mut out, 1);
    assert_eq!(out, b"\x1B]22;pointer\x1B\\");
    let mut out = Vec::new();
    write_pointer_style(&mut out, 3);
    assert_eq!(out, b"\x1B]22;crosshair\x1B\\");
    let mut out = Vec::new();
    write_pointer_style(&mut out, 5);
    assert_eq!(out, b"\x1B]22;not-allowed\x1B\\");
  }

  #[test]
  fn test_multiple_writes_append() {
    let mut out = Vec::new();
    let fg = rgb_color(255, 0, 0, 255);
    let bg = rgb_color(0, 0, 255, 255);
    write_fg(&mut out, fg, caps_rgb());
    write_bg(&mut out, bg, caps_rgb());
    write_move_cursor(&mut out, 1, 1);
    assert_eq!(out, b"\x1B[38;2;255;0;0m\x1B[48;2;0;0;255m\x1B[2;2H");
  }
}
