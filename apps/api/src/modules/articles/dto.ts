import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateArticleDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}

export class CreateArticleCommentDto {
  @IsString()
  @MaxLength(1000)
  body!: string;
}

export class UpdateArticleCommentDto {
  @IsString()
  @MaxLength(1000)
  body!: string;
}
