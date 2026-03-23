import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createGoogleCalendarAuthService } from "../.test-dist/src/infrastructure/google/google-calendar-auth.js";

test("createAuthorizationUrl uses the configured redirect URI and the read-only scope", async (t) => {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "openclaw-google-calendar-auth-"),
  );
  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const credentialsPath = path.join(tempDirectory, "credentials.json");
  await writeFile(
    credentialsPath,
    JSON.stringify({
      installed: {
        client_id: "client-id-1",
        client_secret: "client-secret-1",
        redirect_uris: ["http://127.0.0.1:9999/default"],
      },
    }),
    "utf8",
  );

  let receivedCredentials;
  const fakeOAuthClient = new FakeOAuthClient({
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=1",
  });
  const service = createGoogleCalendarAuthService(
    {
      credentialsPath,
      tokenPath: path.join(tempDirectory, "token.json"),
      oauthRedirectUri: "http://127.0.0.1:3000/oauth2callback",
      defaultCalendarId: "primary",
      confirmationMode: "when-ambiguous",
      upcomingWindowDays: 7,
      readOnlyMode: true,
    },
    {
      oauthClientFactory(credentials) {
        receivedCredentials = credentials;
        return fakeOAuthClient;
      },
    },
  );

  const authorizationRequest = await service.createAuthorizationUrl();

  assert.equal(
    receivedCredentials.redirectUri,
    "http://127.0.0.1:3000/oauth2callback",
  );
  assert.equal(
    authorizationRequest.authorizationUrl,
    "https://accounts.google.com/o/oauth2/v2/auth?mock=1",
  );
  assert.deepEqual(authorizationRequest.scopes, [
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ]);
  assert.equal(fakeOAuthClient.generatedAuthUrlOptions.access_type, "offline");
  assert.equal(fakeOAuthClient.generatedAuthUrlOptions.prompt, "consent");
});

test("exchangeCodeForToken stores tokens and preserves an existing refresh token", async (t) => {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "openclaw-google-calendar-auth-"),
  );
  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const credentialsPath = path.join(tempDirectory, "credentials.json");
  const tokenPath = path.join(tempDirectory, "secrets", "google-calendar-token.json");
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(
    credentialsPath,
    JSON.stringify({
      installed: {
        client_id: "client-id-2",
        client_secret: "client-secret-2",
        redirect_uris: ["http://127.0.0.1:3000/oauth2callback"],
      },
    }),
    "utf8",
  );
  await writeFile(
    tokenPath,
    JSON.stringify({
      refresh_token: "refresh-token-keep-me",
      access_token: "old-access-token",
    }),
    "utf8",
  );

  const fakeOAuthClient = new FakeOAuthClient({
    tokenResponse: {
      tokens: {
        access_token: "new-access-token",
        scope: "https://www.googleapis.com/auth/calendar.events",
        expiry_date: 123456789,
      },
    },
  });
  const service = createGoogleCalendarAuthService(
    {
      credentialsPath,
      tokenPath,
      defaultCalendarId: "primary",
      confirmationMode: "when-ambiguous",
      upcomingWindowDays: 7,
      readOnlyMode: false,
    },
    {
      oauthClientFactory() {
        return fakeOAuthClient;
      },
    },
  );

  const tokenMetadata = await service.exchangeCodeForToken("authorization-code-123");
  const storedTokenFile = JSON.parse(await readFile(tokenPath, "utf8"));

  assert.equal(fakeOAuthClient.receivedCode, "authorization-code-123");
  assert.equal(tokenMetadata.hasRefreshToken, true);
  assert.equal(tokenMetadata.scope, "https://www.googleapis.com/auth/calendar.events");
  assert.equal(storedTokenFile.access_token, "new-access-token");
  assert.equal(storedTokenFile.refresh_token, "refresh-token-keep-me");
});

test("createAuthenticatedCalendarClient loads stored tokens and returns the injected calendar client", async (t) => {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "openclaw-google-calendar-auth-"),
  );
  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const credentialsPath = path.join(tempDirectory, "credentials.json");
  const tokenPath = path.join(tempDirectory, "token.json");
  await writeFile(
    credentialsPath,
    JSON.stringify({
      installed: {
        client_id: "client-id-3",
        client_secret: "client-secret-3",
        redirect_uris: ["http://127.0.0.1:3000/oauth2callback"],
      },
    }),
    "utf8",
  );
  await writeFile(
    tokenPath,
    JSON.stringify({
      access_token: "stored-access-token",
      refresh_token: "stored-refresh-token",
      expiry_date: 1000,
    }),
    "utf8",
  );

  const fakeOAuthClient = new FakeOAuthClient();
  const fakeCalendarClient = {
    events: {
      insert: async () => ({ data: {} }),
      get: async () => ({ data: {} }),
      patch: async () => ({ data: {} }),
      delete: async () => ({ data: {} }),
      list: async () => ({ data: {} }),
    },
  };

  const service = createGoogleCalendarAuthService(
    {
      credentialsPath,
      tokenPath,
      defaultCalendarId: "primary",
      confirmationMode: "when-ambiguous",
      upcomingWindowDays: 7,
      readOnlyMode: false,
    },
    {
      oauthClientFactory() {
        return fakeOAuthClient;
      },
      calendarClientFactory(authClient) {
        assert.equal(authClient, fakeOAuthClient);
        return fakeCalendarClient;
      },
    },
  );

  const hasStoredToken = await service.hasStoredToken();
  const calendarClient = await service.createAuthenticatedCalendarClient();

  assert.equal(hasStoredToken, true);
  assert.deepEqual(fakeOAuthClient.credentialsSet, {
    access_token: "stored-access-token",
    refresh_token: "stored-refresh-token",
    expiry_date: 1000,
  });
  assert.equal(calendarClient, fakeCalendarClient);
});

