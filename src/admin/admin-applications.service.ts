import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../applications/schemas/application.schema';
import { MailService } from '../mail/mail.service'; 
import { User } from '../users/schemas/user.schema'; 

import { Notification } from '../notification/schemas/notification.schema';
import { ChatGateway } from '../chat/chat.gateway';



@Injectable()
export class AdminApplicationsService {
 constructor(
  @InjectModel(Application.name)
  private readonly applicationModel: Model<Application>,

  @InjectModel(User.name)
  private readonly userModel: Model<User>,

  @InjectModel(Notification.name)
  private readonly notificationModel: Model<Notification>,

  private readonly mailService: MailService,
  private readonly chatGateway: ChatGateway,
) {}


async updateStageManagment(appId: string, stage: string, email: string) {
  console.log("\n==============================");
  console.log("🚀 STAGE UPDATE START");
  console.log("AppId:", appId);
  console.log("Stage:", stage);
  console.log("Email:", email);

  try {
    const app = await this.applicationModel.findById(appId);

    if (!app) {
      console.log("❌ Application not found");
      return { statusCode: 404, message: 'Application not found' };
    }

    console.log("✅ Application found:", app._id);

    if (!email || !email.trim()) {
      console.log("❌ Email missing");
      return {
        statusCode: 400,
        message: 'Customer email is required to send notification',
      };
    }

    if (app.application_stage_management?.includes('dip_declined')) {
      console.log("⛔ DIP already declined. Blocking update");
      return {
        statusCode: 403,
        message: 'This application was declined in DIP stage and cannot be modified.',
      };
    }

    const ALLOWED_STAGES = [
      'dip_approved',
      'kyc_confirm',
      'valuation_started',
      'underwriting_started',
      'offer_issued',
      'completed_stage',
    ];

    if (!ALLOWED_STAGES.includes(stage)) {
      console.log("❌ Invalid stage:", stage);
      return {
        statusCode: 400,
        message: 'Invalid application stage status',
        allowedStages: ALLOWED_STAGES,
      };
    }

    if (app.application_stage_management?.includes(stage)) {
      console.log("⚠️ Stage already exists:", stage);
      return {
        statusCode: 400,
        message: 'This stage is already applied',
      };
    }

    if (!Array.isArray(app.application_stage_management)) {
      app.application_stage_management = [];
    }

    app.application_stage_management.push(stage);
    await app.save();

    console.log("✅ Stage saved in DB:", stage);

    // =====================================================
    // 🔔 SAVE NOTIFICATION + REALTIME
    // =====================================================
    if (app.userId) {
      try {
        const notificationMessage = `Your application stage updated to ${stage}`;

        console.log("🔔 Creating DB notification for user:", app.userId);

        const notification = await this.notificationModel.create({
          userId: app.userId,
          applicationId: app._id,
          stage: stage,
          message: notificationMessage,
          type: 'stage_update',
          isRead: false,
        });

        console.log("✅ Notification saved:", notification._id);

        console.log("📡 Sending realtime notification via WS...");

        this.chatGateway.sendNotificationToUser(
          app.userId.toString(),
          {
            notificationId: notification._id,
            applicationId: app._id,
            stage: stage,
            message: notificationMessage,
            isRead: false,
            createdAt: notification.createdAt,
          }
        );

        console.log("✅ Realtime notification sent");

      } catch (notificationError) {
        console.log("❌ Notification error:", notificationError.message);
      }
    } else {
      console.log("⚠️ No userId found, skipping realtime notification");
    }

    // =====================================================
    // EMAIL CHECK
    // =====================================================
    let allowEmail = false;

    if (app?.userId) {
      const user = await this.userModel.findById(app.userId).lean();
      if (user && user.emailNotifications === true) {
        allowEmail = true;
        console.log("📧 Email notification ENABLED");
      } else {
        console.log("📧 Email notification DISABLED");
      }
    }

    if (allowEmail) {
      if (Array.isArray(app.applicants)) {
        console.log("📧 Sending email to applicants...");
        for (const applicant of app.applicants) {
          if (applicant?.email) {
            console.log("📧 Sending to:", applicant.email);
            await this.mailService.sendStageEmail(applicant.email, stage, appId);
          }
        }
      }
      console.log("✅ Emails sent");
    }

    console.log("🎉 STAGE UPDATE SUCCESS");
    console.log("==============================\n");

    return {
      statusCode: 200,
      message: allowEmail
        ? 'Stage updated and email sent successfully'
        : 'Stage updated successfully (email disabled by user)',
      data: app,
    };

  } catch (error) {
    console.log("💥 STAGE UPDATE FAILED:", error.message);
    console.log("==============================\n");

    return {
      statusCode: 500,
      message: 'Stage update failed',
      error: error.message,
    };
  }
}



async declineDip(
  appId: string,
  reason: string,
  email: string,
  status: string,
) {
  try {
    if (!email || !email.trim()) {
      return {
        statusCode: 400,
        message: 'Recipient email is required',
        data: null,
      };
    }

    if (!reason || !reason.trim()) {
      return {
        statusCode: 400,
        message: 'Decline reason is required',
        data: null,
      };
    }

    if (!status || !status.trim()) {
      return {
        statusCode: 400,
        message: 'Status is required',
        data: null,
      };
    }

    const app = await this.applicationModel
      .findById(appId)
      .populate('userId');

    if (!app) {
      return {
        statusCode: 404,
        message: 'Application not found',
        data: null,
      };
    }

    // Prevent double same-status push
    if (app.application_stage_management?.includes(status)) {
      return {
        statusCode: 400,
        message: `Application already in ${status} state`,
        data: null,
      };
    }

    // Save frontend status in BOTH places
    await this.applicationModel.findByIdAndUpdate(appId, {
      $addToSet: { application_stage_management: status },
      status: status,
      dipRejectReason: reason.trim(),
      dipRejectedAt: new Date(),
    });

    await this.mailService.sendDipDeclineEmail(
      email.trim(),
      app.userId.firstName,
      app.appId,
      reason.trim(),
    );

    return {
      statusCode: 200,
      message: 'DIP rejected and email sent successfully',
      data: {
        appId: app.appId,
        email: email.trim(),
        status: status,
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: 'Failed to reject DIP',
      error: error.message,
    };
  }
}

}
