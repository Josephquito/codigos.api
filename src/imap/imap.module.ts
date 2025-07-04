import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';

@Module({
  controllers: [ImapController],
  providers: [ImapService],
})
export class ImapModule {}
