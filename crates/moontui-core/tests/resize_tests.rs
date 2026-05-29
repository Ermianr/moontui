#![allow(unsafe_code)]

use moontui_core::renderer::CliRenderer;
use std::sync::Mutex;

static RESIZE_EVENTS_1: Mutex<Vec<(u32, u32)>> = Mutex::new(Vec::new());
static RESIZE_EVENTS_2: Mutex<Vec<(u32, u32)>> = Mutex::new(Vec::new());

extern "C" fn resize_callback_1(width: u32, height: u32) {
  RESIZE_EVENTS_1.lock().unwrap().push((width, height));
}

extern "C" fn resize_callback_2(width: u32, height: u32) {
  RESIZE_EVENTS_2.lock().unwrap().push((width, height));
}

#[test]
fn test_resize_callback_fires_with_correct_dimensions() {
  let mut renderer = CliRenderer::create_test_renderer(80, 24);
  renderer.set_resize_callback(Some(resize_callback_1));
  RESIZE_EVENTS_1.lock().unwrap().clear();

  renderer.inject_resize_event(120, 40);

  let resizes = RESIZE_EVENTS_1.lock().unwrap();
  assert_eq!(resizes.len(), 1);
  assert_eq!(resizes[0], (120, 40));
}

#[test]
fn test_buffers_reallocate_after_inject_resize_event() {
  let mut renderer = CliRenderer::create_test_renderer(80, 24);
  renderer.inject_resize_event(120, 40);

  assert_eq!(renderer.width(), 120);
  assert_eq!(renderer.height(), 40);
  assert_eq!(renderer.get_current_buffer().width(), 120);
  assert_eq!(renderer.get_current_buffer().height(), 40);
  assert_eq!(renderer.get_next_buffer().width(), 120);
  assert_eq!(renderer.get_next_buffer().height(), 40);
}

#[test]
fn test_force_render_after_resize() {
  let mut renderer = CliRenderer::create_test_renderer(80, 24);
  assert_eq!(renderer.get_stats().frame_count, 0);

  renderer.inject_resize_event(120, 40);

  assert_eq!(renderer.get_stats().frame_count, 1);
}

#[test]
fn test_no_panic_when_resize_callback_is_none() {
  let mut renderer = CliRenderer::create_test_renderer(80, 24);
  renderer.set_resize_callback(None);

  renderer.inject_resize_event(120, 40);

  assert_eq!(renderer.width(), 120);
  assert_eq!(renderer.height(), 40);
}

#[test]
fn test_resize_to_smaller_dimensions() {
  let mut renderer = CliRenderer::create_test_renderer(80, 24);
  renderer.set_resize_callback(Some(resize_callback_2));
  RESIZE_EVENTS_2.lock().unwrap().clear();

  renderer.inject_resize_event(40, 10);

  let resizes = RESIZE_EVENTS_2.lock().unwrap();
  assert_eq!(resizes.len(), 1);
  assert_eq!(resizes[0], (40, 10));
  drop(resizes);

  assert_eq!(renderer.width(), 40);
  assert_eq!(renderer.height(), 10);
  assert_eq!(renderer.get_current_buffer().width(), 40);
  assert_eq!(renderer.get_current_buffer().height(), 10);
}
