// Runtime configuration for the MEAAF server.
//
// Everything here is read from environment variables so the same build can run
// in "open" mode (no password, single local administrator) during rollout and in
// "password" mode later, without touching the code.

export type AuthMode = 'open' | 'password';

import fs from 'fs';
import path from 'path';

/**
 * Optional configuration file next to package.json:
 *
 *   { "authMode": "open", "appVersion": "1.0.0", "defaultTenantId": "tenant-001" }
 *
 * Environment variables always win over the file, so a deployment can override it without
 * editing anything on disk. A missing or malformed file is not an error: the defaults apply
 * and the reason is printed once.
 */
interface FileConfig {
  authMode?: string;
  appVersion?: string;
  defaultTenantId?: string;
  openAdminUsername?: string;
}

const CONFIG_FILE = path.resolve(process.cwd(), 'meaaf.config.json');

function readConfigFile(): FileConfig {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as FileConfig;
  } catch (err) {
    console.warn(
      `[MEAAF] تعذر قراءة meaaf.config.json (${err instanceof Error ? err.message : err}). ` +
        `سيتم تجاهله واستخدام القيم الافتراضية.`
    );
    return {};
  }
}

const fileConfig = readConfigFile();

const RAW_MODE = (process.env.MEAAF_AUTH_MODE || fileConfig.authMode || '').trim().toLowerCase();

/**
 * `open`     -> the application signs the operator in automatically as the system
 *               administrator. No login screen, no password prompt. This is the
 *               default because the product is currently deployed as a single
 *               workstation/desktop installation.
 * `password` -> classic username + BCrypt password login with role permissions.
 *
 * Any unrecognised value falls back to `open` and is reported on startup so a
 * typo can never silently lock everybody out of the system.
 */
export const AUTH_MODE: AuthMode = RAW_MODE === 'password' ? 'password' : 'open';

if (RAW_MODE && RAW_MODE !== 'open' && RAW_MODE !== 'password') {
  console.warn(
    `[MEAAF] MEAAF_AUTH_MODE="${process.env.MEAAF_AUTH_MODE}" غير معروف. ` +
      `القيم المقبولة: open | password. تم الاعتماد التلقائي على الوضع المفتوح (open).`
  );
}

/** True when the system runs without a password prompt. */
export function isOpenAuth(): boolean {
  return AUTH_MODE === 'open';
}

/** Tenant that owns the automatically provisioned administrator account. */
export const DEFAULT_TENANT_ID =
  process.env.MEAAF_DEFAULT_TENANT_ID || fileConfig.defaultTenantId || 'tenant-001';

/** Username of the automatically provisioned administrator account. */
export const OPEN_ADMIN_USERNAME =
  process.env.MEAAF_OPEN_ADMIN_USERNAME || fileConfig.openAdminUsername || 'admin';

/** Displayed in the status bar and the header. */
export const APP_VERSION = process.env.MEAAF_APP_VERSION || fileConfig.appVersion || '1.0.0';
