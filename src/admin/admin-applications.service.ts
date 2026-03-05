import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../applications/schemas/application.schema';
import { MailService } from '../mail/mail.service'; 
import { User } from '../users/schemas/user.schema'; 
import { Kyc } from '../kyc/schemas/kyc.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationService } from '../notification/notification.service';


@Injectable()
export class AdminApplicationsService {
constructor(
  @InjectModel(Application.name)
  private readonly applicationModel: Model<Application>,

  @InjectModel(User.name)
  private readonly userModel: Model<User>,

  private readonly mailService: MailService,

  private readonly notificationService: NotificationService,
@InjectModel(Kyc.name)
private kycModel: Model<Kyc>,
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

    // const ALLOWED_STAGES = [
    //   'dip_approved',
    //   'kyc_confirm',
    //   'valuation_started',
    //   'underwriting_started',
    //   'offer_issued',
    //   'completed_stage',
    // ];

    // if (!ALLOWED_STAGES.includes(stage)) {
    //   console.log("❌ Invalid stage:", stage);
    //   return {
    //     statusCode: 400,
    //     message: 'Invalid application stage status',
    //     allowedStages: ALLOWED_STAGES,
    //   };
    // }

    // if (app.application_stage_management?.includes(stage)) {
    //   console.log("⚠️ Stage already exists:", stage);
    //   return {
    //     statusCode: 400,
    //     message: 'This stage is already applied',
    //   };
    // }

    // =====================================================
    // 🔎 MULTI-APPLICANT KYC VALIDATION (STRICT)
    // Skip ONLY for dip_approved
    // =====================================================
    if (stage !== 'dip_approved') {

      // if (!Array.isArray(app.applicants) || app.applicants.length === 0) {
      //   return {
      //     statusCode: 400,
      //     message: "No applicants found in application",
      //   };
      // }

      // const externalIds = app.applicants
      //   .map(a => a.externalUserId)
      //   .filter(Boolean);

      // if (externalIds.length !== app.applicants.length) {
      //   return {
      //     statusCode: 400,
      //     message: "One or more applicants missing externalUserId",
      //   };
      // }

      // const kycRecords = await this.kycModel
      //   .find(
      //     { externalUserId: { $in: externalIds } },
      //     { externalUserId: 1, status: 1 }
      //   )
      //   .lean();

      // const foundExternalIds = kycRecords.map(r => r.externalUserId);

      // const missingExternalIds = externalIds.filter(
      //   id => !foundExternalIds.includes(id)
      // );

      // if (missingExternalIds.length > 0) {
      //   console.log("❌ Missing KYC records for externalUserIds:");
      //   console.log(missingExternalIds);

      //   return {
      //     statusCode: 400,
      //    message: "KYC record not found for one or more applicants. Stage update blocked.",
      //   };
      // }

      // for (const record of kycRecords) {
      //   if (record.status === 'LINK_SENT') {
      //     console.log("⛔ KYC already LINK_SENT for:", record.externalUserId);
      //     return {
      //       statusCode: 403,
      //         message: "KYC is in progress for one or more applicants. Cannot proceed to next stage.",
      //     };
      //   }
      // }
//       for (const record of kycRecords) {
//     if (record.status !== 'APPROVED') {
//       console.log("⛔ KYC not approved for:", record.externalUserId);

//       return {
//         statusCode: 403,
//         message: "All applicants must have KYC APPROVED before proceeding."
//       };
//     }
// }
    }

    // =====================================================
    // ✅ SAFE TO UPDATE STAGE
    // =====================================================

    // if (!Array.isArray(app.application_stage_management)) {
    //   app.application_stage_management = [];
    // }

    // app.application_stage_management.push(stage);
    // await app.save();

    // console.log("✅ Stage saved in DB:", stage);

    // =====================================================
    // 🔔 NOTIFICATION (NON-BLOCKING FOR SPEED)
    // =====================================================
    if (app.userId) {
      const formattedStage = stage
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const finalMessage = `Your application moved to ${formattedStage}`;

      this.notificationService.sendToUser({
        userId: app.userId.toString(),
        message: finalMessage,
        stage: stage,
        type: 'stage_update',
        applicationId: app._id.toString(),
      }).catch(err =>
        console.log("❌ Notification error:", err.message)
      );
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

    if (allowEmail && Array.isArray(app.applicants)) {
      console.log("📧 Sending email to applicants...");

      for (const applicant of app.applicants) {
        if (applicant?.email) {
          this.mailService
            .sendStageEmail(applicant.email, stage, appId)
            .catch(err =>
              console.log("❌ Mail error:", err.message)
            );
        }
      }

      console.log("✅ Emails triggered");
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
