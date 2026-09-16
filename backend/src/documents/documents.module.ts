import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsSyncService } from './documents-sync.service';
import { DocumentsController } from './documents.controller';
import { BitrixModule } from '../bitrix/bitrix.module';
import { AuthModule } from '../auth/auth.module';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [BitrixModule, AuthModule, ExcelModule],
  providers: [DocumentsService, DocumentsSyncService],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentsSyncService],
})
export class DocumentsModule {}
