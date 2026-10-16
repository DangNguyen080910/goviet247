import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";

const FONT_REGULAR = fileURLToPath(new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url));
const FONT_BOLD = fileURLToPath(new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url));
const FEATURES = { liga: false, clig: false };
const number = (value) => Number(String(value ?? "").replace(/[^\d-]/g, "")) || 0;
const money = (value) => Number(value || 0).toLocaleString("vi-VN");

export function redactAccountingPdfCell(value, header = "") {
  let text = String(value ?? "");
  if (/số tài khoản/i.test(header) && text) {
    const digits = text.replace(/\D/g, "");
    text = digits.length > 4 ? `•••• ${digits.slice(-4)}` : "[đã ẩn]";
  }
  text = text.replace(
    /(\bSTK\b|số\s*tài\s*khoản|account\s*(?:number|no\.?))\s*[:：=-]?\s*((?:\d[ -]?){6,24})/gi,
    (_, label, account) => `${label}: •••• ${account.replace(/\D/g, "").slice(-4)}${/\s$/.test(account) ? " " : ""}`,
  );
  return text.split(/\r?\n/).map((line) =>
    /mật khẩu|mat khau|password|\bpass\b/i.test(line)
      ? "[đã ẩn dòng có thông tin mật khẩu]"
      : line,
  ).join("\n");
}

