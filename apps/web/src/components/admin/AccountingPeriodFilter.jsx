import { MenuItem, TextField } from "@mui/material";
export function accountingRange(value) {
  const month = value.month ? Number(value.month) : (Number(value.quarter) - 1) * 3 + 1;
  const count = value.month ? 1 : 3;
  return { fromDate: new Date(Date.UTC(Number(value.year), month-1, 1)).toISOString().slice(0,10), toDate: new Date(Date.UTC(Number(value.year), month-1+count, 0)).toISOString().slice(0,10) };
}
export function accountingPeriodLabel(value) { return `${value.month ? `Tháng ${value.month}` : `Quý ${value.quarter}`}/${value.year}`; }
export default function AccountingPeriodFilter({ value, onChange }) {
  const mode = value.month ? "month" : "quarter";
  return <>
    <TextField select label="Xem theo" value={mode} onChange={e => onChange({ ...value, month: e.target.value === "month" ? (Number(value.quarter)-1)*3+1 : null })} sx={{ minWidth: 135 }}><MenuItem value="quarter">Quý</MenuItem><MenuItem value="month">Tháng</MenuItem></TextField>
    <TextField select label={mode === "month" ? "Tháng" : "Quý"} value={mode === "month" ? value.month : value.quarter} onChange={e => onChange({ ...value, ...(mode === "month" ? {month:Number(e.target.value),quarter:Math.ceil(Number(e.target.value)/3)} : {quarter:Number(e.target.value)}) })} sx={{ minWidth: 120 }}>
      {Array.from({length:mode === "month" ? 12 : 4},(_,i)=><MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
    </TextField>
    <TextField label="Năm" type="number" value={value.year} onChange={e=>onChange({...value,year:Number(e.target.value)})} inputProps={{min:2000,max:2100}} sx={{width:130}} />
  </>;
}
