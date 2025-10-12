type Props = { html?: string };

export default function NoticeCard({ html }: Props) {
  if (!html) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div
        className="prose prose-sm max-w-none text-gray-700 prose-a:text-[color:var(--brand)]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}


