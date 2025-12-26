import { Controller, Post, Get, Body, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users/register')
export class UsersController {
  constructor(private usersService: UsersService) {}

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

    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const { password: _pwd, ...result } = user.toObject();
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
