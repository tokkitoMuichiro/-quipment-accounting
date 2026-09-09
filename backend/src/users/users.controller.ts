import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';

class AssignRoleDto {
  @IsString()
  roleId: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Patch(':id/role')
  @RequirePermissions('manage_roles')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.users.assignRole(id, dto.roleId);
  }
}
