import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

import { Application, ApplicationSchema } from './schemas/application.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { MailModule } from '../mail/mail.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Application.name, schema: ApplicationSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },  
    ]),
    MailModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
