use moontui_macros::moontui_export_manual;

pub const LAYOUT_OK: i32 = 0;
pub const LAYOUT_ERR_INVALID_INPUT: i32 = 1;
pub const LAYOUT_ERR_OUTPUT_TOO_SMALL: i32 = 2;

const STYLE_STRIDE: usize = 30;
const MEASURE_STRIDE: usize = 2;
const RECT_STRIDE: usize = 4;

const STYLE_WIDTH: usize = 0;
const STYLE_HEIGHT: usize = 1;
const STYLE_FLEX_BASIS: usize = 2;
const STYLE_MIN_WIDTH: usize = 3;
const STYLE_MIN_HEIGHT: usize = 4;
const STYLE_MAX_WIDTH: usize = 5;
const STYLE_MAX_HEIGHT: usize = 6;
const STYLE_FLEX_GROW: usize = 7;
const STYLE_FLEX_SHRINK: usize = 8;
const STYLE_FLEX_DIRECTION: usize = 9;
const STYLE_ALIGN_ITEMS: usize = 10;
const STYLE_ALIGN_SELF: usize = 11;
const STYLE_JUSTIFY_CONTENT: usize = 12;
const STYLE_DISPLAY: usize = 13;
const STYLE_POSITION: usize = 14;
const STYLE_GAP: usize = 15;
const STYLE_PADDING_TOP: usize = 16;
const STYLE_MARGIN_TOP: usize = 20;
const STYLE_LEFT: usize = 24;
const STYLE_RIGHT: usize = 25;
const STYLE_TOP: usize = 26;
const STYLE_BOTTOM: usize = 27;
const STYLE_USES_LAYOUT: usize = 28;

#[derive(Clone, Copy)]
struct Rect {
  x: f32,
  y: f32,
  width: f32,
  height: f32,
}

struct LayoutInput<'a> {
  parents: &'a [i32],
  styles: &'a [f32],
  measurements: &'a [f32],
}

/// @ffi_manual
/// @ts_args parentIndices: Int32Array, styles: Float32Array, measurements: Float32Array, outRects: Float32Array
/// @ts_returns number
/// @ts_body return lib.symbols.computeTaffyLayout(backend.ptr(parentIndices), BigInt(parentIndices.length), backend.ptr(styles), BigInt(styles.length), backend.ptr(measurements), BigInt(measurements.length), backend.ptr(outRects), BigInt(outRects.length))
#[moontui_export_manual]
#[expect(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn computeTaffyLayout(
  parent_indices_ptr: *const i32,
  parent_indices_len: usize,
  styles_ptr: *const f32,
  styles_len: usize,
  measurements_ptr: *const f32,
  measurements_len: usize,
  out_rects_ptr: *mut f32,
  out_rects_len: usize,
) -> i32 {
  if parent_indices_len == 0
    || parent_indices_ptr.is_null()
    || styles_ptr.is_null()
    || measurements_ptr.is_null()
    || out_rects_ptr.is_null()
  {
    return LAYOUT_ERR_INVALID_INPUT;
  }
  if styles_len != parent_indices_len * STYLE_STRIDE
    || measurements_len != parent_indices_len * MEASURE_STRIDE
  {
    return LAYOUT_ERR_INVALID_INPUT;
  }
  if out_rects_len < parent_indices_len * RECT_STRIDE {
    return LAYOUT_ERR_OUTPUT_TOO_SMALL;
  }

  unsafe {
    let parents = std::slice::from_raw_parts(parent_indices_ptr, parent_indices_len);
    let styles = std::slice::from_raw_parts(styles_ptr, styles_len);
    let measurements = std::slice::from_raw_parts(measurements_ptr, measurements_len);
    let out_rects = std::slice::from_raw_parts_mut(out_rects_ptr, out_rects_len);
    if compute_layout(parents, styles, measurements, out_rects).is_err() {
      return LAYOUT_ERR_INVALID_INPUT;
    }
  }
  LAYOUT_OK
}

fn compute_layout(
  parents: &[i32],
  styles: &[f32],
  measurements: &[f32],
  out_rects: &mut [f32],
) -> Result<(), ()> {
  let _taffy_dependency_anchor: taffy::Style = taffy::Style::default();
  if parents.first() != Some(&-1) || parents.iter().skip(1).any(|p| *p < 0) {
    return Err(());
  }
  let input = LayoutInput { parents, styles, measurements };
  let root_style = style(&input, 0);
  let width = value(root_style, STYLE_WIDTH).unwrap_or(0.0);
  let height = value(root_style, STYLE_HEIGHT).unwrap_or(0.0);
  layout_node(&input, out_rects, 0, Rect { x: 0.0, y: 0.0, width, height }, false);
  Ok(())
}

