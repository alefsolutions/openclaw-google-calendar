import {
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

import { google } from "googleapis";

import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import {
  AuthenticationRequiredError,
  PluginConfigurationError,
} from "../../shared/errors.js";
import { normalizeGoogleCalendarError } from "../../shared/google-calendar-error.js";
import type { GoogleCalendarClient } from "./google-calendar-client.js";
import { createGoogleCalendarApiClient } from "./google-calendar-api-client.js";
import { getGoogleCalendarScopes } from "./google-calendar-scopes.js";

export interface GoogleStoredOAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}

export interface GoogleOAuthClientLike {
  generateAuthUrl(options: {
    access_type: "offline";
    scope: string[];
    prompt: "consent";
    include_granted_scopes: boolean;
  }): string;
  getToken(
    code: string,
  ): Promise<{ tokens?: GoogleStoredOAuthTokens } | GoogleStoredOAuthTokens>;
  setCredentials(tokens: GoogleStoredOAuthTokens): void;
  on(event: "tokens", listener: (tokens: GoogleStoredOAuthTokens) => void): void;
}

export interface GoogleCalendarAuthService {
  createAuthorizationUrl(): Promise<GoogleCalendarAuthorizationRequest>;
  exchangeCodeForToken(code: string): Promise<GoogleStoredTokenMetadata>;
  hasStoredToken(): Promise<boolean>;
  createAuthenticatedCalendarClient(): Promise<GoogleCalendarClient>;
}

export interface GoogleCalendarAuthorizationRequest {
  authorizationUrl: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface GoogleStoredTokenMetadata {
  tokenPath: string;
  hasRefreshToken: boolean;
  scope?: string;
  expiryDate?: number;
}

export interface GoogleCalendarAuthServiceDependencies {
  oauthClientFactory?: (credentials: GoogleOAuthClientCredentials) => GoogleOAuthClientLike;
  calendarClientFactory?: (auth: GoogleOAuthClientLike) => GoogleCalendarClient;
}

interface GoogleOAuthClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleCredentialsFileShape {
  installed?: GoogleCredentialsSection;
  web?: GoogleCredentialsSection;
}

interface GoogleCredentialsSection {
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

// This service keeps credential parsing, token persistence, and OAuth client
// setup in one place so the rest of the plugin never has to handle raw secrets.
export function createGoogleCalendarAuthService(
  config: ResolvedGoogleCalendarPluginConfig,
  dependencies: GoogleCalendarAuthServiceDependencies = {},
): GoogleCalendarAuthService {
  return {
    async createAuthorizationUrl() {
      try {
        const credentials = await loadGoogleOAuthClientCredentials(config);
        const oauthClient = createOAuthClient(credentials, dependencies);
        const scopes = getGoogleCalendarScopes(config.readOnlyMode);

        return {
          authorizationUrl: oauthClient.generateAuthUrl({
            access_type: "offline",
            scope: [...scopes],
            prompt: "consent",
            include_granted_scopes: true,
          }),
          redirectUri: credentials.redirectUri,
          scopes,
        };
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "start Google Calendar authorization",
          phase: "authorization-url",
        });
      }
    },

    async exchangeCodeForToken(code: string) {
      try {
        const credentials = await loadGoogleOAuthClientCredentials(config);
        const oauthClient = createOAuthClient(credentials, dependencies);
        const tokenResponse = await oauthClient.getToken(code);
        const nextTokens = normalizeTokenResponse(tokenResponse);
        const storedTokens = await readStoredTokensIfPresent(config.tokenPath);
        const mergedTokens = mergeStoredTokens(storedTokens, nextTokens);
        const tokenPath = getRequiredConfiguredPath(
          config.tokenPath,
          "tokenPath is required for Google Calendar OAuth token storage.",
        );

        await writeStoredTokens(tokenPath, mergedTokens);

        return {
          tokenPath,
          hasRefreshToken: Boolean(mergedTokens.refresh_token),
          scope: normalizeOptionalString(mergedTokens.scope),
          expiryDate:
            typeof mergedTokens.expiry_date === "number"
              ? mergedTokens.expiry_date
              : undefined,
        };
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "complete Google Calendar authentication",
          phase: "token-exchange",
        });
      }
    },

    async hasStoredToken() {
      const tokens = await readStoredTokensIfPresent(config.tokenPath);
      return Boolean(tokens?.access_token || tokens?.refresh_token);
    },

    async createAuthenticatedCalendarClient() {
      try {
        const credentials = await loadGoogleOAuthClientCredentials(config);
        const tokenPath = getRequiredConfiguredPath(
          config.tokenPath,
          "tokenPath is required to create an authenticated Google Calendar client.",
        );
        const storedTokens = await readStoredTokensIfPresent(tokenPath);

        if (!storedTokens?.access_token && !storedTokens?.refresh_token) {
          throw new AuthenticationRequiredError(
            "Google Calendar is not authenticated yet. Complete the OAuth flow and store a token before using the plugin.",
          );
        }

        const oauthClient = createOAuthClient(credentials, dependencies);
        let currentTokens = storedTokens;

        oauthClient.setCredentials(currentTokens);
        oauthClient.on("tokens", (nextTokens) => {
          currentTokens = mergeStoredTokens(currentTokens, nextTokens);
          void writeStoredTokens(tokenPath, currentTokens);
        });

        return createCalendarClient(oauthClient, dependencies);
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "authenticate with Google Calendar",
          phase: "calendar-api",
        });
      }
    },
  };
}

