import { Module } from "@nestjs/common";
import { SnippetsController } from "./snippets.controller";

@Module({
  controllers: [SnippetsController],
})
export class SnippetsModule {}
