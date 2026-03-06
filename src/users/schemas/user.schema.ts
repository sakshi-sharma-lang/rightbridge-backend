import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ default: 'active'})
  status: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  resetPasswordToken?: string;

  @Prop({ required: false })
  countryCode: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ default: null })
  lastLogin?: Date;

  @Prop({ default: null })
  otp?: string;

  @Prop({ default: null })
  otpExpiresAt?: Date;

  @Prop({ type: Boolean, default: false })
  dangerzone?: boolean;

  @Prop({ default: false })
  isOtpVerified?: boolean;

  @Prop({ default: false })
  isForgetPasswordVerified?: boolean;

  @Prop({ default: 0 })
  forgotPasswordCount?: number;

  @Prop({ default: null })
  forgotPasswordLastRequest?: Date;

  // 🔷 SETTINGS
// SETTINGS
@Prop({ type: Boolean, default: true })
emailNotifications: boolean;

@Prop({ type: Boolean, default: true })
smsNotifications: boolean;

@Prop({ type: Boolean, default: true })
documentReminders: boolean;

@Prop({ type: Boolean, default: false })
marketingEmails: boolean;

  // 🔷 ADD THIS FOR TIMESTAMPS FIX
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
