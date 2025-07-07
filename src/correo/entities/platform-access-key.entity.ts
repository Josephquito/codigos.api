import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('platform_access_keys')
export class PlatformAccessKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'email_alias', nullable: false })
  emailAlias!: string;

  @Column({ name: 'plataforma', nullable: false })
  plataforma!: string;

  @Column({ name: 'clave', nullable: false })
  clave!: string;
}
