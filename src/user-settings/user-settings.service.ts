import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User } from '../users/schemas/user.schema';
import { Application } from '../applications/schemas/application.schema';


@Injectable()
export class UserSettingsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Application.name) private applicationModel: Model<Application>,
  ) {}

  // 🔷 GET SETTINGS
  async getSettings(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const activeApplication = await this.applicationModel.findOne({
      userId,
      status: { $nin: ['rejected', 'completed'] },
    });

    return {
      success: true,
      data: {
        accountInfo: {
          email: user.email,
          phone: user.phoneNumber,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
        notifications: {
          emailNotifications: user.emailNotifications ?? false,
          smsNotifications: user.smsNotifications ?? false,
          documentReminders: user.documentReminders ?? false,
          marketingEmails: user.marketingEmails ?? false,
        },
        dangerZone: {
          canDelete: activeApplication ? false : true,
        },
      },
    };
  }

  // 🔷 UPDATE NOTIFICATIONS
 // 🔷 UPDATE NOTIFICATIONS (FIXED)
async updateNotifications(userId: string, body: any) {
  console.log('USER ID =>', userId);
  console.log('BODY =>', body);

  const updateData: any = {};

  if (body.emailNotifications !== undefined)
    updateData.emailNotifications = body.emailNotifications;

  if (body.smsNotifications !== undefined)
    updateData.smsNotifications = body.smsNotifications;

  if (body.documentReminders !== undefined)
    updateData.documentReminders = body.documentReminders;

  if (body.marketingEmails !== undefined)
    updateData.marketingEmails = body.marketingEmails;

  const updatedUser = await this.userModel.findByIdAndUpdate(
    userId,
    { $set: updateData },   // ✅ FIXED
    { new: true }
  );

  if (!updatedUser) {
    throw new NotFoundException('User not found');
  }

  console.log('UPDATED USER =>', updatedUser);

  return {
    success: true,
    message: 'Notification updated successfully',
    data: updatedUser,
  };
}


  // 🔷 CHANGE PASSWORD
  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new BadRequestException('All fields required');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('New password & confirm password not match');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let match = false;

    // if hashed password
    if (user.password && user.password.startsWith('$2')) {
      match = await bcrypt.compare(currentPassword, user.password);
    } else {
      match = currentPassword === user.password;
    }

    if (!match) {
      throw new BadRequestException('Current password wrong');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }





 async deleteAccountRequestUser(userId: string) {

    console.log('\n========== DELETE ACCOUNT REQUEST START ==========');
    console.log('UserId =>', userId);

    if (!userId) {
      throw new BadRequestException('User ID is required.');
    }

    // 🔷 Check Applications
    const userApps = await this.applicationModel.find({ userId });

    console.log('Total Applications Found =>', userApps.length);

    if (!userApps || userApps.length === 0) {
      throw new BadRequestException(
        'Account deletion is not allowed because no completed application was found.',
      );
    }

    // 🔷 Check if any application still active
    const activeApp = userApps.find(
      (app) =>
        !app.application_stage_management?.includes('completed_stage'),
    );

    if (activeApp) {
      console.log('Active Application Found =>', activeApp._id);

      throw new BadRequestException(
        'Account deletion is not allowed while an application is still in progress.',
      );
    }

    // 🔷 Find user
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 🔷 Update dangerzone flag
    user.dangerzone = true;

    await user.save();

    console.log('Flag dangerzone set to TRUE for user =>', userId);

    return {
      success: true,
      message: 'Delete account request submitted successfully.',
      data: {
        dangerzone: user.dangerzone,
      },
    };
  }



async deleteAccount(userId: string) {
  try {
    console.log('\n========== ADMIN DELETE ACCOUNT START ==========');
    console.log('UserId =>', userId);

    if (!userId) {
      throw new BadRequestException(
        'User ID is required to delete the account.',
      );
    }

    const userApps = await this.applicationModel.find({ userId });

    console.log('Total Applications Found =>', userApps.length);

    if (!userApps || userApps.length === 0) {
      throw new BadRequestException(
        'Account deletion is not allowed because no completed application was found.',
      );
    }

    const activeApp = userApps.find(
      (app) =>
        !app.application_stage_management?.includes('completed_stage'),
    );

    if (activeApp) {
      console.log('Active Application Found =>', activeApp._id);

      throw new BadRequestException(
        'Account deletion is not allowed while an application is still in progress. Please complete the application first.',
      );
    }

    const deletedUser = await this.userModel.findByIdAndDelete(userId);

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    console.log('User account deleted successfully =>', userId);

    return {
      success: true,
      message: 'Your account has been deleted successfully.',
    };
  } catch (error) {
    console.error('ADMIN DELETE ACCOUNT ERROR =>', error);

    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }

    throw new BadRequestException('Failed to delete account');
  }
}

async getDangerzoneStatus(userId: string) {

  if (!userId) {
    throw new BadRequestException('User ID is required');
  }

  const user = await this.userModel
    .findById(userId)
    .select('dangerzone');

  if (!user) {
    throw new NotFoundException('User not found');
  }

  return {
    success: true,
    data: {
      dangerzone: user.dangerzone ?? false
    }
  };
}
}
