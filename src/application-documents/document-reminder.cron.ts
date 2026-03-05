import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Application } from '../applications/schemas/application.schema';
import { User } from '../users/schemas/user.schema';
import { ApplicationDocument } from './schemas/application-document.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class DocumentReminderCron {
  private readonly logger = new Logger(DocumentReminderCron.name);

  constructor(
    @InjectModel('Application')
    private readonly applicationModel: Model<Application>,

    @InjectModel('User')
    private readonly userModel: Model<User>,

    @InjectModel('ApplicationDocument')
    private readonly applicationDocumentModel: Model<ApplicationDocument>,

    private readonly mailService: MailService,
  ) {
    this.logger.log('DocumentReminderCron initialized');
  }

  // 🔹 TEST MODE (runs every 10 seconds)
  // @Cron('*/10 * * * * *')
  async checkMissingDocuments() {
    this.logger.log(`Cron triggered at ${new Date().toISOString()}`);

    try {
      const applications = await this.applicationModel.find();

      this.logger.log(`Total applications found: ${applications.length}`);

      for (const application of applications) {

        const user = await this.userModel.findById(application.userId);

        if (!user) {
          this.logger.log(`User not found for application ${application._id}`);
          continue;
        }

        if (!user.documentReminders || !user.emailNotifications) {
          this.logger.log(`Notifications disabled for ${user.email}`);
          continue;
        }

        const applicationDocs = await this.applicationDocumentModel.findOne({
          applicationId: application._id.toString(),
          userId: user._id.toString(),
        });

        const requiredDocuments = [
          'identity',
          'address',
          'bank_statement',
          'income_proof',
        ];

        let uploadedDocs: string[] = [];

        if (applicationDocs && applicationDocs.documents) {
          uploadedDocs = applicationDocs.documents.map((doc) => doc.type);
        }

        const missingDocs = requiredDocuments.filter(
          (doc) => !uploadedDocs.includes(doc),
        );

        if (missingDocs.length > 0) {
          this.logger.log(
            `User ${user.email} missing documents: ${missingDocs.join(', ')}`,
          );
         const formattedDocs = missingDocs.map((doc) =>
            doc
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase()),
          );
          await this.mailService.sendDocumentReminderEmail(
            user.email,
            user.firstName || 'User',
            application.appId,
            formattedDocs,
          );
        } else {
          this.logger.log(`All documents uploaded for ${user.email}`);
        }
      }

    } catch (error) {
      this.logger.error('Cron error', error);
    }
  }
}