import process from "node:process";

/**
 * Shared Discord application settings.
 *
 * These values are used by both Rich Presence and the Listen Along OAuth2
 * account linking flow. Keep them in one place so the application id can
 * never drift away from the redirect URI that belongs to it.
 *
 * Discord validates `redirect_uri` against the exact "Redirects" list of the
 * application in the Developer Portal:
 *   https://discord.com/developers/applications/<CLIENT_ID>/oauth2
 *
 * Any mismatch (host spelling, port, path or trailing slash) makes Discord
 * reject the request with "Invalid OAuth2 redirect_uri". Override the values
 * below with the NEXT_MUSIC_DISCORD_* environment variables when the portal
 * uses different ones instead of patching the source code.
 */

const DEFAULT_CLIENT_ID = "1573717978338431089";
const DEFAULT_REDIRECT_PORT = 51820;
const DEFAULT_REDIRECT_PATH = "/callback";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

function readEnv(name) {
	// Use an explicit node:process import: Vite/Rolldown rewrites a bare
	// `process.env` to `{}` in the main-process bundle, which would silently
	// disable every override in the packaged application.
	const value = process.env?.[name];

	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveClientId() {
	const configured = readEnv("NEXT_MUSIC_DISCORD_CLIENT_ID");

	if (configured && !/^\d{17,20}$/.test(configured)) {
		throw new Error(
			`Invalid NEXT_MUSIC_DISCORD_CLIENT_ID: ${configured} (expected a numeric Discord application id)`,
		);
	}

	return configured || DEFAULT_CLIENT_ID;
}

function resolveRedirectPort() {
	const configured = readEnv("NEXT_MUSIC_DISCORD_REDIRECT_PORT");

	if (configured && !/^\d{1,5}$/.test(configured)) {
		throw new Error(
			`Invalid NEXT_MUSIC_DISCORD_REDIRECT_PORT: ${configured} (expected 1-65535)`,
		);
	}

	const port = configured ? Number(configured) : DEFAULT_REDIRECT_PORT;

	if (port < 1 || port > 65535) {
		throw new Error(
			`Invalid NEXT_MUSIC_DISCORD_REDIRECT_PORT: ${configured} (expected 1-65535)`,
		);
	}

	return port;
}

export const DISCORD_CLIENT_ID = resolveClientId();

const REDIRECT_PORT = resolveRedirectPort();

const defaultRedirectUri = `http://127.0.0.1:${REDIRECT_PORT}${DEFAULT_REDIRECT_PATH}`;

export const DISCORD_REDIRECT_URI =
	readEnv("NEXT_MUSIC_DISCORD_REDIRECT_URI") || defaultRedirectUri;

let parsedRedirect;

try {
	parsedRedirect = new URL(DISCORD_REDIRECT_URI);
} catch {
	throw new Error(
		`Invalid NEXT_MUSIC_DISCORD_REDIRECT_URI: ${DISCORD_REDIRECT_URI} (expected an absolute http URL)`,
	);
}

if (parsedRedirect.protocol !== "http:") {
	throw new Error(
		`Invalid NEXT_MUSIC_DISCORD_REDIRECT_URI: ${DISCORD_REDIRECT_URI} (only http loopback URLs are supported)`,
	);
}

if (!LOOPBACK_HOSTNAMES.has(parsedRedirect.hostname)) {
	throw new Error(
		`Invalid NEXT_MUSIC_DISCORD_REDIRECT_URI: ${DISCORD_REDIRECT_URI} (host must be 127.0.0.1, localhost or [::1])`,
	);
}

/** Host the local callback server listens on, derived from the redirect URI. */
export const DISCORD_REDIRECT_HOST =
	parsedRedirect.hostname === "[::1]" ? "::1" : parsedRedirect.hostname;

/** Port the local callback server listens on, derived from the redirect URI. */
export const DISCORD_REDIRECT_PORT = Number(parsedRedirect.port) || 80;

/** Path the local callback server handles, derived from the redirect URI. */
export const DISCORD_REDIRECT_PATH =
	parsedRedirect.pathname || DEFAULT_REDIRECT_PATH;