test("refreshed OAuth tokens are persisted after the client is created", async (t) => {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "openclaw-google-calendar-auth-"),
  );
  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const credentialsPath = path.join(tempDirectory, "credentials.json");
  const tokenPath = path.join(tempDirectory, "token.json");
  await writeFile(
    credentialsPath,
    JSON.stringify({
      installed: {
        client_id: "client-id-4",
        client_secret: "client-secret-4",
        redirect_uris: ["http://127.0.0.1:3000/oauth2callback"],
      },
    }),
    "utf8",
  );
  await writeFile(
    tokenPath,
    JSON.stringify({
      access_token: "old-access-token",
      refresh_token: "refresh-token-4",
      expiry_date: 1,
    }),
    "utf8",
  );

  const fakeOAuthClient = new FakeOAuthClient();
  const service = createGoogleCalendarAuthService(
    {
      credentialsPath,
      tokenPath,
      defaultCalendarId: "primary",
      confirmationMode: "when-ambiguous",
      upcomingWindowDays: 7,
      readOnlyMode: false,
    },
    {
      oauthClientFactory() {
        return fakeOAuthClient;
      },
      calendarClientFactory() {
        return {
          events: {
            insert: async () => ({ data: {} }),
            get: async () => ({ data: {} }),
            patch: async () => ({ data: {} }),
            delete: async () => ({ data: {} }),
            list: async () => ({ data: {} }),
          },
        };
      },
    },
  );

  await service.createAuthenticatedCalendarClient();
  fakeOAuthClient.emitTokens({
    access_token: "fresh-access-token",
    expiry_date: 9999,
  });

  await waitFor(async () => {
    const storedTokenFile = JSON.parse(await readFile(tokenPath, "utf8"));
    assert.equal(storedTokenFile.access_token, "fresh-access-token");
    assert.equal(storedTokenFile.refresh_token, "refresh-token-4");
    assert.equal(storedTokenFile.expiry_date, 9999);
  });
});

test("createAuthenticatedCalendarClient throws a clear error when no token is stored yet", async (t) => {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "openclaw-google-calendar-auth-"),
  );
  t.after(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  const credentialsPath = path.join(tempDirectory, "credentials.json");
  await writeFile(
    credentialsPath,
    JSON.stringify({
      installed: {
        client_id: "client-id-5",
        client_secret: "client-secret-5",
        redirect_uris: ["http://127.0.0.1:3000/oauth2callback"],
      },
    }),
    "utf8",
  );

  const service = createGoogleCalendarAuthService({
    credentialsPath,
    tokenPath: path.join(tempDirectory, "missing-token.json"),
    defaultCalendarId: "primary",
    confirmationMode: "when-ambiguous",
    upcomingWindowDays: 7,
    readOnlyMode: false,
  });

  await assert.rejects(
    () => service.createAuthenticatedCalendarClient(),
    /not authenticated yet/i,
  );
});

class FakeOAuthClient {
  constructor(options = {}) {
    this.authorizationUrl =
      options.authorizationUrl ??
      "https://accounts.google.com/o/oauth2/v2/auth?mock=default";
    this.tokenResponse = options.tokenResponse ?? { tokens: {} };
    this.generatedAuthUrlOptions = undefined;
    this.receivedCode = undefined;
    this.credentialsSet = undefined;
    this.tokenListener = undefined;
  }

  generateAuthUrl(options) {
    this.generatedAuthUrlOptions = options;
    return this.authorizationUrl;
  }

  async getToken(code) {
    this.receivedCode = code;
    return this.tokenResponse;
  }

  setCredentials(tokens) {
    this.credentialsSet = tokens;
  }

  on(event, listener) {
    if (event === "tokens") {
      this.tokenListener = listener;
    }
  }

  emitTokens(tokens) {
    assert.ok(this.tokenListener, "Expected a tokens listener to be registered.");
    this.tokenListener(tokens);
  }
}

async function waitFor(assertion, attempts = 10, delayMs = 20) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
