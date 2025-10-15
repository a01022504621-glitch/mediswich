// 경로: mediswich/lib/excel/realtimeExport.ts
import ExcelJS from "exceljs";
import type { DBBooking } from "@/lib/realtime/mapBookingToRow";
import { extractExcelFields } from "@/lib/realtime/mapBookingToRow";

export async function buildRealtimeWorkbook(rows: DBBooking[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("예약목록");

  ws.columns = [
    { header: "검진유형", key: "examType", width: 15 },
    { header: "고객사", key: "corp", width: 20 },
    { header: "수검자명", key: "name", width: 15 },
    { header: "생년월일", key: "birth", width: 12 },
    { header: "등급", key: "grade", width: 10 },
    { header: "검진희망일", key: "wanted", width: 12 },
    { header: "예약시간", key: "time", width: 10 },
    { header: "휴대폰", key: "phone", width: 16 },
    { header: "이메일", key: "email", width: 25 },
    { header: "우편번호", key: "zipcode", width: 10 },
    { header: "주소", key: "address1", width: 30 },
    { header: "상세주소", key: "address2", width: 30 },
    { header: "특수검진", key: "spExam", width: 12 },
    { header: "특수물질", key: "spMat", width: 12 },
    { header: "보건증", key: "cert", width: 8 },
    { header: "패키지타입", key: "pkg", width: 25 },
    { header: "검진비용", key: "total", width: 12 },
    { header: "회사지원금", key: "support", width: 12 },
    { header: "본인부담금", key: "copay", width: 12 },
    { header: "선택검사항목", key: "selectedExams", width: 40 },
    { header: "검사코드(패키지 포함)", key: "examCodes", width: 40 },
    { header: "복용약", key: "meds", width: 30 },
    { header: "병력", key: "history", width: 30 },
    { header: "시술이나 수술 이력", key: "surgery", width: 30 },
    { header: "치아상태", key: "dental", width: 20 },
    { header: "검진 후 2주이내 비행계획", key: "flightPlan", width: 25 },
  ];

  ws.getRow(1).font = { bold: true };

  for (const b of rows) {
    const f = extractExcelFields(b);
    ws.addRow({
      examType: f.examType,
      corp: f.corp,
      name: f.name,
      birth: f.birth,
      grade: f.grade,
      wanted: f.wanted,
      time: f.time,
      phone: f.phone,
      email: f.email,
      zipcode: f.zipcode,
      address1: f.address1,
      address2: f.address2,
      spExam: f.spExam,
      spMat: f.spMat,
      cert: f.cert,
      pkg: f.pkg,
      total: f.total,
      support: f.support,
      copay: f.copay,
      selectedExams: f.selectedExams,
      examCodes: f.examCodes, // 코드가 없으면 자동 미기재
      meds: f.meds,
      history: f.history,
      surgery: f.surgery,
      dental: f.dental,
      flightPlan: f.flightPlan,
    });
  }

  const moneyCols = ["Q", "R", "S"];
  for (let i = 2; i <= ws.rowCount; i++) {
    for (const col of moneyCols) ws.getCell(`${col}${i}`).numFmt = "#,##0";
  }
  return wb;
}


