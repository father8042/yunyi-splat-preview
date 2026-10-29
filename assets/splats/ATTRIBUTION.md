# Splat assets — attribution & licenses

Ready-made Gaussian Splats for 云逸 route-B scaffold demos.  
**云逸 will not capture original scenes for now** — these stand in for mountain / meadow / ocean slots.

| Local file | Theme | Source | Size | License | Credit required? | Commercial OK? |
|------------|-------|--------|------|---------|------------------|----------------|
| `coast.sog` | Coastal cliff + ocean (Big Sur) | [Jamesbass/bigsur-360-colmap](https://huggingface.co/datasets/Jamesbass/bigsur-360-colmap) (`bigsur_v2_full_quality.sog`) | ~127 MB | **CC BY 4.0** | **Yes** — credit Jamesbass / dataset page | **Yes**, with attribution |
| `meadow.ply` (`forest.ply` → same) | Lawn + tree (outdoor / meadow-like) | [promc/reconstruction-scenes](https://huggingface.co/datasets/promc/reconstruction-scenes) `lawn-tree/gsplat/lawn-tree.ply` | ~411 MB | **CC0 1.0** | Courtesy credit appreciated | **Yes** (public domain dedication) |
| `ocean.ply` | Coral reef (underwater stand-in for “海际”) | [wildflow/soneva-corals](https://huggingface.co/datasets/wildflow/soneva-corals) `maldives_soneva_hb_20250710/splats/ply/lod3.ply` | ~28 MB | **CC BY 4.0** | **Yes** — Soneva Conservation & Sustainability + Wildflow | **Yes**, with attribution |
| `waterfall.sog` | Waterfall | Rebundled from SuperSplat public viewer CDN scene [`3f415ce8`](https://superspl.at/scene/3f415ce8) (versatile_vertices) | ~11 MB | **Unconfirmed** — not verified as a SuperSplat “downloadable + CC” release | Treat as **local preview only** | **Do not ship publicly / commercially** until creator license confirmed |

## How to credit (CC BY)

Suggested footer / about blurb:

> Landscape demos use CC-licensed Gaussian Splats: Big Sur cliff © dataset authors (Jamesbass/bigsur-360-colmap, CC BY 4.0); coral reef © Soneva / Wildflow (CC BY 4.0). Lawn-tree scene: promc/reconstruction-scenes (CC0).

## Honest constraints

- **CC BY**: free to adapt and use commercially **if** you give attribution and link the license.  
- **CC BY-NC** (none of the primary three above): would **forbid** commercial site use — we avoided NC sources for the main trio.  
- **Big Sur PLY** (`splats/bigsur_v2.ply`) is ~1.0 GB — **not downloaded** (over size budget); SOG used instead.  
- Moving water in Big Sur / waterfall is a soft averaged surface (static 3DGS limit).  
- `waterfall.sog` is **scaffold-only** until SuperSplat download rights are confirmed.

## Not included

- `ref-user.jpg` alone cannot be trained into a splat.  
- cakewalk / dylanebert garden dumps without a clear card license were **not** kept.
