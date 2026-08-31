import { WorkoutSession } from '../services/client-data.service';

export interface SessionExercise {
  id?: string;
  name?: string;
  name_es?: string;
  thumbnail?: string;
  preview_url?: string;
  youtube_url?: string;
  gif_url?: string;
  sets?: number;
  reps?: number | string;
  rest?: number;
  weight?: number | string | null;
  muscle_group?: string;
  secondary_muscles?: string[];
  functional?: boolean;
  difficulty?: string;
  tips?: string[];
  common_mistakes?: string[];
  description_es?: string;
  description_en?: string;
  equipment_type?: string;
  equipment_specific?: string;
  isGroup?: boolean;
  children?: unknown[];
}

export interface ResolvedExerciseMedia {
  preferredSource: 'native' | 'youtube' | 'none';
  nativeVideoUrl: string | null;
  youtubeEmbedUrl: string | null;
  thumbnailUrl: string | null;
  hasPlayableVideo: boolean;
}

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Purpose: resolve the best available media for an exercise without changing its contract.
 * Input: SessionExercise | null | undefined. Output: preferred video source plus thumbnail fallback.
 * Error handling: returns an empty media object when the exercise has no usable media.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const resolveExerciseMedia = (
  exercise: SessionExercise | null | undefined
): ResolvedExerciseMedia => {
  const nativeVideoUrl = normalizeAssetUrl(exercise?.preview_url) || normalizeAssetUrl(exercise?.gif_url);
  const youtubeId = extractYouTubeVideoId(exercise?.youtube_url);
  const youtubeEmbedUrl = youtubeId ? buildYouTubeEmbedUrl(youtubeId) : null;
  const thumbnailUrl =
    normalizeAssetUrl(exercise?.thumbnail) || (youtubeId ? buildYouTubeThumbnailUrl(youtubeId) : null);
  const preferredSource = nativeVideoUrl ? 'native' : youtubeEmbedUrl ? 'youtube' : 'none';

  return {
    preferredSource,
    nativeVideoUrl,
    youtubeEmbedUrl,
    thumbnailUrl,
    hasPlayableVideo: Boolean(nativeVideoUrl || youtubeEmbedUrl)
  };
};

/**
 * Purpose: extract a YouTube video id from supported URL formats or a raw id.
 * Input: unknown YouTube value. Output: canonical video id or null.
 * Error handling: returns null for invalid or unsupported values.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const extractYouTubeVideoId = (value: unknown): string | null => {
  const candidate = normalizeAssetUrl(value);
  if (!candidate) {
    return null;
  }

  const directId = normalizeYouTubeId(candidate);
  if (directId) {
    return directId;
  }

  const parsedUrl = tryParseUrl(candidate);
  if (!parsedUrl) {
    return null;
  }

  const hostname = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();
  if (hostname === 'youtu.be') {
    return normalizeYouTubeId(parsedUrl.pathname.split('/').filter(Boolean)[0] || null);
  }

  if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
    const watchId = parsedUrl.searchParams.get('v');
    if (watchId) {
      return normalizeYouTubeId(watchId);
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(pathSegments[0])) {
      return normalizeYouTubeId(pathSegments[1]);
    }
  }

  return null;
};

/**
 * Purpose: normalize session exercise items into a flattened list for display.
 * Input: unknown array of items. Output: SessionExercise[].
 * Error handling: skips invalid items and returns empty list on bad input.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const flattenSessionItems = (items: unknown): SessionExercise[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const flattened: SessionExercise[] = [];

  items.forEach(item => {
    const exercise = toExercise(item);
    if (!exercise) {
      return;
    }

    if (exercise.isGroup && Array.isArray(exercise.children) && exercise.children.length > 0) {
      exercise.children.forEach(child => {
        const childExercise = toExercise(child);
        if (childExercise) {
          flattened.push(childExercise);
        }
      });
      return;
    }

    flattened.push(exercise);
  });

  return flattened;
};

/**
 * Purpose: compute exercise count for a session including grouped children.
 * Input: WorkoutSession. Output: number.
 * Error handling: returns 0 for missing data.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const getSessionExerciseCount = (session: WorkoutSession | null): number => {
  if (!session) {
    return 0;
  }
  return flattenSessionItems(session.items).length;
};

/**
 * Purpose: resolve the first available primary muscle group from a session.
 * Input: WorkoutSession. Output: string | null.
 * Error handling: returns null when none exists.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const getSessionPrimaryMuscle = (session: WorkoutSession | null): string | null => {
  const exercises = flattenSessionItems(session?.items);
  const found = exercises.find(item => typeof item?.muscle_group === 'string' && item.muscle_group.trim().length > 0);
  return found?.muscle_group ? found.muscle_group.trim() : null;
};

/**
 * Purpose: detect if a session includes at least one functional exercise.
 * Input: WorkoutSession. Output: boolean.
 * Error handling: returns false on missing data.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const hasFunctionalExercise = (session: WorkoutSession | null): boolean => {
  const exercises = flattenSessionItems(session?.items);
  return exercises.some(item => item?.functional === true);
};

/**
 * Purpose: cast unknown values to SessionExercise safely.
 * Input: unknown. Output: SessionExercise | null.
 * Error handling: returns null for non-object inputs.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
const toExercise = (value: unknown): SessionExercise | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as SessionExercise;
};

const normalizeAssetUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeYouTubeId = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return YOUTUBE_ID_PATTERN.test(trimmed) ? trimmed : null;
};

const tryParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
};

const buildYouTubeEmbedUrl = (videoId: string): string =>
  `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;

const buildYouTubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
