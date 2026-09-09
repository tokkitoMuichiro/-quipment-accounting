import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixController } from './bitrix.controller';
import { NotifyService } from './notify.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [BitrixService, NotifyService],
  controllers: [BitrixController],
  exports: [BitrixService, NotifyService],
})
export class BitrixModule {}
