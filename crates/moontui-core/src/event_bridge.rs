use std::os::raw::c_char;

pub type EventCallback = extern "C" fn(
  event_type: *const c_char,
  event_type_len: usize,
  key: *const c_char,
  key_len: usize,
  ctrl: bool,
  shift: bool,
  alt: bool,
);

pub struct EventBridge {
  callback: Option<EventCallback>,
}

impl EventBridge {
  pub fn new() -> Self {
    Self { callback: None }
  }

  pub fn set_callback(&mut self, cb: Option<EventCallback>) {
    self.callback = cb;
  }

  pub fn process_events(&self) -> usize {
    let mut count = 0;
    while let Ok(true) = crossterm::event::poll(std::time::Duration::from_millis(0)) {
      if let Ok(crossterm::event::Event::Key(key)) = crossterm::event::read()
        && key.kind != crossterm::event::KeyEventKind::Release
      {
        let event = crate::input::convert_key_event(key);
        if let Some(cb) = self.callback {
          let Ok(event_type) = std::ffi::CString::new(event.event_type.as_ref()) else {
            continue;
          };
          let Ok(key) = std::ffi::CString::new(event.key.as_ref()) else {
            continue;
          };
          cb(
            event_type.as_ptr(),
            event.event_type.len(),
            key.as_ptr(),
            event.key.len(),
            event.ctrl,
            event.shift,
            event.alt,
          );
          count += 1;
        }
      }
    }
    count
  }

  pub fn inject_key_event(&self, key: &str, ctrl: bool, shift: bool, alt: bool) {
    if let Some(cb) = self.callback {
      let Ok(event_type) = std::ffi::CString::new("key") else { return };
      let Ok(key) = std::ffi::CString::new(key) else { return };
      cb(event_type.as_ptr(), 3, key.as_ptr(), key.as_bytes().len(), ctrl, shift, alt);
    }
  }
}
