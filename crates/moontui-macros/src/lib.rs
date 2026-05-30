use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::quote;
use std::fs;
use std::path::PathBuf;
use syn::parse::{Parse, ParseStream};
use syn::spanned::Spanned;
use syn::{
  FnArg, Ident, ImplItem, ItemFn, ItemImpl, ItemStruct, ReturnType, Token, Type, parse_macro_input,
};

mod schema;
use schema::{FieldDef, FunctionDef, ParamDef, Schema, StructDef};

mod codegen;
use codegen::generate_wrapper;

mod naming;
use naming::snake_to_camel;

struct ExportAttr {
  name: Option<String>,
}

impl Parse for ExportAttr {
  fn parse(input: ParseStream) -> syn::Result<Self> {
    if input.is_empty() {
      return Ok(ExportAttr { name: None });
    }
    let name_ident: Ident = input.parse()?;
    if name_ident != "name" {
      return Err(syn::Error::new(name_ident.span(), "expected `name`"));
    }
    let _: Token![=] = input.parse()?;
    let name_str: syn::LitStr = input.parse()?;
    Ok(ExportAttr { name: Some(name_str.value()) })
  }
}

#[proc_macro_attribute]
pub fn moontui_export(attr: TokenStream, item: TokenStream) -> TokenStream {
  let input = item.clone();
  let export_attr = parse_macro_input!(attr as ExportAttr);

  // Try parsing as impl block first
  if let Ok(impl_block) = syn::parse::<ItemImpl>(input.clone()) {
    match generate_export(&export_attr, &impl_block) {
      Ok(ts) => return ts.into(),
      Err(e) => return e.to_compile_error().into(),
    }
  }

  // Try parsing as struct
  let input2 = item;
  if let Ok(item_struct) = syn::parse::<ItemStruct>(input2.clone()) {
    match generate_struct_export(&item_struct) {
      Ok(ts) => return ts.into(),
      Err(e) => return e.to_compile_error().into(),
    }
  }

  syn::Error::new(Span::call_site(), "expected an impl block or struct").to_compile_error().into()
}

#[proc_macro_attribute]
pub fn moontui_export_manual(_attr: TokenStream, item: TokenStream) -> TokenStream {
  let func = parse_macro_input!(item as ItemFn);
  match generate_manual_export(&func) {
    Ok(ts) => ts.into(),
    Err(e) => e.to_compile_error().into(),
  }
}

#[proc_macro_attribute]
pub fn moontui_skip(_attr: TokenStream, item: TokenStream) -> TokenStream {
  item
}

