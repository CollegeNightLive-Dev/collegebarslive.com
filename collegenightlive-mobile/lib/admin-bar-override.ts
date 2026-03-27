/**
 * Admin-set bar override (Firestore: universities/.../bars/{id}.admin_bar_override).
 * Written only via setAdminBarOverride callable + server secret.
 */

export const ADMIN_BAR_OVERRIDE_DURATION_MS = 15 * 60 * 1000;

export interface AdminBarOverride {
  waitMinutes?: number;
  iconTypes?: string[];
  expiresAt: { toMillis(): number };
}

export type BarWithAlerts = {
  active_alerts?: Array<{ type: string; expiresAt?: { toMillis(): number } }>;
  admin_bar_override?: AdminBarOverride;
};

/** Alert types that can be shown on the map / list (same as map BAR_ALERT_TYPES). */
export const ADMIN_ICON_TYPES = [
  'security',
  'ambulance',
  'strict_bouncer',
  'vibe',
  'fire_music',
  'dead',
] as const;

export type AdminIconType = (typeof ADMIN_ICON_TYPES)[number];

export function isAdminBarOverrideExpired(override: AdminBarOverride | undefined): boolean {
  if (!override?.expiresAt) return true;
  const exp = override.expiresAt;
  const ms = typeof exp.toMillis === 'function' ? exp.toMillis() : 0;
  return Date.now() >= ms;
}

/** Dedup by type: crowd alerts first, then admin-only types. */
export function getMergedBarAlertTypes(bar: BarWithAlerts): string[] {
  const now = Date.now();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of bar.active_alerts ?? []) {
    if (!a?.type || !a.expiresAt || typeof a.expiresAt.toMillis !== 'function') continue;
    if (a.expiresAt.toMillis() <= now) continue;
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a.type);
  }
  const abo = bar.admin_bar_override;
  if (!abo || isAdminBarOverrideExpired(abo)) return out;
  for (const t of abo.iconTypes ?? []) {
    if (typeof t !== 'string') continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
