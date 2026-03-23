import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { registerGoogleCalendarTools } from "./tools/index.js";

export default definePluginEntry({
  id: "openclaw-google-calendar",
  name: "OpenClaw Google Calendar",
  register(api) {
    // Scaffold only: the plugin entry exists so the repo matches OpenClaw's
    // native plugin layout before the Google Calendar runtime is implemented.
    registerGoogleCalendarTools(api);
  },
});
