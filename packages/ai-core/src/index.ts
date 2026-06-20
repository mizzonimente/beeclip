// Barrel pubblico di @clipmanager/ai-core. apps/api e apps/worker importano
// solo da qui: i path interni dei singoli moduli possono cambiare senza
// rompere i consumer.

export * from "./transcription/index.js";
export * from "./analysis/index.js";
export * from "./metadata/index.js";
export * from "./crop/smartCrop.js";
export * from "./crop/ffmpegFilters.js";
export * from "./social/index.js";
export * from "./trends/index.js";
export * from "./ffmpeg/index.js";
export * from "./facetrack/index.js";
