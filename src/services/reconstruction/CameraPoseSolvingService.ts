/**
 * ============================================================================
 * RenderWalk Camera Pose Solving Service (Task 34)
 * ============================================================================
 *
 * Converts an AlignmentGraphArtifact into consistent relative camera poses:
 * 1. Connected Component Analysis & Graph Validation
 * 2. Reference Image Selection & Spanning-Tree Initial Pose Propagation
 * 3. Deterministic 2D Rigid Pose Graph Optimization with Loop Closure
 * 4. Residual Measurement (before vs after optimization)
 * 5. Generation of authoritative CameraPoseArtifact
 *
 * Reuses Task 33/33A structures without fake intrinsics or ML dependencies.
 */

import {
  AlignmentGraphArtifact,
  AlignmentGraphNode,
  PairwiseFrameMatch,
  CameraPoseArtifact,
  SolvedCameraPose,
  ConnectedComponentInfo,
  CameraPoseSolvingStatus
} from "./ReconstructionModels";

interface PoseNode {
  assetId: string;
  capturePointId?: number;
  originalFilename?: string;
  dimensions: { width: number; height: number };
  targetHeadingDegrees?: number;
  actualHeadingDegrees?: number;
  x: number;
  y: number;
  thetaRad: number; // In radians relative to reference frame
}

interface EdgeConstraint {
  srcAssetId: string;
  tgtAssetId: string;
  srcIdx: number;
  tgtIdx: number;
  deltaThetaRad: number;
  deltaX: number;
  deltaY: number;
  weight: number;
  isLoopClosure: boolean;
}

