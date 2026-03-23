# Local Installation

This guide describes the current local-repository installation flow for the OpenClaw Google Calendar plugin.

The flow is designed for local development first, following the current OpenClaw plugin model:

- install the plugin from a local folder
- restart the Gateway so the plugin is loaded
- configure the plugin under `plugins.entries.openclaw-google-calendar.config`
- complete the Google auth flow
- validate the install before relying on the plugin

If your OpenClaw Gateway runs on another machine, install and configure this plugin on the machine running the Gateway.

## Prerequisites

Before installing the plugin, make sure you have:

- OpenClaw installed and a working Gateway
- Node.js available for this repository
- a Google Cloud OAuth client credentials JSON file for Calendar access
- permission to write local token files for the plugin

## 1. Install Repo Dependencies

From this repository:

```powershell
npm install
```

This plugin depends on local `node_modules` when OpenClaw loads it from a folder.

## 2. Install The Plugin Into OpenClaw

Choose one of these local install modes.

Copy install:

```powershell
openclaw plugins install .
```

Linked install for development:

```powershell
openclaw plugins install -l .
```

The linked mode is usually the better choice while iterating on this repository.

## 3. Restart The Gateway

After installing the plugin, restart the Gateway so OpenClaw loads the plugin:

```powershell
openclaw gateway restart
```

## 4. Configure The Plugin

Configure the plugin under `plugins.entries.openclaw-google-calendar.config`.

You can start from [`examples/openclaw.config.example.jsonc`](../examples/openclaw.config.example.jsonc).

The main fields are:

- `credentialsPath`
- `tokenPath`
- `oauthRedirectUri`
- `defaultCalendarId`
- `defaultTimeZone`
- `confirmationMode`
- `upcomingWindowDays`
- `readOnlyMode`

Example:

```jsonc
{
  "plugins": {
    "entries": {
      "openclaw-google-calendar": {
        "enabled": true,
        "config": {
          "credentialsPath": "./secrets/google-oauth-client.json",
          "tokenPath": "./secrets/google-calendar-token.json",
          "oauthRedirectUri": "http://127.0.0.1:3000/oauth2callback",
          "defaultCalendarId": "primary",
          "defaultTimeZone": "America/Los_Angeles",
          "confirmationMode": "when-ambiguous",
          "upcomingWindowDays": 7,
          "readOnlyMode": false
        }
      }
    }
  }
}
```

Optional environment-variable overrides are documented in [`.env.example`](../.env.example).

## 5. Validate The Plugin Install

Use the OpenClaw plugin CLI to confirm the install:

```powershell
openclaw plugins list
openclaw plugins info openclaw-google-calendar
openclaw plugins doctor
openclaw gateway status
```

Useful checks:

- the plugin appears in `openclaw plugins list`
- `openclaw plugins info openclaw-google-calendar` resolves the manifest correctly
- `openclaw plugins doctor` does not report install or manifest problems
- the Gateway is running after restart

## 6. Complete Google Authorization

Once the plugin is installed and configured, start the OAuth flow through the plugin tools:

1. Run `google_calendar_begin_auth`
2. Open the returned Google authorization URL
3. Grant access to the Google account you want this plugin to use
4. Copy the returned authorization code
5. Run `google_calendar_complete_auth` with that code

After auth completes, the plugin should store tokens at `tokenPath`.

## 7. First-Run Functional Checks

After authorization, these are good first checks:

- use `google_calendar_list_upcoming_events`
- ask for the next meeting with `google_calendar_find_next_meeting`
- create a low-risk test event with `google_calendar_create_event`
- verify confirmation behavior by repeating a write only after you explicitly confirm it

If you want to avoid writes during setup, enable `readOnlyMode` first and validate the read-only tools before turning writes on.

## Troubleshooting

If something looks wrong:

- verify that `npm install` ran successfully in this repository
- verify that `credentialsPath` points to a real Google OAuth client credentials file
- verify that `tokenPath` points to a writable location
- rerun `openclaw plugins doctor`
- rerun `openclaw gateway restart`
- confirm that the plugin is installed on the same machine as the Gateway

If Google auth fails, restart the flow with `google_calendar_begin_auth` and use a fresh code with `google_calendar_complete_auth`.
