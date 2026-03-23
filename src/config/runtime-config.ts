export type ConfirmationMode = "always" | "when-ambiguous" | "never";

export interface GoogleCalendarPluginConfig {
  credentialsPath?: string;
  tokenPath?: string;
  defaultCalendarId?: string;
  defaultTimeZone?: string;
  confirmationMode?: ConfirmationMode;
  upcomingWindowDays?: number;
  readOnlyMode?: boolean;
}

export const defaultGoogleCalendarPluginConfig: Required<
  Pick<
    GoogleCalendarPluginConfig,
    "defaultCalendarId" | "confirmationMode" | "upcomingWindowDays" | "readOnlyMode"
  >
> = {
  defaultCalendarId: "primary",
  confirmationMode: "when-ambiguous",
  upcomingWindowDays: 7,
  readOnlyMode: false,
};
