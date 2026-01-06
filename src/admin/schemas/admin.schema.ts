import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { AdminRole } from '../../common/enums/admin-role.enum';

export type AdminDocument = Admin & Document;

@Schema({ timestamps: true })
export class Admin {
  

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    enum: Object.values(AdminRole),
    default: AdminRole.ADMIN,
  })
  role: AdminRole;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: 'admin' })
  appId: string;

  @Prop({ default: null })
  lastLogin: Date;

}

export const AdminSchema = SchemaFactory.createForClass(Admin);
