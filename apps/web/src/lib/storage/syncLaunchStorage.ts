import { prisma, type Prisma } from '@sanova/database';
import {
  parseMediaGallery,
  type LaunchContracts,
  type LaunchMediaItem
} from '../admin/launchTypes';
import {
  getLaunchStorageBucket,
  getPublicStorageUrl,
  getSupabaseAdmin,
  isSupabaseStorageConfigured
} from './supabaseAdmin';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov']);
const PDF_EXT = new Set(['pdf']);

function extension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function classifyMedia(name: string): LaunchMediaItem['type'] | null {
  const ext = extension(name);
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'reel';
  return null;
}

function classifyContractKey(name: string): keyof LaunchContracts | null {
  const lower = name.toLowerCase();
  if (/trust|fideicomiso|fiduciario/.test(lower)) return 'trust';
  if (/purchase|compraventa|compra/.test(lower)) return 'purchase';
  if (/lease|locacion|alquiler/.test(lower)) return 'lease';
  if (/smart|contrato.?inteligente|token/.test(lower)) return 'smartContract';
  return null;
}

async function listAllFiles(prefix: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const bucket = getLaunchStorageBucket();
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' }
  });

  if (error || !data) {
    return [];
  }

  const files: string[] = [];

  for (const entry of data) {
    if (!entry.name) continue;

    const path = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.id === null) {
      files.push(...(await listAllFiles(path)));
      continue;
    }

    files.push(path);
  }

  return files;
}

function mergeGallery(existing: LaunchMediaItem[], discovered: LaunchMediaItem[]): LaunchMediaItem[] {
  const urls = new Set(existing.map((item) => item.url));
  const merged = [...existing];

  for (const item of discovered) {
    if (!urls.has(item.url)) {
      merged.push(item);
      urls.add(item.url);
    }
  }

  return merged;
}

function mergeContracts(existing: LaunchContracts, discovered: LaunchContracts): LaunchContracts {
  return {
    trust: existing.trust || discovered.trust || null,
    purchase: existing.purchase || discovered.purchase || null,
    lease: existing.lease || discovered.lease || null,
    smartContract: existing.smartContract || discovered.smartContract || null
  };
}

export async function discoverLaunchAssetsFromStorage(projectId: string): Promise<{
  mediaGallery: LaunchMediaItem[];
  contracts: LaunchContracts;
  image: string | null;
}> {
  if (!isSupabaseStorageConfigured()) {
    return { mediaGallery: [], contracts: {}, image: null };
  }

  const mediaGallery: LaunchMediaItem[] = [];
  const contracts: LaunchContracts = {};
  const contractSlots: Array<keyof LaunchContracts> = ['trust', 'purchase', 'lease', 'smartContract'];
  let nextContractSlot = 0;

  const scanRoots = [projectId, `draft/${projectId}`];
  const objectPaths = new Set<string>();

  for (const root of scanRoots) {
    for (const objectPath of await listAllFiles(root)) {
      objectPaths.add(objectPath);
    }
  }

  for (const objectPath of objectPaths) {
      const name = objectPath.split('/').pop() ?? objectPath;
      const url = getPublicStorageUrl(objectPath);
      const mediaType = classifyMedia(name);

      if (mediaType) {
        mediaGallery.push({ type: mediaType, url, caption: name });
        continue;
      }

      if (PDF_EXT.has(extension(name))) {
        const key = classifyContractKey(name) ?? contractSlots[nextContractSlot++];
        if (key && !contracts[key]) {
          contracts[key] = url;
        }
      }
  }

  const primaryImage = mediaGallery.find((item) => item.type === 'image')?.url ?? null;

  return { mediaGallery, contracts, image: primaryImage };
}

export async function syncProjectAssetsFromStorage(projectId: string): Promise<boolean> {
  if (!isSupabaseStorageConfigured()) {
    return false;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return false;
  }

  const existingGallery = parseMediaGallery(project.mediaGallery);
  const existingContracts: LaunchContracts = {
    trust: project.contractTrustUrl,
    purchase: project.contractPurchaseUrl,
    lease: project.contractLeaseUrl,
    smartContract: project.contractSmartUrl
  };

  const discovered = await discoverLaunchAssetsFromStorage(projectId);
  const mediaGallery = mergeGallery(existingGallery, discovered.mediaGallery);
  const contracts = mergeContracts(existingContracts, discovered.contracts);
  const image = project.image ?? discovered.image ?? mediaGallery.find((item) => item.type === 'image')?.url ?? null;

  const galleryChanged = mediaGallery.length !== existingGallery.length;
  const contractsChanged =
    contracts.trust !== existingContracts.trust ||
    contracts.purchase !== existingContracts.purchase ||
    contracts.lease !== existingContracts.lease ||
    contracts.smartContract !== existingContracts.smartContract;
  const imageChanged = image !== project.image;

  if (!galleryChanged && !contractsChanged && !imageChanged) {
    return false;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      mediaGallery: mediaGallery as Prisma.InputJsonValue,
      image,
      contractTrustUrl: contracts.trust ?? null,
      contractPurchaseUrl: contracts.purchase ?? null,
      contractLeaseUrl: contracts.lease ?? null,
      contractSmartUrl: contracts.smartContract ?? null
    }
  });

  return true;
}

export async function syncActiveProjectsFromStorage(): Promise<number> {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true }
  });

  let synced = 0;

  for (const project of projects) {
    const changed = await syncProjectAssetsFromStorage(project.id);
    if (changed) synced += 1;
  }

  return synced;
}
