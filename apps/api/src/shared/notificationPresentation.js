export function sortNotifications(items) {
  const time = item => Date.parse(item.createdAt || '') || 0;
  return [...items].sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
    || time(b) - time(a));
}
