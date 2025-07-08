import { Injectable } from '@nestjs/common';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  create(RegisterDto: RegisterDto) {
    return this.userRepository.save(RegisterDto);
  }

  findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }
}
