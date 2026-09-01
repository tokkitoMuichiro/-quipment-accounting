import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelController } from './excel.controller';
import { BitrixModule } from '../bitrix/bitrix.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BitrixModule, AuthModule],
  providers: [ExcelService],
  controllers: [ExcelController],
  exports: [ExcelService],
})
export class ExcelModule {}
