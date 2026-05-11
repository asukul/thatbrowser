# Prompt Template: Open-Source 3D Home Walkthrough App

Use this prompt with Codex (or another coding assistant) to kick off implementation.

## Refined Prompt

> Codex, help me build an open-source 3D home walkthrough app for **iPhone 16 Pro Max**, **iPhone 17 Pro Max**, and **iPad Pro**, aimed at realtors, home buyers, and anyone scanning houses for sale.
>
> Build two scanning modes:
> 1. **Interior mode** for guided room scans (walls, ceilings, floors, openings, and room-to-room transitions).
> 2. **Exterior mode** for facade and lot capture, with sunlight-aware exposure handling and Google Maps Street View context linking.
>
> The output must be a **shareable 3D model** in **USDZ** and **glTF/GLB**.
>
> The viewing experience should feel similar to Zillow-style walkthrough browsing, but fully free and open source.
>
> Platform requirements:
> - **iOS/iPadOS app**: use **ARKit** for capture, tracking, and walkthrough UX.
> - **Web viewer**: use **`<model-viewer>`** for cross-device playback and sharing.
>
> Deployment requirements (GCP-first):
> - Host backend APIs, processing jobs, and static web viewer on **Google Cloud Platform**.
> - Optimize for low latency and global delivery (Cloud Run, Cloud Storage, Cloud CDN).
> - Use signed upload/download URLs, background conversion jobs, and cost-aware autoscaling.
> - Store source scans, derived assets, and metadata with lifecycle policies.
>
> Engineering goals:
> - Smooth performance on all supported devices.
> - Stable capture sessions with graceful degradation on weak conditions.
> - Clear architecture, modular code, and MIT/Apache-2.0 friendly dependencies.
> - Production-ready baseline: CI/CD, observability, and security best practices.
>
> Start by generating:
> 1. A monorepo structure (`ios-app`, `web-viewer`, `backend`, `infra`).
> 2. A phase-by-phase implementation plan.
> 3. Initial code scaffolding for each module.
> 4. A local dev workflow and GCP deployment path.

## Notes

- If you only need quick ideation, use the refined prompt as-is.
- If you need implementation output, ask Codex to generate files in sequence:
  1. `README.md` architecture overview,
  2. iOS capture MVP,
  3. backend upload + conversion pipeline,
  4. web viewer playback,
  5. infra deployment templates.
