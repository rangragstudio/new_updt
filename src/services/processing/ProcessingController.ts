/**
 * ============================================================================
 * RenderWalk Processing API Controller (Task 32)
 * ============================================================================
 *
 * Exposes the authenticated REQUEST PROCESSING endpoint logic.
 * Enforces tenant isolation, input validation, and idempotency.
 */

import {
  ProcessingJobService,
  UserAuthContext,
  ProcessingValidationError,
  TenantAccessError,
  RequestProcessingParams
} from "./ProcessingJobService";
import { SourceImageAssetManifest } from "./ProcessingJobModel";

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly statusCode: number;
}

export class ProcessingController {
  private processingService: ProcessingJobService;

  constructor(processingService: ProcessingJobService) {
    this.processingService = processingService;
  }

  /**
   * Handles POST /api/processing/request
   */
  public async handleRequestProcessing(request: {
    authContext: UserAuthContext;
    body: {
      organizationId: string;
      sessionId: string;
      tourId?: string;
      manifest: {
        totalSourceImages: number;
        sourceImages: SourceImageAssetManifest[];
      };
    };
  }): Promise<ApiResponse<unknown>> {
    try {
      const { authContext, body } = request;

      if (!body) {
        return {
          success: false,
          error: { code: "BAD_REQUEST", message: "Request body is required." },
          statusCode: 400
        };
      }

      const params: RequestProcessingParams = {
        authContext,
        organizationId: body.organizationId,
        sessionId: body.sessionId,
        tourId: body.tourId,
        manifest: body.manifest
      };

      const result = await this.processingService.requestProcessing(params);

      return {
        success: true,
        data: {
          jobId: result.job.id,
          organizationId: result.job.organizationId,
          sessionId: result.job.sessionId,
          status: result.job.status,
          customerStatus: result.customerStatus,
          isExistingJob: result.isExistingJob,
          priority: result.job.priority,
          subscriptionPriorityStatus: result.subscriptionPriorityStatus,
          createdAt: result.job.createdAt
        },
        statusCode: result.isExistingJob ? 200 : 201
      };
    } catch (err: unknown) {
      if (err instanceof ProcessingValidationError) {
        return {
          success: false,
          error: { code: err.code, message: err.message },
          statusCode: 400
        };
      }

      if (err instanceof TenantAccessError) {
        return {
          success: false,
          error: { code: err.code, message: err.message },
          statusCode: err.code === "UNAUTHENTICATED" ? 401 : 403
        };
      }

      return {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: (err as Error).message || "Internal server error" },
        statusCode: 500
      };
    }
  }
}
