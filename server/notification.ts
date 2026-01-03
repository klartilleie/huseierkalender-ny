import nodemailer from 'nodemailer';
import { User, Event, MarkedDay } from '@shared/schema';
import { storage } from './storage';

// E-post avsender konfigurering - bruker SMTP_USER fra miljøvariabel
const FROM_EMAIL = process.env.SMTP_USER || 'kalender@klartilleie.no';
const FROM_NAME = 'Huseierkalenderen';

/**
 * Sjekk om e-postvarsler er aktivert i systeminnstillinger
 */
async function isEmailNotificationsEnabled(): Promise<boolean> {
  try {
    const setting = await storage.getSystemSettingByKey('emailNotifications.enabled');
    return setting?.value !== 'false'; // Standard er aktivert hvis ikke satt
  } catch (error) {
    console.error('Feil ved sjekking av e-postvarslings-innstilling:', error);
    return true; // Aktivert som standard ved feil
  }
}

// Opprette en transporter for å sende e-post
// Bruker SMTP konfigurasjon fra miljøvariabler eller standardinnstillinger
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.smarthjem.as',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'kundeservice@smarthjem.as',
    pass: process.env.SMTP_PASSWORD || '', // Passord må settes i miljøvariabel for produksjon
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production', // Ikke krev gyldig sertifikat i utvikling
  }
});

// Test e-postoppsett uten faktisk sending
const testTransporter = {
  sendMail: async (mailOptions: any) => {
    console.log('E-POST VILLE BLITT SENDT:', mailOptions);
    return { messageId: 'test-id-' + Date.now() };
  }
}

// Bruk testTransporter i utvikling
const mailer = process.env.NODE_ENV === 'production' ? transporter : testTransporter;

/**
 * Send en e-postvarsling om en kalenderendring
 */
