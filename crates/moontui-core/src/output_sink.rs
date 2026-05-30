use std::io::{self, Write};

pub enum OutputSink {
  Stdout,
  Captured(Vec<u8>),
  #[cfg(test)]
  Failing,
}

impl OutputSink {
  pub fn data(&self) -> &[u8] {
    match self {
      Self::Captured(data) => data,
      #[cfg(test)]
      Self::Failing => &[],
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
      #[cfg(test)]
      Self::Failing => Err(io::Error::other("test output failure")),
    }
  }

  fn flush(&mut self) -> io::Result<()> {
    match self {
      Self::Stdout => io::stdout().flush(),
      Self::Captured(_) => Ok(()),
      #[cfg(test)]
      Self::Failing => Err(io::Error::other("test output failure")),
    }
  }
}
