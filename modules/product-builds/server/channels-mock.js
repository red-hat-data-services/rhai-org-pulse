/**
 * Sample channel catalog for the Channels view (AIPCC-31813).
 *
 * Channels identify AIPCC content by its compatibility surface (accelerator +
 * torch + OS) rather than by product release version (AIPCC-27889). Neither
 * the AIPCC Dashboard API nor packages.redhat.com publishes channel data yet,
 * so this module serves a static catalog. The fields mirror the Pulp
 * distribution labels used by packages.redhat.com (channel, accelerator,
 * accelerator_version, torch_version, rhel_version, compatible_releases), and
 * the torch / accelerator stacks match what fondue builds as of September 2026.
 * RHAIBI drop names are real base image release tags.
 */

const PUBLIC_INDEX_BASE = 'https://packages.redhat.com/api/pypi/public-rhai/rhoai';
const PRIVATE_INDEX_BASE = 'https://private.console.redhat.com/api/pypi/rhai/rhaiis';
const BASE_IMAGE_REPO = 'quay.io/aipcc/base-images';

const ARCH_GPU = ['x86_64', 'aarch64'];
const ARCH_ALL = ['x86_64', 'aarch64', 'ppc64le', 's390x'];

const CHANNEL_DEFINITIONS = [
  // Stable: adopted by a product release, torch and accelerator anchor locked.
  { accelerator: 'cuda', accelerator_version: '13.0', torch: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.5', 'rhoai-3.6'], architectures: ARCH_GPU, since: '2026-06-01' },
  { accelerator: 'cuda', accelerator_version: '12.9', torch: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.6'], architectures: ARCH_GPU, since: '2026-06-01' },
  { accelerator: 'rocm', accelerator_version: '7.14', torch: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.6'], architectures: ['x86_64'], since: '2026-06-01' },
  { accelerator: 'gaudi', accelerator_version: '1.24.1', torch: '2.11', maturity: 'stable', compatible_releases: ['rhaiis-3.6'], architectures: ['x86_64'], since: '2026-06-01', private: true },
  { accelerator: 'spyre', accelerator_version: '', torch: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.6'], architectures: ['x86_64', 's390x'], since: '2026-06-01' },
  { accelerator: 'neuron', accelerator_version: '', torch: '2.9', maturity: 'stable', compatible_releases: ['rhaiis-3.5', 'rhaiis-3.6'], architectures: ['x86_64'], since: '2026-06-01', private: true },
  { accelerator: 'cpu', accelerator_version: '', torch: '2.11', maturity: 'stable', compatible_releases: ['rhoai-3.5', 'rhoai-3.6'], architectures: ARCH_ALL, since: '2026-06-01' },
  { accelerator: 'cpu', accelerator_version: '', torch: null, maturity: 'stable', compatible_releases: ['rhoai-3.6'], architectures: ARCH_ALL, since: '2026-06-01' },
  // Rolling: content flows continuously, any team can adopt after testing.
  { accelerator: 'cuda', accelerator_version: '13.2', torch: '2.11', maturity: 'rolling', compatible_releases: [], architectures: ARCH_GPU, since: '2026-08-07' },
  { accelerator: 'cuda', accelerator_version: '13.0', torch: '2.13', maturity: 'rolling', compatible_releases: ['rhoai-3.7'], architectures: ARCH_GPU, since: '2026-08-17' },
  { accelerator: 'cuda', accelerator_version: '12.9', torch: '2.13', maturity: 'rolling', compatible_releases: ['rhoai-3.7'], architectures: ARCH_GPU, since: '2026-08-17' },
  { accelerator: 'cuda', accelerator_version: '13.0', torch: '2.14', maturity: 'rolling', compatible_releases: [], architectures: ARCH_GPU, since: '2026-08-24' },
  { accelerator: 'rocm', accelerator_version: '7.14', torch: '2.12', maturity: 'rolling', compatible_releases: ['rhoai-3.7'], architectures: ['x86_64'], since: '2026-08-14' },
  { accelerator: 'tpu', accelerator_version: '', torch: '2.10', maturity: 'rolling', compatible_releases: ['rhaiis-3.6'], architectures: ['x86_64'], since: '2026-08-04', private: true },
  { accelerator: 'cpu', accelerator_version: '', torch: '2.14', maturity: 'rolling', compatible_releases: [], architectures: ARCH_GPU, since: '2026-08-24' },
];

const ACCELERATOR_LABELS = {
  cpu: 'CPU',
  cuda: 'CUDA',
  gaudi: 'Gaudi',
  neuron: 'Neuron',
  rocm: 'ROCm',
  spyre: 'Spyre',
  tpu: 'TPU',
};

// RHAIBI (base image) releases cut from main, newest first.
const MAIN_DROPS = [
  { name: 'base-v2026091101', created_at: '2026-09-11T14:12:00Z', changes: [
    '(feat) AIPCC-31781: install openmpi-cuda in CUDA 13 images',
    '(feat) AIPCC-30202: Complete lockfile-native base images',
    '(refactor) AIPCC-30058: Rewrite fromager hooks to upload wheels/sdists to Pulp cache',
  ] },
  { name: 'base-v2026090401', created_at: '2026-09-04T16:40:00Z', changes: [] },
  { name: 'base-v2026090302', created_at: '2026-09-03T19:05:00Z', changes: [
    '(ci) AIPCC-31260: Trigger base-image rebuilds for Tekton changes',
  ] },
  { name: 'base-v2026090301', created_at: '2026-09-03T13:22:00Z', changes: [
    '(feat) AIPCC-31131: Set PRODUCT_VERSION to 3.6-EA2',
    '(feat) AIPCC-30149: Consume pip and uv from RHAI Python index in hermetic builds',
    '(docs) AIPCC-29126: Document Torch Day 0 images',
  ] },
  { name: 'base-v2026082701', created_at: '2026-08-27T15:30:00Z', changes: [] },
  { name: 'base-v2026082602', created_at: '2026-08-26T21:10:00Z', changes: [] },
  { name: 'base-v2026082601', created_at: '2026-08-26T12:48:00Z', changes: [] },
  { name: 'base-v2026082401', created_at: '2026-08-24T14:02:00Z', changes: [] },
  { name: 'base-v2026082001', created_at: '2026-08-20T17:25:00Z', changes: [] },
  { name: 'base-v2026081901', created_at: '2026-08-19T13:57:00Z', changes: [] },
  { name: 'base-v2026081701', created_at: '2026-08-17T15:14:00Z', changes: [] },
  { name: 'base-v2026081401', created_at: '2026-08-14T18:33:00Z', changes: [] },
  { name: 'base-v2026080701', created_at: '2026-08-07T14:45:00Z', changes: [] },
  { name: 'base-v2026080401', created_at: '2026-08-04T16:08:00Z', changes: [] },
];

// RHAIBI releases cut from a product release branch. Only channels adopted
// by that release receive them.
const RELEASE_BRANCH_DROPS = [
  { name: 'base-v3.6-EA1.2026090901', created_at: '2026-09-09T15:36:00Z', release: 'rhoai-3.6', branch: '3.6-EA1', changes: [] },
  { name: 'base-v3.6-EA1.2026090801', created_at: '2026-09-08T19:51:00Z', release: 'rhoai-3.6', branch: '3.6-EA1', changes: [] },
];

const TORCH_STACKS = {
  '2.9': [['torch', '2.9.1'], ['torchvision', '0.24.1'], ['torchaudio', '2.9.1']],
  '2.10': [['torch', '2.10.0'], ['torchvision', '0.25.0'], ['torchcodec', '0.10.0'], ['triton', '3.6.0']],
  '2.11': [['torch', '2.11.0'], ['torchvision', '0.26.0'], ['torchaudio', '2.11.0'], ['triton', '3.6.0']],
  '2.12': [['torch', '2.12.0'], ['torchvision', '0.27.0'], ['torchaudio', '2.11.0'], ['triton', '3.7.0']],
  '2.13': [['torch', '2.13.0'], ['torchvision', '0.28.0'], ['torchaudio', '2.11.0'], ['triton', '3.7.1']],
  '2.14': [['torch', '2.14.0'], ['triton', '3.8.0']],
};

// Wheels built for an accelerator stack. Stack-wide wheels are keyed by
// `accelerator[version]`, torch-specific ones by `accelerator[version]-torch`.
// A channel gets both sets.
const ACCELERATOR_WHEELS = {
  'cuda13.0-2.11': [['vllm', '0.26.1'], ['flashinfer-python', '0.6.14'], ['flashinfer-cubin', '0.6.14'], ['deep_gemm', '2.5.0+rhaiv.0'], ['nixl-cu13', '1.3.2'], ['nvidia-cutlass-dsl', '4.6.2']],
  'cuda13.0-2.13': [['cuda-core', '1.1.1'], ['nixl-cu13', '1.3.2']],
  'cuda13.0': [['cuda-python', '13.0.3'], ['cuda-bindings', '13.0.3'], ['cupy-cuda13x', '14.1.1'], ['nvtx', '0.2.15']],
  'cuda12.9-2.11': [['vllm', '0.26.1'], ['flashinfer-python', '0.6.14'], ['nixl', '1.3.2']],
  'cuda12.9': [['cuda-python', '12.9.4'], ['cuda-bindings', '12.9.5'], ['cupy-cuda12x', '14.1.1'], ['nvtx', '0.2.15']],
  'cuda13.2': [['cuda-python', '13.2.0'], ['cuda-bindings', '13.2.0'], ['cupy-cuda13x', '14.1.1'], ['nvtx', '0.2.15']],
  'rocm7.14-2.11': [['vllm', '0.26.1'], ['aotriton', '0.12b0'], ['amd-aiter', '0.1.16.post3']],
  'rocm7.14-2.12': [['aotriton', '0.11.2b0'], ['amd-aiter', '0.1.19'], ['tensorflow-rocm', '2.20.0'], ['onnxruntime-migraphx', '1.25.0']],
  'rocm7.14': [['amd-quark', '0.12.post1']],
  'gaudi1.24.1': [['vllm-gaudi', '0.26.0'], ['habana-torch-plugin', '1.24.1.482'], ['habana-torch-dataloader', '1.24.1.482'], ['habana-media-loader', '1.24.1.482'], ['habana-pyhlml', '1.24.1.482'], ['habana-gpu-migration', '1.24.1.482+redhat1'], ['intel-transformer-engine', '1.24.1.482+redhat1']],
  'spyre': [['vllm', '0.25.2'], ['ibm-fms', '1.13.0'], ['ibm-aiu-smi', '1.3.0']],
  'neuron': [['neuronx-cc', '2.26.6360.0+6f180f47'], ['neuronx-distributed', '0.19.28492+435aae2b'], ['neuronx-distributed-inference', '0.10.18399+ed62453e'], ['libneuronxla', '2.2.17544.0+fb9962bf']],
  'tpu': [['vllm', '0.27.1'], ['tpu-inference', '0.27.0'], ['jax', '0.11.0'], ['jaxlib', '0.11.0'], ['libtpu', '0.0.44'], ['torchax', '0.0.13'], ['tpu-info', '0.7.1']],
  'cpu-2.11': [['vllm', '0.26.1'], ['onnxruntime', '1.25.0']],
  'cpu-2.14': [['skl2onnx', '1.20.0'], ['onnxscript', '0.7.1']],
};

// Compiled wheels that do not link against torch or an accelerator SDK.
// They are rebuilt per OS but identical across accelerators.
const NATIVE_WHEELS = [
  ['numpy', '2.3.2'], ['scipy', '1.16.3'], ['pandas', '2.3.3'], ['pyarrow', '21.0.0'],
  ['pillow', '12.1.1'], ['protobuf', '6.33.5'], ['grpcio', '1.78.0'], ['pyyaml', '6.0.3'],
  ['sentencepiece', '0.2.1'], ['tokenizers', '0.22.2'], ['safetensors', '0.7.0'],
  ['pydantic-core', '2.41.5'], ['orjson', '3.11.5'], ['msgspec', '0.20.0'], ['numba', '0.64.0'],
  ['llvmlite', '0.47.0'], ['cryptography', '46.0.3'], ['psutil', '7.1.3'], ['pyzmq', '27.1.0'],
  ['regex', '2025.11.3'], ['onnx', '1.20.0'], ['matplotlib', '3.10.9'],
];

// Pure-python wheels (py3-none-any), identical in every channel.
const PURE_WHEELS = [
  ['transformers', '5.5.3'], ['datasets', '4.4.1'], ['huggingface-hub', '1.2.1'], ['pydantic', '2.12.5'],
  ['fastapi', '0.124.0'], ['openai', '2.9.0'], ['mistral-common', '1.8.6'], ['kubernetes', '35.0.0'],
  ['kfp-kubernetes', '2.14.6'], ['mlflow', '3.9.0'], ['google-genai', '1.75.0'], ['boto3', '1.43.46'],
  ['cloudpickle', '3.1.2'], ['filelock', '3.20.3'], ['fsspec', '2025.10.0'], ['a2a-sdk', '0.3.26'],
  ['cattrs', '25.2.0'], ['diskcache', '5.6.3'], ['opentelemetry-sdk', '1.36.0'], ['packaging', '24.2'],
  ['requests', '2.32.5'], ['jinja2', '3.1.6'], ['einops', '0.8.1'],
];

// Pure-python wheels that depend on torch, so they are absent from notorch channels.
const PURE_TORCH_WHEELS = [
  ['accelerate', '1.12.0'], ['peft', '0.18.0'], ['compressed-tensors', '0.13.0'],
  ['llmcompressor', '0.13.0'], ['depyf', '0.20.0'],
];

function stackKey(def) {
  return `${def.accelerator}${def.accelerator_version}`;
}

function channelName(def) {
  const torch = def.torch ? `torch${def.torch}` : 'notorch';
  return `${stackKey(def)}-${torch}-ubi9`;
}

function describeChannel(def) {
  const stack = [ACCELERATOR_LABELS[def.accelerator], def.accelerator_version].filter(Boolean).join(' ');
  const torch = def.torch ? `Torch ${def.torch}` : 'no Torch';
  return `${stack} with ${torch} on UBI 9`;
}

function toWheels(pairs, kind) {
  return pairs.map(([name, version]) => ({ name, version, kind }));
}

function buildWheels(def) {
  const accelerated = [];
  if (def.torch) {
    accelerated.push(...TORCH_STACKS[def.torch]);
    const stack = stackKey(def);
    accelerated.push(...(ACCELERATOR_WHEELS[`${stack}-${def.torch}`] || []));
    accelerated.push(...(ACCELERATOR_WHEELS[stack] || []));
  }
  const pure = def.torch ? [...PURE_WHEELS, ...PURE_TORCH_WHEELS] : PURE_WHEELS;
  return [
    ...toWheels(accelerated, 'accelerated'),
    ...toWheels(NATIVE_WHEELS, 'native'),
    ...toWheels(pure, 'pure'),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

function buildDrops(def, name) {
  const since = new Date(`${def.since}T00:00:00Z`).getTime();
  const torchVersion = def.torch ? TORCH_STACKS[def.torch][0][1] : null;
  const branchDrops = RELEASE_BRANCH_DROPS.filter(d =>
    def.maturity === 'stable' && def.compatible_releases.includes(d.release)
  );
  return [...MAIN_DROPS.map(d => ({ ...d, branch: 'main' })), ...branchDrops]
    .filter(d => new Date(d.created_at).getTime() >= since)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(d => ({
      key: `base-images-${d.name}`,
      name: d.name,
      product_key: 'base-images',
      git_branch: d.branch,
      created_at: d.created_at,
      pullspec: `${BASE_IMAGE_REPO}/${name}:${d.name}`,
      torch_version: torchVersion,
      changes: d.changes,
    }));
}

function countByKind(wheels) {
  const counts = { accelerated: 0, native: 0, pure: 0 };
  for (const w of wheels) counts[w.kind]++;
  return counts;
}

function buildChannel(def) {
  const name = channelName(def);
  const wheels = buildWheels(def);
  const drops = buildDrops(def, name);
  const indexBase = def.private ? PRIVATE_INDEX_BASE : PUBLIC_INDEX_BASE;
  return {
    summary: {
      name,
      description: describeChannel(def),
      maturity: def.maturity,
      accelerator: def.accelerator,
      accelerator_version: def.accelerator_version,
      torch_version: def.torch,
      rhel_version: 'ubi9',
      os_release: 'RHEL 9.8',
      python_version: '3.12',
      architectures: def.architectures,
      compatible_releases: def.compatible_releases,
      visibility: def.private ? 'private' : 'public',
      index_url: `${indexBase}/${name}/simple/`,
      base_image: `${BASE_IMAGE_REPO}/${name}`,
      wheel_count: wheels.length,
      wheel_kinds: countByKind(wheels),
      drop_count: drops.length,
      latest_drop: drops[0] ? { name: drops[0].name, created_at: drops[0].created_at } : null,
    },
    drops,
    wheels,
  };
}

// Date the catalog was last aligned with the fondue build definitions.
const AS_OF = '2026-09-11';

const CATALOG = CHANNEL_DEFINITIONS.map(buildChannel);
const BY_NAME = new Map(CATALOG.map(c => [c.summary.name, c]));

function listChannels() {
  return CATALOG.map(c => c.summary);
}

function getChannel(name) {
  const entry = BY_NAME.get(name);
  if (!entry) return null;
  return { ...entry.summary, drops: entry.drops, wheels: entry.wheels };
}

module.exports = { listChannels, getChannel, AS_OF };
