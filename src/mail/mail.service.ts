import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number(this.configService.get('SMTP_PORT')),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  /** Load HTML template and replace variables */
  private loadTemplate(
    templateName: string,
    variables: Record<string, string>,
  ): string {
    const templatePath = path.join(
      process.cwd(),
      'src',
      'mail',
      'templates',
      templateName,
    );

    let html = fs.readFileSync(templatePath, 'utf-8');

    for (const key in variables) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
    }

    return html;
  }

  // ================= FORGOT PASSWORD =================
  async sendForgotPasswordEmail(email: string, resetLink: string) {
    const html = this.loadTemplate('forgot-password.html', {
      RESET_LINK: resetLink,
    });

    await this.transporter.sendMail({
      from: `"RightBridge" <${this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Reset your password',
      html,
    });
  }

  // ================= NEW USER REGISTRATION =================
async sendWelcomeEmail(email: string, firstName: string) {
  const html = this.loadTemplate('welcome-user.html', {
    FIRST_NAME: firstName,
    LOGIN_URL: this.configService.get('FRONTEND_LOGIN_URL') || '',
  });

  await this.transporter.sendMail({
    from: `"RightBridge" <${this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER')}>`,
    to: email,
    subject: 'Welcome to RightBridge',
    html,
  });
}





 async sendAdminRegistrationEmail(
  email: string,
  password: string,
  loginUrl: string,
) {
 const templatePath = path.join(
  process.cwd(),
  'src',
  'admin',
  'templates',
  'admin-welcome.html',
);

  let html = fs.readFileSync(templatePath, 'utf8');

  html = html
    .replace(/{{EMAIL}}/g, email)
    .replace(/{{PASSWORD}}/g, password)
    .replace(/{{LOGIN_URL}}/g, loginUrl);

  await this.transporter.sendMail({
    from: `"RightBridge" <${this.configService.get('SMTP_USER')}>`,
    to: email,
    subject: 'Your RightBridge Admin Account',
    html,
  });
}


 async sendOtpVerificationEmail(
  email: string,
  firstName: string,
  otp: string,
  otp_expiry_time: number,
) {
  const html = this.loadTemplate('otp-verification.html', {
    FIRST_NAME: firstName,
    OTP_CODE: otp,
    TIME_LIMIT: otp_expiry_time.toString(),
  });

  await this.transporter.sendMail({
    from: `"RightBridge" <${this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER')}>`,
    to: email,
    subject: 'Verify your email – RightBridge',
    html,
  });
}


async sendDipDeclineEmail(
  email: string,
  name: string,
  appId: string,
  reason: string,
) {
  const html = this.loadTemplate('dip-decline.html', {
    FIRST_NAME: name,
    APP_ID: appId,
    REASON: reason,
  });

  await this.transporter.sendMail({
    from: `"RightBridge" <${this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER')}>`,
    to: email,
    subject: `Your RightBridge application  was declined`,
    html,
  });
}



async sendStageEmail(
  email: string,
  stage: string,
  appId: string,
) {
  let title = '';
  let message = '';

  switch (stage) {
    case 'approved_dip':
      title = 'DIP Approved';
      message =
        'Your Decision in Principle (DIP) has been approved. We will now proceed with KYC verification.';
      break;

    case 'dip_declined':
      title = 'Application Declined';
      message =
        'We regret to inform you that your loan application has been declined at the Decision in Principle (DIP) stage.';
      break;

   
     case 'kyc_confirmed':
      title = 'KYC Approved';
      message =
        'Your KYC verification has been successfully completed. Your application will now move to the valuation stage.';
      break;

    case 'valuation_started':
      title = 'Valuation Started';
      message =
        'Property valuation has started for your loan application.';
      break;

    case 'underwriting_started':
      title = 'Underwriting In Progress';
      message =
        'Your loan application is currently under underwriting review.';
      break;

    case 'offer_issued':
      title = 'Offer Issued';
      message =
        'Your loan offer has been issued. Please log in to review it.';
      break;

    case 'completed':
      title = 'Application Completed';
      message =
        'Your loan application has been successfully completed.';
      break;

    default:
      title = 'Application Update';
      message = 'Your application status has been updated.';
  }

  const html = this.loadTemplate('stage-management-notification.html', {
    TITLE: title,
    MESSAGE: message,
    APP_ID: appId,
  });

  await this.transporter.sendMail({
    from: `"RightBridge" <${this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER')}>`,
    to: email,
    subject: title,
    html,
  });
}











}
