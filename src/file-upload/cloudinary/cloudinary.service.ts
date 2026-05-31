import { Inject, Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('CLOUDINARY') private readonly cloudinary: any) {}

  uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder: 'gohappygo',
          resource_type: 'auto',
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Meeting proof selfie — authenticated delivery, path travelers_selfie/{requestId}/file
   */
  uploadMeetingProofSelfie(
    file: Express.Multer.File,
    requestId: number,
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder: `travelers_selfie/${requestId}`,
          public_id: 'file',
          type: 'authenticated',
          resource_type: 'image',
          overwrite: false,
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * 
   * Store airline logo files
   */
  storeAirlineLogoFiles(file: Express.Multer.File, publicId?: string): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadOptions: any = {
        folder: 'airlinelogos',
        resource_type: 'auto',
      };
      if (publicId) {
        uploadOptions.public_id = 'airlinelogos/' + publicId;
        uploadOptions.overwrite = true;
        uploadOptions.invalidate = true;
      }
      const uploadStream = this.cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
  

  getAuthenticatedSignedUrl(
    publicId: string,
    expiresInSeconds = 300,
  ): { signedUrl: string; expiresAt: Date } {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signedUrl = this.cloudinary.url(publicId, {
      type: 'authenticated',
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
    });
    return {
      signedUrl,
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  async deleteFile(publicId: string): Promise<any> {
    return this.cloudinary.uploader.destroy(publicId, { type: 'authenticated' });
  }

  async destroyMeetingProof(publicId: string): Promise<void> {
    await this.deleteFile(publicId);
  }
}
