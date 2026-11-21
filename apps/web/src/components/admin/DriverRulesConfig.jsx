import React, { useEffect, useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Stack, TextField, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { driverRulesRequest } from '../../api/adminDriverRules';
const newId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const date = value => value ? new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : 'Chưa có';
function ContentPreview({content}) {
  if(!content)return null;
  return <Stack spacing={2}>
    <Typography variant="h6">{content.title}</Typography>
    {content.groups.map(g=><Box key={g.id}>
      <Typography variant="h6">{g.title}</Typography><Typography color="text.secondary">{g.description}</Typography>
      {g.sections.map(s=><Box key={s.id} sx={{my:2}}><Typography fontWeight={700}>{s.title}</Typography><Typography color="text.secondary">{s.summary}</Typography>{s.paragraphs.map((p,i)=><Typography key={i} sx={{mt:1,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p}</Typography>)}</Box>)}
      <Divider />
    </Box>)}
    <Typography fontWeight={700}>{content.confirmation}</Typography>
  </Stack>;
}
export default function DriverRulesConfig() {
  const [data,setData]=useState(null),[content,setContent]=useState(null),[summary,setSummary]=useState(''),[groupId,setGroupId]=useState('');
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reviewed,setReviewed]=useState(false);
  const [preview,setPreview]=useState(false),[evidence,setEvidence]=useState(null),[evidenceVersion,setEvidenceVersion]=useState(''),[pending,setPending]=useState(false),[page,setPage]=useState(1);
  async function load() {
    setBusy(true);setError('');
    try { const next=await driverRulesRequest(); const source=next.draft||next.current; const c=source?.content||next.template;
      setData(next);setContent(structuredClone(c));setSummary(next.draft?.changeSummary||'');setGroupId(id=>c.groups.some(g=>g.id===id)?id:c.groups[0].id);setDirty(false);setReviewed(false);
    } catch(e){setError(e.message);}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const warn=e=>{if(dirty){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  function edit(change) {setContent(old=>{const next=structuredClone(old);change(next);return next;});setDirty(true);setReviewed(false);setNotice('');}
  const group=content?.groups.find(g=>g.id===groupId);
  const updateSection=(id,key,value)=>edit(c=>{c.groups.find(g=>g.id===groupId).sections.find(s=>s.id===id)[key]=value;});
  async function save() {
    setBusy(true);setError('');setNotice('');
    try {const result=await driverRulesRequest('/draft','POST',{content,changeSummary:summary,expectedRevision:data.draft?.revision??null,expectedDraftId:data.draft?.id??null,expectedBaseVersionId:data.current?.id??null});setData({...data,draft:result.item});setContent(structuredClone(result.item.content));setDirty(false);setReviewed(false);setNotice('Đã lưu nháp. Tài xế chưa thấy thay đổi này.');}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function publish() {
    if(!window.confirm('Phát hành bản đã lưu? Tài xế sẽ thấy dấu đỏ và cần xác nhận phiên bản mới.'))return;
    setBusy(true);setError('');
    try {await driverRulesRequest(`/${data.draft.id}/publish`,'POST',{revision:data.draft.revision,contentHash:data.draft.contentHash,reviewed});await load();setNotice('Đã phát hành. Driver Mobile có hỗ trợ tính năng này sẽ cập nhật dấu đỏ khi đồng bộ.');}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function discard() {
    if(!window.confirm('Bỏ toàn bộ bản nháp? Bản đang áp dụng và các xác nhận cũ vẫn được giữ.'))return;
    setBusy(true);setError('');try {await driverRulesRequest(`/draft/${data.draft.id}`,'DELETE',{revision:data.draft.revision});await load();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function showEvidence(id,waiting=false,nextPage=1) {
    setBusy(true);setError('');try {const result=await driverRulesRequest(`/${id}/acknowledgements?pending=${waiting}&page=${nextPage}`);setEvidence(result);setEvidenceVersion(id);setPending(waiting);setPage(nextPage);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!content)return <Stack spacing={2}>{error&&<Alert severity="error">{error}</Alert>}<Button disabled={busy} onClick={load}>{busy?'Đang tải…':'Tải quy định tài xế'}</Button></Stack>;
  return <Stack spacing={2.5}>
    <Typography variant="h6">Quy định quy tắc tài xế</Typography>
    <Alert severity="info">Tạo mới, sửa, xoá và sắp xếp các mục trong bản nháp. Chỉ khi phát hành, nội dung mới áp dụng và tài xế cần xác nhận lại. Bản đã phát hành và xác nhận cũ được lưu để đối chiếu.</Alert>
    {error&&<Alert severity="error">{error}</Alert>}{notice&&<Alert severity="success">{notice}</Alert>}
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip label={data.current?`Đang áp dụng: phiên bản ${data.current.version}`:'Chưa phát hành lần đầu'} color="primary"/><Chip label={data.draft?`Bản nháp ${data.draft.version} • lần lưu ${data.draft.revision}`:'Đang soạn bản mới'} variant="outlined"/>{dirty&&<Chip color="warning" label="Có thay đổi chưa lưu"/>}</Stack>
    <TextField label="Tiêu đề chung" value={content.title} disabled={busy} onChange={e=>edit(c=>{c.title=e.target.value;})}/>
    <TextField label="Câu xác nhận dành cho tài xế" value={content.confirmation} multiline disabled={busy} onChange={e=>edit(c=>{c.confirmation=e.target.value;})}/>
    <TextField label="Tóm tắt thay đổi để tài xế biết cần đọc gì" value={summary} multiline minRows={2} disabled={busy} onChange={e=>{setSummary(e.target.value);setDirty(true);setReviewed(false);}} helperText="Ví dụ: Bổ sung thời hạn liên hệ trong 15 phút và hướng dẫn xử lý khi không nhận được chuyến."/>
    <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
      <TextField select fullWidth label="Nhóm quy định" value={groupId} disabled={busy} onChange={e=>setGroupId(e.target.value)}>{content.groups.map(g=><MenuItem key={g.id} value={g.id}>{g.title}</MenuItem>)}</TextField>
      <Button disabled={busy} onClick={()=>{const id=newId('group');edit(c=>c.groups.push({id,title:'Nhóm quy định mới',description:'',sections:[{id:newId('rule'),title:'Quy định mới',summary:'',paragraphs:['Nhập nội dung quy định.']}]}));setGroupId(id);}}>Thêm nhóm</Button>
    </Stack>
    {group&&<Stack spacing={2}>
      <TextField label="Tên nhóm" value={group.title} disabled={busy} onChange={e=>edit(c=>{c.groups.find(g=>g.id===groupId).title=e.target.value;})}/>
      <TextField label="Giới thiệu nhóm" value={group.description} multiline disabled={busy} onChange={e=>edit(c=>{c.groups.find(g=>g.id===groupId).description=e.target.value;})}/>
      <Button color="error" disabled={busy||content.groups.length<=1} onClick={()=>{if(window.confirm(`Xoá nhóm “${group.title}” và các mục trong nhóm khỏi bản nháp?`)){const next=content.groups.find(g=>g.id!==groupId).id;edit(c=>{c.groups=c.groups.filter(g=>g.id!==groupId);});setGroupId(next);}}}>Xoá nhóm khỏi bản mới</Button>
      {group.sections.map((s,index)=><Accordion key={s.id}>
        <AccordionSummary expandIcon={<ExpandMoreIcon/>}><Typography>{index+1}. {s.title||'Chưa có tiêu đề'}</Typography></AccordionSummary>
        <AccordionDetails><Stack spacing={2}>
          <TextField label="Tiêu đề mục" value={s.title} disabled={busy} onChange={e=>updateSection(s.id,'title',e.target.value)}/>
          <TextField label="Tóm tắt mục" value={s.summary} multiline disabled={busy} onChange={e=>updateSection(s.id,'summary',e.target.value)}/>
          <TextField label="Nội dung" value={s.paragraphs.join('\n\n')} multiline minRows={7} disabled={busy} onChange={e=>updateSection(s.id,'paragraphs',e.target.value.split(/\n\s*\n/))} helperText="Chừa một dòng trống để tách các đoạn. Nội dung hiển thị dạng văn bản, không cần nhập mã."/>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button disabled={busy||index===0} onClick={()=>edit(c=>{const a=c.groups.find(g=>g.id===groupId).sections;[a[index-1],a[index]]=[a[index],a[index-1]];})}>Đưa lên</Button>
            <Button disabled={busy||index===group.sections.length-1} onClick={()=>edit(c=>{const a=c.groups.find(g=>g.id===groupId).sections;[a[index+1],a[index]]=[a[index],a[index+1]];})}>Đưa xuống</Button>
            <Button color="error" disabled={busy||group.sections.length<=1} onClick={()=>{if(window.confirm(`Xoá mục “${s.title}” khỏi bản nháp?`))edit(c=>{const g=c.groups.find(g=>g.id===groupId);g.sections=g.sections.filter(x=>x.id!==s.id);});}}>Xoá mục</Button>
          </Stack>
        </Stack></AccordionDetails>
      </Accordion>)}
      <Button variant="outlined" disabled={busy} onClick={()=>edit(c=>c.groups.find(g=>g.id===groupId).sections.push({id:newId('rule'),title:'Quy định mới',summary:'',paragraphs:['Nhập nội dung quy định.']}))}>Thêm quy định mới</Button>
    </Stack>}
    <Divider/>
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Button variant="contained" onClick={save} disabled={busy||!summary.trim()}>Lưu nháp</Button><Button onClick={()=>setPreview(true)} disabled={busy}>Xem trước toàn bộ</Button><Button onClick={()=>{if(!dirty||window.confirm('Bỏ thay đổi chưa lưu và tải lại?'))void load();}} disabled={busy}>Tải lại</Button>{data.draft&&<Button color="error" onClick={discard} disabled={busy}>Bỏ bản nháp</Button>}</Stack>
    <FormControlLabel control={<Checkbox checked={reviewed} disabled={busy||dirty||!data.draft} onChange={e=>setReviewed(e.target.checked)}/>} label="Tôi đã xem trước và rà soát toàn bộ bản đã lưu trước khi phát hành."/>
    <Button variant="contained" color="success" onClick={publish} disabled={busy||dirty||!data.draft||!reviewed}>Phát hành và nhắc tài xế xác nhận</Button>
    <Divider/><Typography variant="h6">Lịch sử phát hành &amp; xác nhận</Typography>
    {data.history.length===0?<Typography>Chưa có bản đã phát hành.</Typography>:data.history.map(h=><Stack key={h.id} direction={{xs:'column',sm:'row'}} spacing={1} alignItems={{sm:'center'}}><Box sx={{flex:1}}><Typography fontWeight={700}>Phiên bản {h.version} • {date(h.publishedAt)}</Typography><Typography>{h.changeSummary}</Typography><Typography variant="caption">Phát hành bởi: {h.publishedBy}</Typography></Box><Button onClick={()=>showEvidence(h.id)} disabled={busy}>Xem nội dung &amp; xác nhận</Button></Stack>)}
    <Dialog open={preview} onClose={()=>setPreview(false)} fullWidth maxWidth="md"><DialogTitle>Xem trước {dirty?'• có thay đổi chưa lưu':''}</DialogTitle><DialogContent><ContentPreview content={content}/></DialogContent><DialogActions><Button onClick={()=>setPreview(false)}>Đóng</Button></DialogActions></Dialog>
    <Dialog open={!!evidence} onClose={()=>setEvidence(null)} fullWidth maxWidth="md"><DialogTitle>Phiên bản {evidence?.version.version} — Đã xác nhận: {evidence?.accepted} / {evidence?.total}</DialogTitle><DialogContent>{evidence&&<Stack spacing={2}>
      <Stack direction="row" spacing={1}><Button variant={!pending?'contained':'outlined'} disabled={busy} onClick={()=>showEvidence(evidenceVersion,false)}>Đã xác nhận ({evidence.accepted})</Button><Button variant={pending?'contained':'outlined'} disabled={busy} onClick={()=>showEvidence(evidenceVersion,true)}>Chưa xác nhận ({evidence.pending})</Button></Stack>
      <Box sx={{overflowX:'auto'}}><Table size="small"><TableHead><TableRow><TableCell>Tài xế</TableCell><TableCell>Mã hồ sơ</TableCell><TableCell>Thời điểm xác nhận</TableCell></TableRow></TableHead><TableBody>{evidence.items.map(p=><TableRow key={p.id}><TableCell>{p.fullName||'Chưa có tên'}</TableCell><TableCell>{p.id}</TableCell><TableCell>{date(p.acceptance?.acceptedAt)}</TableCell></TableRow>)}</TableBody></Table></Box>
      {!evidence.items.length&&<Typography>Không có tài xế trong danh sách này.</Typography>}
      <Stack direction="row" spacing={1}><Button disabled={busy||page<=1} onClick={()=>showEvidence(evidenceVersion,pending,page-1)}>Trước</Button><Typography sx={{alignSelf:'center'}}>Trang {page}</Typography><Button disabled={busy||page*50>=evidence.count} onClick={()=>showEvidence(evidenceVersion,pending,page+1)}>Sau</Button></Stack>
      <Divider/><Typography variant="h6">Nội dung được lưu của phiên bản này</Typography><ContentPreview content={evidence.content}/>
    </Stack>}</DialogContent><DialogActions><Button onClick={()=>setEvidence(null)}>Đóng</Button></DialogActions></Dialog>
  </Stack>;
}
