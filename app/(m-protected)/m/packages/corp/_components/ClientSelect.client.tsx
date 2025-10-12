"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
type Opt = { id: string; name: string; code?: string | null };

export default function ClientSelect({
  name = "clientId",
  value,
  defaultValue,
  onChange,
  className,
  placeholder = "고객사 선택",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [q] = useState("");
  const { data } = useSWR<{ items: Opt[] }>(
    `/api/clients?lite=1&q=${encodeURIComponent(q)}&take=50`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const opts = useMemo(() => data?.items ?? [], [data]);
  const inner = value ?? defaultValue ?? "";

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <select
        name={name}
        value={inner}
        onChange={(e) => onChange?.(e.target.value)}
        className="min-w-56 grow rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{placeholder}</option>
        {opts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.code ? ` (${c.code})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

