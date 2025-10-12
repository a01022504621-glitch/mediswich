import { ReactNode } from "react";

export default function SectionCard({
  title,
  children,
  action,
  subtle,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  subtle?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-2xl border p-4",
        subtle ? "bg-white" : "bg-white shadow-sm",
      ].join(" ")}
    >
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {action}
      </header>
      <div className="text-sm text-gray-700">{children}</div>
    </section>
  );
}