export async function loadGoogleOAuthClientCredentials(
  config: Pick<
    ResolvedGoogleCalendarPluginConfig,
    "credentialsPath" | "oauthRedirectUri"
  >,
): Promise<GoogleOAuthClientCredentials> {
  const credentialsPath = getRequiredConfiguredPath(
    config.credentialsPath,
    "credentialsPath is required to load Google OAuth client credentials.",
  );
  const fileContents = await readFile(credentialsPath, "utf8");
  const parsedFile = safeParseJson<GoogleCredentialsFileShape>(
    fileContents,
    "Google OAuth client credentials",
  );
  const credentialSection = parsedFile.installed ?? parsedFile.web;

  if (!credentialSection) {
    throw new PluginConfigurationError(
      "The Google OAuth credentials file must contain either an 'installed' or 'web' section.",
    );
  }

  const clientId = normalizeOptionalString(credentialSection.client_id);
  const clientSecret = normalizeOptionalString(credentialSection.client_secret);
  const redirectUri =
    normalizeOptionalString(config.oauthRedirectUri) ??
    credentialSection.redirect_uris?.map(normalizeOptionalString).find(Boolean);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new PluginConfigurationError(
      "The Google OAuth credentials file must include client_id, client_secret, and at least one redirect URI.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function createOAuthClient(
  credentials: GoogleOAuthClientCredentials,
  dependencies: GoogleCalendarAuthServiceDependencies,
): GoogleOAuthClientLike {
  return (
    dependencies.oauthClientFactory?.(credentials) ??
    new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri,
    )
  );
}

function createCalendarClient(
  oauthClient: GoogleOAuthClientLike,
  dependencies: GoogleCalendarAuthServiceDependencies,
): GoogleCalendarClient {
  return (
    dependencies.calendarClientFactory?.(oauthClient) ??
    createGoogleCalendarApiClient(oauthClient)
  );
}

async function readStoredTokensIfPresent(
  tokenPath: string | undefined,
): Promise<GoogleStoredOAuthTokens | undefined> {
  if (!tokenPath) {
    return undefined;
  }

  try {
    const fileContents = await readFile(tokenPath, "utf8");
    return safeParseJson<GoogleStoredOAuthTokens>(
      fileContents,
      "Google OAuth token file",
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function writeStoredTokens(
  tokenPath: string,
  tokens: GoogleStoredOAuthTokens,
): Promise<void> {
  const sanitizedTokens = sanitizeStoredTokens(tokens);
  const tempFilePath = `${tokenPath}.tmp`;

  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tempFilePath, JSON.stringify(sanitizedTokens, null, 2), "utf8");
  await rename(tempFilePath, tokenPath);

  // Best effort file permissions keep local tokens less exposed on systems that
  // support POSIX-style modes. Windows may ignore or reject this.
  try {
    await chmod(tokenPath, 0o600);
  } catch {
    // Ignore permission-setting failures when the platform does not support them.
  }
}

function mergeStoredTokens(
  existingTokens: GoogleStoredOAuthTokens | undefined,
  nextTokens: GoogleStoredOAuthTokens,
): GoogleStoredOAuthTokens {
  return sanitizeStoredTokens({
    ...existingTokens,
    ...nextTokens,
    refresh_token: nextTokens.refresh_token ?? existingTokens?.refresh_token,
  });
}

function sanitizeStoredTokens(tokens: GoogleStoredOAuthTokens): GoogleStoredOAuthTokens {
  return {
    access_token: normalizeOptionalString(tokens.access_token),
    refresh_token: normalizeOptionalString(tokens.refresh_token),
    scope: normalizeOptionalString(tokens.scope),
    token_type: normalizeOptionalString(tokens.token_type),
    expiry_date:
      typeof tokens.expiry_date === "number" ? Math.trunc(tokens.expiry_date) : undefined,
  };
}

function normalizeTokenResponse(
  tokenResponse: { tokens?: GoogleStoredOAuthTokens } | GoogleStoredOAuthTokens,
): GoogleStoredOAuthTokens {
  if (hasWrappedTokens(tokenResponse)) {
    return tokenResponse.tokens ?? {};
  }

  return tokenResponse;
}

function getRequiredConfiguredPath(
  value: string | undefined,
  errorMessage: string,
): string {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    throw new PluginConfigurationError(errorMessage);
  }

  return normalizedValue;
}

function safeParseJson<TValue>(value: string, label: string): TValue {
  try {
    return JSON.parse(value) as TValue;
  } catch {
    throw new PluginConfigurationError(`${label} contains invalid JSON.`);
  }
}

function normalizeOptionalString(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT",
  );
}

function hasWrappedTokens(
  value: { tokens?: GoogleStoredOAuthTokens } | GoogleStoredOAuthTokens,
): value is { tokens?: GoogleStoredOAuthTokens } {
  return "tokens" in value;
}
