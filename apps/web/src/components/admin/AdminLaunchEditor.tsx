'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  ImagePlus,
  Loader2,
  MapPin,
  Rocket,
  Save,
  Trash2,
  Video
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { AdminAssetRecord, CreateAdminAssetInput } from '../../lib/admin/assetsService';
import {
  autoFillCentrifugeChecklist,
  buildMapEmbedUrl,
  centrifugeReadinessScore,
  EMPTY_CENTRIFUGE_CHECKLIST,
  type CentrifugeChecklist,
  type CollateralProtocol,
  type CollateralTarget,
  type LaunchMediaItem,
  type TokenStandard,
  type TokenInstrumentType,
  instrumentTypeDefaults
} from '../../lib/admin/launchTypes';
import { buildSmartContractDocUrl } from '../../lib/blockchain/explorerUrls';
import {
  formatLaunchGateIssues,
  isErc4626OnChainReady,
  mergeLaunchGateIssues,
  validateErc4626LaunchForm,
  type LaunchGateIssue,
  type LaunchGateIssueCode
} from '../../lib/admin/erc4626LaunchGate';
import { validateErc4626MorphoFormRequirements } from '../../lib/admin/erc4626MorphoGate';
import { AdminGate } from './AdminGate';

type AdminLaunchEditorProps = {
  mode: 'create' | 'edit';
  projectId?: string;
  /** marketplace = tarjeta/token; lending = vault, colateral y automatización */
  scope?: 'marketplace' | 'lending';
};

type TokenDeployHealth = {
  configured?: boolean;
  chainId?: number;
  deployerAddress?: string | null;
  hasGas?: boolean;
  gasBalanceWei?: string | null;
  gasCheckError?: string | null;
};

type FormState = {
  title: string;
  description: string;
  location: string;
  latitude: string;
  longitude: string;
  totalTokens: string;
  availableTokens: string;
  pricePerToken: string;
  targetYield: string;
  tokenInstrumentType: TokenInstrumentType;
  maturityDate: string;
  equitySharePercent: string;
  tokenName: string;
  tokenSymbol: string;
  tokenStandard: TokenStandard;
  spvEntityName: string;
  navOracleUrl: string;
  centrifugeChecklist: CentrifugeChecklist;
  vaultAddress: string;
  jurisdiction: string;
  contractAddress: string;
  isActive: boolean;
  deployToken: boolean;
  collateralCentrifuge: boolean;
  collateralSky: boolean;
  collateralMorpho: boolean;
  collateralAaveHorizon: boolean;
  collateralMaple: boolean;
  collateralClearpool: boolean;
  collateralFigure: boolean;
  contracts: {
    trust: string;
    purchase: string;
    lease: string;
    smartContract: string;
  };
  mediaGallery: LaunchMediaItem[];
  reelUrl: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  location: '',
  latitude: '',
  longitude: '',
  totalTokens: '',
  availableTokens: '',
  pricePerToken: '',
  targetYield: '9',
  tokenInstrumentType: 'EQUITY',
  maturityDate: '',
  equitySharePercent: '100',
  tokenName: '',
  tokenSymbol: '',
  tokenStandard: 'ERC4626',
  spvEntityName: '',
  navOracleUrl: '',
  centrifugeChecklist: { ...EMPTY_CENTRIFUGE_CHECKLIST },
  vaultAddress: '',
  jurisdiction: 'AR',
  contractAddress: '',
  isActive: false,
  deployToken: true,
  collateralCentrifuge: false,
  collateralSky: false,
  collateralMorpho: true,
  collateralAaveHorizon: false,
  collateralMaple: false,
  collateralClearpool: false,
  collateralFigure: false,
  contracts: { trust: '', purchase: '', lease: '', smartContract: '' },
  mediaGallery: [],
  reelUrl: ''
};

function protocolFlagsFromTargets(targets: CollateralTarget[]) {
  const set = new Set(targets.map((t) => t.protocol));
  return {
    collateralCentrifuge: set.has('CENTRIFUGE'),
    collateralSky: set.has('SKY'),
    collateralMorpho: set.has('MORPHO'),
    collateralAaveHorizon: set.has('AAVE_HORIZON'),
    collateralMaple: set.has('MAPLE'),
    collateralClearpool: set.has('CLEARPOOL'),
    collateralFigure: set.has('FIGURE')
  };
}

function assetToForm(asset: AdminAssetRecord): FormState {
  return {
    title: asset.title,
    description: asset.description,
    location: asset.location,
    latitude: asset.latitude != null ? String(asset.latitude) : '',
    longitude: asset.longitude != null ? String(asset.longitude) : '',
    totalTokens: String(asset.totalTokens),
    availableTokens: String(asset.availableTokens),
    pricePerToken: String(asset.pricePerToken),
    targetYield: String(asset.targetYield),
    tokenInstrumentType: asset.tokenInstrumentType,
    maturityDate: asset.maturityDate ? asset.maturityDate.slice(0, 10) : '',
    equitySharePercent: asset.equitySharePercent != null ? String(asset.equitySharePercent) : '100',
    tokenName: asset.tokenName ?? '',
    tokenSymbol: asset.tokenSymbol ?? '',
    tokenStandard: asset.tokenStandard,
    spvEntityName: asset.spvEntityName ?? '',
    navOracleUrl: asset.navOracleUrl ?? '',
    centrifugeChecklist: asset.centrifugeChecklist,
    vaultAddress: asset.vaultAddress ?? '',
    jurisdiction: asset.jurisdiction ?? 'AR',
    contractAddress: asset.contractAddress ?? '',
    isActive: asset.isActive,
    deployToken: false,
    ...protocolFlagsFromTargets(asset.collateralTargets),
    contracts: {
      trust: asset.contracts.trust ?? '',
      purchase: asset.contracts.purchase ?? '',
      lease: asset.contracts.lease ?? '',
      smartContract: asset.contracts.smartContract ?? ''
    },
    mediaGallery: asset.mediaGallery,
    reelUrl: ''
  };
}

function selectedCollateral(form: FormState): CollateralProtocol[] {
  const protocols: CollateralProtocol[] = [];
  if (form.collateralCentrifuge) protocols.push('CENTRIFUGE');
  if (form.collateralSky) protocols.push('SKY');
  if (form.collateralMorpho || form.tokenStandard === 'ERC4626') protocols.push('MORPHO');
  if (form.collateralAaveHorizon) protocols.push('AAVE_HORIZON');
  if (form.collateralMaple) protocols.push('MAPLE');
  if (form.collateralClearpool) protocols.push('CLEARPOOL');
  if (form.collateralFigure) protocols.push('FIGURE');
  return protocols;
}

