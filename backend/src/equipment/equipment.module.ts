import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { TransfersController } from './transfers.controller';
import { AuthModule } from '../auth/auth.module';
import { ExcelModule } from '../excel/excel.module';
import { BitrixModule } from '../bitrix/bitrix.module';

@Module({
  imports: [AuthModule, ExcelModule, BitrixModule],
  providers: [EquipmentService],
  controllers: [EquipmentController, TransfersController],
})
export class EquipmentModule {}
