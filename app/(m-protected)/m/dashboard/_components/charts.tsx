// app/(m-protected)/m/dashboard/_components/charts.tsx
"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f43f5e"];

const tooltip = {
  contentStyle: { borderRadius: 8, borderColor: "#e5e7eb" },
  labelStyle: { color: "#111827", fontWeight: 600 },
} as const;

/* Line (Trend) */
export function TrendChart({
  data,
  height = 320,
}: {
  data: Array<{ d: string; requested: number; confirmed: number; amended: number; completed: number }>;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="d" />
          <YAxis allowDecimals={false} />
          <Tooltip {...tooltip} />
          <Legend />
          <Line type="monotone" dataKey="requested" name="신청" stroke={COLORS[0]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="confirmed" name="확정" stroke={COLORS[1]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="amended" name="변경" stroke={COLORS[2]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="completed" name="완료" stroke={COLORS[3]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Donut */
export function DonutChart({
  data,
  nameKey,
  valueKey,
  height = 240,
}: {
  data: Array<{ [k: string]: any }>;
  nameKey: string;
  valueKey: string;
  height?: number;
}) {
  const total = (data ?? []).reduce((a, v) => a + (Number(v?.[valueKey]) || 0), 0);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip {...tooltip} />
          <Legend />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={"60%"}
            outerRadius={"80%"}
            paddingAngle={2}
            labelLine={false}
          >
            {data?.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "relative",
          marginTop: -height + 20,
          textAlign: "center",
          pointerEvents: "none",
          fontSize: 13,
          color: "#111827",
          fontWeight: 600,
        }}
      >
        총 {total.toLocaleString()}
      </div>
    </div>
  );
}

/* Bars (single or dual) */
export function Bars({
  data,
  xKey,
  yKey,
  yName,
  secondKey,
  secondName,
  height = 260,
}: {
  data: Array<{ [k: string]: any }>;
  xKey: string;
  yKey: string;
  yName: string;
  secondKey?: string;
  secondName?: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis allowDecimals={false} />
          <Tooltip {...tooltip} />
          <Legend />
          <Bar dataKey={yKey} name={yName} fill={COLORS[0]} radius={4}>
            <LabelList dataKey={yKey} position="top" fontSize={11} />
          </Bar>
          {secondKey ? (
            <Bar dataKey={secondKey} name={secondName} fill={COLORS[2]} radius={4}>
              <LabelList dataKey={secondKey} position="top" fontSize={11} />
            </Bar>
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}



