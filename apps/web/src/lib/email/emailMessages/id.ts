import type { EmailMessagesPatch } from './types';

export const id: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Tim Sanova Global'
  },
  activation: {
    subject: 'Aktifkan akun Anda — Sanova Global',
    intro: 'Terima kasih telah mendaftar di Sanova Global.',
    cta: 'Aktifkan akun Anda',
    expiry: 'Tautan ini akan kedaluwarsa dalam 24 jam. Jika Anda tidak membuat akun ini, Anda dapat mengabaikan pesan ini.'
  },
  verificationCode: {
    subject: 'Kode verifikasi Sanova Global Anda',
    label: 'Kode verifikasi Sanova Anda adalah:',
    expiry: 'Kode ini akan kedaluwarsa dalam 10 menit.',
    ignore: 'Jika Anda tidak meminta akses ini, Anda dapat mengabaikan pesan ini dengan aman.'
  },
  passwordReset: {
    subject: 'Atur ulang kata sandi Anda — Sanova Global',
    intro: 'Kami menerima permintaan untuk mengatur ulang kata sandi akun Sanova Anda.',
    cta: 'Atur ulang kata sandi',
    expiry: 'Tautan ini akan kedaluwarsa dalam 1 jam. Jika Anda tidak meminta perubahan ini, Anda dapat mengabaikan pesan ini.'
  },
  accountApproved: {
    subject: 'Akun Sanova Capital Anda telah disetujui!',
    greeting: 'Halo {name},',
    approvedLine: 'Verifikasi identitas (KYC) Anda telah berhasil disetujui dan akun Anda sudah siap.',
    accessLine: 'Anda sekarang dapat mengakses platform dan mulai berinvestasi di marketplace Sanova Capital.',
    cta: 'Buka platform',
    closing: 'Salam hangat,'
  },
  purchaseConfirmation: {
    subject: 'Konfirmasi investasi: {project}',
    greeting: 'Halo {name},',
    receivedLine: 'Kami telah menerima investasi Anda sebesar USD {amount} pada proyek "{project}".',
    confirmedLine: 'Kami telah mengonfirmasi investasi Anda di platform.',
    projectLabel: 'Proyek:',
    amountLabel: 'Jumlah yang diinvestasikan:',
    trackingLine: 'Anda dapat melacak aset dan imbal hasil Anda dari dasbor akun Anda.',
    thanks: 'Terima kasih telah mempercayai Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'KYC klien disetujui: {clientName}',
    body: 'Klien Anda {clientName} ({clientEmail}) telah menyelesaikan KYC dan disetujui. Mereka sekarang dapat bertransaksi di marketplace.'
  },
  advisorClientPurchase: {
    subject: 'Pembelian dari klien Anda: {clientName}',
    body: '{clientName} ({clientEmail}) membeli token di "{project}" senilai USD {amount}. Komisi akan bertambah sesuai kebijakan yang berlaku.'
  },
  invite: {
    investorSubject: 'Undangan Sanova Global — Investor',
    teamSubject: 'Undangan Sanova Global — {roleLabel}',
    greeting: 'Halo{name},',
    investorBody: 'Anda diundang untuk berinvestasi pada aset tokenisasi Sanova Global. Untuk menerima undangan dan memulai verifikasi KYC Anda, buka tautan ini:',
    teamBody: 'Anda diundang untuk bergabung dengan Sanova Global sebagai {roleLabel}. Untuk menerima undangan dan melanjutkan verifikasi KYC, buka tautan ini:',
    reminderPrefix: 'Pengingat: ',
    cta: 'Terima undangan',
    expiry: 'Tautan ini akan kedaluwarsa dalam 7 hari.',
    ignore: 'Jika Anda tidak mengharapkan email ini, Anda dapat mengabaikannya.',
    roleAdvisor: 'Penasihat',
    roleAdvisorManager: 'Manajer'
  }
};
