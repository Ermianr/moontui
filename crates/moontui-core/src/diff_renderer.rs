use crate::ansi;
use crate::buffer::{ATTR_CONTINUATION, OptimizedBuffer};
use crate::terminal::Capabilities;

#[derive(Clone, Debug)]
pub struct DirtyRect {
  pub x: u32,
  pub y: u32,
  pub width: u32,
  pub height: u32,
}

struct AnsiState {
  fg: Option<[u16; 4]>,
  bg: Option<[u16; 4]>,
  attrs: Option<u32>,
}

impl AnsiState {
  fn new() -> Self {
    Self { fg: None, bg: None, attrs: None }
  }
}

pub struct DiffRenderer {
  ansi_state: AnsiState,
  caps: Capabilities,
}

impl DiffRenderer {
  pub fn new(caps: Capabilities) -> Self {
    Self { ansi_state: AnsiState::new(), caps }
  }

  pub fn compute_dirty_rects(
    front: &OptimizedBuffer,
    back: &OptimizedBuffer,
    width: u32,
    height: u32,
  ) -> Vec<DirtyRect> {
    let mut rects: Vec<DirtyRect> = Vec::new();
    for y in 0..height {
      let mut x = 0u32;
      while x < width {
        while x < width && Self::cells_equal(front, back, x, y, width) {
          x += 1;
        }
        if x >= width {
          break;
        }
        let start_x = x;
        while x < width && !Self::cells_equal(front, back, x, y, width) {
          x += 1;
        }
        rects.push(DirtyRect { x: start_x, y, width: x - start_x, height: 1 });
      }
    }
    rects
  }

  fn cells_equal(
    front: &OptimizedBuffer,
    back: &OptimizedBuffer,
    x: u32,
    y: u32,
    width: u32,
  ) -> bool {
    let idx = (y as usize) * (width as usize) + (x as usize);
    front.chars[idx] == back.chars[idx]
      && front.fg[idx] == back.fg[idx]
      && front.bg[idx] == back.bg[idx]
      && front.attributes[idx] == back.attributes[idx]
  }

  pub fn render(
    &mut self,
    rects: &[DirtyRect],
    back: &OptimizedBuffer,
    width: u32,
    height: u32,
    cursor_x: i32,
    cursor_y: i32,
    cursor_visible: bool,
    output: &mut Vec<u8>,
  ) -> u32 {
    self.ansi_state = AnsiState::new();
    let mut cells_updated = 0u32;

    for rect in rects {
      for row in rect.y..(rect.y + rect.height) {
        if row >= height {
          continue;
        }
        ansi::write_move_cursor(output, rect.x, row);

        for col in rect.x..(rect.x + rect.width) {
          if col >= width {
            break;
          }
          let idx = (row as usize) * (width as usize) + (col as usize);

          if (back.attributes[idx] & ATTR_CONTINUATION) != 0 {
            continue;
          }

          cells_updated += 1;

          if self.ansi_state.fg != Some(back.fg[idx]) {
            let fg = back.fg[idx];
            ansi::write_fg(output, fg, self.caps);
            self.ansi_state.fg = Some(back.fg[idx]);
          }
          if self.ansi_state.bg != Some(back.bg[idx]) {
            let bg = back.bg[idx];
            ansi::write_bg(output, bg, self.caps);
            self.ansi_state.bg = Some(back.bg[idx]);
          }
          let style_attrs = back.attributes[idx] & !ATTR_CONTINUATION;
          if self.ansi_state.attrs != Some(style_attrs) {
            ansi::write_style(output, style_attrs);
            self.ansi_state.attrs = Some(style_attrs);
          }

          let ch = if back.chars[idx] == 0 {
            ' '
          } else {
            std::char::from_u32(back.chars[idx]).unwrap_or(' ')
          };
          let mut buf = [0u8; 4];
          let s = ch.encode_utf8(&mut buf);
          output.extend_from_slice(s.as_bytes());
        }
      }
    }

    if cursor_visible {
      let cx = cursor_x.max(0) as u32;
      let cy = cursor_y.max(0) as u32;
      ansi::write_move_cursor(output, cx, cy);
      ansi::write_show_cursor(output);
    } else {
      ansi::write_hide_cursor(output);
    }

    cells_updated
  }
}
