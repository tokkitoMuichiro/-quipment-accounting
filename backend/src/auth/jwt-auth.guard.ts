import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token =
      header?.startsWith('Bearer ') ? header.slice(7) : request.cookies?.token;

    if (!token) {
      throw new UnauthorizedException('Нужна авторизация');
    }

    try {
      const payload = this.jwt.verify(token);
      const user = await this.auth.loadUser(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Сессия недействительна');
    }
  }
}
