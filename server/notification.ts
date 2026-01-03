import nodemailer from 'nodemailer';
import { User, Event, MarkedDay } from '@shared/schema';

// E-post avsender konfigurering
const FROM_EMAIL = 'kundeservice@smarthjem.as';
const FROM_NAME = 'Smart Hjem Kalender';

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
 * Send varsel om ny kalenderhendelse
 */
export async function notifyNewEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  const subject = 'Ny hendelse i kalenderen';
  let message = `En ny hendelse er lagt til i kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  
  if (user.id !== targetUser.id) {
    message = `${user.name} har lagt til en ny hendelse i kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  }
  
  return sendCalendarNotification(targetUser, subject, message, event);
}

/**
 * Send varsel om oppdatert kalenderhendelse
 */
export async function notifyUpdatedEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  const subject = 'Oppdatert hendelse i kalenderen';
  let message = `En hendelse er oppdatert i kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  
  if (user.id !== targetUser.id) {
    message = `${user.name} har oppdatert en hendelse i kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  }
  
  return sendCalendarNotification(targetUser, subject, message, event);
}

/**
 * Send varsel om slettet kalenderhendelse
 */
export async function notifyDeletedEvent(user: User, targetUser: User, event: Event): Promise<boolean> {
  const subject = 'Slettet hendelse fra kalenderen';
  let message = `En hendelse er slettet fra kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  
  if (user.id !== targetUser.id) {
    message = `${user.name} har slettet en hendelse fra kalenderen ${event.title ? `med tittel "${event.title}"` : ''}.`;
  }
  
  return sendCalendarNotification(targetUser, subject, message, event);
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