fn generate_export(
  attr: &ExportAttr,
  impl_block: &ItemImpl,
) -> syn::Result<proc_macro2::TokenStream> {
  let self_type = match &*impl_block.self_ty {
    Type::Path(tp) => tp
      .path
      .segments
      .last()
      .ok_or_else(|| syn::Error::new(tp.span(), "expected a type name"))?
      .ident
      .to_string(),
    _ => return Err(syn::Error::new(impl_block.self_ty.span(), "expected a path type")),
  };

  let mut schema = load_schema();
  let mut wrappers = Vec::new();

  for item in &impl_block.items {
    let ImplItem::Fn(method) = item else {
      continue;
    };

    let sig = &method.sig;

    let is_self_receiver = sig.inputs.iter().any(|arg| matches!(arg, FnArg::Receiver(_)));
    if !is_self_receiver {
      continue;
    }

    // Skip methods that return references - they can't be easily converted to extern "C"
    if let ReturnType::Type(_, ty) = &sig.output
      && matches!(ty.as_ref(), Type::Reference(_))
    {
      continue;
    }

    // Skip methods marked with #[moontui_skip]
    if has_skip_attribute(&method.attrs) {
      continue;
    }

    let method_name = sig.ident.to_string();
    let base_name = snake_to_camel(&method_name);

    // Prefix FFI name with type name to avoid conflicts
    let ffi_name = if let Some(ref prefix) = attr.name {
      // Use attribute name as prefix: "buffer" -> "bufferClear", "bufferDrawText"
      format!("{}{}", prefix, capitalize_first(&base_name))
    } else {
      match self_type.as_str() {
        "CliRenderer" => {
          // For CliRenderer, append "Renderer" to the method name
          if base_name == "destroy" || base_name == "resize" {
            format!("{base_name}Renderer")
          } else {
            base_name.clone()
          }
        }
        "OptimizedBuffer" => {
          // For OptimizedBuffer, prefix with "buffer"
          format!("buffer{}", capitalize_first(&base_name))
        }
        _ => base_name.clone(),
      }
    };

    let mut params = Vec::new();
    params.push(ParamDef {
      name: "self_ptr".to_string(),
      r#type: "ptr".to_string(),
      role: "self".to_string(),
    });

    for arg in &sig.inputs {
      if let FnArg::Typed(pat_type) = arg {
        let name = match &*pat_type.pat {
          syn::Pat::Ident(id) => id.ident.to_string(),
          _ => "arg".to_string(),
        };
        let ty = type_to_ffi(&pat_type.ty);
        params.push(ParamDef { name, r#type: ty, role: "arg".to_string() });
      }
    }

    let returns = match &sig.output {
      ReturnType::Default => "void".to_string(),
      ReturnType::Type(_, ty) => type_to_ffi(ty),
    };

    // Check for @ffi_manual doc comments on methods
    let method_docs = extract_doc_comments(&method.attrs);
    let is_manual = method_docs.iter().any(|c| c.starts_with("@ffi_manual"));
    let ts_metadata = if is_manual {
      parse_ts_metadata(&method_docs)
    } else {
      TsMetadata { ts_body: None, ts_args: None, ts_returns: None }
    };

    let fn_def = FunctionDef {
      receiver: Some(self_type.clone()),
      params,
      returns,
      ffi_name: ffi_name.clone(),
      manual: is_manual,
      ts_body: ts_metadata.ts_body,
      ts_args: ts_metadata.ts_args,
      ts_returns: ts_metadata.ts_returns,
    };

    schema.functions.insert(sig.ident.to_string(), fn_def);

    let wrapper = generate_wrapper(&self_type, sig, &ffi_name);
    wrappers.push(wrapper);
  }

  save_schema(&schema)?;

  let expanded = quote! {
      #impl_block

      #(#wrappers)*
  };

  Ok(expanded)
}

fn generate_struct_export(item_struct: &ItemStruct) -> syn::Result<proc_macro2::TokenStream> {
  let struct_name = item_struct.ident.to_string();
  let mut schema = load_schema();

  let mut fields = Vec::new();
  let mut offset = 0usize;

  for field in &item_struct.fields {
    let field_name = field
      .ident
      .as_ref()
      .ok_or_else(|| syn::Error::new(field.span(), "expected named field"))?
      .to_string();
    let (ffi_type, size, alignment) = struct_field_info(&field.ty)?;
    // Align offset
    offset = (offset + alignment - 1) & !(alignment - 1);
    fields.push(FieldDef { name: field_name, r#type: ffi_type, offset });
    offset += size;
  }

  // For #[repr(C)], the total size is the offset after the last field plus padding
  // We need the actual alignment of the struct (max field alignment)
  let max_alignment = fields.iter().fold(1usize, |acc, f| {
    let (_, _, align) = struct_field_info_by_type(&f.r#type);
    acc.max(align)
  });
  let total_size = (offset + max_alignment - 1) & !(max_alignment - 1);

  let struct_def =
    StructDef { repr: "C".to_string(), fields, size: total_size, alignment: max_alignment };

  schema.structs.insert(struct_name, struct_def);
  save_schema(&schema)?;

  // Output the struct unchanged
  Ok(quote! { #item_struct })
}

fn struct_field_info(ty: &Type) -> syn::Result<(String, usize, usize)> {
  match ty {
    Type::Path(tp) => {
      let name = tp.path.segments.last().map(|s| s.ident.to_string()).unwrap_or_default();
      Ok(struct_field_info_by_type(&name))
    }
    _ => Err(syn::Error::new(ty.span(), "unsupported field type for struct export")),
  }
}

fn struct_field_info_by_type(type_name: &str) -> (String, usize, usize) {
  match type_name {
    "bool" => ("bool".to_string(), 1, 1),
    "u8" => ("u8".to_string(), 1, 1),
    "i8" => ("i8".to_string(), 1, 1),
    "u16" => ("u16".to_string(), 2, 2),
    "i16" => ("i16".to_string(), 2, 2),
    "u32" | "MousePointerStyle" => ("u32".to_string(), 4, 4),
    _ => ("ptr".to_string(), std::mem::size_of::<*const ()>(), std::mem::align_of::<*const ()>()),
  }
}

fn generate_manual_export(func: &ItemFn) -> syn::Result<proc_macro2::TokenStream> {
  let fn_name = func.sig.ident.to_string();

  // Extract @ffi_manual and TS metadata from doc comments
  let doc_comments = extract_doc_comments(&func.attrs);
  let ts_metadata = parse_ts_metadata(&doc_comments);

  let mut schema = load_schema();

  // Parse function parameters
  let mut params = Vec::new();
  for arg in &func.sig.inputs {
    if let FnArg::Typed(pat_type) = arg {
      let name = match &*pat_type.pat {
        syn::Pat::Ident(id) => id.ident.to_string(),
        _ => "arg".to_string(),
      };
      let ty = type_to_ffi(&pat_type.ty);
      params.push(ParamDef { name, r#type: ty, role: "arg".to_string() });
    }
  }

  let returns = match &func.sig.output {
    ReturnType::Default => "void".to_string(),
    ReturnType::Type(_, ty) => type_to_ffi(ty),
  };

  let fn_def = FunctionDef {
    receiver: None,
    params,
    returns,
    ffi_name: fn_name.clone(),
    manual: true,
    ts_body: ts_metadata.ts_body,
    ts_args: ts_metadata.ts_args,
    ts_returns: ts_metadata.ts_returns,
  };

  schema.functions.insert(fn_name, fn_def);
  save_schema(&schema)?;

  // Output the function unchanged
  Ok(quote! { #func })
}

#[expect(clippy::struct_field_names)]
struct TsMetadata {
  ts_body: Option<String>,
  ts_args: Option<String>,
  ts_returns: Option<String>,
}

fn extract_doc_comments(attrs: &[syn::Attribute]) -> Vec<String> {
  let mut comments = Vec::new();
  for attr in attrs {
    if attr.path().is_ident("doc")
      && let syn::Meta::NameValue(nv) = &attr.meta
      && let syn::Expr::Lit(expr_lit) = &nv.value
      && let syn::Lit::Str(lit_str) = &expr_lit.lit
    {
      let text = lit_str.value();
      let trimmed = text.trim();
      if !trimmed.is_empty() {
        comments.push(trimmed.to_string());
      }
    }
  }
  comments
}

fn parse_ts_metadata(doc_comments: &[String]) -> TsMetadata {
  let mut ts_body = None;
  let mut ts_args = None;
  let mut ts_returns = None;

  for comment in doc_comments {
    if let Some(rest) = comment.strip_prefix("@ts_body ") {
      ts_body = Some(rest.to_string());
    } else if let Some(rest) = comment.strip_prefix("@ts_args ") {
      ts_args = Some(rest.to_string());
    } else if let Some(rest) = comment.strip_prefix("@ts_returns ") {
      ts_returns = Some(rest.to_string());
    }
  }

  TsMetadata { ts_body, ts_args, ts_returns }
}

fn has_skip_attribute(attrs: &[syn::Attribute]) -> bool {
  attrs.iter().any(|attr| attr.path().is_ident("moontui_skip"))
}

fn type_to_ffi(ty: &Type) -> String {
  match ty {
    Type::Path(tp) => {
      let name = tp.path.segments.last().map(|s| s.ident.to_string()).unwrap_or_default();
      struct_field_info_by_type(&name).0
    }
    _ => "ptr".to_string(),
  }
}

fn schema_path() -> PathBuf {
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
  PathBuf::from(manifest_dir)
    .parent()
    .expect("no parent dir")
    .parent()
    .expect("no workspace root")
    .join("target")
    .join("moontui-schema.json")
}

fn load_schema() -> Schema {
  let path = schema_path();
  if path.exists() {
    let data = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
  } else {
    Schema::default()
  }
}

fn save_schema(schema: &Schema) -> syn::Result<()> {
  let path = schema_path();
  let json = serde_json::to_string_pretty(schema)
    .map_err(|e| syn::Error::new(Span::call_site(), e.to_string()))?;
  fs::write(&path, json).map_err(|e| syn::Error::new(Span::call_site(), e.to_string()))?;
  Ok(())
}

fn capitalize_first(s: &str) -> String {
  let mut chars = s.chars();
  match chars.next() {
    None => String::new(),
    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
  }
}
