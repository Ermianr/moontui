use std::io::Write;

pub fn write_move_cursor(out: &mut Vec<u8>, x: u32, y: u32) {
  let _ = write!(out, "\x1B[{};{}H", y + 1, x + 1);
}

pub fn write_fg(out: &mut Vec<u8>, r: u16, g: u16, b: u16) {
  let _ = write!(out, "\x1B[38;2;{};{};{}m", r >> 8, g >> 8, b >> 8);
}

pub fn write_bg(out: &mut Vec<u8>, r: u16, g: u16, b: u16) {
  let _ = write!(out, "\x1B[48;2;{};{};{}m", r >> 8, g >> 8, b >> 8);
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

#[cfg(test)]
mod tests {
  use super::*;

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
  fn test_write_fg() {
    let mut out = Vec::new();
    write_fg(&mut out, 65535, 0, 0);
    assert_eq!(out, b"\x1B[38;2;255;0;0m");
  }

  #[test]
  fn test_write_bg() {
    let mut out = Vec::new();
    write_bg(&mut out, 0, 65535, 0);
    assert_eq!(out, b"\x1B[48;2;0;255;0m");
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
  fn test_multiple_writes_append() {
    let mut out = Vec::new();
    write_fg(&mut out, 65535, 0, 0);
    write_bg(&mut out, 0, 0, 65535);
    write_move_cursor(&mut out, 1, 1);
    assert_eq!(out, b"\x1B[38;2;255;0;0m\x1B[48;2;0;0;255m\x1B[2;2H");
  }
}
