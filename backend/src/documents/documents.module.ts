import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { BitrixModule } from '../bitrix/bitrix.module';
import { AuthModule } from '../auth/auth.module';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [BitrixModule, AuthModule, ExcelModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
