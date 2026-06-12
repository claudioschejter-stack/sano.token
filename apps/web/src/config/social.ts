/** Public social profiles — override via Vercel env. */
export function getLinkedInUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() ||
    'https://www.linkedin.com/company/sanova-global'
  );
}

export function getYouTubeUrl(): string {
  return (
    process.env.NEXT_PUBLIC_YOUTUBE_URL?.trim() ||
    'https://www.youtube.com/@SanovaGlobal'
  );
}
