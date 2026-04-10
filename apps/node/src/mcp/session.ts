export interface SessionDefaults {
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
}

export function createSessionDefaults(): SessionDefaults {
  return {};
}
