import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { MailService } from '../mail/mail.service';
import { UpdateUserDto } from './dto/update-user-by-email.dto';


@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService,
  private readonly mailService: MailService, 


    ) {}

  
  @Post('register')
 async create(@Body() createUserDto: CreateUserDto) { // ✅ use DTO
  const { email, phoneNumber, password, ...rest } = createUserDto;

  // 🔹 Check email
  const emailExists = await this.usersService.findByEmail(email);

  // 🟡 ADD: Email exists but OTP NOT verified → update ALL fields except email
  if (emailExists && !emailExists.isOtpVerified) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const otp_expiry_time = 5;

    const updateData: any = {
      ...rest,               // ✅ update all other fields
      phoneNumber,           // ✅ update phone
      otp,
      otpExpiresAt,
      status: 'deactive',
      isOtpVerified: false,
    };

    // ✅ Update password ONLY if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await this.usersService.update(emailExists._id.toString(), updateData);

    await this.mailService.sendOtpVerificationEmail(
      emailExists.email,     // ✅ email unchanged
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

  // 🔴 EXISTING: Email already exists (verified user)
  if (emailExists) {
    throw new BadRequestException('Email already exists');
  }

  // 🔹 EXISTING: Phone check
  const phoneExists = await this.usersService.findByPhoneNumber(phoneNumber);
  if (phoneExists) {
    throw new BadRequestException('Phone number already exists');
  }

  // 🔹 EXISTING: Create new user
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
    user.firstName,
    otp,
    otp_expiry_time,
  );

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


  // async create(@Body() createUserDto: CreateUserDto) { // ✅ use DTO
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

  // 🚫 BLOCK IF ALREADY VERIFIED
  if (user.isOtpVerified === true) {
    throw new BadRequestException(
      'User already verified. OTP resend not allowed.',
    );
  }

  // 🔢 Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const otp_expiry_time = 5;

  // 🔐 Update OTP fields only
  user.otp = otp;
  user.otpExpiresAt = otpExpiresAt;
  user.isOtpVerified = false;

  await user.save();

  // 📧 Send OTP email
  await this.mailService.sendOtpVerificationEmail(
    user.email,
    user.firstName,
    otp,
    otp_expiry_time,
  );

  return {
      statusCode: 200,
    message: 'OTP sent successfully. Please verify your email.',
  };
}




}
