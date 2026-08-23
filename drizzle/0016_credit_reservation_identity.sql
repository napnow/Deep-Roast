ALTER TABLE "credit_transactions" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transactions_reservation_id_unique" ON "credit_transactions" USING btree ("reservation_id");
