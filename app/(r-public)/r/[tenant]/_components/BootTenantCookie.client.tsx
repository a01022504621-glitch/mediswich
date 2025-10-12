"use client";

import { useEffect } from "react";

type Info = { id: string; slug: string; name: string };

export default function BootTenantCookie({ info }: { info: Info }) {
  useEffect(() => {
    try {
      const val = encodeURIComponent(JSON.stringify(info));
      const maxAge = 60 * 60 * 6; // 6시간
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `r_tenant=${val}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
    } catch {
      /* no-op */
    }
  }, [info]);

  return null;
}

