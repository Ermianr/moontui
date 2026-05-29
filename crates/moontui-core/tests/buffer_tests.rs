#![allow(unsafe_code)]

use moontui_core::buffer::ATTR_CONTINUATION;
use moontui_core::renderer::CliRenderer;

#[test]
fn test_draw_current_buffer_no_visible_output() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_current_buffer_mut().draw_text("Hello", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(!output_str.contains("Hello"), "drawing to current buffer should not appear in output");
}

#[test]
fn test_draw_next_buffer_shows_in_output() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("Hello", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("Hello"), "drawing to next buffer should appear in output");
}

#[test]
fn test_render_twice_no_changes_zero_updates() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.render(false).unwrap();
  assert_eq!(
    renderer.get_stats().cells_updated,
    0,
    "first render on identical buffers should be 0"
  );
  renderer.render(false).unwrap();
  assert_eq!(
    renderer.get_stats().cells_updated,
    0,
    "second render on identical buffers should be 0"
  );
}

#[test]
fn test_render_force_updates_all_cells() {
  let mut renderer = CliRenderer::create_test_renderer(3, 3);
  renderer.render(true).unwrap();
  assert_eq!(renderer.get_stats().cells_updated, 9, "force render should update all cells");
}

#[test]
fn test_buffer_swap_after_render() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("Hello", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let current = renderer.get_current_buffer();
  assert_eq!(current.cell_char(0), 'H' as u32);
  assert_eq!(current.cell_char(1), 'e' as u32);
  assert_eq!(current.cell_char(2), 'l' as u32);
  assert_eq!(current.cell_char(3), 'l' as u32);
  assert_eq!(current.cell_char(4), 'o' as u32);
}

#[test]
fn test_draw_text_ascii() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 0, 0, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("Hello", 0, 0, &fg, &bg, 0);
  let buf = renderer.get_next_buffer();
  assert_eq!(buf.cell_char(0), 'H' as u32);
  assert_eq!(*buf.cell_fg(0), fg);
  assert_eq!(*buf.cell_bg(0), bg);
  assert_eq!(buf.cell_char(1), 'e' as u32);
  assert_eq!(buf.cell_char(2), 'l' as u32);
  assert_eq!(buf.cell_char(3), 'l' as u32);
  assert_eq!(buf.cell_char(4), 'o' as u32);
}

#[test]
fn test_draw_text_unicode_wide_chars() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("あ", 0, 0, &fg, &bg, 0);
  let buf = renderer.get_next_buffer();
  assert_eq!(buf.cell_char(0), 'あ' as u32);
  assert_eq!(buf.cell_attributes(0), 0);
  assert_eq!(
    buf.cell_attributes(1) & ATTR_CONTINUATION,
    ATTR_CONTINUATION,
    "continuation cell should be marked"
  );
}

#[test]
fn test_draw_text_empty_string() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  let before_char = renderer.get_next_buffer().cell_char(0);
  renderer.get_next_buffer_mut().draw_text("", 0, 0, &fg, &bg, 0);
  let after_char = renderer.get_next_buffer().cell_char(0);
  assert_eq!(before_char, after_char, "empty string should not modify cells");
}

#[test]
fn test_draw_text_beyond_buffer_width() {
  let mut renderer = CliRenderer::create_test_renderer(5, 3);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("Hello World", 0, 0, &fg, &bg, 0);
  let buf = renderer.get_next_buffer();
  assert_eq!(buf.cell_char(0), 'H' as u32);
  assert_eq!(buf.cell_char(4), 'o' as u32);
}

#[test]
fn test_draw_char() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 0, 0, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 2, 2, &fg, &bg, 0);
  let buf = renderer.get_next_buffer();
  let idx = 2 * 10 + 2;
  assert_eq!(buf.cell_char(idx), 'X' as u32);
  assert_eq!(*buf.cell_fg(idx), fg);
  assert_eq!(*buf.cell_bg(idx), bg);
}

#[test]
fn test_clear() {
  let mut renderer = CliRenderer::create_test_renderer(5, 5);
  let bg = [100, 100, 100, 65535];
  renderer.get_next_buffer_mut().draw_char('X' as u32, 0, 0, &[65535; 4], &[0, 0, 0, 65535], 0);
  renderer.get_next_buffer_mut().clear(&bg);
  for i in 0..renderer.get_next_buffer().cells_len() {
    assert_eq!(renderer.get_next_buffer().cell_char(i), 0, "char_code should be 0 after clear");
    assert_eq!(*renderer.get_next_buffer().cell_bg(i), bg, "bg should match clear color");
  }
}

