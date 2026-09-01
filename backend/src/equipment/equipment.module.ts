import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { TransfersController } from './transfers.controller';
import { AuthModule } from '../auth/auth.module';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [AuthModule, ExcelModule],
  providers: [EquipmentService],
  controllers: [EquipmentController, TransfersController],
})
export class EquipmentModule {}
