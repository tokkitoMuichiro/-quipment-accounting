import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExcelService } from './excel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';

@Controller('excel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExcelController {
  constructor(private readonly excel: ExcelService) {}

  @Get('download')
  @RequirePermissions('export_excel')
  async download(@Res() res: Response) {
    const buffer = await this.excel.buildWorkbookBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      "attachment; filename*=UTF-8''%D0%A3%D1%87%D1%91%D1%82%20%D0%BE%D0%B1%D0%BE%D1%80%D1%83%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F.xlsx",
    );
    res.send(buffer);
  }

  @Post('sync')
  @RequirePermissions('export_excel')
  async sync() {
    return this.excel.syncToBitrix();
  }
}
