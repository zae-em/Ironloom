import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserContext } from '@ironloom/shared';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUserContext) {
    return this.usersService.getProfile(user.userId, user.email);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUserContext,
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(user.userId, body);
  }
}