fn layout_node(input: &LayoutInput<'_>, out: &mut [f32], node: usize, rect: Rect, force: bool) {
  write_rect(out, node, rect);
  let all_children = children(input, node);
  let explicit_children: Vec<usize> = all_children
    .iter()
    .copied()
    .filter(|child| bool_style(input, *child, STYLE_USES_LAYOUT))
    .collect();
  let should_layout =
    force || bool_style(input, node, STYLE_USES_LAYOUT) || !explicit_children.is_empty();
  if !should_layout {
    for child in all_children {
      clear_rect(out, child);
    }
    return;
  }

  let candidate_children = if force || bool_style(input, node, STYLE_USES_LAYOUT) {
    all_children
  } else {
    explicit_children
  };
  let layout_children: Vec<usize> = candidate_children
    .into_iter()
    .filter(|child| !bool_style(input, *child, STYLE_DISPLAY))
    .collect();
  let padding = edges(input, node, STYLE_PADDING_TOP);
  let content = Rect {
    x: rect.x + padding[3],
    y: rect.y + padding[0],
    width: (rect.width - padding[1] - padding[3]).max(0.0),
    height: (rect.height - padding[0] - padding[2]).max(0.0),
  };
  let is_row = enum_style(input, node, STYLE_FLEX_DIRECTION) == 1;
  let gap = value(style(input, node), STYLE_GAP).unwrap_or(0.0);
  let justify = enum_style(input, node, STYLE_JUSTIFY_CONTENT);
  let flow_children: Vec<usize> = layout_children
    .iter()
    .copied()
    .filter(|child| enum_style(input, *child, STYLE_POSITION) != 1)
    .collect();
  let absolute_children: Vec<usize> = layout_children
    .iter()
    .copied()
    .filter(|child| enum_style(input, *child, STYLE_POSITION) == 1)
    .collect();
  layout_flow(input, out, &flow_children, node, content, is_row, gap, justify);
  layout_absolute(input, out, &absolute_children, content);
  for child in children(input, node) {
    if !layout_children.contains(&child) {
      clear_rect(out, child);
    }
  }
}

