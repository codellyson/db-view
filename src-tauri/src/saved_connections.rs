// Phase 5 storage for saved connections.
//
// The SaaS persists these in an encrypted httpOnly cookie; on desktop we put
// them in the OS keychain (Keychain on macOS, Credential Manager on Windows,
// Secret Service on Linux). One keychain entry holds the full JSON list —
// listing, saving, and deleting are all read-modify-write of that single
// entry. Atomic enough for a single-user desktop app, and avoids needing a
// separate index file in the app data dir.

use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::postgres::DbConfig;

const SERVICE: &str = "com.kreativekorna.justdb";
const ACCOUNT: &str = "saved-connections";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub config: DbConfig,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "lastUsed", default, skip_serializing_if = "Option::is_none")]
    pub last_used: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ClientSavedConnection {
    pub id: String,
    pub name: String,
    pub config: ClientConfig,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "lastUsed", default, skip_serializing_if = "Option::is_none")]
    pub last_used: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ClientConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    // Always blank — passwords never leave the keychain in the GET path.
    pub password: String,
    pub ssl: bool,
}

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("keychain: {e}"))
}

pub fn list_full() -> Result<Vec<SavedConnection>, String> {
    let e = entry()?;
    match e.get_password() {
        Ok(json) => serde_json::from_str(&json).map_err(|err| format!("parse: {err}")),
        Err(keyring::Error::NoEntry) => Ok(vec![]),
        Err(err) => Err(format!("keychain read: {err}")),
    }
}

pub fn list_sanitized() -> Result<Vec<ClientSavedConnection>, String> {
    Ok(list_full()?.iter().map(sanitize).collect())
}

fn write_all(conns: &[SavedConnection]) -> Result<(), String> {
    let e = entry()?;
    if conns.is_empty() {
        match e.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(format!("keychain delete: {err}")),
        }
    } else {
        let json = serde_json::to_string(conns).map_err(|err| format!("serialize: {err}"))?;
        e.set_password(&json)
            .map_err(|err| format!("keychain write: {err}"))
    }
}

pub fn save(id: String, name: String, config: DbConfig) -> Result<ClientSavedConnection, String> {
    let mut conns = list_full()?;
    let new = SavedConnection {
        id: id.clone(),
        name,
        config,
        created_at: now_millis(),
        last_used: None,
    };
    // Upsert by id — duplicates would be a UI bug, but writing once is safer.
    if let Some(existing) = conns.iter_mut().find(|c| c.id == id) {
        *existing = new.clone();
    } else {
        conns.push(new.clone());
    }
    write_all(&conns)?;
    Ok(sanitize(&new))
}

pub fn delete(id: &str) -> Result<(), String> {
    let conns = list_full()?;
    let remaining: Vec<SavedConnection> = conns.into_iter().filter(|c| c.id != id).collect();
    write_all(&remaining)
}

pub fn get(id: &str) -> Result<Option<SavedConnection>, String> {
    Ok(list_full()?.into_iter().find(|c| c.id == id))
}

// Best-effort timestamp bump on connect. Errors don't fail the connect.
pub fn mark_used(id: &str) {
    let Ok(mut conns) = list_full() else { return };
    let Some(c) = conns.iter_mut().find(|c| c.id == id) else { return };
    c.last_used = Some(now_millis());
    let _ = write_all(&conns);
}

fn sanitize(c: &SavedConnection) -> ClientSavedConnection {
    ClientSavedConnection {
        id: c.id.clone(),
        name: c.name.clone(),
        config: ClientConfig {
            host: c.config.host.clone(),
            port: c.config.port,
            database: c.config.database.clone(),
            username: c.config.username.clone(),
            password: String::new(),
            ssl: c.config.ssl,
        },
        created_at: c.created_at,
        last_used: c.last_used,
    }
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
