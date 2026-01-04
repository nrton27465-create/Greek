// Code.gs

const SPREADSHEET_ID = "17JxOQpKM_RBSS2Z2Wcmi7kMXAkrDyyyVbExsrDsg5D4"; // ใส่ ID Google Sheet ของคุณ

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('สมัครสมาชิก ร้านทำผม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ฟังก์ชัน include (เผื่ออนาคตจะแยกไฟล์ HTML เพิ่ม)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * บันทึกข้อมูลสมาชิกใหม่ ลงชีต "Members"
 * และสร้างรหัสลูกค้าอัตโนมัติ (C0001, C0002, ...)
 */
function saveMember(member) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Members');

  // ถ้ายังไม่มีชีต Members ให้สร้างพร้อมหัวตาราง
  if (!sheet) {
    sheet = ss.insertSheet('Members');
    sheet.getRange(1, 1, 1, 7).setValues([[
      'Timestamp',
      'Customer ID',
      'Name',
      'Phone',
      'Gender',
      'Birthdate',
      'Note'
    ]]);
  }

  // สร้างรหัสลูกค้าใหม่
  const newCustomerId = generateCustomerId_(sheet);

  // บันทึกข้อมูล
  sheet.appendRow([
    new Date(),             // Timestamp
    newCustomerId,          // Customer ID
    member.name || '',      // Name
    "'" + (member.phone || ''),     // Phone
    member.gender || '',    // Gender
    member.birthdate || '', // Birthdate
    member.note || ''       // Note
  ]);

  // ส่งรหัสลูกค้ากลับไปให้หน้าเว็บแสดง
  return newCustomerId;
}

/**
 * สร้าง Customer ID ใหม่ โดยดูค่าล่าสุดจากคอลัมน์ B
 * รูปแบบ: C0001, C0002, ...
 */
function generateCustomerId_(sheet) {
  const lastRow = sheet.getLastRow();

  // ถ้ายังไม่มีข้อมูล (มีแต่หัวตาราง)
  if (lastRow < 2) {
    return 'C0001';
  }

  // อ่านรหัสลูกค้าล่าสุดจากคอลัมน์ B แถวสุดท้าย
  const lastId = sheet.getRange(lastRow, 2).getValue(); // col B
  const lastNumber = parseInt(String(lastId).replace(/\D/g, ''), 10) || 0;
  const nextNumber = lastNumber + 1;

  // เติมเลข 4 หลัก
  const padded = ('0000' + nextNumber).slice(-4);
  return 'C' + padded;
}
