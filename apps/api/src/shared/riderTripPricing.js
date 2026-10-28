import { destinationSessionText, vnTime } from './destinationService.js';
export function riderPackageLines(snapshot) {
  if (snapshot?.eligible !== true) return [];
  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  const selected = new Map(sessions.map(session => [session.date, session]));
  const days = Array.isArray(snapshot.days) ? snapshot.days : [];
  if (days.length) return days.map(day => {
    const session = selected.get(day.date);
    return session ? `${day.date}: ${snapshot.charterName} · ${destinationSessionText(session)}`
      : `${day.date}: ${snapshot.standardName}${day.standardStart ? ' · ' + vnTime(day.standardStart) + '–' + vnTime(day.standardEnd) : ''}`;
  });
  if (!sessions.length) return snapshot.standardName ? [snapshot.standardName] : [];
  return sessions.map(session => `${session.date}: ${snapshot.charterName} · ${destinationSessionText(session)}`);
}
