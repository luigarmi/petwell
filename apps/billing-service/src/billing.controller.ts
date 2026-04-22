import { Body, Controller, Get, Headers, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, PaymentProviderName, UserRole } from '@petwell/shared-types';

import { BillingService } from './billing.service';
import { RefundPaymentDto, SyncMercadoPagoPaymentDto } from './dto/payment.dto';

@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get('payments/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getSummary(@CurrentUser() user: JwtUserClaims) {
    return this.billingService.summary(user);
  }

  @Get('payments/appointment/:appointmentId/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getLatestPayment(@CurrentUser() user: JwtUserClaims, @Param('appointmentId') appointmentId: string) {
    return this.billingService.getLatestPaymentForAppointment(user, appointmentId);
  }

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getPayment(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string) {
    return this.billingService.getPaymentById(user, paymentId);
  }

  @Get('payments/:id/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getReceipt(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string) {
    return this.billingService.getReceipt(user, paymentId);
  }

  @Post('payments/:id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  retryPayment(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string) {
    return this.billingService.retryPayment(user, paymentId);
  }

  @Post('payments/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  refundPayment(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string, @Body() dto: RefundPaymentDto) {
    return this.billingService.refundPayment(user, paymentId, dto);
  }

  @Post('payments/:id/mercadopago/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  syncMercadoPagoPayment(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string, @Body() dto: SyncMercadoPagoPaymentDto) {
    return this.billingService.syncMercadoPagoPayment(user, paymentId, dto);
  }

  @Post('payments/:id/mock/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  approveMock(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string) {
    return this.billingService.approveMockPayment(user, paymentId);
  }

  @Post('payments/:id/mock/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  declineMock(@CurrentUser() user: JwtUserClaims, @Param('id') paymentId: string) {
    return this.billingService.declineMockPayment(user, paymentId);
  }

  @Post('webhooks/wompi')
  handleWompiWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.billingService.handleProviderWebhook(PaymentProviderName.WOMPI, body, headers, query);
  }

  @Post('webhooks/mercadopago')
  handleMercadoPagoWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.billingService.handleProviderWebhook(PaymentProviderName.MERCADOPAGO, body, headers, query);
  }
}
