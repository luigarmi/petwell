import { Body, Controller, Get, Headers, Inject, Ip, Post } from '@nestjs/common';

import { ForgotPasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RegisterOwnerDto, ResetPasswordDto } from './dto/auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterOwnerDto) {
    return this.authService.registerOwner(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.authService.login(dto, userAgent, ipAddress);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return this.authService.refresh(dto, userAgent, ipAddress);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('demo-users')
  getDemoUsers() {
    return this.authService.getDemoUsers();
  }
}
