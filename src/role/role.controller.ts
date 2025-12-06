import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { UserRoleEntity } from './userRole.entity';
import { CreateUserRoleDto } from './dto/createRole.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { FindRolesQueryDto } from './dto/FindRolesQuery.dto';
import { UpdateUserRoleDto } from './dto/updateRole.dto';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('role')
@Controller('role')
export class RoleController {

    constructor(private readonly roleService: RoleService){

    }

    @Post('')
    @ApiBearerAuth('JWT-auth') 
    @ApiOperation({ summary: 'Create a user role' })
    @ApiBody({ type: CreateUserRoleDto })
    @ApiResponse({ status: 201, description: 'User role created successfully',type: UserRoleEntity })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async createUserRole(@Body() createUserRoleDto:CreateUserRoleDto, @CurrentUser() user: any ): Promise<UserRoleEntity>{    
    return this.roleService.createUserRole(createUserRoleDto, user);
    }

    @Get()
    @ApiBearerAuth('JWT-auth') 
    @ApiOperation({ summary: 'Get all roles' })
    @ApiResponse({ status: 200, description: 'Roles fetched successfully',type: UserRoleEntity })
    @ApiResponse({ status: 400, description: 'Bad request' })
   async getAllRoles(
    @Query() query : FindRolesQueryDto
   ): Promise<PaginatedResponse<UserRoleEntity>>{
       return this.roleService.getAllRoles(query);
    }

    @Put(':id')
    @ApiBearerAuth('JWT-auth') 
    @ApiOperation({ summary: 'Update a user role' })
    @ApiResponse({ status: 200, description: 'User role updated successfully',type: UserRoleEntity })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async updateRole(@Param('id', ParseIntPipe) id: number, @Body() updateUserRoleDto:UpdateUserRoleDto, @CurrentUser() user: any ){
        return this.roleService.updateUserRole(id, updateUserRoleDto, user)
    }

    @Roles(UserRole.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    @ApiBearerAuth('JWT-auth') 
    @ApiOperation({ summary: 'Delete a user role' })
    @ApiResponse({ status: 200, description: 'User role deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async removeRole(@Param('id', ParseIntPipe) id: number):Promise<void>{
        this.roleService.deleteRole(id)
    }
}
