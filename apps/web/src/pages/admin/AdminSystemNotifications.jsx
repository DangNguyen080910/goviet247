// Path: goviet247/apps/web/src/pages/admin/AdminSystemNotifications.jsx
import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";

import {
  fetchSystemNotifications,
  createSystemNotification,
  updateSystemNotification,
  deleteSystemNotification,
} from "../../api/systemNotifications";

export default function AdminSystemNotifications() {
  const [tab, setTab] = useState("DRIVER");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [active, setActive] = useState(true);

  const [snack, setSnack] = useState({
    open: false,
    text: "",
    type: "success",
  });

  const showSnack = (text, type = "success") => {
    setSnack({ open: true, text, type });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchSystemNotifications({
        audience: tab,
      });
      setItems(data);
    } catch (err) {
      console.error(err);
      showSnack(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      showSnack("Vui lòng nhập đầy đủ tiêu đề và nội dung", "error");
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      await createSystemNotification({
        title: title.trim(),
        message: content.trim(),
        audience: tab,
        isActive: active,
      });

      showSnack(active ? "Đã gửi thông báo." : "Đã lưu thông báo ở trạng thái tắt, chưa gửi cho người nhận.");

      setTitle("");
      setContent("");
      setActive(true);

      loadData();
    } catch (err) {
      console.error(err);
      showSnack(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateSystemNotification(item.id, {
        isActive: !item.isActive,
      });

      showSnack("Cập nhật trạng thái thành công");
      loadData();
    } catch (err) {
      console.error(err);
      showSnack(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (saving || !window.confirm(`Xoá thông báo “${item.title}”? Thao tác này không thể hoàn tác.`)) return;
    setSaving(true);
    try {
      await deleteSystemNotification(item.id);
      setItems(current => current.filter(row => row.id !== item.id));
      showSnack("Đã xoá thông báo.");
    } catch (err) {
      showSnack(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Thông Báo Hệ Thống
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="DRIVER" value="DRIVER" />
          <Tab label="RIDER" value="RIDER" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Tạo thông báo mới
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />

          <TextField
            label="Nội dung"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />

          <FormControlLabel
            control={
              <Switch
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            }
            label="Kích hoạt ngay"
          />

          <Button variant="contained" disabled={saving} onClick={handleCreate}>
            {active ? "GỬI THÔNG BÁO" : "LƯU THÔNG BÁO"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Danh sách thông báo
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : items.length === 0 ? (
          <Typography>Chưa có thông báo</Typography>
        ) : (
          <Stack spacing={2}>
            {items.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid #eee",
                  backgroundColor: item.isActive
                    ? "rgba(46,125,50,0.05)"
                    : "rgba(0,0,0,0.03)",
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>{item.title}</Typography>

                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, whiteSpace: "pre-line" }}
                >
                  {item.message}
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="caption">
                    {item.isActive ? "Đang hoạt động" : "Đã tắt"}
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        disabled={saving}
                        checked={item.isActive}
                        onChange={() => handleToggle(item)}
                      />
                    }
                    label="Bật/Tắt"
                  />
                  <Button color="error" disabled={saving} onClick={() => handleDelete(item)}>Xoá</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}