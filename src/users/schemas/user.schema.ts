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

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ default: null })
  lastLogin?: Date;

    @Prop({ default: null })
  otp?: string;

  @Prop({ default: null })
  otpExpiresAt?: Date;

  @Prop({ default: false })
  isOtpVerified?: boolean;


}

export const UserSchema = SchemaFactory.createForClass(User);
