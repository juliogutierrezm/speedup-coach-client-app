import { extractYouTubeVideoId, resolveExerciseMedia, SessionExercise } from './session-exercise.utils';

describe('session-exercise utils', () => {
  it('extracts YouTube ids from supported URL formats', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=test')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('prefers hosted media and preserves a direct thumbnail when available', () => {
    const exercise: SessionExercise = {
      preview_url: 'https://cdn.example.com/video.mp4',
      thumbnail: 'https://cdn.example.com/poster.jpg',
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };

    expect(resolveExerciseMedia(exercise)).toEqual({
      preferredSource: 'native',
      nativeVideoUrl: 'https://cdn.example.com/video.mp4',
      youtubeEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1',
      thumbnailUrl: 'https://cdn.example.com/poster.jpg',
      hasPlayableVideo: true
    });
  });

  it('falls back to YouTube media and thumbnail when hosted video is missing', () => {
    const exercise: SessionExercise = {
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };

    expect(resolveExerciseMedia(exercise)).toEqual({
      preferredSource: 'youtube',
      nativeVideoUrl: null,
      youtubeEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      hasPlayableVideo: true
    });
  });

  it('returns no playable video when neither hosted nor YouTube media exists', () => {
    const exercise: SessionExercise = {
      thumbnail: 'https://cdn.example.com/poster.jpg'
    };

    expect(resolveExerciseMedia(exercise)).toEqual({
      preferredSource: 'none',
      nativeVideoUrl: null,
      youtubeEmbedUrl: null,
      thumbnailUrl: 'https://cdn.example.com/poster.jpg',
      hasPlayableVideo: false
    });
  });
});
