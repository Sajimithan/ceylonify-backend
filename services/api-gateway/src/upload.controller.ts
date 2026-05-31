import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

const imageStorage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const documentStorage = diskStorage({
  destination: './uploads/documents',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `doc-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const ALLOWED_DOC_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
];

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return { url: `/uploads/${file.filename}` };
  }

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: documentStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException('Only images and PDF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return { url: `/uploads/documents/${file.filename}` };
  }
}
