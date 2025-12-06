import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

export class CustomBadRequestException extends BadRequestException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 400,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomForbiddenException extends ForbiddenException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 403,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomConflictException extends ConflictException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 409,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomNotFoundException extends NotFoundException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 404,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomUnauthorizedException extends UnauthorizedException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 401,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomRequestNotCompletedException extends BadRequestException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 400,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Exception thrown when a request is not linked to a travel or demand
 */
export class CustomRequestNotLinkedToTravelOrDemandException extends BadRequestException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 400,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomReviewAlreadyExistsException extends BadRequestException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 400,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomInternalServerErrorException extends InternalServerErrorException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: 500,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

export class CustomThrottlerException extends HttpException {
  constructor(message: string, public errorCode: string) {
    super({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      errorCode,
      message,
      timestamp: new Date().toISOString()
    }, HttpStatus.TOO_MANY_REQUESTS);
  }
}