#[expect(
  clippy::too_many_lines,
  reason = "keeps the scalar batch layout pass in one hot-path loop"
)]
fn layout_flow(
  input: &LayoutInput<'_>,
  out: &mut [f32],
  flow_children: &[usize],
  node: usize,
  content: Rect,
  is_row: bool,
  gap: f32,
  justify: i32,
) {
  let main_size = if is_row { content.width } else { content.height };
  let cross_size = if is_row { content.height } else { content.width };
  let gap_total = if justify == 3 && flow_children.len() > 1 {
    0.0
  } else {
    (flow_children.len().saturating_sub(1) as f32) * gap.max(0.0)
  };
  let base_sizes: Vec<f32> =
    flow_children.iter().map(|child| child_base(input, *child, content, is_row)).collect();
  let base_total = flow_children.iter().enumerate().fold(0.0, |total, (index, child)| {
    total + base_sizes[index] + main_margin(input, *child, is_row)
  });
  let fixed_total = flow_children.iter().enumerate().fold(0.0, |total, (index, child)| {
    if value(style(input, *child), STYLE_FLEX_GROW).unwrap_or(0.0) > 0.0 {
      total + main_margin(input, *child, is_row)
    } else {
      total + base_sizes[index] + main_margin(input, *child, is_row)
    }
  });
  let flex_total: f32 = flow_children
    .iter()
    .map(|child| value(style(input, *child), STYLE_FLEX_GROW).unwrap_or(0.0))
    .sum();
  let shrink_total: f32 = flow_children
    .iter()
    .map(|child| value(style(input, *child), STYLE_FLEX_SHRINK).unwrap_or(1.0))
    .sum();
  let free_space = main_size - base_total - gap_total;
  let grow_remaining = (main_size - fixed_total - gap_total).max(0.0);
  let used_space = if free_space < 0.0 { main_size } else { main_size.min(base_total + gap_total) };
  let justify_offset = match justify {
    1 => ((main_size - used_space).max(0.0) / 2.0).floor(),
    2 => (main_size - used_space).max(0.0),
    _ => 0.0,
  };
  let dynamic_gap = if justify == 3 && flow_children.len() > 1 {
    ((main_size - base_total).max(0.0) / (flow_children.len() - 1) as f32).floor()
  } else {
    gap
  };
  let mut gap_remainder = if justify == 3 && flow_children.len() > 1 {
    ((main_size - base_total).max(0.0) as i32) % (flow_children.len() - 1) as i32
  } else {
    0
  };
  let mut cursor = if is_row { content.x } else { content.y } + justify_offset;
  let flex_children = flow_children
    .iter()
    .filter(|child| value(style(input, **child), STYLE_FLEX_GROW).unwrap_or(0.0) > 0.0)
    .count();
  let mut flex_index = 0;
  for (index, child) in flow_children.iter().copied().enumerate() {
    let margin = edges(input, child, STYLE_MARGIN_TOP);
    let flex_grow = value(style(input, child), STYLE_FLEX_GROW).unwrap_or(0.0);
    let flex_shrink = value(style(input, child), STYLE_FLEX_SHRINK).unwrap_or(1.0);
    let flex_base =
      if flex_total > 0.0 { ((grow_remaining * flex_grow) / flex_total).floor() } else { 0.0 };
    let remainder =
      if flex_grow > 0.0 && flex_index < (grow_remaining as usize) % flex_children.max(1) {
        1.0
      } else {
        0.0
      };
    let shrink = if free_space < 0.0 && shrink_total > 0.0 {
      ((free_space.abs() * flex_shrink) / shrink_total).ceil()
    } else {
      0.0
    };
    let main = clamp_child(
      input,
      child,
      if flex_grow > 0.0 { flex_base + remainder } else { base_sizes[index] - shrink },
      is_row,
    );
    let cross_margin = if is_row { margin[0] + margin[2] } else { margin[3] + margin[1] };
    let explicit_cross = if is_row {
      resolve_size(value(style(input, child), STYLE_HEIGHT), content.height)
    } else {
      resolve_size(value(style(input, child), STYLE_WIDTH), content.width)
    };
    let intrinsic_cross = if is_row { measure(input, child)[1] } else { measure(input, child)[0] };
    let align = align(input, node, child);
    let fallback_cross = if align == 0 {
      cross_size - cross_margin
    } else if intrinsic_cross != 0.0 {
      intrinsic_cross
    } else {
      cross_size - cross_margin
    };
    let cross = explicit_cross.max(fallback_cross).max(0.0);
    let cross_offset = match align {
      1 => ((cross_size - cross - cross_margin).max(0.0) / 2.0).floor(),
      2 => (cross_size - cross - cross_margin).max(0.0),
      _ => 0.0,
    };
    let rect = if is_row {
      Rect {
        x: cursor + margin[3],
        y: content.y + margin[0] + cross_offset,
        width: main.max(0.0),
        height: cross,
      }
    } else {
      Rect {
        x: content.x + margin[3] + cross_offset,
        y: cursor + margin[0],
        width: cross,
        height: main.max(0.0),
      }
    };
    layout_node(input, out, child, rect, true);
    let next_gap = dynamic_gap + if gap_remainder > 0 { 1.0 } else { 0.0 };
    gap_remainder = (gap_remainder - 1).max(0);
    cursor += main + main_margin(input, child, is_row) + next_gap;
    if flex_grow > 0.0 {
      flex_index += 1;
    }
  }
}

fn layout_absolute(input: &LayoutInput<'_>, out: &mut [f32], children: &[usize], content: Rect) {
  for child in children {
    let margin = edges(input, *child, STYLE_MARGIN_TOP);
    let child_style = style(input, *child);
    let width = resolve_size(value(child_style, STYLE_WIDTH), content.width);
    let height = resolve_size(value(child_style, STYLE_HEIGHT), content.height);
    let x = if let Some(left) = value(child_style, STYLE_LEFT) {
      content.x + left + margin[3]
    } else {
      content.x + content.width - width - value(child_style, STYLE_RIGHT).unwrap_or(0.0) - margin[1]
    };
    let y = if let Some(top) = value(child_style, STYLE_TOP) {
      content.y + top + margin[0]
    } else {
      content.y + content.height
        - height
        - value(child_style, STYLE_BOTTOM).unwrap_or(0.0)
        - margin[2]
    };
    layout_node(input, out, *child, Rect { x, y, width, height }, true);
  }
}