export async function sendCalendarNotification(
  user: User, 
  subject: string, 
  message: string,
  eventData?: Event | MarkedDay
): Promise<boolean> {
  try {
    if (!user.email) {
      console.error(`Cannot send notification: User ${user.id} has no email address`);
      return false;
    }

    // E-post HTML innhold
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #0f766e;
          color: white;
          padding: 15px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
          background-color: #f9f9f9;
        }
        .event-details {
          background-color: white;
          border: 1px solid #eee;
          padding: 15px;
          margin-top: 15px;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #eee;
        }
        .button {
          display: inline-block;
          background-color: #0f766e;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Smart Hjem Kalender</h2>
        </div>
        <div class="content">
          <p>Hei ${user.name},</p>
          <p>${message}</p>
          ${eventData ? `
          <div class="event-details">
            <h3>${'title' in eventData ? eventData.title : ('markerType' in eventData ? eventData.markerType : 'Hendelse')}</h3>
            ${('description' in eventData && eventData.description) ? `<p>${eventData.description}</p>` : ''}
            ${('notes' in eventData && eventData.notes) ? `<p>${eventData.notes}</p>` : ''}
            ${('startTime' in eventData && eventData.startTime) ? `
            <p><strong>Tidspunkt:</strong> ${new Date(eventData.startTime).toLocaleString('nb-NO', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            })}</p>` : ''}
            ${('date' in eventData && eventData.date) ? `
            <p><strong>Dato:</strong> ${new Date(eventData.date).toLocaleString('nb-NO', { 
              dateStyle: 'full'
            })}</p>` : ''}
            ${('endTime' in eventData && eventData.endTime) ? `
            <p><strong>Slutter:</strong> ${new Date(eventData.endTime).toLocaleString('nb-NO', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            })}</p>` : ''}
          </div>
          ` : ''}
          <a href="${process.env.APP_URL || 'https://kalender.smarthjem.as'}" class="button">Åpne kalender</a>
        </div>
        <div class="footer">
          <p>Denne e-posten ble sendt fra Smart Hjem Kalender-systemet. Hvis du ikke ønsker å motta disse varslene, kan du endre dine varslingsinnstillinger i kalenderapplikasjonen.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send e-post
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: user.email,
      subject: `${subject} | Smart Hjem Kalender`,
      html: htmlContent,
      text: message  // Tekst-versjon for e-postklienter som ikke støtter HTML
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`E-postvarsling sendt til ${user.email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Feil ved sending av e-postvarsling:', error);
    return false;
  }
}

/**
 * Send standard kalenderoppdaterings-e-post
 * Denne funksjonen sender en generell varslings-e-post om kalenderendringer
 * Sender også kopi til avsender med informasjon om hvem som mottok e-posten
 */
export async function sendStandardCalendarUpdateEmail(targetUser: User): Promise<boolean> {
  try {
    // Sjekk om e-postvarsler er aktivert
    const emailEnabled = await isEmailNotificationsEnabled();
    if (!emailEnabled) {
      console.log('E-postvarsler er deaktivert i systeminnstillinger');
      return false;
    }

    if (!targetUser.email) {
      console.error(`Cannot send notification: User ${targetUser.id} has no email address`);
      return false;
    }

    const subject = 'Ny oppdatering i din huseierkalender 🏠';
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.8;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          padding: 0;
          border: 1px solid #ddd;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #1a1a2e 0%, #0f766e 100%);
          color: #fde047;
          padding: 30px 20px;
          text-align: center;
        }
        .header h2 {
          margin: 0;
          font-size: 24px;
        }
        .header .emoji {
          font-size: 40px;
          margin-bottom: 10px;
        }
        .content {
          padding: 30px;
          background-color: #ffffff;
        }
        .content p {
          margin: 15px 0;
        }
        .highlight-box {
          background-color: #f0fdf4;
          border-left: 4px solid #0f766e;
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .highlight-box p {
          margin: 8px 0;
        }
        .button-container {
          text-align: center;
          margin: 30px 0 20px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #0f766e 0%, #10b981 100%);
          color: white !important;
          padding: 15px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 16px;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666;
          background-color: #f9f9f9;
          border-top: 1px solid #eee;
        }
        .signature {
          font-style: italic;
          color: #0f766e;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">🏠</div>
          <h2>Huseierkalenderen</h2>
        </div>
        <div class="content">
          <p>Hei!</p>
          
          <p>Dette er et automatisk varsel om at det har skjedd en endring i din kalender.</p>
          
          <div class="highlight-box">
            <p>Det har enten kommet inn en ny booking.</p>
            <p>Eller det er gjort en endring/sletting i en eksisterende hendelse.</p>
          </div>
          
          <p>Vennligst logg inn på din konto for å se detaljene og oppdatere dine planer.</p>
          
          <div class="button-container">
            <a href="${process.env.APP_URL || 'https://kalender.smarthjem.as'}" class="button">Åpne kalenderen</a>
          </div>
          
          <p class="signature">Med vennlig hilsen,<br>Huseierkalenderen</p>
        </div>
        <div class="footer">
          <p>Dette er en automatisk e-post fra Smart Hjem Kalender-systemet.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `Hei!

Dette er et automatisk varsel om at det har skjedd en endring i din kalender.

Det har enten kommet inn en ny booking.

Eller det er gjort en endring/sletting i en eksisterende hendelse.

Vennligst logg inn på din konto for å se detaljene og oppdatere dine planer.

