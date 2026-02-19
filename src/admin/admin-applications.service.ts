import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../applications/schemas/application.schema';
import { MailService } from '../mail/mail.service'; 
import { User } from '../users/schemas/user.schema'; 

import { Notification } from '../notification/schemas/notification.schema';
import { NotificationGateway } from '../notification/notification.gateway';



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
  private readonly notificationGateway: NotificationGateway,
) {}


async updateStageManagment(appId: string, stage: string, email: string) {
  try {
    const app = await this.applicationModel.findById(appId);

    if (!app) {
      return {
        statusCode: 404,
        message: 'Application not found',
      };
    }

    if (!email || !email.trim()) {
      return {
        statusCode: 400,
        message: 'Customer email is required to send notification',
      };
    }

    //  Lock if DIP declined
    if (app.application_stage_management?.includes('dip_declined')) {
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
      return {
        statusCode: 400,
        message: 'Invalid application stage status',
        allowedStages: ALLOWED_STAGES,
      };
    }

    //  Prevent duplicate stage
    if (app.application_stage_management?.includes(stage)) {
      return {
        statusCode: 400,
        message: 'This stage is already applied',
      };
    }

    // Save stage
    if (!Array.isArray(app.application_stage_management)) {
      app.application_stage_management = [];
    }

    app.application_stage_management.push(stage);
    await app.save();

    // =====================================================
    // 🔔 SAVE NOTIFICATION + REALTIME EMIT (ADDED)
    // =====================================================
    if (app.userId) {
      try {
        const notificationMessage = `Your application stage updated to ${stage}`;

        const notification = await this.notificationModel.create({
          userId: app.userId,
          applicationId: app._id,
          stage: stage,
          message: notificationMessage,
          type: 'stage_update',
          isRead: false,
        });

        this.notificationGateway.emitStageNotification(
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

      } catch (notificationError) {
        console.error('Notification error:', notificationError.message);
      }
    }

    // =====================================================
    //  CHECK USER EMAIL NOTIFICATION SETTING
    // =====================================================
    let allowEmail = false;

    if (app?.userId) {
      const user = await this.userModel.findById(app.userId).lean();
      if (user && user.emailNotifications === true) {
        allowEmail = true;
      }
    }

    // =====================================================
    //  SEND EMAILS IF ENABLED
    // =====================================================
    if (allowEmail) {

      // ==============================
      // 1️⃣ SEND TO USER TABLE EMAIL
      // ==============================
      // const mainUser = await this.userModel.findById(app.userId).lean();
      // if (mainUser?.email) {
      //   await this.mailService.sendStageEmail(mainUser.email, stage, appId);
      // }

      // ==============================
      // 2️⃣ SEND TO ALL APPLICANTS EMAIL
      // ==============================
      if (Array.isArray(app.applicants)) {
        for (const applicant of app.applicants) {
          if (applicant?.email) {
            await this.mailService.sendStageEmail(applicant.email, stage, appId);
          }
        }
      }
    }

    return {
      statusCode: 200,
      message: allowEmail
        ? 'Stage updated and email sent successfully'
        : 'Stage updated successfully (email disabled by user)',
      data: app,
    };

  } catch (error) {
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
