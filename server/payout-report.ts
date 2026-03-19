import PDFDocument from 'pdfkit';
import { storage } from './storage';

const MONTH_NAMES = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr';
};

interface PayoutReportData {
  userId: number;
  userName: string;
  userEmail: string;
  year: number;
  months: Array<{
    month: number;
    monthName: string;
    totalBookingAmount: number;
    totalManualPaid: number;
    totalManualOffset: number;
    totalManualPending: number;
    totalIncome: number;
    netAmount: number;
    finalStatus: string;
    bookingPayouts: Array<{
      guestName: string | null;
      checkIn: string | null;
      checkOut: string | null;
      nights: number;
      calculatedAmount: string;
      adminAmount: string | null;
      isOverridden: boolean;
    }>;
    manualPayouts: Array<{
      amount: string;
      status: string;
      notes: string | null;
      rentalDays: number | null;
    }>;
  }>;
  generatedBy: string;
}

function getStatusText(status: string): string {
  switch (status) {
    case 'paid': return 'Betalt';
    case 'sent': return 'Sendt';
    case 'pending': return 'Venter';
    case 'offset': return 'Motregning';
    case 'cancelled': return 'Kansellert';
    case 'none': return 'Ingen data';
    default: return status;
  }
}

export async function generatePayoutPDF(data: PayoutReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Utbetalingsrapport ${data.year} - ${data.userName}`,
          Author: 'Smart Hjem AS',
          Subject: `Utbetalingsrapport for ${data.userName}, ${data.year}`,
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;

      doc.fontSize(20).font('Helvetica-Bold')
        .text('Smart Hjem AS', 50, 50);
      doc.fontSize(10).font('Helvetica')
        .text('Booking  ·  Cleaning  ·  Power', 50, 75);

      doc.moveTo(50, 95).lineTo(50 + pageWidth, 95).stroke('#d4a017');

      doc.fontSize(16).font('Helvetica-Bold')
        .text(`Utbetalingsrapport ${data.year}`, 50, 115);

      doc.fontSize(11).font('Helvetica');
      doc.text(`Eier: ${data.userName}`, 50, 145);
      if (data.userEmail) {
        doc.text(`E-post: ${data.userEmail}`, 50, 162);
      }
      doc.text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, 50, data.userEmail ? 179 : 162);
      doc.text(`Generert av: ${data.generatedBy}`, 50, data.userEmail ? 196 : 179);

      let yPos = data.userEmail ? 225 : 208;

      const totalEarned = data.months.reduce((s, m) => s + m.totalIncome, 0);
      const totalOffset = data.months.reduce((s, m) => s + m.totalManualOffset, 0);
      const totalNet = totalEarned - totalOffset;

      doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke('#e5e7eb');
      yPos += 10;

      doc.fontSize(12).font('Helvetica-Bold').text('Årssammendrag', 50, yPos);
      yPos += 22;

      doc.fontSize(10).font('Helvetica');
      doc.text('Total inntekt:', 50, yPos);
      doc.text(formatCurrency(totalEarned), 350, yPos, { width: pageWidth - 300, align: 'right' });
      yPos += 18;

      if (totalOffset > 0) {
        doc.text('Justeringer/motregninger:', 50, yPos);
        doc.fillColor('#dc2626').text('-' + formatCurrency(totalOffset), 350, yPos, { width: pageWidth - 300, align: 'right' });
        doc.fillColor('#000000');
        yPos += 18;
      }

      doc.font('Helvetica-Bold');
      doc.text('Netto utbetalt:', 50, yPos);
      doc.text(formatCurrency(totalNet), 350, yPos, { width: pageWidth - 300, align: 'right' });
      yPos += 10;

      doc.moveTo(50, yPos + 5).lineTo(50 + pageWidth, yPos + 5).stroke('#e5e7eb');
      yPos += 20;

      for (const month of data.months) {
        if (month.totalIncome === 0 && month.totalManualOffset === 0 && month.finalStatus === 'none') {
          continue;
        }

        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(12).font('Helvetica-Bold')
          .fillColor('#1a1a1a')
          .text(month.monthName, 50, yPos);

        const statusText = getStatusText(month.finalStatus);
        doc.fontSize(9).font('Helvetica')
          .fillColor(month.finalStatus === 'paid' ? '#16a34a' : month.finalStatus === 'offset' ? '#ea580c' : '#6b7280')
          .text(statusText, 200, yPos + 2);
        doc.fillColor('#000000');
        yPos += 22;

        doc.fontSize(10).font('Helvetica');

        if (month.totalBookingAmount > 0) {
          doc.text('  Bookinger (API):', 50, yPos);
          doc.text(formatCurrency(month.totalBookingAmount), 350, yPos, { width: pageWidth - 300, align: 'right' });
          yPos += 16;
        }

        if (month.totalManualPaid > 0) {
          doc.fillColor('#16a34a');
          doc.text('  Utbetalinger:', 50, yPos);
          doc.text(formatCurrency(month.totalManualPaid), 350, yPos, { width: pageWidth - 300, align: 'right' });
          doc.fillColor('#000000');
          yPos += 16;
        }

        if (month.totalManualOffset > 0) {
          doc.fillColor('#ea580c');
          doc.text('  Justeringer:', 50, yPos);
          doc.text('-' + formatCurrency(month.totalManualOffset), 350, yPos, { width: pageWidth - 300, align: 'right' });
          doc.fillColor('#000000');
          yPos += 16;
        }

        doc.font('Helvetica-Bold');
        doc.text('  Netto:', 50, yPos);
        doc.text(formatCurrency(month.netAmount), 350, yPos, { width: pageWidth - 300, align: 'right' });
        doc.font('Helvetica');
        yPos += 20;

        if (month.bookingPayouts && month.bookingPayouts.length > 0) {
          doc.fontSize(8).fillColor('#6b7280');
          doc.text('  Bookingdetaljer:', 50, yPos);
          yPos += 14;

          for (const bp of month.bookingPayouts) {
            if (yPos > 740) {
              doc.addPage();
              yPos = 50;
            }
            const amount = bp.isOverridden && bp.adminAmount
              ? parseFloat(bp.adminAmount)
              : parseFloat(bp.calculatedAmount || "0");
            const checkIn = bp.checkIn ? new Date(bp.checkIn).toLocaleDateString('nb-NO') : '?';
            const checkOut = bp.checkOut ? new Date(bp.checkOut).toLocaleDateString('nb-NO') : '?';

            doc.fontSize(8).fillColor('#374151');
            doc.text(`    ${bp.guestName || 'Ukjent gjest'}  ·  ${checkIn} – ${checkOut}  ·  ${bp.nights} netter`, 50, yPos);
            doc.text(formatCurrency(amount), 350, yPos, { width: pageWidth - 300, align: 'right' });
            yPos += 13;
          }
          doc.fillColor('#000000');
          yPos += 4;
        }

        if (month.manualPayouts && month.manualPayouts.length > 0) {
          doc.fontSize(8).fillColor('#6b7280');
          doc.text('  Manuelle registreringer:', 50, yPos);
          yPos += 14;

          for (const mp of month.manualPayouts) {
            if (yPos > 740) {
              doc.addPage();
              yPos = 50;
            }
            const mpAmount = parseFloat(mp.amount || "0");
            const isOffset = mp.status === 'offset';
            const label = mp.notes || (isOffset ? 'Motregning' : 'Utbetaling');
            const statusLabel = getStatusText(mp.status);

            doc.fontSize(8).fillColor(isOffset ? '#ea580c' : '#16a34a');
            doc.text(`    ${label}  (${statusLabel})${mp.rentalDays ? '  ·  ' + mp.rentalDays + ' dager' : ''}`, 50, yPos);
            doc.text((isOffset ? '-' : '') + formatCurrency(Math.abs(mpAmount)), 350, yPos, { width: pageWidth - 300, align: 'right' });
            yPos += 13;
          }
          doc.fillColor('#000000');
          yPos += 4;
        }

        doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke('#f3f4f6');
        yPos += 12;
      }

      if (yPos > 720) {
        doc.addPage();
        yPos = 50;
      }

      yPos += 10;
      doc.fontSize(8).fillColor('#9ca3af')
        .text(`Denne rapporten er automatisk generert av Smart Hjem AS kalendersystem.`, 50, yPos);
      yPos += 12;
      doc.text(`Rapport-ID: RPT-${data.userId}-${data.year}-${Date.now()}`, 50, yPos);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