const COLLATERAL_FORM_KEYS: Array<{ key: keyof FormState; protocol: CollateralProtocol; label: string }> = [
  { key: 'collateralCentrifuge', protocol: 'CENTRIFUGE', label: 'Centrifuge' },
  { key: 'collateralSky', protocol: 'SKY', label: 'Sky Protocol (MakerDAO)' },
  { key: 'collateralMorpho', protocol: 'MORPHO', label: 'Morpho' },
  { key: 'collateralAaveHorizon', protocol: 'AAVE_HORIZON', label: 'Aave Horizon (RWA)' },
  { key: 'collateralMaple', protocol: 'MAPLE', label: 'Maple Finance' },
  { key: 'collateralClearpool', protocol: 'CLEARPOOL', label: 'Clearpool' },
  { key: 'collateralFigure', protocol: 'FIGURE', label: 'Figure Markets' }
];

export function AdminLaunchEditor({ mode, projectId, scope = 'marketplace' }: AdminLaunchEditorProps) {
  const t = useTranslation();
  const l = t.adminLaunch;
  const router = useRouter();
  const isMarketplace = scope === 'marketplace';
  const isLending = scope === 'lending';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);
  const [vaultFundingStatus, setVaultFundingStatus] = useState<string>('NOT_REQUIRED');
  const [tokenDeployReady, setTokenDeployReady] = useState<boolean | null>(null);
  const [tokenDeployHealth, setTokenDeployHealth] = useState<TokenDeployHealth | null>(null);
  const [collateralTargets, setCollateralTargets] = useState<CollateralTarget[]>([]);
  const [deploymentEvents, setDeploymentEvents] = useState<AdminAssetRecord['deploymentEvents']>([]);
  const [automationReadiness, setAutomationReadiness] = useState<AdminAssetRecord['automationReadiness'] | null>(null);
  const [registeringCollateral, setRegisteringCollateral] = useState(false);
  const [repairingAutomation, setRepairingAutomation] = useState(false);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [linkedInvestorWallet, setLinkedInvestorWallet] = useState<string | null>(null);
  const [migratingShares, setMigratingShares] = useState(false);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapPreview = useMemo(() => {
    const lat = form.latitude ? Number.parseFloat(form.latitude) : null;
    const lng = form.longitude ? Number.parseFloat(form.longitude) : null;
    return buildMapEmbedUrl(form.location || 'Argentina', lat, lng);
  }, [form.location, form.latitude, form.longitude]);

  const loadAsset = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}`);
      if (!response.ok) throw new Error('load failed');
      const data = (await response.json()) as { asset: AdminAssetRecord };
      setForm(assetToForm(data.asset));
      setTokenStatus(data.asset.tokenDeployStatus);
      setVaultFundingStatus(data.asset.vaultFundingStatus);
      setCollateralTargets(data.asset.collateralTargets);
      setDeploymentEvents(data.asset.deploymentEvents);
      setAutomationReadiness(data.asset.automationReadiness);
      skipAutoSaveRef.current = true;
    } catch {
      setError(l.loadError);
    } finally {
      setLoading(false);
    }
  }, [projectId, l.loadError]);

  useEffect(() => {
    if (mode === 'edit') {
      void loadAsset();
    }
  }, [mode, loadAsset]);

  useEffect(() => {
    void fetch('/api/admin/token-deploy/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: TokenDeployHealth | null) => {
        setTokenDeployHealth(data);
        setTokenDeployReady(Boolean(data?.configured));
      })
      .catch(() => setTokenDeployReady(false));
  }, []);

  useEffect(() => {
    void fetch('/api/admin/launch-issuer-wallet')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { walletAddress?: string | null } | null) => {
        setLinkedInvestorWallet(data?.walletAddress?.trim() || null);
      })
      .catch(() => setLinkedInvestorWallet(null));
  }, []);

  const isErc4626Launch = form.tokenStandard === 'ERC4626';
  const shouldAutoDeploy = isErc4626Launch || (tokenDeployReady === true && !form.contractAddress);
  const onChainLaunchReady =
    isErc4626Launch &&
    isErc4626OnChainReady({
      tokenStandard: form.tokenStandard,
      tokenDeployStatus: tokenStatus ?? 'NOT_REQUESTED',
      contractAddress: form.contractAddress || null,
      vaultAddress: form.vaultAddress || null,
      vaultFundingStatus,
      contracts: { smartContract: form.contracts.smartContract || null }
    });
  /** ERC-4626: emit token + vault + Morpho from marketplace or loans when not yet on-chain. */
  const shouldEmitErc4626OnChain = isErc4626Launch && !onChainLaunchReady;

  function launchGateMessages(): Record<LaunchGateIssueCode, string> {
    return l.launchGate as Record<LaunchGateIssueCode, string>;
  }

  function formatLaunchIssues(issues: LaunchGateIssue[]): string {
    return `${l.launchGateTitle}\n${l.launchGateIntro}\n${formatLaunchGateIssues(issues, launchGateMessages())}`;
  }

  async function uploadFile(file: File, folder: string) {
    setUploading(true);
    setError(null);

    try {
      const signedResponse = await fetch('/api/admin/assets/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          folder
        })
      });

      const signedData = (await signedResponse.json()) as {
        uploadUrl?: string;
        url?: string;
        kind?: string;
        mimeType?: string;
        error?: string;
        detail?: string;
        storage?: string;
      };

      if (signedResponse.ok && signedData.uploadUrl && signedData.url) {
        const putResponse = await fetch(signedData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': signedData.mimeType || file.type || 'application/octet-stream'
          },
          body: file
        });

        if (!putResponse.ok) {
          throw new Error(signedData.detail ?? 'upload failed');
        }

        return {
          url: signedData.url,
          kind: signedData.kind,
          storage: signedData.storage
        };
      }

      if (signedData.error === 'STORAGE_NOT_CONFIGURED') {
        throw new Error('STORAGE_NOT_CONFIGURED');
      }

      const body = new FormData();
      body.append('file', file);
      body.append('folder', folder);

      const response = await fetch('/api/admin/assets/upload', { method: 'POST', body });
      const data = (await response.json()) as {
        url?: string;
        kind?: string;
        error?: string;
        detail?: string;
        storage?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(data.detail ?? data.error ?? 'upload failed');
      }

      return data;
    } catch (error) {
      const code = error instanceof Error ? error.message : undefined;
      setError(mapUploadError(code));
      throw error;
    } finally {
      setUploading(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const folder = projectId ?? 'draft';

    try {
      const result = await uploadFile(file, folder);
      if (!result?.url) return;

      const nextGallery = [
        ...form.mediaGallery,
        { type: 'image' as const, url: result.url, caption: file.name }
      ];

      setForm((current) => ({ ...current, mediaGallery: nextGallery }));
      await persistMediaGallery(nextGallery);
      setMessage(l.mediaSaved);
    } catch {
      // uploadFile already sets error message
    } finally {
      event.target.value = '';
    }
  }

  async function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const folder = `${projectId ?? 'draft'}/reels`;

    try {
      const result = await uploadFile(file, folder);
      if (!result?.url) return;

      const nextGallery = [
        ...form.mediaGallery,
        { type: 'reel' as const, url: result.url, caption: file.name }
      ];

      setForm((current) => ({ ...current, mediaGallery: nextGallery }));
      await persistMediaGallery(nextGallery);
      setMessage(l.mediaSaved);
    } catch {
      // uploadFile already sets error message
    } finally {
      event.target.value = '';
    }
  }

  async function handleContractUpload(
    key: keyof FormState['contracts'],
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const folder = `${projectId ?? 'draft'}/contracts`;
    const result = await uploadFile(file, folder);
    if (!result?.url) return;

    const nextContracts = { ...form.contracts, [key]: result.url };

    setForm((current) => ({
      ...current,
      contracts: nextContracts
    }));

    try {
      await persistContracts(nextContracts);
      setMessage(l.mediaSaved);
    } catch {
      setError(l.saveError);
    }
  }

  function addReelUrl() {
    const url = form.reelUrl.trim();
    if (!url) return;

    const nextGallery = [...form.mediaGallery, { type: 'reel' as const, url }];
    setForm((current) => ({
      ...current,
      mediaGallery: nextGallery,
      reelUrl: ''
    }));

    void persistMediaGallery(nextGallery)
      .then(() => setMessage(l.mediaSaved))
      .catch(() => setError(l.saveError));
  }

  function removeMedia(index: number) {
    const nextGallery = form.mediaGallery.filter((_, i) => i !== index);
    setForm((current) => ({
      ...current,
      mediaGallery: nextGallery
    }));

    void persistMediaGallery(nextGallery)
      .then(() => setMessage(l.mediaSaved))
      .catch(() => setError(l.saveError));
  }

  function applyInstrumentDefaults(type: TokenInstrumentType) {
    const defaults = instrumentTypeDefaults(type);
    setForm((current) => ({
      ...current,
      tokenInstrumentType: type,
      tokenStandard: defaults.tokenStandard,
      maturityDate: type === 'DEBT' ? current.maturityDate : '',
      equitySharePercent: type === 'EQUITY' ? current.equitySharePercent || '100' : ''
    }));
  }

  async function persistMediaGallery(gallery: LaunchMediaItem[]) {
    if (mode !== 'edit' || !projectId) {
      return;
    }

    const primaryImage = gallery.find((item) => item.type === 'image')?.url ?? null;

    const response = await fetch(`/api/admin/assets/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaGallery: gallery,
        ...(primaryImage ? { image: primaryImage } : {})
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? 'save failed');
    }
  }

  async function persistContracts(contracts: FormState['contracts']) {
    if (mode !== 'edit' || !projectId) {
      return;
    }

    const response = await fetch(`/api/admin/assets/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracts })
    });

    if (!response.ok) {
      throw new Error('save failed');
    }
  }

  async function persistDraft(options?: { silent?: boolean }) {
    if (mode !== 'edit' || !projectId || loading) {
      return;
    }

    const smartContractUrl =
      form.contracts.smartContract ||
      (form.contractAddress ? buildSmartContractDocUrl(null, form.contractAddress) : null);

    const response = await fetch(`/api/admin/assets/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildPayload(),
        availableTokens: Number.parseInt(form.availableTokens, 10),
        contractAddress: form.contractAddress || null,
        contracts: {
          ...form.contracts,
          smartContract: smartContractUrl ?? form.contracts.smartContract
        }
      })
    });

    if (!response.ok) {
      if (!options?.silent) {
        setError(l.saveError);
      }
      throw new Error('save failed');
    }

    if (!options?.silent) {
      setMessage(l.saveSuccess);
    } else {
      setMessage(l.mediaSaved);
    }
  }

  useEffect(() => {
    if (mode !== 'edit' || !projectId || loading || form.tokenStandard === 'ERC4626') {
      return;
    }

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistDraft({ silent: true }).catch(() => undefined);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [form, mode, projectId, loading]);

  function mapUploadError(code?: string): string {
    if (code === 'STORAGE_NOT_CONFIGURED') {
      return l.uploadStorageNotConfigured;
    }

    if (code === 'Unsupported file type') {
      return l.uploadUnsupportedType;
    }

    if (code?.includes('File too large')) {
      return l.uploadTooLarge;
    }

    if (code?.includes('mime type') && code.includes('not supported')) {
      return l.uploadUnsupportedType;
    }

    if (code && code !== 'upload failed' && code !== 'Upload failed') {
      return `${l.uploadError} ${code}`;
    }

    return l.uploadError;
  }

  function buildPayload(): CreateAdminAssetInput {
    const checklist = autoFillCentrifugeChecklist({
      checklist: form.centrifugeChecklist,
      hasTrustContract: Boolean(form.contracts.trust),
      hasNavOracleUrl: Boolean(form.navOracleUrl.trim()),
      hasSpvName: Boolean(form.spvEntityName.trim()),
      tokenDeployed: Boolean(form.contractAddress)
    });

    return {
      title: form.title,
      description: form.description,
      location: form.location,
      latitude: form.latitude ? Number.parseFloat(form.latitude) : null,
      longitude: form.longitude ? Number.parseFloat(form.longitude) : null,
      mediaGallery: form.mediaGallery,
      contracts: form.contracts,
      tokenName: form.tokenName || form.title,
      tokenSymbol: form.tokenSymbol,
      tokenStandard: form.tokenStandard,
      tokenInstrumentType: form.tokenInstrumentType,
      maturityDate: form.tokenInstrumentType === 'DEBT' && form.maturityDate ? form.maturityDate : null,
      equitySharePercent:
        form.tokenInstrumentType === 'EQUITY' && form.equitySharePercent ?
          Number.parseFloat(form.equitySharePercent)
        : null,
      spvEntityName: form.spvEntityName || null,
      navOracleUrl: form.navOracleUrl || null,
      centrifugeChecklist: checklist,
      totalTokens: Number.parseInt(form.totalTokens, 10),
      pricePerToken: Number.parseFloat(form.pricePerToken),
      targetYield: Number.parseFloat(form.targetYield),
      jurisdiction: form.jurisdiction,
      isActive: form.isActive,
      collateralProtocols: selectedCollateral(form),
      deployToken: shouldEmitErc4626OnChain || (!isErc4626Launch && (shouldAutoDeploy || form.deployToken))
    };
  }

  function erc4626FormValidationIssues(wantsPublish: boolean): LaunchGateIssue[] {
    if (!isErc4626Launch) return [];

    const checklist = autoFillCentrifugeChecklist({
      checklist: form.centrifugeChecklist,
      hasTrustContract: Boolean(form.contracts.trust),
      hasNavOracleUrl: Boolean(form.navOracleUrl.trim()),
      hasSpvName: Boolean(form.spvEntityName.trim()),
      tokenDeployed: Boolean(form.contractAddress)
    });

    return mergeLaunchGateIssues(
      validateErc4626LaunchForm({
        title: form.title,
        description: form.description,
        location: form.location,
        totalTokens: Number.parseInt(form.totalTokens, 10),
        pricePerToken: Number.parseFloat(form.pricePerToken),
        tokenName: form.tokenName || form.title,
        tokenSymbol: form.tokenSymbol,
        mediaGallery: form.mediaGallery,
        isActive: wantsPublish,
        collateralMorpho: true
      }),
      validateErc4626MorphoFormRequirements({
        totalTokens: Number.parseInt(form.totalTokens, 10),
        spvEntityName: form.spvEntityName || null,
        navOracleUrl: form.navOracleUrl || null,
        jurisdiction: form.jurisdiction,
        contracts: form.contracts,
        centrifugeChecklist: checklist,
        collateralMorpho: true
      })
    );
  }

  async function handleMigrateSharesToCoinbase() {
    if (!projectId) return;
    setMigratingShares(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/migrate-investor-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = (await response.json()) as {
        ok?: boolean;
        txHash?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        setError(data.detail ? `${data.error}: ${data.detail}` : (data.error ?? l.migrateSharesError));
        return;
      }

      setMessage(`${l.migrateSharesSuccess} ${data.txHash ?? ''}`.trim());
    } catch {
      setError(l.migrateSharesError);
    } finally {
      setMigratingShares(false);
    }
  }

  const centrifugeScore = useMemo(
    () => centrifugeReadinessScore(form.centrifugeChecklist),
    [form.centrifugeChecklist]
  );

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const wantsPublish = form.isActive;

    try {
      const clientIssues = erc4626FormValidationIssues(wantsPublish);
      if (clientIssues.length) {
        setError(formatLaunchIssues(clientIssues));
        return;
      }

      if (isErc4626Launch && tokenDeployReady === false) {
        setError(l.tokenDeployOptionalHint);
        return;
      }

      const payload = buildPayload();

      if (mode === 'create') {
        const response = await fetch('/api/admin/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = (await response.json()) as {
          asset?: AdminAssetRecord;
          error?: string;
          issues?: LaunchGateIssue[];
        };

        if (!response.ok) {
          if (data.issues?.length) {
            setError(formatLaunchIssues(data.issues));
          } else {
            setError(l.saveError);
          }
          return;
        }

        if (!data.asset) {
          setError(l.saveError);
          return;
        }

        if (isErc4626Launch) {
          setMessage(l.launchSavedOnChain);
        }

        router.push(`/dashboard/assets/${data.asset.id}/edit?created=1`);
        return;
      }

      if (!projectId) return;

      const patchBody: Record<string, unknown> = {
        ...payload,
        availableTokens: Number.parseInt(form.availableTokens, 10),
        deployToken: shouldEmitErc4626OnChain || (!isErc4626Launch && shouldAutoDeploy)
      };

      if (!isErc4626Launch) {
        patchBody.contractAddress = form.contractAddress || null;
        patchBody.contracts = {
          ...form.contracts,
          smartContract:
            form.contracts.smartContract ||
            (form.contractAddress ? buildSmartContractDocUrl(null, form.contractAddress) : null)
        };
      }

      const response = await fetch(`/api/admin/assets/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });

      const data = (await response.json()) as {
        asset?: AdminAssetRecord;
        deploy?: { status?: string; reason?: string };
        issues?: LaunchGateIssue[];
      };

      if (!response.ok) {
        if (data.issues?.length) {
          setError(formatLaunchIssues(data.issues));
        } else {
          setError(l.saveError);
        }
        if (data.asset) {
          setForm(assetToForm(data.asset));
          setTokenStatus(data.asset.tokenDeployStatus);
          setVaultFundingStatus(data.asset.vaultFundingStatus);
          setCollateralTargets(data.asset.collateralTargets);
        }
        return;
      }

      if (!data.asset) {
        setError(l.saveError);
        return;
      }

      setForm(assetToForm(data.asset));
      setTokenStatus(data.asset.tokenDeployStatus);
      setVaultFundingStatus(data.asset.vaultFundingStatus);
      setCollateralTargets(data.asset.collateralTargets);

      if (isErc4626Launch && isErc4626OnChainReady(data.asset)) {
        setMessage(l.launchSavedOnChain);
      } else if (data.deploy?.status === 'SKIPPED' && data.deploy.reason) {
        setMessage(
          data.deploy.reason.includes('TOKEN_DEPLOY_PRIVATE_KEY')
            ? l.tokenDeployOptionalHint
            : `${l.tokenSkipped}: ${data.deploy.reason}`
        );
      } else if (!isErc4626Launch && data.asset.contractAddress) {
        setMessage(l.saveSuccess);
      } else {
        setMessage(l.saveSuccess);
      }
    } catch {
      setError(l.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterCollateral() {
    if (!projectId) return;
    setRegisteringCollateral(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}/register-collateral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocols: selectedCollateral(form) })
      });

      const data = (await response.json()) as {
        outcomes?: Array<{ protocol: CollateralProtocol; target: CollateralTarget }>;
        updatedAsset?: AdminAssetRecord;
        error?: string;
      };

      if (!response.ok) {
        setError(l.collateralRegisterError);
        return;
      }

      if (data.updatedAsset) {
        setCollateralTargets(data.updatedAsset.collateralTargets);
        setDeploymentEvents(data.updatedAsset.deploymentEvents);
        setAutomationReadiness(data.updatedAsset.automationReadiness);
      }

      const submitted = data.outcomes?.filter((o) => o.target.status === 'SUBMITTED' || o.target.status === 'REGISTERED').length ?? 0;
      setMessage(submitted > 0 ? l.collateralRegisterSuccess : l.collateralRegisterPending);
    } catch {
      setError(l.collateralRegisterError);
    } finally {
      setRegisteringCollateral(false);
    }
  }

  async function handleRepairAutomation() {
    if (!projectId) return;
    setRepairingAutomation(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}/repair-automation`, { method: 'POST' });
      const data = (await response.json()) as { asset?: AdminAssetRecord; error?: string };

      if (!response.ok || !data.asset) {
        setError(data.error ?? 'No se pudo reparar la automatización.');
        return;
      }

      setForm(assetToForm(data.asset));
      setTokenStatus(data.asset.tokenDeployStatus);
      setCollateralTargets(data.asset.collateralTargets);
      setDeploymentEvents(data.asset.deploymentEvents);
      setAutomationReadiness(data.asset.automationReadiness);
      setMessage('Reparación automática ejecutada. Revisá el estado detallado debajo.');
    } catch {
      setError('No se pudo reparar la automatización.');
    } finally {
      setRepairingAutomation(false);
    }
  }

  async function handlePreflight() {
    if (!projectId) return;
    setRunningPreflight(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}/preflight`, { method: 'POST' });
      const data = (await response.json()) as {
        asset?: AdminAssetRecord;
        preflight?: { ok: boolean };
        error?: string;
      };

      if (!response.ok || !data.asset) {
        setError(data.error ?? 'No se pudo simular la emisión.');
        return;
      }

      setCollateralTargets(data.asset.collateralTargets);
      setDeploymentEvents(data.asset.deploymentEvents);
      setAutomationReadiness(data.asset.automationReadiness);
      setMessage(data.preflight?.ok ? 'Preflight OK: listo para automatizar.' : 'Preflight con alertas: revisá el historial.');
    } catch {
      setError('No se pudo simular la emisión.');
    } finally {
      setRunningPreflight(false);
    }
  }

  function collateralTargetFor(protocol: CollateralProtocol): CollateralTarget | undefined {
    return collateralTargets.find((t) => t.protocol === protocol);
  }

  function collateralStatusLabel(status?: string): string {
    if (!status) return '—';
    const labels = l.collateralStatuses as Record<string, string>;
    return labels[status] ?? status;
  }

  function readinessClass(status?: string): string {
    if (status === 'READY') return 'border-terminal-success/30 text-terminal-success';
    if (status === 'BLOCKED') return 'border-red-500/30 text-red-400';
    if (status === 'NOT_REQUIRED') return 'border-terminal-border text-terminal-muted';
    return 'border-terminal-warning/30 text-terminal-warning';
  }

  const morphoTarget = collateralTargetFor('MORPHO');
  const automationSteps = [
    {
      label: 'Token RWA',
      status: form.contractAddress ? tokenStatus ?? 'DEPLOYED' : 'PENDIENTE',
      detail: form.contractAddress || 'Se completa automáticamente al emitir.'
    },
    {
      label: 'Vault ERC-4626',
      status:
        form.vaultAddress ? 'DEPLOYED' : form.tokenStandard === 'ERC4626' ? 'PENDIENTE' : 'NO APLICA',
      detail: form.vaultAddress || 'Requerido para colateral DeFi.'
    },
    {
      label: 'Fondeo del vault',
      status:
        deploymentEvents.find((event) => event.step === 'VAULT_FUNDING')?.status ??
        (form.vaultAddress ? 'PENDIENTE' : 'NO APLICA'),
      detail:
        deploymentEvents.find((event) => event.step === 'VAULT_FUNDING')?.message ??
        'La plataforma verifica totalAssets() y shares luego del depósito.'
    },
    {
      label: 'Oracle Morpho',
      status: morphoTarget?.oracleAddress ? 'DEPLOYED' : form.collateralMorpho ? 'PENDIENTE' : 'NO SELECCIONADO',
      detail: morphoTarget?.oracleAddress || 'Se despliega automáticamente por vault.'
    },
    {
      label: 'Mercado Morpho',
      status: morphoTarget?.status ?? (form.collateralMorpho ? 'PENDIENTE' : 'NO SELECCIONADO'),
      detail: morphoTarget?.externalId || morphoTarget?.poolUrl || 'Se registra al reparar/guardar con Morpho seleccionado.'
    }
  ];

  async function handleDeployToken() {
    if (!projectId) return;
    setDeploying(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}/deploy-token`, { method: 'POST' });
      const data = (await response.json()) as {
        asset?: AdminAssetRecord;
        reason?: string;
        explorerUrl?: string;
        skipped?: boolean;
        collateral?: { outcomes?: Array<{ target: CollateralTarget }> };
      };

      if (data.asset) {
        setTokenStatus(data.asset.tokenDeployStatus);
        setCollateralTargets(data.asset.collateralTargets);
        setDeploymentEvents(data.asset.deploymentEvents);
        setAutomationReadiness(data.asset.automationReadiness);
        if (data.asset.contractAddress) {
          setForm((current) => ({
            ...current,
            contractAddress: data.asset!.contractAddress ?? '',
            vaultAddress: data.asset!.vaultAddress ?? ''
          }));
        }
      }

      if (data.skipped && data.reason) {
        if (
          data.reason.includes('TOKEN_DEPLOY_PRIVATE_KEY') ||
          data.reason.includes('PRIVATE_KEY')
        ) {
          setMessage(l.tokenDeployOptionalHint);
        } else if (data.reason.includes('THIRDWEB_SECRET_KEY')) {
          setMessage(l.tokenDeployThirdwebHint);
        } else {
          setMessage(`${l.tokenSkipped}: ${data.reason}`);
        }
      } else if (data.explorerUrl) {
        const vaultNote =
          data.asset?.vaultAddress && form.tokenStandard === 'ERC4626'
            ? ` | Vault: ${data.asset.vaultAddress}`
            : '';
        const collateralNote =
          data.collateral?.outcomes?.length ?
            ` | ${l.collateralAutoTriggered}`
          : '';
        setMessage(`${l.tokenDeployed} ${data.explorerUrl}${vaultNote}${collateralNote}`);
      } else {
        setMessage(l.tokenRequested);
      }
    } catch {
      setError(l.tokenDeployError);
    } finally {
      setDeploying(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text outline-none focus:border-terminal-primary';

  return (
    <AdminGate>
      <div className="mx-auto max-w-4xl space-y-8 pb-12">
        <Link
          href={isLending ? '/dashboard/loans' : '/dashboard/assets'}
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {isLending ? t.adminLoans.backToList : t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {isLending ? t.adminLoans.eyebrow : l.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">
            {isLending ? t.adminLoans.configureTitle : mode === 'create' ? l.createTitle : l.editTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">
            {isLending ? t.adminLoans.configureSubtitle : l.subtitleMarketplace ?? l.subtitle}
          </p>
          {isMarketplace && mode === 'edit' && projectId && form.tokenStandard === 'ERC4626' ? (
            <Link
              href={`/dashboard/loans/${projectId}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-terminal-primary hover:text-blue-400"
            >
              {t.adminAssets.configureLoan} →
            </Link>
          ) : null}
          {isLending && projectId ? (
            <Link
              href={`/dashboard/assets/${projectId}/edit`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-terminal-muted hover:text-terminal-primary"
            >
              ← {t.adminLoans.viewAssetCard}
            </Link>
          ) : null}
        </header>

        {loading ? (
          <p className="text-sm text-terminal-muted">{l.loading}</p>
        ) : (
          <form onSubmit={(event) => void handleSave(event)} className="space-y-8">
            {isMarketplace ? (
            <>
            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="text-lg font-semibold text-terminal-text">{l.sectionBasic}</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2 block text-sm">
                  <span className="text-terminal-muted">{l.fieldTitle}</span>
                  <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-terminal-muted">{l.fieldDescription}</span>
                  <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-terminal-muted">{l.fieldLocation}</span>
                  <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldLatitude}</span>
                  <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-34.6037" className={inputClass} />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldLongitude}</span>
                  <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-58.3816" className={inputClass} />
                </label>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-terminal-border">
                <iframe title="Map preview" src={mapPreview} className="h-48 w-full" loading="lazy" />
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-terminal-muted">
                <MapPin size={12} />
                {l.mapHint}
              </p>
            </section>

            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="text-lg font-semibold text-terminal-text">{l.sectionToken}</h2>

              <div className="mt-6">
                <p className="text-sm font-medium text-terminal-text">{l.fieldInstrumentType}</p>
                <p className="mt-1 text-xs text-terminal-muted">{l.instrumentTypeDesc}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(['DEBT', 'EQUITY'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => applyInstrumentDefaults(type)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        form.tokenInstrumentType === type ?
                          'border-terminal-primary bg-terminal-primary/10'
                        : 'border-terminal-border bg-terminal-bg hover:border-terminal-primary/40'
                      }`}
                    >
                      <p className="font-semibold text-terminal-text">
                        {type === 'DEBT' ? l.instrumentDebt : l.instrumentEquity}
                      </p>
                      <p className="mt-2 text-xs text-terminal-muted">
                        {type === 'DEBT' ? l.instrumentDebtDesc : l.instrumentEquityDesc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldTotalTokens}</span>
                  <input required type="number" min={1} value={form.totalTokens} onChange={(e) => setForm({ ...form, totalTokens: e.target.value, availableTokens: mode === 'create' ? e.target.value : form.availableTokens })} className={inputClass} />
                </label>
                {mode === 'edit' ? (
                  <label className="block text-sm">
                    <span className="text-terminal-muted">{l.fieldAvailableTokens}</span>
                    <input required type="number" min={0} value={form.availableTokens} onChange={(e) => setForm({ ...form, availableTokens: e.target.value })} className={inputClass} />
                  </label>
                ) : null}
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldPricePerToken}</span>
                  <input required type="number" min={0} step="0.01" value={form.pricePerToken} onChange={(e) => setForm({ ...form, pricePerToken: e.target.value })} className={inputClass} />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">
                    {form.tokenInstrumentType === 'DEBT' ? l.fieldFixedCoupon : l.fieldProjectedYield}
                  </span>
                  <input required type="number" min={0} step="0.1" value={form.targetYield} onChange={(e) => setForm({ ...form, targetYield: e.target.value })} className={inputClass} />
                  <p className="mt-1 text-xs text-terminal-muted">
                    {form.tokenInstrumentType === 'DEBT' ? l.fixedCouponHint : l.projectedYieldHint}
                  </p>
                </label>
                {form.tokenInstrumentType === 'DEBT' ? (
                  <label className="block text-sm">
                    <span className="text-terminal-muted">{l.fieldMaturityDate}</span>
                    <input
                      type="date"
                      value={form.maturityDate}
                      onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                ) : (
                  <label className="block text-sm">
                    <span className="text-terminal-muted">{l.fieldEquityShare}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.equitySharePercent}
                      onChange={(e) => setForm({ ...form, equitySharePercent: e.target.value })}
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-terminal-muted">{l.equityShareHint}</p>
                  </label>
                )}
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldTokenName}</span>
                  <input value={form.tokenName} onChange={(e) => setForm({ ...form, tokenName: e.target.value })} className={inputClass} />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldTokenSymbol}</span>
                  <input value={form.tokenSymbol} onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value.toUpperCase() })} placeholder="RWA" className={inputClass} />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-terminal-muted">{l.fieldTokenStandard}</span>
                  <select
                    value={form.tokenStandard}
                    onChange={(e) => {
                      const tokenStandard = e.target.value as TokenStandard;
                      setForm({
                        ...form,
                        tokenStandard,
                        collateralMorpho: tokenStandard === 'ERC4626' ? true : form.collateralMorpho
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="SANOVA_KYC">{l.tokenStandardSanova}</option>
                    <option value="ERC4626">{l.tokenStandardErc4626}</option>
                    <option value="THIRDWEB_DEMO">{l.tokenStandardThirdweb}</option>
                  </select>
                  <p className="mt-1 text-xs text-terminal-muted">
                    {form.tokenStandard === 'SANOVA_KYC' && l.tokenStandardSanovaDesc}
                    {form.tokenStandard === 'ERC4626' && l.tokenStandardErc4626Desc}
                    {form.tokenStandard === 'THIRDWEB_DEMO' && l.tokenStandardThirdwebDesc}
                  </p>
                </label>
              </div>
            </section>

            {isErc4626Launch ? (
              <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                <p className="text-sm font-medium text-terminal-text">{l.tokenDeployTitle}</p>
                <p className="mt-1 text-xs text-terminal-muted">{l.tokenDeployDesc}</p>
                <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2">
                  <p className="text-xs font-medium text-terminal-text">{l.treasurySharesTitle}</p>
                  <p className="mt-1 text-xs text-terminal-muted">{l.treasurySharesDesc}</p>
                  {mode === 'edit' && onChainLaunchReady ? (
                    <button
                      type="button"
                      disabled={migratingShares || !linkedInvestorWallet}
                      onClick={() => void handleMigrateSharesToCoinbase()}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 px-3 py-1.5 text-xs font-semibold text-terminal-primary hover:bg-terminal-primary/10 disabled:opacity-50"
                    >
                      {migratingShares ? <Loader2 size={14} className="animate-spin" /> : null}
                      {linkedInvestorWallet ? l.migrateSharesToCoinbase : l.issuerWalletMissing}
                    </button>
                  ) : null}
                  {linkedInvestorWallet ? (
                    <p className="mt-2 font-mono text-xs text-terminal-muted">
                      {l.coinbaseDestination}: {linkedInvestorWallet}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2">
                  <p className="text-xs font-medium text-terminal-text">{l.morphoRequiredTitle}</p>
                  <p className="mt-1 text-xs text-terminal-muted">{l.morphoRequiredDesc}</p>
                </div>
                {tokenDeployReady === false ? (
                  <p className="mt-2 text-xs text-amber-400/90">{l.tokenDeployOptionalHint}</p>
                ) : (
                  <p className="mt-2 text-xs text-terminal-success">
                    {onChainLaunchReady ? l.launchSavedOnChain : l.tokenDeployMandatoryHint}
                  </p>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-terminal-muted">{l.fieldContractAddress}</span>
                    <input value={form.contractAddress} readOnly placeholder={l.tokenDeployAutoPlaceholder} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span className="text-terminal-muted">{l.fieldVaultAddress}</span>
                    <input value={form.vaultAddress} readOnly placeholder={l.tokenDeployAutoPlaceholder} className={inputClass} />
                  </label>
                </div>
                {tokenStatus ? (
                  <p className="mt-2 text-xs text-terminal-muted">
                    {l.tokenStatus}: {tokenStatus} · Vault: {vaultFundingStatus}
                  </p>
                ) : null}
                {form.contracts.smartContract ? (
                  <a
                    href={form.contracts.smartContract}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block truncate text-xs text-terminal-primary"
                  >
                    {form.contracts.smartContract}
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="text-lg font-semibold text-terminal-text">{l.sectionMedia}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{l.mediaDesc}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-text hover:border-terminal-primary/40">
                  <ImagePlus size={16} />
                  {uploading ? l.uploading : l.uploadPhoto}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleImageUpload(e)} />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-text hover:border-terminal-primary/40">
                  <Video size={16} />
                  {uploading ? l.uploading : l.uploadVideo}
                  <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => void handleVideoUpload(e)} />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <input value={form.reelUrl} onChange={(e) => setForm({ ...form, reelUrl: e.target.value })} placeholder={l.reelPlaceholder} className={inputClass} />
                <button type="button" onClick={addReelUrl} className="shrink-0 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text">
                  {l.addReelUrl}
                </button>
              </div>
              {form.mediaGallery.length > 0 ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {form.mediaGallery.map((item, index) => (
                    <li key={`${item.url}-${index}`} className="overflow-hidden rounded-lg border border-terminal-border bg-terminal-bg">
                      {item.type === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.caption ?? item.url} className="h-32 w-full object-cover" />
                      ) : (
                        <video src={item.url} controls className="h-32 w-full object-cover" />
                      )}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-terminal-muted">
                        <span className="truncate">{item.type}: {item.caption ?? item.url}</span>
                        <button type="button" onClick={() => removeMedia(index)} className="shrink-0 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-terminal-muted">{l.mediaEmpty}</p>
              )}
            </section>

            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-terminal-text">
                <FileText size={18} />
                {l.sectionContracts}
              </h2>
              <p className="mt-1 text-sm text-terminal-muted">{l.contractsDesc}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {(['trust', 'purchase', 'lease', 'smartContract'] as const).map((key) => (
                  <div key={key} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                    <p className="text-sm font-medium text-terminal-text">{l.contractLabels[key]}</p>
                    {form.contracts[key] ? (
                      <a href={form.contracts[key]} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-xs text-terminal-primary">
                        {form.contracts[key]}
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-terminal-muted">{l.noFile}</p>
                    )}
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-terminal-primary">
                      {l.uploadPdf}
                      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void handleContractUpload(key, e)} />
                    </label>
                  </div>
                ))}
              </div>
            </section>
            </>
            ) : null}

            {isLending && mode === 'edit' ? (
              <>
                <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                  <h2 className="text-lg font-semibold text-terminal-text">{form.title}</h2>
                  <p className="mt-1 text-sm text-terminal-muted">{form.tokenSymbol} · {form.tokenStandard}</p>
                </section>

                <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                  <p className="text-sm font-medium text-terminal-text">{l.tokenDeployTitle}</p>
                  <p className="mt-1 text-xs text-terminal-muted">{l.tokenDeployDesc}</p>
                  {tokenDeployReady === false ? (
                    <p className="mt-2 text-xs text-amber-400/90">{l.tokenDeployOptionalHint}</p>
                  ) : (
                    <p className="mt-2 text-xs text-terminal-success">
                      {onChainLaunchReady ? l.launchSavedOnChain : l.tokenDeployMandatoryHint}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="block min-w-[16rem] flex-1 text-sm">
                      <span className="text-terminal-muted">{l.fieldContractAddress}</span>
                      <input
                        value={form.contractAddress}
                        readOnly
                        placeholder={l.tokenDeployAutoPlaceholder}
                        className={inputClass}
                      />
                    </label>
                    {form.tokenStandard === 'ERC4626' ? (
                      <label className="block min-w-[16rem] flex-1 text-sm">
                        <span className="text-terminal-muted">{l.fieldVaultAddress}</span>
                        <input value={form.vaultAddress} readOnly placeholder="0x…" className={inputClass} />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      disabled={deploying}
                      onClick={() => void handleDeployToken()}
                      className="inline-flex items-center gap-2 self-end rounded-lg border border-terminal-primary/40 bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/10 disabled:opacity-50"
                    >
                      {deploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                      {l.deployToken}
                    </button>
                    <button
                      type="button"
                      disabled={runningPreflight}
                      onClick={() => void handlePreflight()}
                      className="inline-flex items-center gap-2 self-end rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text hover:border-terminal-primary/40 disabled:opacity-50"
                    >
                      {runningPreflight ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                      Simular emisión
                    </button>
                    <button
                      type="button"
                      disabled={repairingAutomation}
                      onClick={() => void handleRepairAutomation()}
                      className="inline-flex items-center gap-2 self-end rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-text hover:border-terminal-primary/40 disabled:opacity-50"
                    >
                      {repairingAutomation ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                      Reparar automatización
                    </button>
                  </div>
                  {tokenStatus ? (
                    <p className="mt-2 text-xs text-terminal-muted">
                      {l.tokenStatus}: {tokenStatus}
                    </p>
                  ) : null}
                  <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-card/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted">
                      Preflight on-chain
                    </p>
                    <div className="mt-2 grid gap-2 text-xs text-terminal-muted sm:grid-cols-2">
                      <span>Chain: {tokenDeployHealth?.chainId ?? '—'}</span>
                      <span>Gas: {tokenDeployHealth?.hasGas ? 'OK' : 'Pendiente'}</span>
                      <span className="sm:col-span-2 break-all">
                        Wallet: {tokenDeployHealth?.deployerAddress ?? 'No configurada'}
                      </span>
                      {tokenDeployHealth?.gasCheckError ? (
                        <span className="sm:col-span-2 text-red-400">{tokenDeployHealth.gasCheckError}</span>
                      ) : null}
                    </div>
                  </div>
                  {automationReadiness ? (
                    <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-card/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted">
                            100% listo para colateral
                          </p>
                          <p className="mt-1 text-sm text-terminal-text">
                            Score operativo: {automationReadiness.score}% · {automationReadiness.status}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${readinessClass(automationReadiness.status)}`}>
                          {automationReadiness.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {automationReadiness.items.map((entry) => (
                          <div key={entry.key} className="rounded-lg border border-terminal-border bg-terminal-bg/70 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-terminal-text">{entry.label}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${readinessClass(entry.status)}`}>
                                {entry.status}
                              </span>
                            </div>
                            <p className="mt-1 break-all text-[11px] text-terminal-muted">{entry.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-2">
                    {automationSteps.map((step) => (
                      <div key={step.label} className="rounded-lg border border-terminal-border bg-terminal-card/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-terminal-text">{step.label}</p>
                          <span className="rounded-full border border-terminal-border px-2 py-1 text-[11px] uppercase tracking-wide text-terminal-muted">
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-xs text-terminal-muted">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                  {deploymentEvents.length ? (
                    <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-card/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted">
                        Historial automático
                      </p>
                      <ul className="mt-2 space-y-2">
                        {deploymentEvents.slice(0, 8).map((event) => (
                          <li key={event.id} className="text-xs text-terminal-muted">
                            <span className="font-semibold text-terminal-text">{event.step}</span> · {event.status} · {event.message}
                            {event.txHash ? <span className="block break-all">tx: {event.txHash}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>

            <details className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <summary className="cursor-pointer list-none text-lg font-semibold text-terminal-text [&::-webkit-details-marker]:hidden">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {l.sectionCentrifuge}
                  <span className="rounded-full border border-terminal-border px-2 py-0.5 text-xs font-medium text-terminal-muted">
                    {l.optionalBadge}
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-terminal-muted">{l.centrifugeDesc}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldSpvEntity}</span>
                  <input value={form.spvEntityName} onChange={(e) => setForm({ ...form, spvEntityName: e.target.value })} placeholder="SPV Sanova …" className={inputClass} />
                </label>
                <label className="block text-sm">
                  <span className="text-terminal-muted">{l.fieldNavOracle}</span>
                  <input value={form.navOracleUrl} onChange={(e) => setForm({ ...form, navOracleUrl: e.target.value })} placeholder="https://…" className={inputClass} />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3">
                <span className="text-sm text-terminal-text">{l.centrifugeReadiness}</span>
                <span className="text-sm font-semibold text-terminal-primary">{centrifugeScore}%</span>
              </div>
              <ul className="mt-4 space-y-2">
                {(Object.keys(l.centrifugeChecklist) as Array<keyof CentrifugeChecklist>).map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-terminal-text">
                    <input
                      type="checkbox"
                      checked={form.centrifugeChecklist[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          centrifugeChecklist: { ...form.centrifugeChecklist, [key]: e.target.checked }
                        })
                      }
                    />
                    {l.centrifugeChecklist[key]}
                  </label>
                ))}
              </ul>
            </details>

            <details className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <summary className="cursor-pointer list-none text-lg font-semibold text-terminal-text [&::-webkit-details-marker]:hidden">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {l.sectionCollateral}
                  <span className="rounded-full border border-terminal-border px-2 py-0.5 text-xs font-medium text-terminal-muted">
                    {l.optionalBadge}
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-terminal-muted">{l.collateralDesc}</p>
              <div className="mt-4 space-y-3">
                {COLLATERAL_FORM_KEYS.map(({ key, protocol, label }) => {
                  const target = collateralTargetFor(protocol);
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2"
                    >
                      <label className="flex items-center gap-2 text-sm text-terminal-text">
                        <input
                          type="checkbox"
                          checked={isErc4626Launch && protocol === 'MORPHO' ? true : Boolean(form[key])}
                          disabled={isErc4626Launch && protocol === 'MORPHO'}
                          onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        />
                        <span className="font-medium">{label}</span>
                        {mode === 'edit' && target ? (
                          <span className="ml-auto text-xs text-terminal-muted">
                            {target.readinessScore ?? 0}% · {collateralStatusLabel(target.status)}
                          </span>
                        ) : null}
                      </label>
                      {mode === 'edit' && target?.missingRequirements?.length ? (
                        <p className="mt-1 pl-6 text-xs text-terminal-warning">
                          {l.collateralMissing}: {target.missingRequirements.join(', ')}
                        </p>
                      ) : null}
                      {mode === 'edit' && target?.notes ? (
                        <p className="mt-1 pl-6 text-xs text-terminal-muted">{target.notes}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {mode === 'edit' && selectedCollateral(form).length > 0 ? (
                <button
                  type="button"
                  disabled={registeringCollateral}
                  onClick={() => void handleRegisterCollateral()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/10 disabled:opacity-50"
                >
                  {registeringCollateral ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  {l.registerCollateral}
                </button>
              ) : null}
              <p className="mt-4 rounded-lg border border-dashed border-terminal-border px-3 py-2 text-xs text-terminal-muted">
                {l.collateralNote}
              </p>
            </details>
              </>
            ) : null}

            {isMarketplace && isErc4626Launch ? (
              <p className="rounded-lg border border-dashed border-terminal-border px-4 py-3 text-xs text-terminal-muted">
                {onChainLaunchReady
                  ? l.launchSavedOnChain
                  : tokenDeployReady === false
                    ? l.tokenDeployOptionalHint
                    : l.tokenDeployMandatoryHint}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              {isMarketplace ? (
              <label className="flex items-center gap-2 text-sm text-terminal-text">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                {l.publishOnSave}
              </label>
              ) : null}
              <button
                type="submit"
                disabled={
                  saving ||
                  uploading ||
                  (isErc4626Launch &&
                    (tokenDeployReady === false || erc4626FormValidationIssues(form.isActive).length > 0))
                }
                className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? (shouldEmitErc4626OnChain ? l.emittingOnChain : l.saving) : l.save}
              </button>
            </div>

            {message ? <p className="text-sm text-terminal-success">{message}</p> : null}
            {error ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                {error}
              </pre>
            ) : null}
          </form>
        )}
      </div>
    </AdminGate>
  );
}
