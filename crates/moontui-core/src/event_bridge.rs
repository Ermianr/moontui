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

pub type ResizeCallback = extern "C" fn(width: u32, height: u32);

pub struct EventBridge {
  callback: Option<EventCallback>,
  resize_callback: Option<ResizeCallback>,
  pending_resize: Option<(u32, u32)>,
}

impl EventBridge {
  pub fn new() -> Self {
    Self { callback: None, resize_callback: None, pending_resize: None }
  }

  pub fn set_callback(&mut self, cb: Option<EventCallback>) {
    self.callback = cb;
  }

  pub fn set_resize_callback(&mut self, cb: Option<ResizeCallback>) {
    self.resize_callback = cb;
  }

  pub fn take_pending_resize(&mut self) -> Option<(u32, u32)> {
    self.pending_resize.take()
  }

  pub fn process_events(&mut self) -> usize {
    let mut count = 0;
    while let Ok(true) = crossterm::event::poll(std::time::Duration::from_millis(0)) {
      match crossterm::event::read() {
        Ok(crossterm::event::Event::Key(key))
          if key.kind != crossterm::event::KeyEventKind::Release =>
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
        Ok(crossterm::event::Event::Resize(width, height)) => {
          let w = u32::from(width);
          let h = u32::from(height);
          self.pending_resize = Some((w, h));
          if let Some(cb) = self.resize_callback {
            cb(w, h);
          }
          count += 1;
        }
        _ => {}
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

  pub fn inject_resize_event(&self, width: u32, height: u32) {
    if let Some(cb) = self.resize_callback {
      cb(width, height);
    }
  }
}
