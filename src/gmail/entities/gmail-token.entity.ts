// src/auth/gmail-token.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gmail_tokens')
export class GmailToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'jsonb' })
  token!: object;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
