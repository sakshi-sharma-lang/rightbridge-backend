import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../applications/schemas/application.schema';
import { MailService } from '../mail/mail.service'; 

@Injectable()
export class AdminApplicationsService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
      private readonly mailService: MailService,      // 👈 ADD THIS

  ) {}

async updateStageManagment(appId: string, stage: string) {
  try {
    const app = await this.applicationModel.findById(appId);

    if (!app) {
      return {
        statusCode: 404,
        message: 'Application not found',
        data: null,
      };
    }

    // 🚫 BLOCK if DIP is declined
    if (app.application_stage_management?.includes('decline_stage')) {
      return {
        statusCode: 403,
        message: 'This application was declined in DIP stage and cannot be modified.',
        data: null,
      };
    }

    const updated = await this.applicationModel.findByIdAndUpdate(
      appId,
      {
        $addToSet: {
          application_stage_management: stage,
        },
      },
      { new: true },
    );

    return {
      statusCode: 200,
      message: 'Stage added successfully',
      data: updated,
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: 'Failed to update application stage',
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
