import { forwardRef, useRef, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { moneySuggestions, suggestedMoneyLabel } from '../../../../../packages/shared/moneySuggestions.js';

const MoneyTextField = forwardRef(function MoneyTextField({
  moneySuggestions: enabled = true, inputRef, sx, fullWidth, ...props
}, forwardedRef) {
  const field = useRef(null);
  const [focused, setFocused] = useState(false);
  const disabled = props.disabled || props.InputProps?.readOnly || props.inputProps?.readOnly || props.slotProps?.input?.readOnly;
  const suggestions = enabled && focused && !disabled ? moneySuggestions(props.value) : [];
  function select(amount) {
    if (disabled) return;
    const target = { value: String(amount), name: props.name, type: props.type || 'text' };
    props.onChange?.({ target, currentTarget: target });
    field.current?.focus();
  }
  const control = <TextField {...props} fullWidth={fullWidth} ref={forwardedRef}
    sx={enabled ? undefined : sx}
    inputRef={node => {
      field.current = node;
      if (typeof inputRef === 'function') inputRef(node);
      else if (inputRef) inputRef.current = node;
    }} />;
  if (!enabled) return control;
  return <Box sx={[{ minWidth: 0, ...(fullWidth ? { width: '100%' } : {}) }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {control}
    {!!suggestions.length && <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" color="text.secondary">Chọn nhanh số tiền</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
        {suggestions.map(amount => <Button key={amount} type="button" size="small" variant="outlined"
          aria-label={`Chọn số tiền ${amount.toLocaleString('vi-VN')} đồng`}
          onMouseDown={event => event.preventDefault()}
          onClick={() => select(amount)} sx={{ minHeight: 36, textTransform: 'none' }}>
          {suggestedMoneyLabel(amount)}
        </Button>)}
      </Box>
    </Box>}
  </Box>;
});

export default MoneyTextField;
