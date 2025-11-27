import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

if (!process.env.ENCRYPTION_KEY) {
  console.warn(
    "WARNING: ENCRYPTION_KEY not set. Using random key that will change on restart. " +
      "Set ENCRYPTION_KEY environment variable for production use."
  );
}

function getEncryptionKey(): Buffer {
  const keyHex = ENCRYPTION_KEY.trim();

  if (keyHex.length < 64) {
    throw new Error(
      `ENCRYPTION_KEY must be at least 64 hex characters (32 bytes). ` +
        `Current length: ${keyHex.length}. Generate with: openssl rand -hex 32`
    );
  }

  const keyBytes = Buffer.from(keyHex.slice(0, 64), "hex");

  if (keyBytes.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY length. Expected 32 bytes (64 hex chars), got ${keyBytes.length} bytes.`
    );
  }

  return keyBytes;
}

const IV_LENGTH = 16;

export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error: any) {
    if (error.message.includes("ENCRYPTION_KEY")) {
      throw error;
    }
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error: any) {
    if (error.message.includes("ENCRYPTION_KEY")) {
      throw error;
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

const MAX_QUERY_LENGTH = 10000;
const MAX_INPUT_LENGTH = 255;

export function validateQuery(query: string): {
  valid: boolean;
  error?: string;
} {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query is required" };
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
    };
  }

  const trimmedQuery = query.trim().toUpperCase();

  const allowedKeywords = [
    "SELECT",
    "WITH",
    "FROM",
    "WHERE",
    "JOIN",
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
    "OUTER",
    "ON",
    "GROUP",
    "BY",
    "HAVING",
    "ORDER",
    "LIMIT",
    "OFFSET",
    "AS",
    "AND",
    "OR",
    "NOT",
    "IN",
    "EXISTS",
    "LIKE",
    "ILIKE",
    "IS",
    "NULL",
    "DISTINCT",
    "COUNT",
    "SUM",
    "AVG",
    "MAX",
    "MIN",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
  ];

  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "CALL",
    "COPY",
    "\\COPY",
  ];

  for (const keyword of dangerousKeywords) {
    if (trimmedQuery.includes(keyword)) {
      return {
        valid: false,
        error: `Query contains prohibited keyword: ${keyword}. Only SELECT queries are allowed.`,
      };
    }
  }

  if (!trimmedQuery.startsWith("SELECT") && !trimmedQuery.startsWith("WITH")) {
    return {
      valid: false,
      error: "Only SELECT queries are allowed",
    };
  }

  return { valid: true };
}

export function validateInput(
  input: string,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof input !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
    };
  }

  return { valid: true };
}

export function sanitizeError(error: any): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("password") ||
      message.includes("authentication") ||
      message.includes("permission") ||
      message.includes("access denied") ||
      message.includes("syntax error")
    ) {
      return "Database operation failed. Please check your connection and try again.";
    }

    return "An error occurred while processing your request.";
  }

  return "An unexpected error occurred.";
}