Med vennlig hilsen,
Huseierkalenderen`;

    // Send e-post til brukeren
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: targetUser.email,
      subject: subject,
      html: htmlContent,
      text: textContent
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`Standard kalenderoppdaterings-epost sendt til ${targetUser.email}: ${info.messageId}`);
    
    // Send kopi til avsender med informasjon om mottaker
    const copyHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.8;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          padding: 0;
          border: 1px solid #ddd;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .copy-notice {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px 20px;
          margin: 0;
        }
        .header {
          background: linear-gradient(135deg, #1a1a2e 0%, #0f766e 100%);
          color: #fde047;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 20px;
          background-color: #ffffff;
        }
        .footer {
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #666;
          background-color: #f9f9f9;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="copy-notice">
          <strong>KOPI AV SENDT E-POST</strong><br>
          Denne e-posten ble sendt til: <strong>${targetUser.name}</strong> (${targetUser.email})
        </div>
        <div class="header">
          <h3>Huseierkalenderen - Kopi</h3>
        </div>
        <div class="content">
          <p><strong>Mottaker:</strong> ${targetUser.name}</p>
          <p><strong>E-post:</strong> ${targetUser.email}</p>
          <p><strong>Tidspunkt:</strong> ${new Date().toLocaleString('nb-NO')}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p>Innholdet i den originale e-posten var en kalenderoppdatering.</p>
        </div>
        <div class="footer">
          <p>Automatisk kopi fra Huseierkalenderen</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    const copyMailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: FROM_EMAIL,
      subject: `[KOPI] ${subject} - Sendt til ${targetUser.name}`,
      html: copyHtmlContent,
      text: `KOPI AV SENDT E-POST\n\nDenne e-posten ble sendt til: ${targetUser.name} (${targetUser.email})\nTidspunkt: ${new Date().toLocaleString('nb-NO')}`
    };
    
    try {
      await mailer.sendMail(copyMailOptions);
      console.log(`Kopi sendt til avsender om e-post til ${targetUser.email}`);
    } catch (copyError) {
      console.error('Feil ved sending av kopi til avsender:', copyError);
    }
    
    return true;
  } catch (error) {
    console.error('Feil ved sending av standard kalenderoppdaterings-epost:', error);
    return false;
  }
}

/**
 * Send varsel om ny kalenderhendelse
 */
export async function notifyNewEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  return sendStandardCalendarUpdateEmail(targetUser);
}

/**
 * Send varsel om oppdatert kalenderhendelse
 */
export async function notifyUpdatedEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  return sendStandardCalendarUpdateEmail(targetUser);
}

/**
 * Send varsel om slettet kalenderhendelse
 */
export async function notifyDeletedEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  return sendStandardCalendarUpdateEmail(targetUser);
}

/**
 * Send varsel om nytt samarbeidsarrangement
 */
export async function notifyCollaborativeEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  const subject = 'Du er invitert til et samarbeidsarrangement';
  const message = `${user.name} har invitert deg til å samarbeide på arrangementet "${event.title}". Du kan nå se og redigere dette arrangementet i din kalender.`;
  
  return sendCalendarNotification(targetUser, subject, message, event);
}

/**
 * Send en e-post med lenke for å tilbakestille passord
 */
export async function sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean> {
  try {
    if (!user.email) {
      console.error(`Cannot send password reset: User ${user.id} has no email address`);
      return false;
    }
    
    const resetLink = `${process.env.APP_URL || 'https://kalender.smarthjem.as'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    
    const subject = 'Tilbakestill passord';
    const message = `Det er bedt om tilbakestilling av passord for din konto.`;
    
    // E-post HTML innhold
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #0f766e;
          color: white;
          padding: 15px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
          background-color: #f9f9f9;
        }
        .reset-button {
          display: inline-block;
          background-color: #0f766e;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
          margin-bottom: 15px;
        }
        .footer {
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Smart Hjem Kalender</h2>
        </div>
        <div class="content">
          <p>Hei ${user.name},</p>
          <p>${message}</p>
          <p>Klikk på knappen nedenfor for å tilbakestille passordet ditt. Hvis du ikke ba om tilbakestilling av passord, kan du ignorere denne e-posten.</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="reset-button">Tilbakestill passord</a>
          </div>
          <p>Hvis knappen ikke fungerer, kan du kopiere og lime inn følgende lenke i nettleseren din:</p>
          <p style="word-break: break-all;">${resetLink}</p>
          <p>Denne lenken er gyldig i 24 timer.</p>
        </div>
        <div class="footer">
          <p>Denne e-posten ble sendt fra Smart Hjem Kalender-systemet. Hvis du har spørsmål, vennligst kontakt kundeservice@smarthjem.as.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send e-post
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: user.email,
      subject: `${subject} | Smart Hjem Kalender`,
      html: htmlContent,
      text: `${message}\n\nKlikk på denne lenken for å tilbakestille passordet ditt: ${resetLink}\n\nDenne lenken er gyldig i 24 timer.`
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`Passord-tilbakestillingsepost sendt til ${user.email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Feil ved sending av passord-tilbakestillingslenke:', error);
    return false;
  }
}