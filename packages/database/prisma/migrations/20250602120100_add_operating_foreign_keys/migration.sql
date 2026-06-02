-- Operating ledger foreign keys (present in schema, missing in production DB).

-- AddForeignKey
ALTER TABLE "ProjectOperatingAccount" ADD CONSTRAINT "ProjectOperatingAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOperatingLedgerEntry" ADD CONSTRAINT "ProjectOperatingLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ProjectOperatingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOperatingLedgerEntry" ADD CONSTRAINT "ProjectOperatingLedgerEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProjectYieldBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectYieldBatch" ADD CONSTRAINT "ProjectYieldBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
