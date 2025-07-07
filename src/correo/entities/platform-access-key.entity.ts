import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('platform_access_keys')
export class PlatformAccessKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: false })
  emailAlias!: string;

  @Column()
  plataforma!: string;

  @Column()
  clave!: string;
}
