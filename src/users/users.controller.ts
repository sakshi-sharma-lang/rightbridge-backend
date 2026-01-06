import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { MailService } from '../mail/mail.service';

@Controller('users/register')
export class UsersController {
  constructor(private usersService: UsersService,
  private readonly mailService: MailService, 


    ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) { // ✅ use DTO
    const { email, phoneNumber, password } = createUserDto;

    // Check duplicates
    const emailExists = await this.usersService.findByEmail(email);
    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    const phoneExists = await this.usersService.findByPhoneNumber(phoneNumber);
    if (phoneExists) {
      throw new BadRequestException('Phone number already exists');
    }
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
    return result;
  }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(user => {
      const { password, ...rest } = user.toObject();
      return rest;
    });
  }
}
