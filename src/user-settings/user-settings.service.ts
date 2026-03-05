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
    { $set: updateData },
    { new: true }
  );

  if (!updatedUser) throw new NotFoundException('User not found');

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





// async userdeleteAccountConf(userId: string) {
//   try {
//     console.log('\n========== DELETE ACCOUNT START ==========');
//     console.log('UserId =>', userId);

//     if (!userId) {
//       throw new BadRequestException('User ID is required.');
//     }

//     const userApps = await this.applicationModel.find({ userId });

//     console.log('Total Applications Found =>', userApps.length);

//     if (userApps.length === 0) {
//       throw new BadRequestException(
//         'Account deletion is not allowed because no completed application was found.',
//       );
//     }

//     const activeApp = userApps.find(
//       (app) => !app.application_stage_management?.includes('completed_stage'),
//     );

//     if (activeApp) {
//       console.log('Active Application Found');
//       console.log('ApplicationId =>', activeApp._id);

//       throw new BadRequestException(
//         'Account deletion is not allowed while an application is still in progress.',
//       );
//     }

//     await this.userModel.findByIdAndUpdate(
//       userId,
//       { danderzone: true },
//       { new: true },
//     );

//     console.log('Flag danderzone set to TRUE for user =>', userId);

//     return {
//       success: true,
//       message: 'Flag updated successfully.',
//     };
//   } catch (error) {
//     console.log('DELETE ACCOUNT ERROR =>', error.message);
//     throw error;
//   }
// }

}
