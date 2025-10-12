// app/(m-private)/m/notifications/page.tsx
import SimpleTabs from "@/components/admin/SimpleTabs";
import TemplatesTab from "@/components/admin/notifications/TemplatesTab";
import RulesTab from "@/components/admin/notifications/RulesTab";
import QueueTab from "@/components/admin/notifications/QueueTab";

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">알림관리</h1>
      <SimpleTabs
        tabs={[
          { id: "templates", title: "템플릿", content: <TemplatesTab /> },
          { id: "rules", title: "규칙", content: <RulesTab /> },
          { id: "queue", title: "큐/로그", content: <QueueTab /> },
        ]}
      />
    </div>
  );
}

