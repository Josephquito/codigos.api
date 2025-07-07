import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAccessKey } from 'src/correo/entities/platform-access-key.entity';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';

@Injectable()
export class CuentasService {
  constructor(
    @InjectRepository(PlatformAccessKey)
    private readonly repo: Repository<PlatformAccessKey>,
  ) {}
  async findAll() {
    const registros = await this.repo.find();

    const cuentasMap = new Map<string, any>();

    for (const reg of registros) {
      const correo = reg.emailAlias.toLowerCase();
      const plataforma = reg.plataforma.toLowerCase();
      const clave = reg.clave;

      if (!cuentasMap.has(correo)) {
        cuentasMap.set(correo, {
          correo,
          disney: 'Sin asignar',
          netflix: 'Sin asignar',
          prime: 'Sin asignar',
          chatgpt: 'Sin asignar',
          crunchyroll: 'Sin asignar',
        });
      }

      const cuenta = cuentasMap.get(correo);
      cuenta[plataforma] = clave;
    }

    return Array.from(cuentasMap.values());
  }

  async findByEmail(email: string) {
    const registros = await this.repo.find({
      where: { emailAlias: email.toLowerCase() },
    });

    if (registros.length === 0) return [];

    const cuenta = {
      correo: email.toLowerCase(),
      disney: 'Sin asignar',
      netflix: 'Sin asignar',
      prime: 'Sin asignar',
      chatgpt: 'Sin asignar',
      crunchyroll: 'Sin asignar',
    };

    for (const reg of registros) {
      const plataforma = reg.plataforma.toLowerCase();
      cuenta[plataforma] = reg.clave;
    }

    return [cuenta];
  }

  async create(dto: CreateCuentaDto): Promise<PlatformAccessKey> {
    const nueva = this.repo.create({
      emailAlias: dto.emailAlias.toLowerCase(),
      plataforma: dto.plataforma.toLowerCase(),
      clave: dto.clave,
    });
    return this.repo.save(nueva);
  }
  async update(
    emailAlias: string,
    plataforma: string,
    dto: UpdateCuentaDto,
  ): Promise<PlatformAccessKey | null> {
    const entry = await this.repo.findOneBy({
      emailAlias: emailAlias.toLowerCase(),
      plataforma: plataforma.toLowerCase(),
    });

    if (!entry) return null;

    entry.clave = dto.clave;
    return this.repo.save(entry);
  }
}
