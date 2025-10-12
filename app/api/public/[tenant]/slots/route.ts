// app/api/public/[tenant]/slots/route.ts
export const runtime = "nodejs";
export { GET, dynamic, revalidate } from "../timeslots/route";

