import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "../auth.service";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){

 constructor(private authService: AuthService){
     super({
           jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), //vlidate jwt token and extract user info from it
           ignoreExpiration: false,
           secretOrKey: 'jwt_secret' 
        })
 }

    async validate(payload: any) {
        try {
            // Convert payload.sub to number to ensure proper type
            const userId = parseInt(payload.sub, 10);
            
            if (isNaN(userId)) {
                throw new UnauthorizedException('Invalid user ID in token');
            }
            
            // Get the full user object with role
            const user = await this.authService.getUserById(userId);
            
            // Return the complete user object
            return user;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}