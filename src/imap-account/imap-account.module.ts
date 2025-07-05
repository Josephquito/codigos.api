import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImapAccount } from './entities/imap-account.entity';
import { ImapAccountService } from './imap-account.service';
import { ImapAccountController } from './imap-account.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImapAccount])],
  providers: [ImapAccountService],
  controllers: [ImapAccountController],
  exports: [ImapAccountService], // Para usarlo en otros servicios
})
export class ImapAccountModule {}