function reportDefinition(rows, reportType) {
  const headers = rows[0] || [];
  const source = rows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));
  const index = new Map(headers.map((header, position) => [header, position]));
  const get = (row, header) => redactAccountingPdfCell(row[index.get(header)], header);
  const amount = (row, header) => number(get(row, header));
  const sum = (header, predicate = () => true) => source.filter(predicate).reduce((total, row) => total + amount(row, header), 0);
  const field = (label, header = label, weight = 1, numeric = false) => ({ label, weight, numeric, value: (row) => get(row, header) });
  const combined = (label, fields, weight) => ({
    label, weight,
    value: (row) => fields.map((header) => get(row, header)).filter(Boolean).join("\n"),
  });
  const detail = (row, fields) => fields.map((header) => {
    const value = get(row, header);
    return value ? `${header}: ${value}` : "";
  }).filter(Boolean).join(" | ");
  const authors = [...new Set(source.map((row) => get(row, "Người tạo")).filter(Boolean))];
  let columns;
  let details = () => "";
  let summary = `${source.length} dòng dữ liệu`;
  let note = "";
  let pageSize = "A4";
  let totals = [];
  const total = (values) => ({ cells: values, isTotal: true });

  switch (reportType) {
    case "cash": {
      columns = [field("Ngày giờ", "Ngày", 1.05), field("Thu / Chi", "Loại", 0.55),
        field("Nhóm", "Nhóm", 0.85), field("Diễn giải", "Ghi chú", 3.15),
        field("Số tiền (VND)", "Số tiền", 1, true), field("Nguồn", "Nguồn", 1.15)];
      details = (row) => detail(row, ["Mã tham chiếu", ...(authors.length > 1 ? ["Người tạo"] : [])]);
      const income = sum("Số tiền", (row) => get(row, "Mã loại") === "IN");
      const expense = sum("Số tiền", (row) => get(row, "Mã loại") === "OUT");
      summary += ` | Tổng thu: ${money(income)}đ | Tổng chi: ${money(expense)}đ | Chênh lệch: ${money(income - expense)}đ`;
      note = "Thu chi gồm dòng tiền ví tài xế; chênh lệch thu chi không đồng nghĩa lợi nhuận công ty.";
      totals = [total(["", "", "", "TỔNG THU", money(income), ""]),
        total(["", "", "", "TỔNG CHI", money(expense), ""]),
        total(["", "", "", "CHÊNH LỆCH THU CHI", money(income - expense), ""])];
      break;
    }
    case "wallet":
      pageSize = "A3";
      columns = [field("Ngày giờ", "Ngày giờ", 1.1), combined("Tài xế / SĐT", ["Tài xế", "SĐT"], 1.55),
        field("Loại giao dịch", "Loại giao dịch", 1.45), field("Số tiền (VND)", "Số tiền", 1.05, true),
        field("Số dư trước", "Số dư trước", 1.05, true), field("Số dư sau", "Số dư sau", 1.05, true),
        combined("Mã giao dịch / liên quan", ["Mã giao dịch", "Liên quan"], 2.3), field("Ghi chú", "Ghi chú", 2.85)];
      details = (row) => detail(row, ["Mã chuyến", "Mã yêu cầu rút"].filter((header) => {
        const reference = get(row, header);
        return reference && !get(row, "Liên quan").includes(reference);
      }));
      note = "Số dư trước/sau thuộc ví riêng từng tài xế; không cộng các số dư thành doanh thu hoặc số dư công ty.";
      break;
    case "trips": {
      pageSize = "A3";
      columns = [combined("Ngày / loại dòng", ["Ngày sự kiện", "Loại dòng"], 1.4),
        combined("Tài xế / SĐT", ["Tài xế", "SĐT"], 1.5), field("Giá chuyến", "Giá chuyến", 1.05, true),
        field("Phí môi giới gồm VAT", "Phí môi giới đã thu (đã gồm VAT)", 1.05, true),
        field("Phí môi giới chưa VAT", "Doanh thu phí chưa VAT", 1.05, true),
        field("VAT phí môi giới", "VAT đầu ra phí môi giới", 0.95, true),
        field("VAT tài xế", "VAT tài xế", 0.95, true), field("PIT tài xế", "PIT tài xế", 0.95, true),
        field("Tổng khấu trừ", "Tổng khấu trừ", 1.05, true), field("Thực nhận", "Tài xế thực nhận", 1.1, true),
        field("Phạt huỷ", "Phạt huỷ chuyến", 1, true)];
      details = (row) => detail(row, ["Mã chuyến", "Trạng thái", "Loại xe", "Chiều chuyến", "Thuế suất VAT phí môi giới", "Ghi chú"]);
      const count = source.filter((row) => get(row, "Mã loại dòng") === "COMPLETED_TRIP").length;
      summary = `${count} chuyến hoàn thành | ${source.length - count} dòng phạt huỷ | Đơn vị: VND`;
      note = "Giá chuyến và thực nhận thuộc tài xế. Các khoản phạt được trình bày riêng, không gộp vào thu nhập chuyến hoàn thành.";
      totals = [total(["TỔNG CỘNG", "", ...["Giá chuyến", "Phí môi giới đã thu (đã gồm VAT)", "Doanh thu phí chưa VAT",
        "VAT đầu ra phí môi giới", "VAT tài xế", "PIT tài xế", "Tổng khấu trừ", "Tài xế thực nhận", "Phạt huỷ chuyến"].map((header) => money(sum(header)))])];
      break;
    }
    case "driverIncome":
      pageSize = "A3";
      columns = [field("Tài xế", "Tài xế", 1.65), field("SĐT", "SĐT", 1.15),
        field("Số chuyến", "Số chuyến hoàn thành", 0.65, true), field("Giá trị chuyến", "Tổng giá trị chuyến", 1.1, true),
        field("Phí môi giới gồm VAT", "Phí môi giới đã thu", 1.1, true), field("VAT tài xế", "VAT tài xế", 1, true),
        field("PIT tài xế", "PIT tài xế", 1, true), field("Tổng khấu trừ", "Tổng khấu trừ", 1.1, true),
        field("Thực nhận", "Tài xế thực nhận", 1.1, true)];
      summary = `${source.length} tài xế | ${sum("Số chuyến hoàn thành")} chuyến hoàn thành | Đơn vị tiền: VND`;
      note = "Thực nhận được tính theo dữ liệu chuyến; không thay thế chứng từ xác nhận thanh toán thực tế.";
      totals = [total(["TỔNG CỘNG", "", ...["Số chuyến hoàn thành", "Tổng giá trị chuyến", "Phí môi giới đã thu", "VAT tài xế",
        "PIT tài xế", "Tổng khấu trừ", "Tài xế thực nhận"].map((header) => money(sum(header)))])];
      break;
    case "withdraw": {
      pageSize = "A3";
      columns = [field("Ngày yêu cầu", "Ngày tạo", 1.15), combined("Tài xế / SĐT", ["Tài xế", "SĐT"], 1.65),
        field("Số tiền (VND)", "Số tiền", 1.1, true), field("Trạng thái", "Trạng thái", 1.1),
        combined("Ngân hàng / tài khoản đã che / chủ TK", ["Ngân hàng", "Số tài khoản", "Chủ tài khoản"], 2.3),
        field("Ngày duyệt", "Ngày duyệt", 1.15), field("Ngày chi trả", "Ngày chi trả", 1.15),
        combined("Ghi chú / lý do từ chối", ["Ghi chú", "Lý do từ chối"], 2.4)];
      details = (row) => detail(row, ["Mã yêu cầu"]);
      const paid = source.filter((row) => get(row, "Mã trạng thái") === "PAID");
      summary = `${source.length} yêu cầu | Đã chi: ${paid.length} yêu cầu, ${money(sum("Số tiền", (row) => get(row, "Mã trạng thái") === "PAID"))}đ`;
      note = "Rút ví là dòng tiền ví tài xế; không đồng nghĩa thu nhập theo chuyến. Số tài khoản chỉ giữ bốn số cuối.";
      break;
    }
    case "reconciliation":
      pageSize = "A3";
      columns = [field("Mã chuyến", "Mã chuyến", 1.8), combined("Trạng thái / ngày cập nhật", ["Trạng thái hiện tại", "Ngày cập nhật"], 1.45),
        combined("Tài xế / SĐT", ["Tài xế", "SĐT"], 1.55), field("Giá chuyến", "Giá chuyến", 0.95, true),
        field("Phí môi giới đã giữ", "Phí môi giới đã giữ", 0.95, true), field("VAT đã giữ", "VAT tài xế đã giữ", 0.85, true),
        field("PIT đã giữ", "PIT tài xế đã giữ", 0.85, true), field("Tổng đã giữ", "Tổng đã giữ", 0.95, true),
        field("Lý do / giải trình", "Lý do / giải trình", 2.9)];
      note = "Khoản giữ xét theo giao dịch ví trong quý; ngày cập nhật chuyến là trạng thái hiện tại và có thể thuộc quý sau. Không cộng bảng này thành doanh thu mới.";
      totals = [total(["TỔNG KHOẢN GIỮ", "", "", "", ...["Phí môi giới đã giữ", "VAT tài xế đã giữ", "PIT tài xế đã giữ", "Tổng đã giữ"].map((header) => money(sum(header))), ""])];
      break;
    case "revenue":
      columns = [field("Nhóm", "Nhóm", 1.4), field("Hạng mục", "Hạng mục", 4.5), field("Giá trị", "Giá trị", 1.25, true)];
      summary = "Báo cáo tạm tính theo dữ liệu hệ thống | Số tiền: VND; số lượng: chuyến/lượt";
      note = "Các dòng tham chiếu không cộng thêm vào tổng thu hoặc chi phí. Kế toán đối chiếu chứng từ và điều chỉnh trước khi chốt.";
      break;
    case "notes":
      columns = [field("Nhóm", "Nhóm", 1), field("Hạng mục", "Hạng mục", 2.5),
        field("Giá trị", "Giá trị", 1.2), field("Ghi chú", "Ghi chú", 4.1)];
      details = (row) => detail(row, ["Mã hạng mục", "Ngày tạo", ...(authors.length > 1 ? ["Người tạo"] : [])]);
      note = "Thông tin mật khẩu được ẩn theo từng dòng ghi chú; các dòng giải trình còn lại được giữ để đối chiếu.";
      break;
    default:
      // Unknown reports retain every original field in a labelled record, never slice columns into unrelated pages.
      columns = [{ label: "Nội dung bản ghi", weight: 1, value: (row) => headers.map((header) => `${header}: ${get(row, header)}`).join("\n") }];
  }

  return {
    columns, pageSize, summary, note,
    author: authors.length === 1 ? authors[0] : "",
    records: source.map((row, position) => ({
      number: String(position + 1), cells: columns.map((column) => column.value(row)), details: details(row),
    })),
    totals,
  };
}

