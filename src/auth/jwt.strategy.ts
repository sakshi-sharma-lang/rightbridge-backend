import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
});
  }

  async validate(payload: any) {
     console.log('JWT PAYLOAD IN STRATEGY:', payload);
    return {
      userId: payload.sub || payload.userId,
      email: payload.email,
    };
  }
}
