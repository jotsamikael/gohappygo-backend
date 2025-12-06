import { SetMetadata } from "@nestjs/common";
import { UserRole } from "../../user/user.entity";


//Unique identifier for storing and retrieving role requirements as meta data on route handlers
export const ROLES_KEY = "roles";


//roles decorator marks the routes with the roles that are allowed to access them
//roles guard will later reads this metdata to check if the user has permission
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);