#[test]
fn test_fill_rect() {
  let mut renderer = CliRenderer::create_test_renderer(10, 10);
  let bg = [100, 100, 100, 65535];
  renderer.get_next_buffer_mut().fill_rect(2, 2, 3, 3, &bg);
  let buf = renderer.get_next_buffer();
  for y in 0..10 {
    for x in 0..10 {
      let idx = y * 10 + x;
      if (2..5).contains(&x) && (2..5).contains(&y) {
        assert_eq!(*buf.cell_bg(idx), bg, "cell ({x},{y}) should be filled");
      } else {
        assert_ne!(*buf.cell_bg(idx), bg, "cell ({x},{y}) should NOT be filled");
      }
    }
  }
}

#[test]
fn test_draw_box() {
  let mut renderer = CliRenderer::create_test_renderer(10, 10);
  let border_chars = [
    '┌' as u32,
    '─' as u32,
    '┐' as u32,
    '│' as u32,
    '┘' as u32,
    '─' as u32,
    '└' as u32,
    '│' as u32,
  ];
  let border_color = [65535, 65535, 65535, 65535];
  let bg_color = [100, 100, 100, 65535];
  renderer.get_next_buffer_mut().draw_box(1, 1, 5, 5, &border_chars, 0, &border_color, &bg_color);
  let buf = renderer.get_next_buffer();
  assert_eq!(buf.cell_char(10 + 1), '┌' as u32);
  assert_eq!(buf.cell_char(10 + 2), '─' as u32);
  assert_eq!(buf.cell_char(10 + 5), '┐' as u32);
  assert_eq!(buf.cell_char(2 * 10 + 1), '│' as u32);
  assert_eq!(buf.cell_char(3 * 10 + 1), '│' as u32);
  assert_eq!(buf.cell_char(4 * 10 + 1), '│' as u32);
  assert_eq!(buf.cell_char(2 * 10 + 5), '│' as u32);
  assert_eq!(buf.cell_char(3 * 10 + 5), '│' as u32);
  assert_eq!(buf.cell_char(4 * 10 + 5), '│' as u32);
  assert_eq!(buf.cell_char(5 * 10 + 1), '└' as u32);
  assert_eq!(buf.cell_char(5 * 10 + 5), '┘' as u32);
  assert_eq!(buf.cell_char(5 * 10 + 2), '─' as u32);
  assert_eq!(*buf.cell_bg(2 * 10 + 2), bg_color);
  assert_eq!(*buf.cell_bg(4 * 10 + 4), bg_color);
}

#[test]
fn test_regression_get_current_buffer_plus_render_no_output() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_current_buffer_mut().draw_text("Hidden", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(
    !output_str.contains("Hidden"),
    "text drawn to current buffer should never appear in render output"
  );
}

#[test]
fn test_regression_cstring_not_used_for_text() {
  let renderer = moontui_core::createRenderer(10, 5, false);
  let buf = moontui_core::getNextBuffer(renderer);
  assert!(!buf.is_null(), "getNextBuffer returned null");
  let buf_ref = unsafe { &mut *buf };
  buf_ref.draw_text("Te\0st", 0, 0, &[65535, 65535, 65535, 65535], &[0, 0, 0, 65535], 0);
  assert_eq!(buf_ref.cell_char(0), 'T' as u32);
  assert_eq!(buf_ref.cell_char(1), 'e' as u32);
  assert_eq!(buf_ref.cell_char(2), 0, "embedded null should be preserved");
  assert_eq!(buf_ref.cell_char(3), 's' as u32);
  assert_eq!(buf_ref.cell_char(4), 't' as u32);
  assert_eq!(moontui_core::destroyRenderer(renderer), 0);
}

#[test]
fn test_regression_clear_screen_removes_residual() {
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  let fg = [65535, 65535, 65535, 65535];
  let bg = [0, 0, 0, 65535];
  renderer.get_next_buffer_mut().draw_text("Residual", 0, 0, &fg, &bg, 0);
  renderer.render(false).unwrap();
  renderer.clear_output();
  renderer.setup_terminal(true).unwrap();
  let output = renderer.get_output_data().to_vec();
  let output_str = String::from_utf8_lossy(&output);
  assert!(output_str.contains("\x1b[2J\x1b[H"), "setup_terminal should clear screen");
}
