// Fall back for browsers without the asynchronous Clipboard API.
export async function copyText(value) {
  const text=String(value);
  if (globalThis.navigator?.clipboard?.writeText) {
    try {await navigator.clipboard.writeText(text);return;} catch { /* Try the synchronous browser fallback. */ }
  }
  const active=document.activeElement;
  const field=document.createElement('textarea');
  field.value=text;field.readOnly=true;field.style.position='fixed';field.style.opacity='0';
  const host=active?.closest?.('[role="dialog"]') || document.body;
  host.appendChild(field);
  try {field.select();field.setSelectionRange?.(0,text.length);if (!document.execCommand('copy')) throw new Error('Không thể sao chép.');}
  finally {field.remove();active?.focus?.();}
}
