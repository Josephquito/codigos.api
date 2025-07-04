import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GmailModule } from './gmail/gmail.module';
import { AuthModule } from './auth/auth.module';
import { ImapModule } from './imap/imap.module';

@Module({
  imports: [GmailModule, AuthModule, ImapModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
