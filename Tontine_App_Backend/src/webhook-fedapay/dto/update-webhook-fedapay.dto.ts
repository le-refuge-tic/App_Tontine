import { PartialType } from '@nestjs/swagger';
import { CreateWebhookFedapayDto } from './create-webhook-fedapay.dto';

export class UpdateWebhookFedapayDto extends PartialType(CreateWebhookFedapayDto) {}
