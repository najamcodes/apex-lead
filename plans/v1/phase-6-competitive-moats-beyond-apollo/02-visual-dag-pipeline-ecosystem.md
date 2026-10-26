# Implementation Prompt: Visual DAG Pipeline Builder & Node Extensibility Ecosystem

## Prompt Objective
Build an interactive Visual DAG (Directed Acyclic Graph) pipeline editor using `@xyflow/react`, an asynchronous topological sort execution engine in the Katal MVC server, and a sandboxed custom transformer runtime for user-defined JavaScript node transformations.

---

## Context & Architectural Rationale
Apollo provides static, linear search filters (e.g. industry -> headcount -> export). It cannot handle complex branch logic, custom validation scripts, or automated cascading actions.

ApexLead's **Visual DAG Pipeline Ecosystem** transforms lead generation into an automated engineering workflow:
1. **Visual Drag-and-Drop Canvas:** Powered by `@xyflow/react` with custom styled nodes (Source, Filter, Enricher, Router, Action).
2. **Asynchronous Parallel Branch Execution:** Topological sorting identifies independent graph branches and executes them concurrently using worker pools.
3. **Polymorphic Data Pipe:** Every node consumes and emits arbitrary JSON collections conforming to Phase 1's `records` dynamic schema.
4. **Sandboxed Custom Code Nodes:** Power users and agencies can write custom JavaScript snippets (e.g. calculate custom deal size, normalize custom address formats) executed safely inside a secure V8 isolate (`isolated-vm`).

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Visual DAG Pipelines
CREATE TABLE IF NOT EXISTS visual_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]', -- React Flow Node definitions
    edges JSONB NOT NULL DEFAULT '[]', -- React Flow Connection edges
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES visual_pipelines(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    records_processed INT NOT NULL DEFAULT 0,
    records_emitted INT NOT NULL DEFAULT 0,
    node_execution_logs JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_visual_pipelines_org 
ON visual_pipelines (org_id);
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── engine/
│   │   ├── DagExecutionEngine.ts
│   │   ├── TopologicalSorter.ts
│   │   ├── SandboxedCodeRunner.ts
│   │   └── registry/
│   │       ├── NodeRegistry.ts
│   │       ├── SourceNodes.ts
│   │       ├── FilterNodes.ts
│   │       └── ActionNodes.ts
│   └── controllers/
│       └── PipelineController.ts
website/
├── src/
│   └── app/
│       └── (dashboard)/
│           └── pipelines/
│               ├── [id]/
│               │   └── page.tsx
│               └── components/
│                   ├── DagCanvas.tsx
│                   ├── CustomNodeCard.tsx
│                   └── NodeConfigSidebar.tsx
```

---

## Detailed Implementation Code

### 1. Topological Sorter & Graph Validator (`server/src/engine/TopologicalSorter.ts`)

```typescript
export interface DagNodeDef {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface DagEdgeDef {
  id: string;
  source: string;
  target: string;
}

export class TopologicalSorter {
  /**
   * Validates that the graph is strictly acyclic and returns nodes grouped in executable execution layers.
   */
  public static sort(nodes: DagNodeDef[], edges: DagEdgeDef[]): DagNodeDef[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const nodeMap = new Map<string, DagNodeDef>();

    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      adjacency.set(n.id, []);
      nodeMap.set(n.id, n);
    });

    edges.forEach((e) => {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      adjacency.get(e.source)?.push(e.target);
    });

    // Find all root nodes (inDegree === 0)
    let currentLayer = nodes.filter((n) => inDegree.get(n.id) === 0);
    const layers: DagNodeDef[][] = [];
    let visitedCount = 0;

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      visitedCount += currentLayer.length;

      const nextLayerIds = new Set<string>();

      for (const node of currentLayer) {
        const neighbors = adjacency.get(node.id) || [];
        for (const neighborId of neighbors) {
          const currentDeg = (inDegree.get(neighborId) || 1) - 1;
          inDegree.set(neighborId, currentDeg);
          if (currentDeg === 0) {
            nextLayerIds.add(neighborId);
          }
        }
      }

      currentLayer = Array.from(nextLayerIds).map((id) => nodeMap.get(id)!);
    }

    if (visitedCount !== nodes.length) {
      throw new Error('Cyclic dependency detected! DAG pipelines cannot contain circular connection loops.');
    }

    return layers;
  }
}
```

---

### 2. DAG Execution Engine (`server/src/engine/DagExecutionEngine.ts`)

```typescript
import { Service, Inject } from 'katal';
import { DataSource } from 'typeorm';
import { TopologicalSorter, DagNodeDef, DagEdgeDef } from './TopologicalSorter';
import { NodeRegistry } from './registry/NodeRegistry';

