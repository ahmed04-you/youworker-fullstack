## Deployment Checklist

This stack runs on CPU with optional GPU support for Ollama. Before you move it to a new machine, walk through the steps below to avoid surprises.

1. **Install Docker + Compose plugin**
   - https://docs.docker.com/engine/install/ubuntu/
   - Enable the Docker service and add your user to the `docker` group.

2. **Authenticate to required registries (if needed)**
   - Images referenced in this stack are public by default.
   - If you mirror them or host private builds, log in with credentials that can pull from your registry.
   - Update `.env` or the Compose file to point at your custom image names when required.

3. **Clone the repo and copy environment**
   - `git clone <repo> && cd youworker-fullstack`
   - Create a `.env` (see `apps/api/config.py` or `packages/common/settings.py` for defaults). Adjust URLs if services run on another host.
   - Add any sample documents under `examples/ingestion/` on the host; the stack mounts this directory at `/data/examples` inside the API container for ingestion tests.

4. **Build images**
   - `docker compose -f ops/compose/docker-compose.yml build`
   - If you build elsewhere and move images, preload the Ollama models on the target host:
     `docker compose run --rm ollama ollama pull gpt-oss:20b embeddinggemma:300m`.

5. **Start the stack**
   - `docker compose -f ops/compose/docker-compose.yml up -d`
   - First boot will download Ollama models and may take several minutes.

6. **Test document ingestion**
   - Place files in `examples/ingestion/` (host).
   - From inside the stack, reference them as `/data/examples/<filename>` when calling the ingest API.

7. **Backups and persistence**
   - Qdrant data → named volume `qdrant_data`.
   - Ollama models → named volume `ollama_data`. Snapshot these before upgrades.

8. **Runtime health checks**
   - API docs: http://localhost:8001/docs
   - SSE stream sanity check: `curl -N http://localhost:8001/v1/chat` with a sample payload.

## Optional: GPU Support for Ollama

If you want to accelerate Ollama with GPU:

1. **Install NVIDIA drivers**
   - Ubuntu: `sudo ubuntu-drivers autoinstall && sudo reboot`
   - Confirm with `nvidia-smi`.

2. **Install NVIDIA Container Toolkit**
   - Follow https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
   - Set Docker's default runtime or start the daemon with `nvidia-container-runtime`.
   - Test: `docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi`.

3. **Verify GPU visibility in Ollama container**
   - `docker compose exec ollama nvidia-smi` to confirm Ollama sees the GPU.

**Note**: Document parsing (Docling), OCR (Tesseract), and transcription (Whisper) all run on CPU only for maximum compatibility and reliability.

Keep this checklist with your deployment runbook so each host is provisioned identically.
