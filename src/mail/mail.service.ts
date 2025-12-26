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

}
