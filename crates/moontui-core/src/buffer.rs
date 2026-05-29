use moontui_macros::{moontui_export, moontui_skip};

pub const ATTR_CONTINUATION: u32 = 1 << 0;
pub const ATTR_BOLD: u32 = 1 << 1;
pub const ATTR_ITALIC: u32 = 1 << 2;
pub const ATTR_UNDERLINE: u32 = 1 << 3;

pub struct OptimizedBuffer {
  pub(crate) width: u32,
  pub(crate) height: u32,
  pub(crate) chars: Vec<u32>,
  pub(crate) fg: Vec<[u16; 4]>,
  pub(crate) bg: Vec<[u16; 4]>,
  pub(crate) attributes: Vec<u32>,
}

#[moontui_export(name = "buffer")]
impl OptimizedBuffer {
  pub fn new(width: u32, height: u32) -> Self {
    let size = (width as usize) * (height as usize);
    Self {
      width,
      height,
      chars: vec![0u32; size],
      fg: vec![[0u16, 0, 0, 65535]; size],
      bg: vec![[0u16, 0, 0, 65535]; size],
      attributes: vec![0u32; size],
    }
  }

  /// @ffi_manual
  /// @ts_args p: Pointer<Buffer>, bg: RGBAInput
  /// @ts_returns void
  /// @ts_body lib.symbols.bufferClear(p, rgbaPtr(bg))
  pub fn clear(&mut self, bg: &[u16; 4]) {
    self.chars.fill(0);
    self.fg.fill([0, 0, 0, 65535]);
    self.bg.fill(*bg);
    self.attributes.fill(0);
  }

  #[moontui_skip]
  pub fn draw_char(
    &mut self,
    char_codepoint: u32,
    x: u32,
    y: u32,
    fg: &[u16; 4],
    bg: &[u16; 4],
    attributes: u32,
  ) {
    if x >= self.width || y >= self.height {
      return;
    }
    let idx = (y as usize) * (self.width as usize) + (x as usize);
    self.chars[idx] = char_codepoint;
    self.fg[idx] = *fg;
    self.bg[idx] = *bg;
    self.attributes[idx] = attributes;
  }

  #[moontui_skip]
  pub fn draw_text(
    &mut self,
    text: &str,
    x: u32,
    y: u32,
    fg: &[u16; 4],
    bg: &[u16; 4],
    attributes: u32,
  ) {
    if y >= self.height {
      return;
    }
    let stride = self.width as usize;
    let row_start = (y as usize) * stride;
    let mut cx = x;
    for ch in text.chars() {
      if cx >= self.width {
        break;
      }
      let width = unicode_width::UnicodeWidthChar::width(ch).unwrap_or(1) as u32;
      if width == 0 {
        self.set_cell(row_start + (cx as usize), ch as u32, *fg, *bg, attributes);
        continue;
      }
      self.set_cell(row_start + (cx as usize), ch as u32, *fg, *bg, attributes);
      cx += 1;
      if width > 1 {
        for _ in 1..width {
          if cx >= self.width {
            break;
          }
          self.set_cell(row_start + (cx as usize), 0, *fg, *bg, attributes | ATTR_CONTINUATION);
          cx += 1;
        }
      }
    }
  }

  #[moontui_skip]
  pub fn fill_rect(&mut self, x: u32, y: u32, width: u32, height: u32, bg: &[u16; 4]) {
    let x_end = (x + width).min(self.width);
    let y_end = (y + height).min(self.height);
    let stride = self.width as usize;
    for cy in y..y_end {
      for cx in x..x_end {
        let idx = (cy as usize) * stride + (cx as usize);
        self.bg[idx] = *bg;
        let is_cont = (self.attributes[idx] & ATTR_CONTINUATION) != 0;
        self.attributes[idx] = if is_cont { ATTR_CONTINUATION } else { 0 };
      }
    }
  }

  #[moontui_skip]
  pub fn draw_box(
    &mut self,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    border_chars: &[u32; 8],
    _packed_options: u32,
    border_color: &[u16; 4],
    bg_color: &[u16; 4],
  ) {
    if width == 0 || height == 0 {
      return;
    }
    let left = x.max(0) as u32;
    let top = y.max(0) as u32;
    let right = (x + width as i32 - 1).max(0) as u32;
    let bottom = (y + height as i32 - 1).max(0) as u32;

    if left >= self.width || top >= self.height {
      return;
    }

    if width > 2 && height > 2 {
      self.fill_rect(left + 1, top + 1, width - 2, height - 2, bg_color);
    }

    let stride = self.width as usize;

    if top < self.height {
      for bx in left..=right {
        if bx >= self.width {
          break;
        }
        let ch = if bx == left {
          border_chars[0]
        } else if bx == right {
          border_chars[2]
        } else {
          border_chars[1]
        };
        let idx = (top as usize) * stride + (bx as usize);
        self.set_cell(idx, ch, *border_color, *bg_color, 0);
      }
    }

    if bottom < self.height && height > 1 {
      for bx in left..=right {
        if bx >= self.width {
          break;
        }
        let ch = if bx == left {
          border_chars[6]
        } else if bx == right {
          border_chars[4]
        } else {
          border_chars[5]
        };
        let idx = (bottom as usize) * stride + (bx as usize);
        self.set_cell(idx, ch, *border_color, *bg_color, 0);
      }
    }

    if height > 1 {
      for by in (top + 1)..bottom {
        if by >= self.height {
          break;
        }
        if left < self.width {
          let idx = (by as usize) * stride + (left as usize);
          self.set_cell(idx, border_chars[7], *border_color, *bg_color, 0);
        }
        if right < self.width && right != left {
          let idx = (by as usize) * stride + (right as usize);
          self.set_cell(idx, border_chars[3], *border_color, *bg_color, 0);
        }
      }
    }
  }

