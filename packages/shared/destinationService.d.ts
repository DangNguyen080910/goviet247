export const DEFAULT_DESTINATION_CONFIG: any;
export function destinationConfig(raw?: any): any;
export function destinationDescription(config: any, charter?: boolean): string;
export function destinationWindows(config: any, direction: string, pickup: any, returnTime: any, outboundMinutes: any): {date:string;start:string;end:string;hours:number}[];
export function destinationSummary(snapshot: any): string[];
export function vnDay(value: any): string;
export function vnTime(value: any): string;
export type DestinationDay = { date: string; standardStart: string | null; standardEnd: string | null; charter: { date: string; start: string; end: string; hours: number; flexible: boolean; fee: number } | null };
export function destinationDays(config: any, direction: string, pickup: any, returnTime: any, outboundMinutes: any): DestinationDay[];
export function destinationDayText(day: DestinationDay, selected: boolean, config: any): string;

export function destinationSelectedFee(days: DestinationDay[], dates: string[]): number;
export function destinationSessionText(session: any): string;

export function destinationQuoteSummary(snapshot: any, config?: any): string[];
