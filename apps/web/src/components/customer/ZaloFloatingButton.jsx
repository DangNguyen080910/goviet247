import { Box, useMediaQuery } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import { useEffect, useRef, useState } from "react";
import { getPublicSystemConfig } from "../../api/systemConfig";

const SIZE = 56;
const STORAGE_KEY = "goviet247-support-position";

// Keep the control inside the visible viewport, including when the keyboard opens.
function constrain(position, snap = false) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const minX = left + 16;
  const maxX = Math.max(minX, left + width - SIZE - 16);
  const minY = top + Math.min(88, Math.max(16, height - SIZE - 16));
  const maxY = Math.max(minY, top + height - SIZE - 88);
  let x = Math.min(maxX, Math.max(minX, position?.x ?? maxX));
  if (snap) x = x < left + width / 2 ? minX : maxX;
  return { x, y: Math.min(maxY, Math.max(minY, position?.y ?? maxY)) };
}

export default function ZaloFloatingButton() {
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState(() => {
    // Desktop starts on the right, even if a mobile position was saved.
    if (window.innerWidth >= 900) return constrain();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return constrain(saved, true);
    } catch { /* Storage is optional. */ }
    return constrain();
  });
  const [showHint, setShowHint] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    let active = true;
    getPublicSystemConfig().then((config) => {
      const digits = String(config?.supportPhoneRider || "").replace(/\D/g, "");
      if (active) {
        setPhone(digits.startsWith("0") ? `84${digits.slice(1)}` : digits);
        setShowHint(Boolean(digits));
      }
    }).catch((error) => console.error("Load Zalo config failed:", error));
    let wasDesktop = window.innerWidth >= 900;
    const resize = () => {
      const isDesktop = window.innerWidth >= 900;
      const enteredDesktop = isDesktop && !wasDesktop;
      wasDesktop = isDesktop;
      setPosition((current) => enteredDesktop ? constrain() : constrain(current, true));
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      active = false;
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, []);

  useEffect(() => {
    if (!phone) return;
    const timer = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(timer);
  }, [phone]);

  function finish(event) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (current.moved) {
      const next = constrain(current.position, true);
      setPosition(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional. */ }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!phone) return null;
  const onLeft = position.x < window.innerWidth / 2;
  return (
    <Box sx={{ position: "fixed", left: position.x, top: position.y,
      width: SIZE, height: SIZE, zIndex: (theme) => theme.zIndex.drawer + 5 }}>
      {showHint && (
        <Box sx={{ position: "absolute", bottom: SIZE + 12,
          ...(onLeft ? { left: 0 } : { right: 0 }),
          whiteSpace: "nowrap", pointerEvents: "none", bgcolor: "#111827", color: "white",
          px: 1.5, py: 1, borderRadius: 3, fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 16px #0002" }}>Bạn cần hỗ trợ?</Box>
      )}
      <Box component="a" href={`https://zalo.me/${phone}`} target="_blank"
        rel="noopener noreferrer" aria-label="Nhắn Zalo hỗ trợ (có thể kéo để di chuyển)"
        title="Nhắn Zalo hỗ trợ" draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
            origin: position, position, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current || current.id !== event.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.moved && Math.hypot(dx, dy) < 6) return;
          current.moved = true;
          suppressClick.current = true;
          setDragging(true);
          setShowHint(false);
          current.position = constrain({ x: current.origin.x + dx, y: current.origin.y + dy });
          setPosition(current.position);
        }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onClick={(event) => {
          if (suppressClick.current && event.detail !== 0) event.preventDefault();
          suppressClick.current = false;
        }}
        sx={{ width: SIZE, height: SIZE, display: "flex", alignItems: "center",
          justifyContent: "center", borderRadius: "50%", bgcolor: "#0068ff", color: "white",
          touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
          cursor: dragging ? "grabbing" : "grab", boxShadow: "0 6px 20px #0068ff40",
          animation: reduceMotion || dragging ? "none" : "supportPulse 3.6s ease-in-out infinite",
          "@keyframes supportPulse": { "0%, 70%, 100%": { transform: "scale(1)" },
            "80%": { transform: "scale(1.06)" }, "90%": { transform: "scale(1)" } },
          "&:focus-visible": { outline: "3px solid #F97316", outlineOffset: 4 },
          "&:hover": { bgcolor: "#0057d9" } }}>
        <ChatIcon sx={{ fontSize: 28, pointerEvents: "none" }} />
      </Box>
    </Box>
  );
}
