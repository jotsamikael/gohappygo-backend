import { Module } from '@nestjs/common';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadedFileEntity } from 'src/uploaded-file/uploaded-file.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([UploadedFileEntity]),
    CloudinaryModule,
    MulterModule.register({
      storage: memoryStorage()
    }),
  ],
  controllers: [FileUploadController],
  providers: [FileUploadService],
  exports:[FileUploadService]
})
export class FileUploadModule {}
