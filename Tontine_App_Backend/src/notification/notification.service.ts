import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  findAll(membreId?: number): Promise<Notification[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Notification> {
    const n = await this.repo.findOne({ where: { id }, relations: { membre: true } });
    if (!n) throw new NotFoundException(`Notification introuvable : ${id}.`);
    if (membreId !== undefined && n.membre.id !== membreId) {
      throw new NotFoundException(`Notification introuvable : ${id}.`);
    }
    return n;
  }

  async markAsRead(id: number, membreId?: number): Promise<void> {
    await this.findOne(id, membreId);
    await this.repo.update(id, { lue: true });
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const n = this.repo.create({
      type: dto.type, message: dto.message, lue: dto.lue, membre: { id: dto.membreId },
    });
    return this.repo.save(n);
  }
}
