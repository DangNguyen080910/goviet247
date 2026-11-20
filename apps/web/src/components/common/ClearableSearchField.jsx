import { useRef } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function ClearableSearchField({ onClear, inputRef, InputProps = {}, ...props }) {
  const fieldRef = useRef(null);
  const hasValue = String(props.value ?? '').length > 0;
  const disabled = Boolean(props.disabled || props.inputProps?.readOnly || InputProps.readOnly);

  function clear() {
    if (disabled) return;
    onClear();
    fieldRef.current?.focus();
  }

  return <TextField
    {...props}
    inputRef={node => {
      fieldRef.current = node;
      if (typeof inputRef === 'function') inputRef(node);
      else if (inputRef) inputRef.current = node;
    }}
    InputProps={{
      ...InputProps,
      endAdornment: <>
        {InputProps.endAdornment}
        {hasValue && <InputAdornment position="end">
          <IconButton type="button" size="small" disabled={disabled}
            aria-label="Xoá nội dung tìm kiếm" title="Xoá nội dung tìm kiếm"
            onMouseDown={event => event.preventDefault()} onClick={clear}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </InputAdornment>}
      </>,
    }}
  />;
}
