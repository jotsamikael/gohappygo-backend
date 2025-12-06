import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRoleEntity } from './userRole.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity])],

  controllers: [RoleController],
  providers: [RoleService],
  exports:[RoleService]
})
export class RoleModule {}
