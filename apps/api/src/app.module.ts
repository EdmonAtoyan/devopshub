import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import * as path from "path";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { FeedModule } from "./modules/feed/feed.module";
import { ArticlesModule } from "./modules/articles/articles.module";
import { SnippetsModule } from "./modules/snippets/snippets.module";
import { ToolsModule } from "./modules/tools/tools.module";
import { TagsModule } from "./modules/tags/tags.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SearchModule } from "./modules/search/search.module";
import { NewsModule } from "./modules/news/news.module";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../../.env"),
      ],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    FeedModule,
    ArticlesModule,
    SnippetsModule,
    ToolsModule,
    TagsModule,
    NotificationsModule,
    SearchModule,
    NewsModule,
  ],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
