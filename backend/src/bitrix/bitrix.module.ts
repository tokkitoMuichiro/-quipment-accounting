import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixController } from './bitrix.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [BitrixService],
  controllers: [BitrixController],
  exports: [BitrixService],
})
export class BitrixModule {}
