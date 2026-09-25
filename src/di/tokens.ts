import type { ConversionWorkspaceGateway } from '../app/contracts/conversion.workspace.gateway.js';
import type { DocumentUploadGateway } from '../app/contracts/document.upload.gateway.js';
import type { PdfConversionGateway } from '../app/contracts/pdf.conversion.gateway.js';
import { createToken } from '../../kit-dev/di/container.js';
import { ConversionConfig } from '../infra/pdf.conversion.config.js';

export const PATH_PROTOCOL = createToken<string>('PATH_PROTOCOL');
export const PATH_CERTIFICATE = createToken<string>('PATH_CERTIFICATE');
export const PDF_WORKSPACE = createToken<ConversionWorkspaceGateway>('PDF_WORKSPACE');
export const PDF_UPLOAD = createToken<DocumentUploadGateway>('PDF_UPLOAD');
export const PDF_CONVERTER = createToken<PdfConversionGateway>('PDF_CONVERTER');
export const PDF_CONVERSION_MAX_CONCURRENT = createToken<number>('PDF_CONVERSION_MAX_CONCURRENT');
export const PDF_CONFIG = createToken<ConversionConfig>('PDF_CONFIG');