export function buildAccountingPdf(rows, { title, quarter, year, subtitle = "", reportType = "generic" }) {
  return new Promise((resolve, reject) => {
    const report = reportDefinition(rows, reportType);
    const doc = new PDFDocument({ size: report.pageSize, layout: "landscape", margin: 28,
      bufferPages: true, autoFirstPage: false,
      info: { Title: `${title} - Q${quarter}/${year}`, Author: "GoViet247", Subject: "Bảng đối chiếu kế toán" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont("Regular", FONT_REGULAR);
    doc.registerFont("Bold", FONT_BOLD);
    const fontSize = 8.4;
    const lineHeight = 11.8;
    const padding = 5;
    const left = 28;
    const columns = [{ label: "STT", weight: 0, width: 31 }, ...report.columns];
    let widths;
    let y;
    let bodyTop;
    let bottom;
    let bodyCapacity;
    const widthCache = new Map();

    function wrap(text, width, { bold = false, size = fontSize } = {}) {
      doc.font(bold ? "Bold" : "Regular").fontSize(size);
      const measure = (value) => {
        const key = `${bold ? "b" : "r"}:${size}:${value}`;
        if (widthCache.has(key)) return widthCache.get(key);
        const measured = doc.widthOfString(value, { features: FEATURES });
        if (widthCache.size > 12000) widthCache.clear();
        widthCache.set(key, measured);
        return measured;
      };
      const lines = [];
      for (const paragraph of String(text ?? "").split(/\r?\n/)) {
        let line = "";
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) { lines.push(""); continue; }
        for (const word of words) {
          const proposed = line ? `${line} ${word}` : word;
          if (measure(proposed) <= width) { line = proposed; continue; }
          if (line) { lines.push(line); line = ""; }
          if (measure(word) <= width) { line = word; continue; }
          // References without spaces must wrap instead of overflowing into adjacent columns.
          for (const character of word) {
            if (line && measure(line + character) > width) {
              lines.push(line); line = "";
            }
            line += character;
          }
        }
        lines.push(line);
      }
      return lines.length ? lines : [""];
    }

    function textLines(lines, x, top, width, { bold = false, size = fontSize, align = "left", color = "#243447", leading = lineHeight } = {}) {
      doc.font(bold ? "Bold" : "Regular").fontSize(size).fillColor(color);
      lines.forEach((line, index) => {
        doc.text(line, x, top + index * leading, { width, align, lineBreak: false, features: FEATURES });
      });
    }

    function newPage() {
      doc.addPage();
      const usable = doc.page.width - left * 2;
      const totalWeight = report.columns.reduce((sum, column) => sum + column.weight, 0);
      widths = [31, ...report.columns.map((column) => (usable - 31) * column.weight / totalWeight)];
      bottom = doc.page.height - 45;
      y = 25;
      const heading = wrap(title, usable, { bold: true, size: 16 });
      textLines(heading, left, y, usable, { bold: true, size: 16, leading: 20, color: "#16324f" });
      y += heading.length * 20 + 4;
      const period = `Quý ${quarter}/${year} | Khổ ${report.pageSize} ngang | ${report.summary}`;
      const contextLines = wrap(period, usable, { size: 8.5 });
      textLines(contextLines, left, y, usable, { size: 8.5, leading: 12 });
      y += contextLines.length * 12 + 4;
      if (subtitle) {
        const lines = wrap(subtitle, usable, { size: 8 });
        textLines(lines, left, y, usable, { size: 8, leading: 11, color: "#475569" });
        y += lines.length * 11 + 4;
      }
      if (report.note) {
        const lines = wrap(report.note, usable, { size: 8 });
        textLines(lines, left, y, usable, { size: 8, leading: 11, color: "#475569" });
        y += lines.length * 11 + 7;
      }
      const headingCells = columns.map((column, index) => wrap(column.label, widths[index] - padding * 2, { bold: true, size: 8.2 }));
      const height = Math.max(...headingCells.map((lines) => lines.length)) * lineHeight + padding * 2;
      drawCells(headingCells, height, { header: true });
      bodyTop = y;
      bodyCapacity = bottom - bodyTop;
      if (bodyCapacity < 80) throw new Error("Accounting PDF heading leaves insufficient room for table data");
    }

    function drawCells(lines, height, { header = false, total = false, stripe = false } = {}) {
      let x = left;
      const fill = header ? "#e5eff8" : total ? "#e8f2eb" : stripe ? "#f5f8fb" : "#ffffff";
      columns.forEach((column, index) => {
        doc.rect(x, y, widths[index], height).fillAndStroke(fill, "#c9d5df");
        textLines(lines[index] || [], x + padding, y + padding, widths[index] - padding * 2, {
          bold: header || total, size: header ? 8.2 : fontSize,
          align: index === 0 ? "center" : column.numeric && !header ? "right" : "left",
        });
        x += widths[index];
      });
      y += height;
    }

    function detailLines(text, numberLabel) {
      if (!text) return;
      const usable = doc.page.width - left * 2;
      const prefix = numberLabel ? `Chi tiết dòng ${numberLabel}: ` : "";
      const lines = wrap(prefix + text, usable - padding * 2, { size: 7.8 });
      let offset = 0;
      while (offset < lines.length) {
        if (bottom - y < 20) newPage();
        const available = Math.max(1, Math.floor((bottom - y - padding * 2) / 10.8));
        const part = lines.slice(offset, offset + available);
        const height = part.length * 10.8 + padding * 2;
        doc.rect(left, y, usable, height).fillAndStroke("#fbfcfe", "#c9d5df");
        textLines(part, left + padding, y + padding, usable - padding * 2, { size: 7.8, leading: 10.8, color: "#475569" });
        y += height;
        offset += part.length;
        if (offset < lines.length) {
          newPage();
          const label = [`Chi tiết dòng ${numberLabel || "tổng hợp"} (tiếp)`];
          textLines(label, left + padding, y + 2, usable - padding * 2, { bold: true, size: 8 });
          y += 17;
        }
      }
    }

    function drawRecord(record, stripe = false) {
      const values = [record.number || "", ...record.cells];
      const lines = values.map((value, index) => wrap(value, widths[index] - padding * 2, { bold: record.isTotal }));
      const maxLines = Math.max(...lines.map((value) => value.length));
      const fullHeight = maxLines * lineHeight + padding * 2;
      const detailReserve = record.details
        ? wrap(`Chi tiết dòng ${record.number}: ${record.details}`, doc.page.width - left * 2 - padding * 2, { size: 7.8 }).length * 10.8 + padding * 2
        : 0;
      if (fullHeight + detailReserve <= bodyCapacity && y + fullHeight + detailReserve > bottom) newPage();
      let offset = 0;
      while (offset < maxLines) {
        if (bottom - y < lineHeight + padding * 2) newPage();
        const capacity = Math.max(1, Math.floor((bottom - y - padding * 2) / lineHeight));
        const count = Math.min(maxLines - offset, capacity);
        const cells = lines.map((value, index) => {
          if (!offset) return value.slice(0, count);
          if (index === 0) return wrap(`${record.number || ""}\n(tiếp)`, widths[0] - padding * 2);
          // Repeat short identifying cells on continued portions of an unusually long record.
          return value.length <= count && !columns[index].numeric ? value : value.slice(offset, offset + count);
        });
        const drawnLines = Math.max(count, ...cells.map((cell) => cell.length));
        const height = drawnLines * lineHeight + padding * 2;
        if (height > bottom - y + 0.1) { newPage(); continue; }
        drawCells(cells, height, { total: record.isTotal, stripe });
        offset += count;
        if (offset < maxLines) newPage();
      }
      detailLines(record.details, record.number);
    }

    try {
      newPage();
      if (!report.records.length) {
        textLines(["Không có dữ liệu trong kỳ này."], left + padding, y + 12, doc.page.width - left * 2, { size: 10 });
      } else {
        report.records.forEach((record, index) => drawRecord(record, index % 2 === 1));
        report.totals.forEach((record) => drawRecord(record));
      }
      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page += 1) {
        doc.switchToPage(page);
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const usable = doc.page.width - left * 2;
        const footerY = doc.page.height - 26;
        doc.moveTo(left, footerY - 7).lineTo(doc.page.width - left, footerY - 7).strokeColor("#c9d5df").stroke();
        const author = report.author ? ` | Người tạo dữ liệu: ${report.author}` : "";
        textLines([`GoViet247 | Q${quarter}/${year}${author}`], left, footerY, usable - 100, { size: 7.3, color: "#64748b" });
        textLines([`Trang ${page - range.start + 1}/${range.count}`], doc.page.width - left - 95, footerY, 95, { size: 8, align: "right", color: "#475569" });
        doc.page.margins.bottom = originalBottomMargin;
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
