import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRoleEntity } from './userRole.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserRoleDto } from './dto/createRole.dto';
import { UpdateUserRoleDto } from './dto/updateRole.dto';
import { UserEntity } from 'src/user/user.entity';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { FindRolesQueryDto } from './dto/FindRolesQuery.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RoleService implements OnModuleInit {
  
      private roleListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(UserRoleEntity)
    private userRoleRespository: Repository<UserRoleEntity>,
     //Inject cache manager
     @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  async getUserRoleById(roleId: number): Promise<UserRoleEntity> {
    const UserRoleEntity = await this.userRoleRespository.findOneBy({ id:roleId });
    if (!UserRoleEntity) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }
    return UserRoleEntity;
  }


  private generateRoleListCacheKey(query: FindRolesQueryDto): string {
        const { page = 1, limit = 10, code } = query;
        return `roles_list_page${page}_limit${limit}_code${code || 'all'}`;
    }

    
  async getAllRoles(query: FindRolesQueryDto): Promise<PaginatedResponse<UserRoleEntity>>{
    //generate cache key
      const cacheKey = this.generateRoleListCacheKey(query);
      //add cache key to memory
      this.roleListCacheKeys.add(cacheKey)

      //get data from cache
      const getCachedData = await this.cacheManager.get<PaginatedResponse<UserRoleEntity>>(cacheKey);
           if (getCachedData) {
            console.log(`Cache Hit---------> Returning roles list from Cache ${cacheKey}`)
            return getCachedData
        }
        console.log(`Cache Miss---------> Returning roles list from database`)
        const { page = 1, limit = 10, code } = query;
        const skip = (page - 1) * limit;
        const queryBuilder = this.userRoleRespository.createQueryBuilder('role')
        .orderBy('role.created_at', 'DESC').skip(skip).take(limit)

        if (code) {
            // Change from ILIKE to LIKE (MySQL is case-insensitive by default)
            queryBuilder.andWhere('role.code LIKE :code', { code: `%${code}%` })
            
            // Or use LOWER() for explicit case-insensitive search:
            // queryBuilder.andWhere('LOWER(role.code) LIKE LOWER(:code)', { code: `%${code}%` })
        }

        const [items, totalItems] = await queryBuilder.getManyAndCount();

        const totalPages = Math.ceil(totalItems / limit);

        const responseResult = {
            items,
            meta: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems,
                totalPages,
                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages
            }
        }
        await this.cacheManager.set(cacheKey, responseResult, 30000);
        return responseResult;

  }

  async createUserRole(
    createUserRoleDto: CreateUserRoleDto,
    user:UserEntity
  ): Promise<UserRoleEntity> {
    const newUserRole = this.userRoleRespository.create({
      name: createUserRoleDto.name,
      code: createUserRoleDto.code,
      description: createUserRoleDto.description,
      createdBy: user.id
    });

    //check wether the element already exists
    const existing = await this.userRoleRespository.findOne({
      where: { code: createUserRoleDto.code },
      withDeleted: true,
    });
    //if it already exists simply restore it
    if (existing?.deletedAt) {
      await this.userRoleRespository.restore(existing.id);
      return existing;
    }

    if (existing) {
      throw new ConflictException(
        `Role with code ${createUserRoleDto.code} already exists.`,
      );
    }

    return this.userRoleRespository.save(newUserRole);
  }

  async updateUserRole(
    id: number,
    updateUserRoleDto: UpdateUserRoleDto,
    user: UserEntity
  ): Promise<UserRoleEntity> {
    //find the current role
    const currentUserRole = await this.userRoleRespository.findBy({ id });

    if (!currentUserRole) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    // create the payload
    const updatedUserRole = this.userRoleRespository.create({
      name: updateUserRoleDto.name,
      code: updateUserRoleDto.code,
      description: updateUserRoleDto.description,
      updatedBy: user.id
    });
    //save updated user role
    return this.userRoleRespository.save(updatedUserRole);
  }

  //returns a user role based on the name of the role
  async getUserRoleIdByCode(code: string): Promise<UserRoleEntity | null> {
    const UserRoleEntity = await this.userRoleRespository.findOneBy({ code });
    if (!UserRoleEntity) {
      throw new NotFoundException(`Role with code ${code} not found`);
    }
    return UserRoleEntity;
  }

  async deleteRole(id: number) {
    //find the current role
    const currentUserRole = await this.userRoleRespository.findBy({ id });

    if (!currentUserRole) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    this.userRoleRespository.softRemove(currentUserRole);
  }


  //load roles to db on app startup
  async seedRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: 'Administrator',
        code: 'ADMIN',
        description: 'Administers GohappyGo platform',
      },
      { name: 'GoHappyGo User', code: 'USER', description: 'Uses the GohappyGo platform' },
      {
        name: 'Operator',
        code: 'OPERATOR',
        description: 'Does operational task on the GohappyGo platform',
      },
    ];

    for (const role of defaultRoles) {
      const existing = await this.userRoleRespository.findOneBy({
        code: role.code,
      });
      if (!existing) {
        await this.userRoleRespository.save(role);
        console.log(`🟢 Role '${role.code}' created`);
      } else {
        console.log(`🟡 Role '${role.code}' already exists`);
      }
    }
  }
}
