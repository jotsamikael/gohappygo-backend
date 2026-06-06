import { Module } from '@nestjs/common';
import { IsUniqueConstraint } from './pipe/isUniqueConstraint.pipe';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { RoleModule } from 'src/role/role.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { CommonModule } from 'src/common/common.module';

import { UserMapper } from './user.mapper';

@Module({
  imports:[
    TypeOrmModule.forFeature([UserEntity]),
    RoleModule,
    FileUploadModule,
    CommonModule
  ],
  providers:[UserService, UserMapper, IsUniqueConstraint],
  exports:[UserService]
})
export class UserModule {}
