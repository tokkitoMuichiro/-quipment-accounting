import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import {
  BulkTransferDto,
  CreateEquipmentDto,
  FlagFillDto,
  TransferEquipmentDto,
  UpdateEquipmentDto,
} from './equipment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';

@Controller('equipment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('category') category?: string,
  ) {
    return this.equipment.list(user, scope, warehouseId, ownerUserId, category);
  }

  @Get('alerts')
  alerts(@CurrentUser() user: AuthUser) {
    return this.equipment.alerts(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.get(id, user);
  }

  @Post()
  @RequirePermissions('create')
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: AuthUser) {
    return this.equipment.create(dto, user);
  }

  @Post('bulk-transfer')
  @RequirePermissions('transfer')
  bulkTransfer(@Body() dto: BulkTransferDto, @CurrentUser() user: AuthUser) {
    return this.equipment.bulkTransfer(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.remove(id, user);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.acceptTransfer(id, user);
  }

  @Post(':id/cancel-pending')
  cancelPending(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.cancelPendingTransfer(id, user);
  }

  @Post(':id/flag-fill')
  flagFill(
    @Param('id') id: string,
    @Body() dto: FlagFillDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.flagFill(id, dto, user);
  }

  @Post(':id/confirm-fill')
  confirmFill(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.confirmFill(id, user);
  }

  @Post(':id/transfer')
  @RequirePermissions('transfer')
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferEquipmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.transfer(id, dto, user);
  }
}
