// validators/is-unique.validator.ts
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { UserService } from '../user.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly usersService: UserService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const field = args.property;
    const user = await this.usersService.findByField(field, value);
    return !user; // valid if user not found
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} is already in use.`;
  }
}
