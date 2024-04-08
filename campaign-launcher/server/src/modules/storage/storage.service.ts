import crypto from 'crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import stringify from 'json-stable-stringify';
import * as Minio from 'minio';

import { S3ConfigService } from '@/common/config/s3-config.service';
import { ErrorBucket } from '@/common/constants/errors';
import { ContentType, Extension } from '@/common/enums/storage';
import { UploadedFile } from '@/common/interfaces';

@Injectable()
export class StorageService {
  public readonly minioClient: Minio.Client;

  constructor(public readonly s3ConfigService: S3ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.s3ConfigService.endpoint,
      port: this.s3ConfigService.port,
      accessKey: this.s3ConfigService.accessKey,
      secretKey: this.s3ConfigService.secretKey,
      useSSL: this.s3ConfigService.useSSL,
    });
  }
  public formatUrl(key: string): string {
    return `${this.s3ConfigService.useSSL ? 'https' : 'http'}://${
      this.s3ConfigService.endpoint
    }:${this.s3ConfigService.port}/${this.s3ConfigService.bucket}/${key}`;
  }

  public async uploadFile(data: string | object): Promise<UploadedFile> {
    if (!(await this.minioClient.bucketExists(this.s3ConfigService.bucket))) {
      throw new BadRequestException(ErrorBucket.NotExist);
    }

    const isStringData = typeof data === 'string';
    const contentType = isStringData
      ? ContentType.TEXT_PLAIN
      : ContentType.APPLICATION_JSON;

    const content = isStringData ? data : stringify(data);
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    const key = `s3${hash}${isStringData ? '' : Extension.JSON}`;

    try {
      await this.minioClient.putObject(
        this.s3ConfigService.bucket,
        key,
        content,
        {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      );

      return { url: this.formatUrl(key), hash };
    } catch (e) {
      throw new BadRequestException('File not uploaded');
    }
  }
}
