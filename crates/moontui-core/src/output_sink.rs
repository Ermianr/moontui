use std::io::{self, Write};

pub enum OutputSink {
  Stdout,
  Captured(Vec<u8>),
}

impl OutputSink {
  pub fn data(&self) -> &[u8] {
    match self {
      Self::Captured(data) => data,
      Self::Stdout => &[],
    }
  }

  pub fn clear(&mut self) {
    if let Self::Captured(data) = self {
      data.clear();
    }
  }
}

impl Write for OutputSink {
  fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
    match self {
      Self::Stdout => io::stdout().write(buf),
      Self::Captured(data) => data.write(buf),
    }
  }

  fn flush(&mut self) -> io::Result<()> {
    match self {
      Self::Stdout => io::stdout().flush(),
      Self::Captured(_) => Ok(()),
    }
  }
}
