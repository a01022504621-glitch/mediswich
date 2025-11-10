import type { DBBooking } from "@/lib/realtime/mapBookingToRow";
import { extractExcelFields } from "@/lib/realtime/mapBookingToRow";
import ExcelJS from "exceljs";

export async function buildRealtimeWorkbook(rows: DBBooking[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("예약명단");

  ws.columns = [
    { header: "고객사", key: "corp", width: 18 },
    { header: "수검자명", key: "name", width: 12 },
    { header: "생년월일(7)", key: "birth", width: 14 },
    { header: "휴대폰", key: "phone", width: 15 },
    { header: "이메일", key: "email", width: 22 },
    { header: "우편번호", key: "zipcode", width: 10 },
    { header: "주소1", key: "address1", width: 26 },
    { header: "주소2", key: "address2", width: 22 },
    { header: "패키지타입", key: "examType", width: 12 },
    { header: "패키지명", key: "pkg", width: 18 },
    { header: "추가검사", key: "addons", width: 32 },
    { header: "선택검사", key: "selectedExams", width: 26 },
    { header: "검사코드", key: "examCodes", width: 20 },
    { header: "예약신청일", key: "requestedAt", width: 12 },
    { header: "예약확정일", key: "confirmedAt", width: 12 },
    { header: "검진완료일", key: "completedAt", width: 12 },
    { header: "예약희망일", key: "wanted", width: 12 },
    { header: "예약시간", key: "time", width: 10 },
    { header: "회사지원금", key: "support", width: 12 },
    { header: "본인부담금", key: "copay", width: 12 },
    { header: "등급", key: "grade", width: 8 },
    { header: "특수검진", key: "spExam", width: 12 },
    { header: "특수물질", key: "spMat", width: 12 },
    { header: "보건증", key: "cert", width: 8 },
    { header: "복용약", key: "meds", width: 20 },
    { header: "병력", key: "history", width: 20 },
    { header: "시술이력", key: "surgery", width: 20 },
    { header: "치아상태", key: "dental", width: 20 },
    { header: "비행계획2주", key: "flightPlan", width: 14 },
  ];

  for (const b of rows) {
    const f = extractExcelFields(b);
    ws.addRow(f as any);
  }

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "center" };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}



