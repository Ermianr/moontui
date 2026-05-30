#![allow(unsafe_code)]

use moontui_core::renderer::CliRenderer;
use std::os::raw::c_char;
use std::sync::Mutex;

static CAPTURED_EVENTS: Mutex<Vec<String>> = Mutex::new(Vec::new());
static INPUT_TEST_LOCK: Mutex<()> = Mutex::new(());

fn lock_captured_events() -> std::sync::MutexGuard<'static, Vec<String>> {
  CAPTURED_EVENTS.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn lock_input_test() -> std::sync::MutexGuard<'static, ()> {
  INPUT_TEST_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

extern "C" fn test_callback(
  event_type: *const c_char,
  event_type_len: usize,
  key: *const c_char,
  key_len: usize,
  _ctrl: bool,
  _shift: bool,
  _alt: bool,
) {
  unsafe {
    let type_slice = std::slice::from_raw_parts(event_type as *const u8, event_type_len);
    let key_slice = std::slice::from_raw_parts(key as *const u8, key_len);
    let type_str = String::from_utf8_lossy(type_slice).into_owned();
    let key_str = String::from_utf8_lossy(key_slice).into_owned();
    lock_captured_events().push(format!("{type_str}:{key_str}"));
  }
}

fn clear_captured_events() {
  let mut events = lock_captured_events();
  events.clear();
}

#[test]
fn test_process_events_drains_input_buffer() {
  let _guard = lock_input_test();
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_event_callback(Some(test_callback));
  clear_captured_events();

  renderer.inject_key_event("a", false, false, false);
  renderer.inject_key_event("b", true, false, false);

  let events = lock_captured_events();
  assert_eq!(events.len(), 2);
  assert!(events.contains(&"key:a".to_string()));
  assert!(events.contains(&"key:b".to_string()));
  drop(events);
}

#[test]
fn test_process_events_no_callback() {
  let _guard = lock_input_test();
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_event_callback(None);

  renderer.inject_key_event("a", false, false, false);

  let count = renderer.process_events();
  assert_eq!(count, 0, "should return 0 when no callback registered");
}

#[test]
fn test_process_events_empty_buffer() {
  let _guard = lock_input_test();
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_event_callback(Some(test_callback));
  clear_captured_events();

  let count = renderer.process_events();
  assert_eq!(count, 0, "empty buffer should return 0");
}

#[test]
fn test_process_events_multiple_events() {
  let _guard = lock_input_test();
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_event_callback(Some(test_callback));
  clear_captured_events();

  renderer.inject_key_event("a", false, false, false);
  renderer.inject_key_event("b", true, false, false);
  renderer.inject_key_event("c", false, true, false);

  let events = lock_captured_events();
  assert_eq!(events.len(), 3);
  assert!(events.contains(&"key:a".to_string()));
  assert!(events.contains(&"key:b".to_string()));
  assert!(events.contains(&"key:c".to_string()));
  drop(events);
}

#[test]
fn test_regression_keyrelease_no_handler() {
  let _guard = lock_input_test();
  let mut renderer = CliRenderer::create_test_renderer(10, 5);
  renderer.set_event_callback(Some(test_callback));
  clear_captured_events();

  renderer.inject_key_event("enter", false, false, false);

  let events = lock_captured_events();
  assert!(events.contains(&"key:enter".to_string()));
  drop(events);
}
