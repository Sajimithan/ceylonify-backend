import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AppResolver } from './app.resolver';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { MeResolver } from './me/me.resolver';
import { ListingsResolver } from './listings/listings.resolver';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminGuard } from './auth/admin.guard';
import { AuthGuard } from './auth/auth.guard';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      playground: true,
    }),
    HealthModule,
    NotificationsModule,
  ],
  controllers: [UploadController],
  providers: [AppResolver, MeResolver, ListingsResolver, AdminGuard, AuthGuard],
})
export class AppModule {}
