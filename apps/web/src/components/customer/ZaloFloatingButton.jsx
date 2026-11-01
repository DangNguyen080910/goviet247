import { useFloatingActions } from '../FloatingActionsContext';
import { Box, useMediaQuery } from "@mui/material";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { useEffect, useRef, useState } from "react";
import { getPublicSystemConfig } from "../../api/systemConfig";

const SIZE = 56;
const CHAT_SPACE = 64;
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
  // Reserve a separate row above support for the trip inbox.
  const minY = top + Math.min(88 + CHAT_SPACE, Math.max(CHAT_SPACE + 8, height - SIZE - 16));
  const footer = document.querySelector('[data-customer-footer]')?.getBoundingClientRect();
  const footerLimit = footer ? footer.top - SIZE - 16 : top + height - SIZE - 88;
  const maxY = Math.max(minY, Math.min(top + height - SIZE - 16, footerLimit));
  let x = Math.min(maxX, Math.max(minX, position?.x ?? maxX));
  if (snap) x = x < left + width / 2 ? minX : maxX;
  return { x, y: Math.min(maxY, Math.max(minY, position?.y ?? maxY)) };
}

export default function ZaloFloatingButton() {
  const {setDockTarget, dockDragRef} = useFloatingActions();
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
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    const footer = document.querySelector('[data-customer-footer]');
    if (footer) observer?.observe(footer);
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      active = false;
      observer?.disconnect();
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

  function startDrag(event) {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
            origin: position, position, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
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
  }
  function consumeClick(event) {
    const dragged = suppressClick.current && event.detail !== 0;
    suppressClick.current = false;
    if (dragged) {event.preventDefault();event.stopPropagation();}
    return dragged;
  }
  dockDragRef.current = {startDrag,moveDrag,finish,consumeClick};

  if (!phone) return null;
  const onLeft = position.x < window.innerWidth / 2;
  return (
    <Box sx={{ position: "fixed", left: position.x, top: position.y,
      width: SIZE, height: SIZE, zIndex: (theme) => theme.zIndex.drawer + 5 }}>
      <Box ref={setDockTarget} data-trip-chat-dock sx={{position:'absolute',bottom:SIZE+12,
        ...(onLeft ? {left:0} : {right:0}),width:'max-content',maxWidth:'calc(100vw - 32px)'}} />
      {showHint && (
        <Box sx={{ position: "absolute", bottom: 8,
          ...(onLeft ? { left: SIZE + 12 } : { right: SIZE + 12 }),
          whiteSpace: "nowrap", pointerEvents: "none", bgcolor: "#111827", color: "white",
          px: 1.5, py: 1, borderRadius: 3, fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 16px #0002" }}>Bạn cần hỗ trợ?</Box>
      )}
      <Box component="a" href={`https://zalo.me/${phone}`} target="_blank"
        rel="noopener noreferrer" aria-label="Hỗ trợ GoViet247 qua Zalo (có thể kéo để di chuyển)"
        title="Hỗ trợ GoViet247" draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onClick={consumeClick}
        sx={{ width: SIZE, height: SIZE, display: "flex", alignItems: "center",
          justifyContent: "center", flexDirection: "column", gap: "2px", borderRadius: "50%", bgcolor: "#0068ff", color: "white",
          touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
          cursor: dragging ? "grabbing" : "grab", boxShadow: "0 6px 20px #0068ff40",
          animation: reduceMotion || dragging ? "none" : "supportPulse 3.6s ease-in-out infinite",
          "@keyframes supportPulse": { "0%, 70%, 100%": { transform: "scale(1)" },
            "80%": { transform: "scale(1.06)" }, "90%": { transform: "scale(1)" } },
          "&:focus-visible": { outline: "3px solid #F97316", outlineOffset: 4 },
          "&:hover": { bgcolor: "#0057d9" } }}>
        <SupportAgentIcon sx={{ fontSize: 24, pointerEvents: "none" }} />
        <Box component="span" sx={{fontSize:10.5,lineHeight:1,fontWeight:800,pointerEvents:"none"}}>Hỗ trợ</Box>
      </Box>
    </Box>
  );
}
