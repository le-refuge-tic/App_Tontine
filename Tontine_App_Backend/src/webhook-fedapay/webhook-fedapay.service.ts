import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookFedapay } from './entities/webhook-fedapay.entity';
import { CreateWebhookFedapayDto } from './dto/create-webhook-fedapay.dto';

/**
 * Service des webhooks FedaPay. Enregistre le payload brut reçu ; le traitement
 * métier sera implémenté plus tard.
 */
@Injectable()
export class WebhookFedapayService {
  constructor(
    @InjectRepository(WebhookFedapay) private readonly repo: Repository<WebhookFedapay>,
  ) {}

  findAll(): Promise<WebhookFedapay[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<WebhookFedapay> {
    const webhook = await this.repo.findOneBy({ id });
    if (!webhook) {
      throw new NotFoundException(`Webhook FedaPay introuvable : ${id}.`);
    }
    return webhook;
  }

  /** Enregistre le payload brut d'un appel reçu de FedaPay. */
  async create(dto: CreateWebhookFedapayDto): Promise<WebhookFedapay> {
    const webhook = this.repo.create({
      evenement: dto.evenement,
      payload: dto.payload,
      traite: dto.traite,
    });
    return this.repo.save(webhook);
  }
}