  #[moontui_skip]
  pub fn write_resolved_chars(&self, output: &mut [u8], add_line_breaks: bool) -> u32 {
    let mut pos = 0usize;
    let stride = self.width as usize;
    for y in 0..self.height {
      let row_start = (y as usize) * stride;
      for x in 0..self.width {
        let idx = row_start + (x as usize);
        if (self.attributes[idx] & ATTR_CONTINUATION) != 0 {
          continue;
        }
        let ch = self.decoded_char(idx);
        let mut buf = [0u8; 4];
        let s = ch.encode_utf8(&mut buf);
        let bytes = s.as_bytes();
        if pos + bytes.len() > output.len() {
          return pos as u32;
        }
        output[pos..pos + bytes.len()].copy_from_slice(bytes);
        pos += bytes.len();
      }
      if add_line_breaks {
        if pos + 1 > output.len() {
          return pos as u32;
        }
        output[pos] = b'\n';
        pos += 1;
      }
    }
    pos as u32
  }

  pub fn real_char_size(&self, add_line_breaks: bool) -> u32 {
    let mut size = 0u32;
    let stride = self.width as usize;
    for y in 0..self.height {
      let row_start = (y as usize) * stride;
      for x in 0..self.width {
        let idx = row_start + (x as usize);
        if (self.attributes[idx] & ATTR_CONTINUATION) != 0 {
          continue;
        }
        let ch = self.decoded_char(idx);
        size += ch.len_utf8() as u32;
      }
      if add_line_breaks {
        size += 1;
      }
    }
    size
  }

  pub fn get_char_ptr(&self) -> *const u32 {
    self.chars.as_ptr()
  }

  pub fn get_fg_ptr(&self) -> *const [u16; 4] {
    self.fg.as_ptr()
  }

  pub fn get_bg_ptr(&self) -> *const [u16; 4] {
    self.bg.as_ptr()
  }

  pub fn get_attributes_ptr(&self) -> *const u32 {
    self.attributes.as_ptr()
  }

  pub fn width(&self) -> u32 {
    self.width
  }

  pub fn height(&self) -> u32 {
    self.height
  }

  pub fn cell_char(&self, idx: usize) -> u32 {
    self.chars[idx]
  }

  pub fn cell_fg(&self, idx: usize) -> &[u16; 4] {
    &self.fg[idx]
  }

  pub fn cell_bg(&self, idx: usize) -> &[u16; 4] {
    &self.bg[idx]
  }

  pub fn cell_attributes(&self, idx: usize) -> u32 {
    self.attributes[idx]
  }

  #[moontui_skip]
  #[inline]
  fn set_cell(&mut self, idx: usize, ch: u32, fg: [u16; 4], bg: [u16; 4], attrs: u32) {
    self.chars[idx] = ch;
    self.fg[idx] = fg;
    self.bg[idx] = bg;
    self.attributes[idx] = attrs;
  }

  #[moontui_skip]
  #[inline]
  fn decoded_char(&self, idx: usize) -> char {
    if self.chars[idx] == 0 { ' ' } else { std::char::from_u32(self.chars[idx]).unwrap_or(' ') }
  }

  pub fn cells_len(&self) -> usize {
    self.chars.len()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_buffer_creation() {
    let buf = OptimizedBuffer::new(10, 5);
    assert_eq!(buf.width, 10);
    assert_eq!(buf.height, 5);
    assert_eq!(buf.chars.len(), 50);
    for i in 0..50 {
      assert_eq!(buf.chars[i], 0);
      assert_eq!(buf.attributes[i], 0);
    }
  }

  #[test]
  fn test_buffer_clear() {
    let mut buf = OptimizedBuffer::new(5, 5);
    let bg = [100, 100, 100, 65535];
    buf.clear(&bg);
    for i in 0..25 {
      assert_eq!(buf.chars[i], 0);
      assert_eq!(buf.bg[i], bg);
      assert_eq!(buf.attributes[i], 0);
    }
  }

  #[test]
  fn test_draw_text_clipping() {
    let mut buf = OptimizedBuffer::new(5, 3);
    let fg = [65535, 65535, 65535, 65535];
    let bg = [0, 0, 0, 65535];
    buf.draw_text("Hello World", 0, 0, &fg, &bg, 0);
    assert_eq!(buf.chars[0], 'H' as u32);
    assert_eq!(buf.chars[4], 'o' as u32);
    buf.draw_text("test", 3, 2, &fg, &bg, 0);
    assert_eq!(buf.chars[2 * 5 + 3], 't' as u32);
  }

  #[test]
  fn test_wide_char_continuation() {
    let mut buf = OptimizedBuffer::new(10, 2);
    let fg = [65535, 65535, 65535, 65535];
    let bg = [0, 0, 0, 65535];
    buf.draw_text("あ", 0, 0, &fg, &bg, 0);
    assert_eq!(buf.chars[0], 'あ' as u32);
    assert_eq!(buf.attributes[0], 0);
    assert_eq!(buf.attributes[1] & ATTR_CONTINUATION, ATTR_CONTINUATION);
  }

  #[test]
  fn test_write_resolved_chars() {
    let mut buf = OptimizedBuffer::new(5, 2);
    let fg = [65535, 65535, 65535, 65535];
    let bg = [0, 0, 0, 65535];
    buf.draw_text("Hi", 0, 0, &fg, &bg, 0);
    let mut output = vec![0u8; 64];
    let written = buf.write_resolved_chars(&mut output, true);
    let result = std::str::from_utf8(&output[..written as usize]).unwrap();
    assert_eq!(result, "Hi   \n     \n");
  }
}
