import type { calendar_v3 } from "googleapis";

export interface GoogleCalendarEventsResource {
  insert(
    params: calendar_v3.Params$Resource$Events$Insert,
  ): Promise<{ data: calendar_v3.Schema$Event }>;
  get(
    params: calendar_v3.Params$Resource$Events$Get,
  ): Promise<{ data: calendar_v3.Schema$Event }>;
  patch(
    params: calendar_v3.Params$Resource$Events$Patch,
  ): Promise<{ data: calendar_v3.Schema$Event }>;
  delete(
    params: calendar_v3.Params$Resource$Events$Delete,
  ): Promise<{ data: unknown }>;
  list(
    params: calendar_v3.Params$Resource$Events$List,
  ): Promise<{ data: calendar_v3.Schema$Events }>;
}

export interface GoogleCalendarClient {
  events: GoogleCalendarEventsResource;
}

export interface GoogleCalendarGatewayOptions {
  defaultCalendarId?: string;
}
