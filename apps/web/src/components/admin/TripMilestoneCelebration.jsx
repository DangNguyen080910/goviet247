import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";

const key = "goviet247:seen-trip-milestones";
export default function TripMilestoneCelebration({ milestones = [] }) {
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const current = milestones.find(item => !seen.includes(item.id));
  function dismiss() {
    const next = [...seen, current.id];
    setSeen(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Still dismiss for this session. */ }
  }
  useEffect(() => {
    function sync(event) {
      if (event.key === key) { try { setSeen(JSON.parse(event.newValue || "[]")); } catch {} }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return <Dialog open={Boolean(current)} onClose={dismiss} fullWidth maxWidth="sm">
    <DialogTitle sx={{ textAlign: "center", color: "#00695c", fontWeight: 800 }}>🎉 GoViet247 sắp đạt mốc mới!</DialogTitle>
    <DialogContent sx={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes milestoneFall { from { transform: translateY(-30px) rotate(0deg); opacity:1 } to { transform:translateY(320px) rotate(300deg); opacity:0 } } @media (prefers-reduced-motion: reduce) { .milestoneConfetti { animation:none !important; display:none; } }`}</style>
      {current && Array.from({ length: 28 }, (_, i) => <Box key={`${current.id}-${i}`} aria-hidden className="milestoneConfetti" sx={{ pointerEvents:"none", position:"absolute", top:0, left:`${i * 3.6}%`, width:9, height:15, bgcolor:["#ff9800", "#26a69a", "#ec407a", "#42a5f5"][i%4], animation:`milestoneFall 2.5s ${i%5 * 0.15}s 2 both` }} />)}
      <Typography sx={{ fontSize: 52, my: 2 }}>🎊</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{current?.message}</Typography>
      <Typography color="text.secondary" sx={{ mt: 2 }}>Đây là thông báo chuẩn bị mốc chuyến. Admin tự xem xét phần thưởng; chuyến và thanh toán vẫn xử lý bình thường.</Typography>
      <Button variant="contained" onClick={dismiss} sx={{ mt: 3 }}>Đã biết — cùng chờ mốc mới!</Button>
    </DialogContent>
  </Dialog>;
}
