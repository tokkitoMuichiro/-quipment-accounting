import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { DocumentsSyncService } from './documents-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { DOC_MAX_BYTES, UploadedMemoryFile } from '../bitrix/document.constants';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly sync: DocumentsSyncService,
  ) {}

  @Post('documents/sync')
  syncAll() {
    return this.sync.syncAll();
  }

  @Get('equipment/:id/documents')
  list(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documents.list(id, user);
  }

  @Post('equipment/:id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: DOC_MAX_BYTES },
    }),
  )
  upload(
    @Param('id') id: string,
    @UploadedFile() file: UploadedMemoryFile,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.upload(id, file, user);
  }

  @Get('documents/:id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.documents.download(id, user);
    const encoded = encodeURIComponent(file.originalName);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encoded}`,
    );
    res.send(file.buffer);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documents.remove(id, user);
  }
}
