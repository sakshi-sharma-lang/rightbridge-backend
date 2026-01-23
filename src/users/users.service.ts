import { Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';


@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // Create a single user
  async create(userData: Partial<User>): Promise<User> {
    const createdUser = new this.userModel(userData);
    return createdUser.save();
  }

  // Get all users
  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  // Check if email exists
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Check if phone exists
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }


async updateLastLogin(userId: string): Promise<void> {
  await this.userModel.updateOne(
    { _id: userId },
    { $set: { lastLogin: new Date() } }
  );
}

async findById(userId: string) {
  return this.userModel.findById(userId).select('-password');
}

// async findByIdUserotpveify(id: string) {
//   return this.userModel.findById(id);
// }

async update(id: string, data: any) {
  return this.userModel.findByIdAndUpdate(id, data, { new: true });
}



// Update user by email or phone number
  async updateByEmailOrPhone(
  identifier: { email?: string; phoneNumber?: string },
  data: any,
) {
  const user = await this.userModel.findOne(identifier);

  if (!user) {
    throw new NotFoundException('User not found');
  }

  Object.assign(user, data);
  return user.save();
}

async findByResetToken(token: string) {
  return this.userModel.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });
}



}
