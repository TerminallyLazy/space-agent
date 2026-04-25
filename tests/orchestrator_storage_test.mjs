import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGraphManifestPath,
  buildNodePath,
  createGraph,
  listGraphs,
  readGraph,
  saveGraph
} from "../app/L0/_all/mod/_core/orchestrator/storage.js";

function createYamlRuntime() {
  const files = new Map();
  const yaml = {
    parse(content) {
      return JSON.parse(content);
    },
    stringify(value) {
      return JSON.stringify(value, null, 2);
    }
  };
  return {
    files,
    runtime: {
      api: {
        async filePaths({ patterns }) {
          const suffix = String(patterns?.[0] || "").replace(/^\*\*\//u, "");
          return {
            paths: [...files.keys()]
              .filter((path) => path.endsWith(suffix))
              .map((path) => ({ path }))
          };
        },
        async fileRead(input) {
          if (Array.isArray(input?.files)) {
            return { files: input.files.map(({ path }) => ({ path, content: files.get(path) })) };
          }
          const path = typeof input === "string" ? input : input.path;
          if (!files.has(path)) {
            const error = new Error("status 404");
            error.statusCode = 404;
            throw error;
          }
          return { path, content: files.get(path) };
        },
        async fileWrite(input) {
          if (Array.isArray(input?.files)) {
            input.files.forEach(({ path, content }) => files.set(path, content));
            return { count: input.files.length };
          }
          files.set(input.path, input.content);
          return { path: input.path };
        }
      },
      utils: { yaml }
    }
  };
}

function createYamlRuntimeWithCallApi() {
  const { files, runtime } = createYamlRuntime();
  delete runtime.api.filePaths;
  runtime.api.call = async (endpoint, options) => {
    assert.equal(endpoint, "file_paths");
    assert.equal(options?.method, "POST");

    const suffix = String(options?.body?.patterns?.[0] || "").replace(/^\*\*\//u, "");
    return {
      [options.body.patterns[0]]: [...files.keys()].filter((path) => path.endsWith(suffix))
    };
  };

  return { files, runtime };
}

test("storage path helpers use user orchestrator root", () => {
  assert.equal(buildGraphManifestPath("graph-1"), "~/orchestrator/graph-1/graph.yaml");
  assert.equal(buildNodePath("graph-1", "node-a"), "~/orchestrator/graph-1/nodes/node-a.yaml");
});

test("createGraph persists manifest and readGraph loads nodes", async () => {
  const { runtime, files } = createYamlRuntime();
  const graph = await createGraph({ title: "Ops" }, runtime);

  assert.equal(graph.id, "graph-1");
  assert(files.has("~/orchestrator/graph-1/graph.yaml"));

  graph.nodes = [{
    schema: "orchestrator-node/v1",
    id: "node-a",
    type: "docker_container",
    name: "Web",
    x: 1,
    y: 2,
    config: {},
    runtime: {}
  }];
  graph.nodeIds = ["node-a"];
  await saveGraph(graph, runtime);

  const loaded = await readGraph("graph-1", runtime);
  assert.equal(loaded.title, "Ops");
  assert.equal(loaded.nodes.length, 1);
  assert.equal(loaded.nodes[0].id, "node-a");
});

test("readGraph preserves manifest node id when node file has no id", async () => {
  const { runtime, files } = createYamlRuntime();
  await createGraph({ title: "Ops" }, runtime);
  files.set(
    "~/orchestrator/graph-1/graph.yaml",
    runtime.utils.yaml.stringify({
      schema: "orchestrator-graph/v1",
      id: "graph-1",
      title: "Ops",
      nodeIds: ["node-a"]
    })
  );
  files.set("~/orchestrator/graph-1/nodes/node-a.yaml", "{}");

  const loaded = await readGraph("graph-1", runtime);
  assert.equal(loaded.nodes.length, 1);
  assert.equal(loaded.nodes[0].id, "node-a");
});

test("listGraphs reads graph manifests", async () => {
  const { runtime } = createYamlRuntime();
  await createGraph({ title: "First" }, runtime);
  await createGraph({ title: "Second" }, runtime);

  const graphs = await listGraphs(runtime);
  assert.deepEqual(graphs.map((graph) => graph.title), ["First", "Second"]);
});

test("listGraphs supports production file_paths discovery", async () => {
  const { runtime } = createYamlRuntimeWithCallApi();
  await createGraph({ title: "First" }, runtime);
  await createGraph({ title: "Second" }, runtime);

  const graphs = await listGraphs(runtime);
  assert.deepEqual(graphs.map((graph) => graph.title), ["First", "Second"]);
});
