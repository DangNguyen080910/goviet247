// Path: goviet247/apps/web/src/pages/admin/AdminCashTransactions.jsx
import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Stack,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Snackbar,
  Alert,
} from "@mui/material";

import {
  fetchCompanyCashTransactions,
  fetchCompanyCashSummary,
  createCompanyCashTransaction,
  deleteCompanyCashTransaction,
  exportCompanyCashTransactions,
} from "../../api/adminCashTransactions";

// ================= ENUM =================
const TYPE_OPTIONS = [
  { value: "IN", label: "Thu" },
  { value: "OUT", label: "Chi" },
];

const CATEGORY_OPTIONS = [
  { value: "OWNER_CAPITAL", label: "Vốn cá nhân" },
  { value: "DRIVER_TOPUP", label: "Tài xế nạp ví" },
  { value: "COMMISSION_IN", label: "Hoa hồng" },
  { value: "OTHER_IN", label: "Thu khác" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AWS", label: "AWS" },
  { value: "SERVER", label: "Server" },
  { value: "SALARY", label: "Lương" },
  { value: "OPERATIONS", label: "Vận hành" },
  { value: "DRIVER_WITHDRAW", label: "Rút tiền tài xế" },
  { value: "REFUND", label: "Hoàn tiền" },
  { value: "OTHER_OUT", label: "Chi khác" },
];

// ================= COMPONENT =================
export default function AdminCashTransactions() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    totalIn: 0,
    totalOut: 0,
    balance: 0,
  });

  const [form, setForm] = useState({
    txnDate: "",
    type: "IN",
    category: "OWNER_CAPITAL",
    amount: "",
    note: "",
    source: "",
  });

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState(null);

  // ================= LOAD DATA =================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [listRes, summaryRes] = await Promise.all([
        fetchCompanyCashTransactions(filters),
        fetchCompanyCashSummary(filters),
      ]);

      setItems(listRes.items || []);
      setSummary(summaryRes);
    } catch (err) {
      console.error(err);
      setSnackbar({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ================= HANDLERS =================
  const handleCreate = async () => {
    try {
      if (!form.txnDate || !form.amount) {
        setSnackbar({ type: "error", message: "Thiếu dữ liệu." });
        return;
      }

      await createCompanyCashTransaction({
        ...form,
        amount: Number(form.amount),
      });

      setSnackbar({ type: "success", message: "Đã thêm thu/chi." });

      setForm({
        txnDate: "",
        type: "IN",
        category: "OWNER_CAPITAL",
        amount: "",
        note: "",
        source: "",
      });

      loadData();
    } catch (err) {
      console.error(err);
      setSnackbar({ type: "error", message: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xoá dòng này?")) return;

    try {
      await deleteCompanyCashTransaction(id);
      setSnackbar({ type: "success", message: "Đã xoá." });
      loadData();
    } catch (err) {
      console.error(err);
      setSnackbar({ type: "error", message: err.message });
    }
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await exportCompanyCashTransactions(filters);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setSnackbar({ type: "error", message: err.message });
    }
  };

  // ================= UI =================
  return (
    <Box p={2}>
      <Typography variant="h5" mb={2}>
        Thu Chi Công Ty
      </Typography>

      {/* FILTER */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <TextField
              type="date"
              label="Từ ngày"
              InputLabelProps={{ shrink: true }}
              value={filters.fromDate}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  fromDate: e.target.value,
                }))
              }
            />

            <TextField
              type="date"
              label="Đến ngày"
              InputLabelProps={{ shrink: true }}
              value={filters.toDate}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  toDate: e.target.value,
                }))
              }
            />

            <Button variant="contained" onClick={loadData}>
              Lọc
            </Button>

            <Button variant="outlined" onClick={handleExport}>
              Export CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* SUMMARY */}
      <Stack direction="row" spacing={2} mb={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography>Tổng thu</Typography>
            <Typography color="green">
              {summary.totalIn.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography>Tổng chi</Typography>
            <Typography color="red">
              {summary.totalOut.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography>Chênh lệch</Typography>
            <Typography>{summary.balance.toLocaleString()}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* FORM */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <TextField
              type="date"
              label="Ngày"
              InputLabelProps={{ shrink: true }}
              value={form.txnDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, txnDate: e.target.value }))
              }
            />

            <TextField
              select
              label="Loại"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              {TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Nhóm"
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              {CATEGORY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Số tiền"
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />

            <TextField
              label="Nguồn"
              value={form.source}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: e.target.value }))
              }
            />

            <TextField
              label="Ghi chú"
              value={form.note}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
            />

            <Button variant="contained" onClick={handleCreate}>
              Thêm
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* TABLE */}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ngày</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Nhóm</TableCell>
              <TableCell>Số tiền</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell>Người tạo</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {new Date(row.txnDate).toLocaleDateString()}
                </TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.amount.toLocaleString()}</TableCell>
                <TableCell>{row.note}</TableCell>
                <TableCell>{row.createdByUsername}</TableCell>
                <TableCell>
                  <Button
                    color="error"
                    onClick={() => handleDelete(row.id)}
                  >
                    Xoá
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* SNACKBAR */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
      >
        {snackbar && (
          <Alert severity={snackbar.type}>{snackbar.message}</Alert>
        )}
      </Snackbar>
    </Box>
  );
}