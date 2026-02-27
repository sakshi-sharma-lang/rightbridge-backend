import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { MailService } from '../mail/mail.service';
import { UpdateUserDto } from './dto/update-user-by-email.dto';

import { NotificationService } from '../notification/notification.service';
import { InjectModel } from '@nestjs/mongoose';
import { Admin } from '../admin/schemas/admin.schema';
import { Model } from 'mongoose';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService,
  private readonly mailService: MailService, 
   private readonly notificationService: NotificationService,
  @InjectModel(Admin.name)
  private adminModel: Model<Admin>,


    ) {}

  
  @Post('register')
  async create(@Body() createUserDto: CreateUserDto) {

    const { email, phoneNumber, password, ...rest } = createUserDto;

    // 🔹 Check email
    const emailExists = await this.usersService.findByEmail(email);

    // 🔹 Email exists but OTP NOT verified
    if (emailExists && !emailExists.isOtpVerified) {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const otp_expiry_time = 5;

      const updateData: any = {
        ...rest,
        phoneNumber,
        otp,
        otpExpiresAt,
        status: 'deactive',
        isOtpVerified: false,
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await this.usersService.update(emailExists._id.toString(), updateData);

      await this.mailService.sendOtpVerificationEmail(
        emailExists.email,
        emailExists.firstName,
        otp,
        otp_expiry_time,
      );

      return {
        message: 'OTP resent successfully. Please verify your email.',
        error: null,
        statusCode: 200,
      };
    }

    // 🔹 Email already verified
    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    // 🔹 Phone check
    const phoneExists = await this.usersService.findByPhoneNumber(phoneNumber);
    if (phoneExists) {
      throw new BadRequestException('Phone number already exists');
    }

    // 🔹 Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const otp_expiry_time = 5;

    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
      otp,
      otpExpiresAt,
      status: 'deactive',
      isOtpVerified: false,
    });

    await this.mailService.sendOtpVerificationEmail(
      user.email,
      `${user.firstName} ${user.lastName || ''}`,
      otp,
      otp_expiry_time,
    );

    // =====================================================
    // 🔔 NOTIFICATION BLOCK (ONLY ADDITION)
    // =====================================================
    try {

      // 🔹 Welcome notification to user
      await this.notificationService.sendToUser({
        userId: user._id.toString(),
        message: `Welcome ${user.firstName}, your account created successfully`,
        stage: 'user_registered',
        type: 'welcome',
      });

      // 🔹 Notify super admin
 const superAdmin = await this.adminModel
  .findOne({ role: 'super_admin' })
  .select('_id')
  .lean();

if (!superAdmin) {
  console.log('❌ Super admin not found');
} else {
  await this.notificationService.sendToAdmin({
    adminId: superAdmin._id.toString(),
    message: `New user registered: ${user.firstName} ${user.lastName || ''}`,
    stage: 'user_registered',
    type: 'registration',
  });
}
    

      console.log('✅ Register notifications sent');

    } catch (err) {
      console.log('❌ Register notification error:', err.message);
    }

    const {
      password: _pwd,
      otp: _otp,
      otpExpiresAt: _exp,
      ...result
    } = user.toObject();

    return {
      message: 'User registered successfully',
      error: null,
      statusCode: 201,
      data: result,
    };
  }



  // async create(@Body() createUserDto: CreateUserDto) { //  use DTO
  //   const { email, phoneNumber, password } = createUserDto;

  //   // Check duplicates
  //   const emailExists = await this.usersService.findByEmail(email);
  //   if (emailExists) {
  //     throw new BadRequestException('Email already exists');
  //   }

  //   const phoneExists = await this.usersService.findByPhoneNumber(phoneNumber);
  //   if (phoneExists) {
  //     throw new BadRequestException('Phone number already exists');
  //   }
  //   const hashedPassword = await bcrypt.hash(password, 10);
  //   const otp = Math.floor(1000 + Math.random() * 9000).toString();
  //   const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  //   const otp_expiry_time = 5;


  //   const user = await this.usersService.create({
  //     ...createUserDto,
  //     password: hashedPassword,
  //     otp,
  //     otpExpiresAt,
  //     status: 'deactive',
  //     isOtpVerified: false,
  //   });

  //   await this.mailService.sendOtpVerificationEmail(
  //   user.email,
  //   user.firstName,
  //   otp,
  //   otp_expiry_time,
  // );

  //   const {
  //   password: _pwd,
  //   otp: _otp,
  //   otpExpiresAt: _exp,
  //   ...result
  // } = user.toObject();
  //   return result;
  // }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(user => {
      const { password, ...rest } = user.toObject();
      return rest;
    });
  }


@Post('otp/verify-by-email-or-phone')
async updateUserOtp(@Body() dto: UpdateUserDto) {
  const { email, phoneNumber } = dto;


  if (!email && !phoneNumber) {
    throw new BadRequestException('Email or phone number is required');
  }

  let user;

  if (email) {
    user = await this.usersService.findByEmail(email);
  } else if (phoneNumber) {
    user = await this.usersService.findByPhoneNumber(phoneNumber);
  }

  if (!user) {
    throw new BadRequestException('User not found');
  }

  //  BLOCK IF ALREADY VERIFIED
  // if (user.isOtpVerified === true) {
  //   throw new BadRequestException(
  //     'User already verified. OTP resend not allowed.',
  //   );
  // }

  if (dto.type !== 'FORGOT_PASSWORD' && user.isOtpVerified === true) {
  throw new BadRequestException(
    'User already verified. OTP resend not allowed.',
  );
}



if (dto.type === 'FORGOT_PASSWORD') {
  user.isForgetPasswordVerified = false; // reset before verification
} else {
  user.isOtpVerified = false; // only for REGISTER / LOGIN
}
  // 🔢 Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const otp_expiry_time = 5;

  //  Update OTP fields only
  user.otp = otp;
  user.otpExpiresAt = otpExpiresAt;


  await user.save();

  // 📧 Send OTP email
  await this.mailService.sendOtpVerificationEmail(
    user.email,
    `${user.firstName} ${user.lastName || ''}`,
    otp,
    otp_expiry_time,
  );

  return {
      statusCode: 200,
    message: 'OTP sent successfully. Please verify your email.',
  };
}




}
