import {useEffect,useState} from 'react';
import {Button, Tooltip} from '@mui/material';
import {copyText} from '../../utils/clipboard';

export default function CopyTripIdButton({tripId}) {
  const [message,setMessage]=useState('');
  const value=String(tripId || '').trim();
  useEffect(()=>setMessage(''),[value]);
  if (!value || value==='-' || value==='--') return null;
  return <Tooltip title={message || 'Sao chép mã chuyến đầy đủ'}><Button size="small" type="button"
    aria-label={`Sao chép mã chuyến ${value}`} sx={{minWidth:44,minHeight:36,textTransform:'none',flexShrink:0}}
    onClick={async event=>{event.stopPropagation();try {await copyText(value);setMessage('Đã sao chép');} catch {setMessage('Không thể sao chép');window.alert('Không thể sao chép mã chuyến. Vui lòng thử lại.');}}}
  >{message==='Đã sao chép'?'Copy ✓':'Copy'}</Button></Tooltip>;
}
