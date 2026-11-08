import { redactAccountingPdfCell } from "./accountingPdf.js";
import archiver from "archiver";
import { PassThrough } from "node:stream";
const xml = value => String(value ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
function column(n) { let s=""; for(n++; n; n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
// Explicit inline strings preserve leading-zero identities and prevent formula execution.
export async function buildAccountingExcel(rows, {title="Sổ sách", numericColumns} = {}) {
  const headers=rows[0] || [];
  const numeric=headers.map((h, index) => numericColumns ? numericColumns.includes(index) : !/mã|sđt|điện thoại|cccd|định danh|tài khoản|ngày|tháng|năm/i.test(h) && /tiền|phí|vat|pit|thuế|giá|tỷ lệ|số dư|balance|amount|giá trị|tổng thu|tổng chi/i.test(h));
  const body=rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=> {
    const ref=column(j)+(i+1), raw=i === 0 ? String(v ?? "") : redactAccountingPdfCell(v, headers[j]);
    return i>0 && numeric[j] && /^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(Number(raw))
      ? `<c r="${ref}" s="2"><v>${Number(raw)}</v></c>`
      : `<c r="${ref}" s="${i===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${xml(raw)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const last=column(Math.max(headers.length-1,0))+Math.max(rows.length,1);
  const files={
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(title.replace(/[\\/*?:\[\]]/g,' ').slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B60"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${headers.map((h,j)=>`<col min="${j+1}" max="${j+1}" width="${/ghi chú|mô tả|diễn giải/i.test(h)?55:26}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
  };
  const archive=archiver('zip',{zlib:{level:6}}),stream=new PassThrough(),chunks=[];
  const done=new Promise((resolve,reject)=>{stream.on('data',c=>chunks.push(c));stream.on('end',()=>resolve(Buffer.concat(chunks)));stream.on('error',reject);archive.on('error',reject);});
  archive.pipe(stream);for(const [name,value] of Object.entries(files)) archive.append(value,{name});await archive.finalize();return done;
}
