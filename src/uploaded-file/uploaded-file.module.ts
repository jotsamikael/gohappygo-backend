import { Module } from '@nestjs/common';
import { UploadedFileController } from './uploaded-file.controller';
import { UploadedFileService } from './uploaded-file.service';

@Module({
  controllers: [UploadedFileController],
  providers: [UploadedFileService]
})
export class UploadedFileModule {}
