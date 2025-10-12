// app/(m-protected)/m/org/capacity/page.tsx
import Calendar from "./ui/Calendar.client";

export default function CapacityPage() {
  const today = new Date();
  const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return (
    <section className="space-y-4">
      <Calendar initialMonth={initialMonth} />
    </section>
  );
}
