import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';

@Module({
  controllers: [ImapController],
  providers: [ImapService],
  exports: [ImapService],
})
export class ImapModule {}
