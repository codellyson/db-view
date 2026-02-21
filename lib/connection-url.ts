export interface ParsedConnectionURL {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

export function parseConnectionURL(url: string): ParsedConnectionURL {
  const trimmed = url.trim();

  const schemeMatch = trimmed.match(/^(postgresql|postgres|mysql):\/\//i);
  if (!schemeMatch) {
    throw new Error(
      "Invalid connection URL. Expected format: postgresql://user:pass@host:port/dbname"
    );
  }

  const parsed = new URL(trimmed);

  const host = parsed.hostname;
  if (!host) throw new Error("Host is required in connection URL");

  const defaultPort = schemeMatch[1].toLowerCase() === "mysql" ? 3306 : 5432;
  const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;

  const database = parsed.pathname.replace(/^\//, "");
  if (!database) throw new Error("Database name is required in connection URL");

  const username = decodeURIComponent(parsed.username);
  if (!username) throw new Error("Username is required in connection URL");

  const password = decodeURIComponent(parsed.password);

  const sslParam =
    parsed.searchParams.get("sslmode") || parsed.searchParams.get("ssl");
  let ssl: boolean | { rejectUnauthorized?: boolean } | undefined;
  if (
    sslParam === "require" ||
    sslParam === "true" ||
    sslParam === "verify-full"
  ) {
    ssl =
      sslParam === "verify-full" ? true : { rejectUnauthorized: false };
  } else if (sslParam === "disable" || sslParam === "false") {
    ssl = false;
  }

  return { host, port, database, username, password, ssl };
}

export function isConnectionURL(input: string): boolean {
  return /^(postgresql|postgres|mysql):\/\//i.test(input.trim());
}

export function detectDatabaseType(
  url: string
): "postgresql" | "mysql" {
  if (/^mysql:\/\//i.test(url.trim())) return "mysql";
  return "postgresql";
}
