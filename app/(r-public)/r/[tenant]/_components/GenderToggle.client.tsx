"use client";
type Sex = "M" | "F";

export default function GenderToggle({
  value,
  onChange,
}: {
  value: Sex;
  onChange: (v: Sex) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["M", "F"] as Sex[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={[
            "flex-1 rounded-2xl px-5 py-3 text-sm font-semibold transition",
            value === v
              ? "bg-[color:var(--brand)] text-white shadow"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50",
          ].join(" ")}
        >
          {v === "M" ? "남성" : "여성"}
        </button>
      ))}
    </div>
  );
}

