export interface CalendarIntegration {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date | string;
  lastSync: Date | string | null;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date | string;
  endTime: Date | string;
  lastUpdated: Date | string;
  attendees?: string[];
  isRecurring?: boolean;
} 