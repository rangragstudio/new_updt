/**
 * RenderWalk Notification Service (Phase 1 Step D)
 * Provider-independent notification & alert dispatcher.
 */

export enum NotificationType {
  TOUR_PROCESSING_COMPLETED = "TOUR_PROCESSING_COMPLETED",
  TOUR_PROCESSING_FAILED = "TOUR_PROCESSING_FAILED",
  TOUR_PUBLISHED = "TOUR_PUBLISHED",
  STORAGE_QUOTA_WARNING = "STORAGE_QUOTA_WARNING",
  PLAN_LIMIT_REACHED = "PLAN_LIMIT_REACHED"
}

export interface NotificationPayload {
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface NotificationAdapter {
  dispatch(notification: NotificationPayload): Promise<boolean>;
}

/**
 * Development & Logging Adapter (Independent of vendor API credentials)
 */
export class LoggingNotificationAdapter implements NotificationAdapter {
  private dispatchedLogs: NotificationPayload[] = [];

  async dispatch(notification: NotificationPayload): Promise<boolean> {
    const payload = {
      ...notification,
      createdAt: notification.createdAt || new Date().toISOString()
    };
    this.dispatchedLogs.push(payload);
    return true;
  }

  getLogs(): NotificationPayload[] {
    return [...this.dispatchedLogs];
  }
}

export class NotificationService {
  private adapter: NotificationAdapter;

  constructor(adapter?: NotificationAdapter) {
    this.adapter = adapter || new LoggingNotificationAdapter();
  }

  async sendTourProcessingCompleted(organizationId: string, tourId: string, tourName: string): Promise<boolean> {
    return this.adapter.dispatch({
      organizationId,
      type: NotificationType.TOUR_PROCESSING_COMPLETED,
      title: "Tour Processing Completed",
      message: `All 360° multi-resolution tiles and manifests for '${tourName}' have finished processing and are ready in your editor.`,
      metadata: { tourId, tourName }
    });
  }

  async sendTourProcessingFailed(organizationId: string, tourId: string, tourName: string, reason: string): Promise<boolean> {
    return this.adapter.dispatch({
      organizationId,
      type: NotificationType.TOUR_PROCESSING_FAILED,
      title: "Processing Needs Attention",
      message: `Processing for '${tourName}' stopped: ${reason}. Original files have been safely preserved.`,
      metadata: { tourId, tourName, reason }
    });
  }

  async sendTourPublished(organizationId: string, tourId: string, tourName: string, publicUrl: string): Promise<boolean> {
    return this.adapter.dispatch({
      organizationId,
      type: NotificationType.TOUR_PUBLISHED,
      title: "Tour Published Live",
      message: `'${tourName}' is now live on the public CDN. Public link: ${publicUrl}`,
      metadata: { tourId, tourName, publicUrl }
    });
  }

  async sendStorageQuotaWarning(organizationId: string, usedGb: number, limitGb: number): Promise<boolean> {
    return this.adapter.dispatch({
      organizationId,
      type: NotificationType.STORAGE_QUOTA_WARNING,
      title: "Storage Quota Alert",
      message: `Your studio has utilized ${(usedGb).toFixed(1)} GB of your ${(limitGb).toFixed(0)} GB quota (over 85%). Consider upgrading to avoid upload limits.`,
      metadata: { usedGb, limitGb }
    });
  }

  async sendPlanLimitReached(organizationId: string, activeTours: number, limit: number): Promise<boolean> {
    return this.adapter.dispatch({
      organizationId,
      type: NotificationType.PLAN_LIMIT_REACHED,
      title: "Plan Tour Limit Reached",
      message: `You have reached the maximum of ${limit} active tours on your plan.`,
      metadata: { activeTours, limit }
    });
  }
}
