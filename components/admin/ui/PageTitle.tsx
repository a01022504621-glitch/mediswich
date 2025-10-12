export default function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[20px] font-semibold tracking-tight mb-4">{children}</h1>
  );
}


