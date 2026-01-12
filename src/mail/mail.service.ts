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








}
