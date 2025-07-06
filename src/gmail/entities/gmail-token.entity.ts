// src/auth/gmail-token.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Credentials } from 'google-auth-library';

@Entity('gmail_tokens')
export class GmailToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  // ✅ Aquí especificamos el tipo Credentials en lugar de 'object'
  @Column({ type: 'jsonb' })
  token!: Credentials;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
