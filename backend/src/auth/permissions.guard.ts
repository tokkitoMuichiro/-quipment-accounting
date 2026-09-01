import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../common/require-permissions.decorator';
import { Permission, hasPermission } from '../common/permissions';
import { AuthUser, rolePermissions } from '../common/auth-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    if (!user) {
      throw new ForbiddenException();
    }

    if (!hasPermission(rolePermissions(user), required)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
