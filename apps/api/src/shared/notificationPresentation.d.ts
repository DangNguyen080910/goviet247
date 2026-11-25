export function sortNotifications<T extends { id: string; isPinned?: boolean; createdAt?: string | Date | null }>(items: T[]): T[];
