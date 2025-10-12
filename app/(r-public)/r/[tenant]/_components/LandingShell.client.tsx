"use client";
import { useEffect, useMemo, useState } from "react";
import CategoryTabs from "./CategoryTabs.client";
import PackageList from "./PackagesList.client";
import CompanyCodeForm from "./CompanyCodeForm.client";

type Cat = "nhis" | "general" | "corp";

export default function LandingShell({ tenant }: { tenant: string }) {
  const [cat, setCat] = useState<Cat>("general");

  // URL 쿼리 동기화(뒤로가기/공유 대비)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("cat") as Cat | null;
    if (c && ["nhis", "general", "corp"].includes(c)) setCat(c);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("cat", cat);
    history.replaceState(null, "", `?${sp.toString()}`);
  }, [cat]);

  const tabs = useMemo(
    () => [
      { label: "국가검진", active: cat === "nhis", onClick: () => setCat("nhis") },
      { label: "개인검진", active: cat === "general", onClick: () => setCat("general") },
      { label: "기업/단체검진", active: cat === "corp", onClick: () => setCat("corp") },
    ],
    [cat]
  );

  return (
    <div className="mt-6 space-y-6">
      <CategoryTabs items={tabs} />
      {cat === "corp" ? (
        <CompanyCodeForm tenant={tenant} />
      ) : (
        <PackageList tenant={tenant} type={cat} />
      )}
    </div>
  );
}

