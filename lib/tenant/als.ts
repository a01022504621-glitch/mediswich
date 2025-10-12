// lib/tenant/als.ts
import { AsyncLocalStorage } from "async_hooks";

export type TenantContext = {
  hospitalId?: string;
  hospitalSlug?: string;
};

export const tenantAls = new AsyncLocalStorage<TenantContext>();

export function getTenant() {
  return tenantAls.getStore() ?? {};
}

export function runWithTenant<T>(ctx: TenantContext, fn: () => T) {
  return tenantAls.run(ctx, fn);
}


