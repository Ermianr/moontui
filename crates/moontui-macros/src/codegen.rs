use proc_macro2::TokenStream;
use quote::quote;
use syn::{FnArg, Pat, ReturnType, Signature};

pub fn generate_wrapper(self_type: &str, sig: &Signature, ffi_name: &str) -> TokenStream {
  let fn_name = &sig.ident;
  let ffi_ident = syn::Ident::new(ffi_name, fn_name.span());

  let self_type_ident = syn::Ident::new(self_type, fn_name.span());

  let mut extern_params = Vec::new();
  let mut call_args = Vec::new();

  extern_params.push(quote! { self_ptr: *mut #self_type_ident });

  for arg in &sig.inputs {
    if let FnArg::Typed(pat_type) = arg {
      let pat = &pat_type.pat;
      let ty = &pat_type.ty;
      let name = match pat.as_ref() {
        Pat::Ident(id) => &id.ident,
        _ => continue,
      };
      extern_params.push(quote! { #name: #ty });
      call_args.push(quote! { #name });
    }
  }

  let has_return = !matches!(sig.output, ReturnType::Default);
  let return_type = &sig.output;

  let body = if has_return {
    quote! {
        if self_ptr.is_null() {
            return Default::default();
        }
        unsafe {
            (*self_ptr).#fn_name(#(#call_args),*)
        }
    }
  } else {
    quote! {
        if self_ptr.is_null() {
            return;
        }
        unsafe {
            (*self_ptr).#fn_name(#(#call_args),*)
        }
    }
  };

  quote! {
      #[expect(unsafe_code)]
      #[unsafe(no_mangle)]
      pub extern "C" fn #ffi_ident(#(#extern_params),*) #return_type {
          #body
      }
  }
}
