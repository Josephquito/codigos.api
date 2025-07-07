import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAccessKey } from 'src/correo/entities/platform-access-key.entity';

@Injectable()
export class PlataformaClaveService {
  constructor(
    @InjectRepository(PlatformAccessKey)
    private readonly repo: Repository<PlatformAccessKey>,
  ) {}

  async validar(
    email: string,
    plataforma: string,
    clave: string,
  ): Promise<boolean> {
    const acceso = await this.repo
      .createQueryBuilder('key')
      .where('LOWER(key.emailAlias) = LOWER(:email)', { email })
      .andWhere('LOWER(key.plataforma) = LOWER(:plataforma)', { plataforma })
      .getOne();

    return !!acceso && acceso.clave === clave;
  }
}