@Service()
export class DagExecutionEngine {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(NodeRegistry) private nodeRegistry: NodeRegistry
  ) {}

  /**
   * Executes a visual pipeline layer-by-layer, piping polymorphic JSON data between nodes.
   */
  public async executePipeline(pipelineId: string, orgId: string, initialInputs: any[] = []): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT nodes, edges FROM visual_pipelines WHERE id = $1 AND org_id = $2`,
      [pipelineId, orgId]
    );

    if (rows.length === 0) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const { nodes, edges }: { nodes: DagNodeDef[]; edges: DagEdgeDef[] } = rows[0];
    const layers = TopologicalSorter.sort(nodes, edges);

    // Create execution run record
    const runRes = await this.dataSource.query(
      `INSERT INTO pipeline_runs (pipeline_id, org_id, status) VALUES ($1, $2, 'running') RETURNING id`,
      [pipelineId, orgId]
    );
    const runId = runRes[0].id;

    // Buffer storing outputs emitted by each node ID
    const nodeOutputs = new Map<string, any[]>();
    const nodeLogs: Record<string, any> = {};

    (async () => {
      try {
        for (const layer of layers) {
          // Execute all independent nodes in this layer in parallel
          await Promise.all(
            layer.map(async (node) => {
              const handler = this.nodeRegistry.getHandler(node.type);
              if (!handler) {
                throw new Error(`Unregistered node type: ${node.type}`);
              }

              // Gather incoming records from source edges connecting to this node
              const incomingEdges = edges.filter((e) => e.target === node.id);
              let incomingRecords: any[] = [];

              if (incomingEdges.length === 0) {
                incomingRecords = initialInputs;
              } else {
                for (const edge of incomingEdges) {
                  const parentRecords = nodeOutputs.get(edge.source) || [];
                  incomingRecords.push(...parentRecords);
                }
              }

              const startTime = Date.now();
              const emitted = await handler.execute({
                nodeConfig: node.data,
                orgId,
                records: incomingRecords,
              });

              nodeOutputs.set(node.id, emitted);
              nodeLogs[node.id] = {
                durationMs: Date.now() - startTime,
                inputCount: incomingRecords.length,
                outputCount: emitted.length,
                status: 'success',
              };
            })
          );
        }

        // Finalize run
        await this.dataSource.query(
          `UPDATE pipeline_runs 
           SET status = 'completed', node_execution_logs = $1, finished_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(nodeLogs), runId]
        );
      } catch (err: any) {
        await this.dataSource.query(
          `UPDATE pipeline_runs 
           SET status = 'failed', error_message = $1, finished_at = NOW() 
           WHERE id = $2`,
          [err.message, runId]
        );
      }
    })();

    return runId;
  }
}
```

---

### 3. Visual DAG React Canvas (`website/src/app/(dashboard)/pipelines/[id]/page.tsx`)

```tsx
'use client';

import React, { useCallback } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  Edge 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Save, Plus } from 'lucide-react';

const initialNodes = [
  {
    id: '1',
    type: 'sourceNode',
    position: { x: 100, y: 150 },
    data: { label: 'Google Maps Scraper', query: 'Roofing Contractors', location: 'Austin, TX' },
  },
  {
    id: '2',
    type: 'filterNode',
    position: { x: 450, y: 150 },
    data: { label: 'Rating & Reviews Filter', minRating: 4.5, minReviews: 10 },
  },
  {
    id: '3',
    type: 'enrichNode',
    position: { x: 800, y: 150 },
    data: { label: 'Waterfall Email Cascade', checkMx: true },
  },
  {
    id: '4',
    type: 'actionNode',
    position: { x: 1150, y: 150 },
    data: { label: 'Enroll in Drip Cadence', cadenceId: 'contractor-warm-pitch' },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
];

export default function PipelineEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-slate-950 flex flex-col">
      {/* Action Toolbar */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm">Automated Contractor Acquisition Pipeline</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            Active DAG
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Node
          </button>
          <button className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all">
            <Save className="w-3.5 h-3.5" /> Save Graph
          </button>
          <button className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all">
            <Play className="w-3.5 h-3.5 fill-current" /> Execute Pipeline
          </button>
        </div>
      </div>

      {/* Interactive Flow Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls className="bg-slate-900 border border-slate-800 rounded-lg text-white" />
        </ReactFlow>
      </div>
    </div>
  );
}
```

---

## Verification & Acceptance Criteria
1. **Cycle Detection:** Submit a graph containing a cycle (A -> B -> C -> A); verify `TopologicalSorter` throws `"Cyclic dependency detected"`.
2. **Layer Parallelism:** Construct a graph where Node A fans out to Node B and Node C simultaneously; verify Layer 2 executes Node B and Node C in parallel via `Promise.all`.
3. **Canvas Interactivity:** Add a custom node via UI, connect it with an animated edge, and verify `onConnect` updates state properly.
4. **Execution Run Logging:** Inspect `pipeline_runs` row after completion to verify per-node millisecond timing and record counts are accurately logged in JSON.
