import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  async sendForgotPassword(email: string, resetLink: string) {
    const templatePath = path.join(
      __dirname,
      '../admin/templates/forgot-password.html',
    );

    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace('{{RESET_LINK}}', resetLink);

    //  Replace this with nodemailer / SES / SendGrid
    console.log('Sending email to:', email);
    console.log(html);
  }

  async sendAdminRegistrationEmail(
    email: string,
    password: string,
    loginUrl: string,
  ) {
    const templatePath = path.join(
      __dirname,
      '../mail/templates/admin-welcome.html',
    );

    let html = fs.readFileSync(templatePath, 'utf8');

    html = html
      .replace('{{EMAIL}}', email)
      .replace('{{PASSWORD}}', password)
      .replace('{{LOGIN_URL}}', loginUrl);

    //  Replace with Nodemailer / SES / SendGrid
    console.log('Sending Admin Registration Email to:', email);
    console.log(html);
  }



  




}
