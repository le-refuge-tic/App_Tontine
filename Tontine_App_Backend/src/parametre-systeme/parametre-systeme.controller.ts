import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParametreSystemeService } from './parametre-systeme.service';
import { CreateParametreSystemeDto } from './dto/create-parametre-systeme.dto';
import { UpdateParametreSystemeDto } from './dto/update-parametre-systeme.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

/** Paramètres système — admin seulement. */
@ApiTags('parametres-systeme')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('parametres-systeme')
export class ParametreSystemeController {
  constructor(private readonly service: ParametreSystemeService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':cle')
  findOne(@Param('cle') cle: string) { return this.service.findOne(cle); }

  @Post()
  create(@Body() dto: CreateParametreSystemeDto) { return this.service.create(dto); }

  @Patch(':cle')
  update(@Param('cle') cle: string, @Body() dto: UpdateParametreSystemeDto) {
    return this.service.update(cle, dto);
  }

  @Delete(':cle')
  remove(@Param('cle') cle: string) { return this.service.remove(cle); }
}
