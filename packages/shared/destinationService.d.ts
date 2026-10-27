export const DEFAULT_DESTINATION_CONFIG: any;
export function destinationConfig(raw?: any): any;
export function destinationDescription(config: any, charter?: boolean): string;
export function destinationWindows(config: any, direction: string, pickup: any, returnTime: any, outboundMinutes: any): {date:string;start:string;end:string;hours:number}[];
export function destinationSummary(snapshot: any): string[];
export function vnDay(value: any): string;
export function vnTime(value: any): string;