fn child_base(input: &LayoutInput<'_>, child: usize, content: Rect, is_row: bool) -> f32 {
  let child_style = style(input, child);
  let explicit = if is_row {
    resolve_size(value(child_style, STYLE_WIDTH), content.width)
  } else {
    resolve_size(value(child_style, STYLE_HEIGHT), content.height)
  };
  let basis = resolve_size(
    value(child_style, STYLE_FLEX_BASIS),
    if is_row { content.width } else { content.height },
  );
  let intrinsic = if is_row { measure(input, child)[0] } else { measure(input, child)[1] };
  clamp_child(input, child, first_non_zero([basis, explicit, intrinsic]), is_row)
}

fn resolve_size(size: Option<f32>, parent_size: f32) -> f32 {
  match size {
    Some(value) if value < 0.0 => ((parent_size * value.abs()) / 100.0).floor().max(0.0),
    Some(value) => value.max(0.0).floor(),
    None => 0.0,
  }
}

fn clamp_child(input: &LayoutInput<'_>, child: usize, size: f32, is_row: bool) -> f32 {
  let child_style = style(input, child);
  let min =
    if is_row { value(child_style, STYLE_MIN_WIDTH) } else { value(child_style, STYLE_MIN_HEIGHT) };
  let max =
    if is_row { value(child_style, STYLE_MAX_WIDTH) } else { value(child_style, STYLE_MAX_HEIGHT) };
  let min_clamped = min.map_or(size, |min| size.max(min));
  max.map_or(min_clamped, |max| min_clamped.min(max))
}

fn first_non_zero(values: [f32; 3]) -> f32 {
  values.into_iter().find(|value| *value != 0.0).unwrap_or(0.0)
}

fn children(input: &LayoutInput<'_>, node: usize) -> Vec<usize> {
  input
    .parents
    .iter()
    .enumerate()
    .filter_map(|(index, parent)| (*parent == node as i32).then_some(index))
    .collect()
}

fn style<'a>(input: &'a LayoutInput<'_>, node: usize) -> &'a [f32] {
  let start = node * STYLE_STRIDE;
  &input.styles[start..start + STYLE_STRIDE]
}

fn measure(input: &LayoutInput<'_>, node: usize) -> [f32; 2] {
  let start = node * MEASURE_STRIDE;
  [input.measurements[start], input.measurements[start + 1]]
}

fn edges(input: &LayoutInput<'_>, node: usize, start: usize) -> [f32; 4] {
  let node_style = style(input, node);
  [
    value(node_style, start).unwrap_or(0.0),
    value(node_style, start + 1).unwrap_or(0.0),
    value(node_style, start + 2).unwrap_or(0.0),
    value(node_style, start + 3).unwrap_or(0.0),
  ]
}

fn main_margin(input: &LayoutInput<'_>, child: usize, is_row: bool) -> f32 {
  let margin = edges(input, child, STYLE_MARGIN_TOP);
  if is_row { margin[3] + margin[1] } else { margin[0] + margin[2] }
}

fn align(input: &LayoutInput<'_>, parent: usize, child: usize) -> i32 {
  let self_align = enum_style(input, child, STYLE_ALIGN_SELF);
  if self_align >= 0 { self_align } else { enum_style(input, parent, STYLE_ALIGN_ITEMS).max(0) }
}

fn enum_style(input: &LayoutInput<'_>, node: usize, index: usize) -> i32 {
  style(input, node)[index] as i32
}

fn bool_style(input: &LayoutInput<'_>, node: usize, index: usize) -> bool {
  style(input, node)[index] != 0.0
}

fn value(node_style: &[f32], index: usize) -> Option<f32> {
  let value = node_style[index];
  (!value.is_nan()).then_some(value)
}

fn write_rect(out: &mut [f32], node: usize, rect: Rect) {
  let start = node * RECT_STRIDE;
  out[start] = rect.x.floor();
  out[start + 1] = rect.y.floor();
  out[start + 2] = rect.width.floor().max(0.0);
  out[start + 3] = rect.height.floor().max(0.0);
}

fn clear_rect(out: &mut [f32], node: usize) {
  write_rect(out, node, Rect { x: 0.0, y: 0.0, width: 0.0, height: 0.0 });
}