export class CameraPoseSolvingService {
  /**
   * Solves relative camera poses from the provided alignment graph.
   */
  public async solveCameraPoses(
    graphArtifact: AlignmentGraphArtifact,
    processingJobId = `job-${Date.now()}`
  ): Promise<CameraPoseArtifact> {
    const totalStart = Date.now();

    // -----------------------------------------------------------------------
    // STEP 1: CONNECTED COMPONENT VALIDATION
    // -----------------------------------------------------------------------
    const valStart = Date.now();
    const { nodes, edges } = graphArtifact;

    if (!nodes || nodes.length === 0) {
      return this.createFailureArtifact(
        graphArtifact,
        processingJobId,
        "INSUFFICIENT_RECONSTRUCTION_GRAPH",
        "Alignment graph contains zero image nodes."
      );
    }

    if (nodes.length === 1) {
      return this.createFailureArtifact(
        graphArtifact,
        processingJobId,
        "INSUFFICIENT_RECONSTRUCTION_GRAPH",
        "A single image is insufficient to solve relative camera poses."
      );
    }

    // Partition edges: strong (MATCHED), weak (WEAK_MATCH), rejected (NO_MATCH / ERROR)
    const strongEdges = edges.filter((e) => e.status === "MATCHED");
    const weakEdges = edges.filter((e) => e.status === "WEAK_MATCH");
    const rejectedEdges = edges.filter((e) => e.status === "NO_MATCH" || e.status === "ERROR");

    // Build adjacency list for connected component analysis
    // Strong edges are prioritized; weak edges are used cautiously
    const adj = new Map<string, { target: string; edge: PairwiseFrameMatch; isWeak: boolean }[]>();
    for (const node of nodes) {
      adj.set(node.assetId, []);
    }

    for (const e of strongEdges) {
      adj.get(e.sourceAssetId)?.push({ target: e.targetAssetId, edge: e, isWeak: false });
      adj.get(e.targetAssetId)?.push({ target: e.sourceAssetId, edge: e, isWeak: false });
    }

    // Include weak edges only to prevent disconnection, downweighted
    for (const e of weakEdges) {
      adj.get(e.sourceAssetId)?.push({ target: e.targetAssetId, edge: e, isWeak: true });
      adj.get(e.targetAssetId)?.push({ target: e.sourceAssetId, edge: e, isWeak: true });
    }

    // Find connected components via BFS
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const node of nodes) {
      if (!visited.has(node.assetId)) {
        const comp: string[] = [];
        const queue: string[] = [node.assetId];
        visited.add(node.assetId);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          comp.push(curr);

          for (const neighbor of adj.get(curr) || []) {
            if (!visited.has(neighbor.target)) {
              visited.add(neighbor.target);
              queue.push(neighbor.target);
            }
          }
        }
        components.push(comp);
      }
    }

    // Sort components by size descending -> primary component is components[0]
    components.sort((a, b) => b.length - a.length);
    const primaryComponent = components[0] || [];

    if (primaryComponent.length < 2) {
      return this.createFailureArtifact(
        graphArtifact,
        processingJobId,
        "INSUFFICIENT_RECONSTRUCTION_GRAPH",
        `Insufficient connected images: primary component contains only ${primaryComponent.length} image(s). At least 2 visually verified images are required.`
      );
    }

    const reachableSet = new Set(primaryComponent);
    const unreachableAssetIds = nodes.filter((n) => !reachableSet.has(n.assetId)).map((n) => n.assetId);
    const isFullyConnected = unreachableAssetIds.length === 0;

    const connectedComponentInfo: ConnectedComponentInfo = {
      size: primaryComponent.length,
      totalImages: nodes.length,
      isFullyConnected,
      reachableAssetIds: primaryComponent,
      unreachableAssetIds
    };

    const valMs = Date.now() - valStart;

    // -----------------------------------------------------------------------
    // STEP 2: INITIAL RELATIVE POSES VIA SPANNING TREE
    // -----------------------------------------------------------------------
    const initStart = Date.now();

    // Select reference image:
    // If capturePointId === 1 exists in primary component, use Point 1; otherwise, use node with highest degree
    let referenceAssetId = primaryComponent[0];
    const point1Node = nodes.find((n) => n.capturePointId === 1 && reachableSet.has(n.assetId));
    if (point1Node) {
      referenceAssetId = point1Node.assetId;
    } else {
      let maxDegree = -1;
      for (const assetId of primaryComponent) {
        const degree = (adj.get(assetId) || []).length;
        if (degree > maxDegree) {
          maxDegree = degree;
          referenceAssetId = assetId;
        }
      }
    }

    // Map reachable nodes
    const nodeMap = new Map<string, PoseNode>();
    const nodeIndexMap = new Map<string, number>();
    const activeNodes: PoseNode[] = [];

    primaryComponent.forEach((assetId, idx) => {
      const gNode = nodes.find((n) => n.assetId === assetId)!;
      const pNode: PoseNode = {
        assetId: gNode.assetId,
        capturePointId: gNode.capturePointId,
        originalFilename: gNode.originalFilename,
        dimensions: gNode.dimensions,
        targetHeadingDegrees: gNode.targetHeadingDegrees,
        actualHeadingDegrees: gNode.actualHeadingDegrees,
        x: 0,
        y: 0,
        thetaRad: 0
      };
      nodeMap.set(assetId, pNode);
      nodeIndexMap.set(assetId, idx);
      activeNodes.push(pNode);
    });

    // Spanning tree traversal to assign initial relative poses
    const treeVisited = new Set<string>([referenceAssetId]);
    const treeQueue: string[] = [referenceAssetId];
    const spanningTreeEdgeKeys = new Set<string>();

    while (treeQueue.length > 0) {
      const uId = treeQueue.shift()!;
      const uPose = nodeMap.get(uId)!;

      for (const { target: vId, edge, isWeak } of adj.get(uId) || []) {
        if (!treeVisited.has(vId) && nodeMap.has(vId)) {
          treeVisited.add(vId);
          treeQueue.push(vId);

          const edgeKey = `${edge.sourceAssetId}<->${edge.targetAssetId}`;
          spanningTreeEdgeKeys.add(edgeKey);

          // Extract relative transformation
          // Matrix maps p_src to p_tgt: p_tgt = T * p_src
          const T = edge.geometricVerification.transformationMatrix;
          const isForward = edge.sourceAssetId === uId;

          let deltaTheta: number;
          let deltaX: number;
          let deltaY: number;

          if (isForward) {
            deltaTheta = Math.atan2(T[1][0], T[0][0]);
            deltaX = T[0][2];
            deltaY = T[1][2];
          } else {
            // Inverse transform
            const cosT = T[0][0];
            const sinT = T[1][0];
            const tx = T[0][2];
            const ty = T[1][2];
            deltaTheta = -Math.atan2(sinT, cosT);
            deltaX = -(cosT * tx + sinT * ty);
            deltaY = -(-sinT * tx + cosT * ty);
          }

          // Propagate pose to v
          const vPose = nodeMap.get(vId)!;
          vPose.thetaRad = this.wrapToPi(uPose.thetaRad + deltaTheta);
          vPose.x = uPose.x + (Math.cos(uPose.thetaRad) * deltaX - Math.sin(uPose.thetaRad) * deltaY);
          vPose.y = uPose.y + (Math.sin(uPose.thetaRad) * deltaX + Math.cos(uPose.thetaRad) * deltaY);
        }
      }
    }

    const initMs = Date.now() - initStart;

    // -----------------------------------------------------------------------
    // STEP 3: GRAPH-BASED POSE OPTIMIZATION & LOOP CLOSURE
    // -----------------------------------------------------------------------
    const optStart = Date.now();

    // Collect all valid constraints between active nodes
    const constraints: EdgeConstraint[] = [];
    let loopClosureUsed = false;

    for (const e of [...strongEdges, ...weakEdges]) {
      if (nodeIndexMap.has(e.sourceAssetId) && nodeIndexMap.has(e.targetAssetId)) {
        const srcIdx = nodeIndexMap.get(e.sourceAssetId)!;
        const tgtIdx = nodeIndexMap.get(e.targetAssetId)!;
        const T = e.geometricVerification.transformationMatrix;

        const deltaThetaRad = Math.atan2(T[1][0], T[0][0]);
        const deltaX = T[0][2];
        const deltaY = T[1][2];

        const edgeKey = `${e.sourceAssetId}<->${e.targetAssetId}`;
        const isLoop = !spanningTreeEdgeKeys.has(edgeKey);
        if (isLoop) {
          loopClosureUsed = true;
        }

        const weight = e.status === "MATCHED" ? 1.0 : 0.2;

        constraints.push({
          srcAssetId: e.sourceAssetId,
          tgtAssetId: e.targetAssetId,
          srcIdx,
          tgtIdx,
          deltaThetaRad,
          deltaX,
          deltaY,
          weight,
          isLoopClosure: isLoop
        });
      }
    }

    // Calculate residual before optimization
    const residualBefore = this.calculateGraphResidual(activeNodes, constraints);

    // Deterministic Pose Graph Optimization (Iterative Gauss-Newton Gradient Descent)
    // Minimizes rotation and translation errors across all graph constraints
    const iterations = 40;
    const learningRateTheta = 0.05;
    const learningRatePos = 0.05;
    const refIdx = nodeIndexMap.get(referenceAssetId)!;

    for (let iter = 0; iter < iterations; iter++) {
      const gradTheta = new Float64Array(activeNodes.length);
      const gradX = new Float64Array(activeNodes.length);
      const gradY = new Float64Array(activeNodes.length);

      for (const c of constraints) {
        const u = activeNodes[c.srcIdx];
        const v = activeNodes[c.tgtIdx];

        // Angular error: (theta_v - theta_u) - deltaTheta
        const predDeltaTheta = this.wrapToPi(v.thetaRad - u.thetaRad);
        const errTheta = this.wrapToPi(predDeltaTheta - c.deltaThetaRad);

        // Position error in global frame: (pos_v - pos_u) - R(u) * deltaPos
        const cosU = Math.cos(u.thetaRad);
        const sinU = Math.sin(u.thetaRad);
        const predDeltaX = cosU * c.deltaX - sinU * c.deltaY;
        const predDeltaY = sinU * c.deltaX + cosU * c.deltaY;

        const errX = (v.x - u.x) - predDeltaX;
        const errY = (v.y - u.y) - predDeltaY;

        const w = c.weight;

        // Gradients for rotation
        gradTheta[c.tgtIdx] += w * errTheta;
        gradTheta[c.srcIdx] -= w * errTheta;

        // Gradients for position
        gradX[c.tgtIdx] += w * errX;
        gradX[c.srcIdx] -= w * errX;
        gradY[c.tgtIdx] += w * errY;
        gradY[c.srcIdx] -= w * errY;
      }

      // Update poses (keeping reference frame anchored at index refIdx)
      for (let i = 0; i < activeNodes.length; i++) {
        if (i !== refIdx) {
          activeNodes[i].thetaRad = this.wrapToPi(activeNodes[i].thetaRad - learningRateTheta * gradTheta[i]);
          activeNodes[i].x -= learningRatePos * gradX[i];
          activeNodes[i].y -= learningRatePos * gradY[i];
        }
      }
    }

    const residualAfter = this.calculateGraphResidual(activeNodes, constraints);
    const optMs = Date.now() - optStart;
    const totalMs = Date.now() - totalStart;

    // -----------------------------------------------------------------------
    // STEP 4: ASSEMBLE OUTPUT ARTIFACT
    // -----------------------------------------------------------------------
    const cameraPoses: SolvedCameraPose[] = activeNodes.map((n) => {
      // Normalize yaw angle to [0, 360) degrees
      let deg = (n.thetaRad * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;

      const cosT = Math.cos(n.thetaRad);
      const sinT = Math.sin(n.thetaRad);

      const rotationMatrix = [
        [cosT, -sinT, n.x],
        [sinT, cosT, n.y],
        [0, 0, 1]
      ];

      return {
        assetId: n.assetId,
        capturePointId: n.capturePointId,
        originalFilename: n.originalFilename,
        position: { x: Math.round(n.x * 100) / 100, y: Math.round(n.y * 100) / 100, z: 0 },
        rotationDegrees: Math.round(deg * 100) / 100,
        rotationMatrix,
        dimensions: n.dimensions,
        auxiliaryMetadata: {
          targetHeadingDegrees: n.targetHeadingDegrees,
          actualHeadingDegrees: n.actualHeadingDegrees,
          intrinsicsAvailable: false // Explicitly marked unavailable
        }
      };
    });

    return {
      organizationId: graphArtifact.organizationId,
      processingJobId,
      captureSessionId: graphArtifact.sessionId,
      tourId: graphArtifact.tourId,
      sourceType: graphArtifact.sourceType,
      inputType: graphArtifact.inputType,
      referenceAssetId,
      cameraPoses,
      connectedComponent: connectedComponentInfo,
      verifiedEdgeCount: strongEdges.length,
      weakEdgeCount: weakEdges.length,
      rejectedEdgeCount: rejectedEdges.length,
      residualBefore: Math.round(residualBefore * 1000) / 1000,
      residualAfter: Math.round(residualAfter * 1000) / 1000,
      loopClosureUsed,
      processingTimings: {
        graphValidationMs: valMs,
        initialPoseSolvingMs: initMs,
        graphOptimizationMs: optMs,
        totalPoseSolvingMs: totalMs
      },
      status: "SOLVED",
      resultSummary: "Camera poses solved from alignment graph. Awaiting stitching pipeline.",
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Evaluates the mean residual error across all graph edge constraints.
   */
  private calculateGraphResidual(nodes: readonly PoseNode[], constraints: readonly EdgeConstraint[]): number {
    if (constraints.length === 0) return 0;
    let sumErr = 0;

    for (const c of constraints) {
      const u = nodes[c.srcIdx];
      const v = nodes[c.tgtIdx];

      const predDeltaTheta = this.wrapToPi(v.thetaRad - u.thetaRad);
      const errTheta = Math.abs(this.wrapToPi(predDeltaTheta - c.deltaThetaRad));

      const cosU = Math.cos(u.thetaRad);
      const sinU = Math.sin(u.thetaRad);
      const predDeltaX = cosU * c.deltaX - sinU * c.deltaY;
      const predDeltaY = sinU * c.deltaX + cosU * c.deltaY;

      const errPos = Math.sqrt(Math.pow((v.x - u.x) - predDeltaX, 2) + Math.pow((v.y - u.y) - predDeltaY, 2));

      sumErr += c.weight * (errTheta + 0.05 * errPos);
    }

    return sumErr / constraints.length;
  }

  /**
   * Helper to normalize angles to [-PI, PI).
   */
  private wrapToPi(rad: number): number {
    let a = (rad + Math.PI) % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a - Math.PI;
  }

  /**
   * Constructs a controlled failure artifact without fabricating fake poses.
   */
  private createFailureArtifact(
    graphArtifact: AlignmentGraphArtifact,
    processingJobId: string,
    status: CameraPoseSolvingStatus,
    failureReason: string
  ): CameraPoseArtifact {
    return {
      organizationId: graphArtifact.organizationId,
      processingJobId,
      captureSessionId: graphArtifact.sessionId,
      tourId: graphArtifact.tourId,
      sourceType: graphArtifact.sourceType,
      inputType: graphArtifact.inputType,
      referenceAssetId: "none",
      cameraPoses: [],
      connectedComponent: {
        size: 0,
        totalImages: graphArtifact.nodes?.length || 0,
        isFullyConnected: false,
        reachableAssetIds: [],
        unreachableAssetIds: graphArtifact.nodes?.map((n) => n.assetId) || []
      },
      verifiedEdgeCount: 0,
      weakEdgeCount: 0,
      rejectedEdgeCount: graphArtifact.edges?.length || 0,
      residualBefore: 0,
      residualAfter: 0,
      loopClosureUsed: false,
      processingTimings: {
        graphValidationMs: 0,
        initialPoseSolvingMs: 0,
        graphOptimizationMs: 0,
        totalPoseSolvingMs: 0
      },
      status,
      failureReason,
      resultSummary: failureReason,
      createdAt: new Date().toISOString()
    };
  }
}
