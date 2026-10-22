export function formatCarType(value) {
  return { CAR_5: "Xe 5 chỗ", CAR_7: "Xe 7 chỗ", CAR_16: "Xe 16 chỗ" }[value] || value || "—";
}
