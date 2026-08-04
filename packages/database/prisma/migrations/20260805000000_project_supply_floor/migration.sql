-- Supply accounting is enforced in the application with a conditional
-- decrement, which is correct and atomic. This is the floor underneath it: a
-- future unconditional decrement, a manual edit or a bad script cannot sell
-- tokens that do not exist, because the database refuses to record it.
--
-- NOT VALID skips the check against existing rows, so the migration cannot fail
-- on a project whose accounting already drifted. New writes are validated from
-- this point on, and the constraint can be validated later once any drift is
-- reconciled:
--   ALTER TABLE "Project" VALIDATE CONSTRAINT "Project_availableTokens_range";

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_availableTokens_range"
  CHECK ("availableTokens" >= 0 AND "availableTokens" <= "totalTokens")
  NOT VALID;
